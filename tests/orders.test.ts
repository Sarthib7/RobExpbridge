import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Orders } from '../src/economics/orders.js';
import type { ChainGateway, PaymentIntent, PaymentVerification } from '../src/economics/chain.js';
import { Store } from '../src/memory/store.js';
import { seal } from '../src/memory/integrity.js';
import { demoExperience } from '../src/sim/experience.js';
import { fixture } from '../src/sim/assembly.js';

// Explicit test fake: no keys, signing, network calls, or chain receipts.
class FakeChain implements ChainGateway {
  buyerAddress = '0x' + '11'.repeat(20);
  sellerAddress = '0x' + '22'.repeat(20);
  mode = 'local' as const;
  chainId = 31337;
  rpcUrl = 'http://127.0.0.1:8545';
  explorerUrl = '';
  currency = 'ETH';
  amountAtomic = '1000000000000000'; price = '0.001'; maxFee = '0.01';
  transactionUrl(_hash: string) { return ''; }
  prepared: PaymentIntent[] = [];
  broadcasts: string[] = [];
  verifications: { intent: PaymentIntent; hash: string }[] = [];
  evidence: PaymentVerification = { state: 'pending', reason: 'Fake evidence awaits finality.' };
  broadcastFails = false;
  verifyFails = false;
  async balances() { return { buyer: '1', seller: '0' }; }
  async prepare(intent: PaymentIntent) {
    this.prepared.push(structuredClone(intent));
    return { rawTransaction: 'fake-signed-payment-' + this.prepared.length, transactionHash: '0x' + 'ab'.repeat(32) };
  }
  async broadcast(raw: string) {
    this.broadcasts.push(raw);
    if (this.broadcastFails) throw new Error('Fake uncertain broadcast.');
  }
  async verify(intent: PaymentIntent, hash: string) {
    this.verifications.push({ intent, hash });
    if (this.verifyFails) throw new Error('Fake RPC unavailable.');
    return this.evidence;
  }
  close() {}
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'eb-orders-test-'));
  const recordPath = join(dir, 'records.json');
  const orderPath = join(dir, 'orders.json');
  const store = new Store(recordPath);
  await store.publish(demoExperience());
  const chain = new FakeChain();
  const orders = new Orders(orderPath, store, chain);
  const request = { experienceId: 'exp-001', context: fixture, idempotencyKey: randomUUID() };
  return { store, chain, orders, request, orderPath, recordPath };
}

test('quoted order requires finality before advisory access and verifies again at access', async () => {
  const { orders, chain, request } = await setup();
  const { order, token } = await orders.create(request);
  assert.equal(order.state, 'quoted');
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_REQUIRED' });
  assert.equal((await orders.pay(order.id, token)).order.state, 'pending');
  assert.equal((await orders.verify(order.id, token)).order.state, 'pending');
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_REQUIRED' });
  chain.evidence = { state: 'confirmed', reason: 'Fake finalized evidence.', blockNumber: 10 };
  assert.equal((await orders.verify(order.id, token)).order.state, 'confirmed');
  const unlocked = await orders.unlock(order.id, token);
  assert.deepEqual(unlocked.record.advisory, demoExperience().advisory);
  assert.deepEqual(unlocked.context, fixture);
  assert.equal(chain.verifications.length, 3);
  assert.equal(chain.prepared.length, 1);
  assert.equal(chain.prepared[0].amountAtomic, '1000000000000000');
  assert.equal(Buffer.from(chain.prepared[0].data.slice(2), 'hex').toString(), 'experiencebridge:' + order.id + ':' + order.recordDigest);
});

test('invalid bearer tokens cannot read, pay, verify, or unlock an order', async () => {
  const { orders, chain, request } = await setup();
  const { order } = await orders.create(request);
  for (const token of ['', 'invalid', '0'.repeat(64)]) {
    for (const operation of ['get', 'pay', 'verify', 'unlock'] as const) {
      await assert.rejects(orders[operation](order.id, token), { code: 'ORDER_UNAUTHORIZED' });
    }
  }
  assert.equal(chain.prepared.length, 0);
  assert.equal(chain.verifications.length, 0);
});

test('incompatible quote fails before payment preparation', async () => {
  const { orders, chain, request } = await setup();
  await assert.rejects(orders.create({ ...request, context: { ...fixture, gripper: 'vacuum-v2' } }), { code: 'INCOMPATIBLE' });
  assert.equal(chain.prepared.length, 0);
});

test('expired quote fails before signing without waiting for a clock', async () => {
  const { orders, chain, request, orderPath } = await setup();
  const { order, token } = await orders.create(request);
  const saved = JSON.parse(await readFile(orderPath, 'utf8'));
  saved[0].expiresAt = '2000-01-01T00:00:00.000Z';
  await writeFile(orderPath, JSON.stringify(saved));
  await assert.rejects(orders.pay(order.id, token), { code: 'QUOTE_EXPIRED' });
  assert.equal(chain.prepared.length, 0);
});

test('idempotency returns the same quote and rejects key reuse for a different request', async () => {
  const { orders, request } = await setup();
  const first = await orders.create(request);
  assert.deepEqual(await orders.create(request), first);
  await assert.rejects(orders.create({ ...request, experienceId: 'exp-002' }), { code: 'IDEMPOTENCY_CONFLICT' });
  await assert.rejects(orders.create({ ...request, context: { ...fixture, gripper: 'vacuum-v2' } }), { code: 'IDEMPOTENCY_CONFLICT' });
});

test('concurrent payment attempts prepare once and broadcast identical saved bytes', async () => {
  const { orders, chain, request } = await setup();
  const { order, token } = await orders.create(request);
  const results = await Promise.all([orders.pay(order.id, token), orders.pay(order.id, token)]);
  assert.ok(results.every(result => result.order.state === 'pending'));
  assert.equal(chain.prepared.length, 1);
  assert.deepEqual(chain.broadcasts, ['fake-signed-payment-1', 'fake-signed-payment-1']);
});

test('unknown broadcast remains pending and restart retries the same saved payment', async () => {
  const { orders, chain, request, store, orderPath } = await setup();
  const { order, token } = await orders.create(request);
  chain.broadcastFails = true;
  const pending = await orders.pay(order.id, token);
  assert.equal(pending.order.state, 'pending');
  assert.match(pending.order.reason, /unknown/i);
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_REQUIRED' });
  const restartedChain = new FakeChain();
  const restarted = new Orders(orderPath, store, restartedChain);
  assert.equal((await restarted.pay(order.id, token)).order.transactionHash, pending.order.transactionHash);
  assert.equal(restartedChain.prepared.length, 0);
  assert.deepEqual(restartedChain.broadcasts, chain.broadcasts);
});

test('any pending payment prevents preparing a second order until resolved', async () => {
  for (const broadcastFails of [false, true]) {
    const { orders, chain, request } = await setup();
    const first = await orders.create(request);
    const second = await orders.create({ ...request, idempotencyKey: randomUUID() });
    chain.broadcastFails = broadcastFails;
    await orders.pay(first.order.id, first.token);
    await assert.rejects(orders.pay(second.order.id, second.token), { code: 'PAYMENT_PENDING' });
    assert.equal(chain.prepared.length, 1);
    chain.evidence = { state: 'confirmed', reason: 'Fake finalized evidence.' };
    await orders.verify(first.order.id, first.token);
    await orders.pay(second.order.id, second.token);
    assert.equal(chain.prepared.length, 2);
  }
});

test('changed or revoked experience blocks payment after quote and access after confirmation', async () => {
  for (const change of [{ revoked: true }, { contributor: { organization: 'changed-synthetic-factory', machineId: 'synthetic-arm-a' } }]) {
    const { orders, chain, request, recordPath } = await setup();
    const { order, token } = await orders.create(request);
    await writeFile(recordPath, JSON.stringify([seal({ ...demoExperience(), ...change })]));
    await assert.rejects(orders.pay(order.id, token), { code: 'EXPERIENCE_CHANGED' });
    assert.equal(chain.prepared.length, 0);
    await writeFile(recordPath, JSON.stringify([seal(demoExperience())]));
    await orders.pay(order.id, token);
    chain.evidence = { state: 'confirmed', reason: 'Fake finalized evidence.' };
    await orders.verify(order.id, token);
    await writeFile(recordPath, JSON.stringify([seal({ ...demoExperience(), ...change })]));
    await assert.rejects(orders.unlock(order.id, token), { code: 'EXPERIENCE_CHANGED' });
  }
});

test('rejected evidence and verification outages never unlock an advisory', async () => {
  const { orders, chain, request } = await setup();
  const { order, token } = await orders.create(request);
  await orders.pay(order.id, token);
  chain.verifyFails = true;
  await assert.rejects(orders.verify(order.id, token), /Fake RPC unavailable/);
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_REQUIRED' });
  chain.verifyFails = false;
  chain.evidence = { state: 'confirmed', reason: 'Fake finalized evidence.' };
  await orders.verify(order.id, token);
  chain.verifyFails = true;
  await assert.rejects(orders.unlock(order.id, token), /Fake RPC unavailable/);
  chain.verifyFails = false;
  chain.evidence = { state: 'pending', reason: 'Fake finality unavailable.' };
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_NOT_FINAL' });
  chain.evidence = { state: 'rejected', reason: 'Fake mismatched transfer.' };
  assert.equal((await orders.verify(order.id, token)).order.state, 'rejected');
  await assert.rejects(orders.unlock(order.id, token), { code: 'PAYMENT_REQUIRED' });
});

test('V6 legacy amountWei orders load without changing signed bytes or their original memo', async () => {
  const { orders, chain, request, orderPath, store } = await setup();
  const { order, token } = await orders.create(request);
  await orders.pay(order.id, token);
  const saved = JSON.parse(await readFile(orderPath, 'utf8'));
  saved[0].amountWei = saved[0].amountAtomic;
  delete saved[0].amountAtomic;
  saved[0].data = '0x' + Buffer.from('experiencebridge:' + order.id).toString('hex');
  await writeFile(orderPath, JSON.stringify(saved));
  const diskBefore = await readFile(orderPath, 'utf8');
  const restored = new Orders(orderPath, store, chain);
  assert.equal((await restored.get(order.id, token)).order.data, saved[0].data);
  assert.equal(await readFile(orderPath, 'utf8'), diskBefore, 'Reading legacy data must not rewrite it.');
  await restored.pay(order.id, token);
  assert.equal(chain.prepared.length, 1, 'Legacy signed payments must never be re-signed.');
  assert.deepEqual(chain.broadcasts, ['fake-signed-payment-1', 'fake-signed-payment-1']);
  chain.evidence = { state: 'confirmed', reason: 'Fake finalized evidence.' };
  await restored.verify(order.id, token);
  assert.equal(chain.verifications[0].intent.amountAtomic, '1000000000000000');
  assert.equal(chain.verifications[0].intent.data, saved[0].data);
});

test('V6 new orders bind UUID and record digest with the selected network atomic amount', async () => {
  const { store, orderPath, request } = await setup();
  const chain = new FakeChain();
  const solanaFake: ChainGateway = {
    buyerAddress: 'fake-solana-buyer', sellerAddress: 'fake-solana-seller', mode: 'solana-devnet',
    chainId: 'fake-solana-genesis', rpcUrl: 'https://mock.invalid', explorerUrl: '', currency: 'SOL',
    amountAtomic: '1000000', price: '0.001', maxFee: '0.0001', transactionUrl: () => '',
    balances: chain.balances.bind(chain), prepare: chain.prepare.bind(chain), broadcast: chain.broadcast.bind(chain),
    verify: chain.verify.bind(chain), close: () => {},
  };
  const orders = new Orders(orderPath, store, solanaFake);
  const { order, token } = await orders.create(request);
  const digest = (await store.all())[0].integrity.sha256;
  assert.equal(order.recordDigest, digest);
  assert.equal(order.currency, 'SOL');
  assert.equal(order.price, '0.001');
  await orders.pay(order.id, token);
  assert.equal(chain.prepared[0].amountAtomic, '1000000');
  assert.equal(Buffer.from(chain.prepared[0].data.slice(2), 'hex').toString('utf8'), `experiencebridge:${order.id}:${digest}`);
});

test('V6 stored amounts for another network fail closed before signing or verification', async () => {
  for (const legacy of [false, true]) {
    const { orders, chain, request, orderPath } = await setup();
    const { order, token } = await orders.create(request);
    const saved = JSON.parse(await readFile(orderPath, 'utf8'));
    if (legacy) { delete saved[0].amountAtomic; saved[0].amountWei = '1000000'; }
    else saved[0].amountAtomic = '1000000';
    await writeFile(orderPath, JSON.stringify(saved));
    for (const method of ['get', 'pay', 'verify', 'unlock'] as const) {
      await assert.rejects(orders[method](order.id, token), { code: 'ORDER_STORE_UNAVAILABLE' });
    }
    assert.equal(chain.prepared.length, 0);
    assert.equal(chain.verifications.length, 0);
    assert.equal(chain.broadcasts.length, 0);
  }
});
