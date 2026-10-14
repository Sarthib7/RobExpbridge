import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { JsonRpcProvider, Wallet } from 'ethers';
import { checkPaymentEvidence, createGateway } from '../src/economics/chain.js';

const buyer = '0x1111111111111111111111111111111111111111';
const seller = '0x2222222222222222222222222222222222222222';
const hash = `0x${'ab'.repeat(32)}`;
const blockHash = `0x${'cd'.repeat(32)}`;
const intent = { buyer, seller, amountAtomic: '1000000000000000', data: '0x616263' };
const tx = { hash, from: buyer, to: seller, value: '0x38d7ea4c68000', input: intent.data, chainId: '0x2706', blockHash, blockNumber: '0xa' };
const receipt = { transactionHash: hash, from: buyer, to: seller, status: '0x1', blockHash, blockNumber: '0xa' };
const block = { hash: blockHash, number: '0xa' };
const verify = (changes: Partial<typeof tx> = {}) => checkPaymentEvidence(intent, hash, 9990, { ...tx, ...changes }, receipt, block, block);

test('exact payment in canonical finalized block confirms', () => {
  assert.equal(verify().state, 'confirmed');
  assert.equal(verify().blockNumber, 10);
});

test('each bound payment field must match', () => {
  for (const change of [{ from: seller }, { to: buyer }, { value: '0x1' }, { input: '0xff' }, { chainId: '0x1' }, { hash: blockHash }]) {
    assert.equal(verify(change).state, 'rejected');
  }
});

test('missing transaction or receipt stays pending', () => {
  assert.equal(checkPaymentEvidence(intent, hash, 9990, null, null, null, null).state, 'pending');
  assert.equal(checkPaymentEvidence(intent, hash, 9990, tx, null, null, null).state, 'pending');
});

test('receipt mismatch or revert rejects', () => {
  for (const change of [{ status: '0x0' }, { transactionHash: blockHash }, { from: seller }, { to: buyer }]) {
    assert.equal(checkPaymentEvidence(intent, hash, 9990, tx, { ...receipt, ...change }, block, block).state, 'rejected');
  }
});

test('unfinalized and orphaned inclusion cannot unlock', () => {
  assert.equal(checkPaymentEvidence(intent, hash, 9990, tx, receipt, block, { ...block, number: '0x9' }).state, 'pending');
  assert.equal(checkPaymentEvidence(intent, hash, 9990, tx, receipt, { ...block, hash }, block).state, 'pending');
  assert.equal(checkPaymentEvidence(intent, hash, 9990, tx, receipt, block, null).state, 'pending');
  assert.equal(verify({ blockHash: hash }).state, 'pending');
  assert.equal(verify({ blockNumber: '0xb' }).state, 'pending');
});

test('malformed numerical evidence fails closed', () => {
  assert.equal(verify({ value: 'bad' }).state, 'rejected');
});

// Ephemeral test signer stays in memory and never sends a transaction.
const fixtureKey = Wallet.createRandom().privateKey;
test('gateway rejects unsafe network configuration', () => {
  assert.throws(() => createGateway('local', 'https://example.com', fixtureKey, seller), /loopback/);
  assert.throws(() => createGateway('agung', 'http://127.0.0.1:8545', fixtureKey, seller), /HTTPS/);
});

test('live chain mismatch prevents any signing or broadcast RPC', async () => {
  const methods: string[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    methods.push(message.method);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: '0x1' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const gateway = createGateway('local', `http://127.0.0.1:${address.port}`, fixtureKey, seller);
  try {
    await assert.rejects(gateway.prepare({ ...intent, buyer: gateway.buyerAddress }), /Payment RPC operation failed/);
    assert.deepEqual(methods, ['eth_chainId']);
  } finally {
    gateway.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test('insufficient funds prevents signing', async (t) => {
  t.mock.method(JsonRpcProvider.prototype, 'send', async () => '0x7a69');
  t.mock.method(JsonRpcProvider.prototype, 'getBalance', async () => 0n);
  t.mock.method(Wallet.prototype, 'populateTransaction', async () => ({ gasLimit: 22000n, gasPrice: 1000000000n }));
  const signing = t.mock.method(Wallet.prototype, 'signTransaction', async () => { throw new Error('Must not sign'); });
  const gateway = createGateway('local', 'http://127.0.0.1:8545', fixtureKey, seller);
  try {
    await assert.rejects(gateway.prepare({ ...intent, buyer: gateway.buyerAddress }), /Payment RPC operation failed/);
    assert.equal(signing.mock.callCount(), 0);
  } finally { gateway.close(); }
});
