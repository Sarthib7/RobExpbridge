import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKeyPairSignerFromPrivateKeyBytes, getSignatureFromTransaction, getTransactionDecoder } from '@solana/kit';
import { createSolanaGateway, SOLANA_DEVNET_GENESIS } from '../src/economics/solana.js';
import { loadSolanaWallets } from '../src/economics/solana-wallets.js';

async function fixture() {
  const seed = randomBytes(32);
  const buyer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const seller = await createKeyPairSignerFromPrivateKeyBytes(randomBytes(32));
  const calls: { method: string; params: any[] }[] = [];
  const state = { genesis: SOLANA_DEVNET_GENESIS, balance: 1_000_000_000, fee: 5000, simulationError: null as unknown, transaction: null as any, rpcError: false };
  const gateway = await createSolanaGateway('https://mock.invalid', seed, seller.address, async (_url, init) => {
    const body = JSON.parse(String(init.body)); calls.push(body);
    let result: unknown;
    switch (body.method) {
      case 'getGenesisHash': result = state.genesis; break;
      case 'getBalance': result = { value: state.balance }; break;
      case 'getLatestBlockhash': result = { value: { blockhash: buyer.address, lastValidBlockHeight: 1000 } }; break;
      case 'getFeeForMessage': result = { value: state.fee }; break;
      case 'simulateTransaction': result = { value: { err: state.simulationError } }; break;
      case 'sendTransaction': result = getSignatureFromTransaction(getTransactionDecoder().decode(Buffer.from(body.params[0], 'base64'))); break;
      case 'getTransaction': result = state.transaction; break;
      default: throw new Error('Unexpected mock RPC method.');
    }
    return new Response(JSON.stringify(state.rpcError ? { error: { message: 'sensitive provider detail' } } : { result }), { status: 200 });
  });
  const intent = { buyer: buyer.address, seller: seller.address, amountAtomic: '1000000', data: '0x' + Buffer.from('experiencebridge:10000000-0000-4000-8000-000000000001:' + 'a'.repeat(64)).toString('hex') };
  function evidence(raw: string) {
    return { slot: 1234, transaction: [raw, 'base64'], meta: { err: null, fee: 5000, preBalances: [1_000_000_000, 0, 1, 1], postBalances: [998_995_000, 1_000_000, 1, 1] } };
  }
  return { gateway, intent, state, calls, evidence, seed, seller };
}

test('V6 Solana exact transfer and record memo finalize; retry sends identical signed bytes', async () => {
  const f = await fixture();
  const prepared = await f.gateway.prepare(f.intent);
  assert.equal(f.calls.filter(c => c.method === 'simulateTransaction').length, 1);
  await f.gateway.broadcast(prepared.rawTransaction);
  await f.gateway.broadcast(prepared.rawTransaction);
  const sends = f.calls.filter(c => c.method === 'sendTransaction');
  assert.equal(sends.length, 2);
  assert.equal(sends[0].params[0], sends[1].params[0]);
  f.state.transaction = f.evidence(prepared.rawTransaction);
  assert.equal((await f.gateway.verify(f.intent, prepared.transactionHash)).state, 'confirmed');
  assert.equal(f.calls.filter(c => c.method === 'getTransaction').at(-1)?.params[1].commitment, 'finalized');
  assert.match(f.gateway.transactionUrl(prepared.transactionHash), /\?cluster=devnet$/);
});

test('V6 Solana missing evidence remains pending and altered memo or balances reject', async () => {
  const f = await fixture(); const prepared = await f.gateway.prepare(f.intent);
  assert.equal((await f.gateway.verify(f.intent, prepared.transactionHash)).state, 'pending');
  f.state.transaction = f.evidence(prepared.rawTransaction);
  const other = { ...f.intent, data: '0x' + Buffer.from('experiencebridge:10000000-0000-4000-8000-000000000002:' + 'a'.repeat(64)).toString('hex') };
  assert.equal((await f.gateway.verify(other, prepared.transactionHash)).state, 'rejected');
  f.state.transaction.meta.postBalances[1] = 999_999;
  assert.equal((await f.gateway.verify(f.intent, prepared.transactionHash)).state, 'rejected');
  f.state.transaction.meta.err = { InstructionError: [0, 'failure'] };
  assert.equal((await f.gateway.verify(f.intent, prepared.transactionHash)).state, 'rejected');
});

test('V6 Solana wrong genesis blocks prepare, broadcast, and verification', async () => {
  const f = await fixture(); const prepared = await f.gateway.prepare(f.intent);
  f.state.genesis = 'wrong-network'; f.calls.length = 0;
  await assert.rejects(f.gateway.prepare(f.intent), /Solana payment operation failed/);
  await assert.rejects(f.gateway.broadcast(prepared.rawTransaction), /Solana payment operation failed/);
  await assert.rejects(f.gateway.verify(f.intent, prepared.transactionHash), /Solana payment operation failed/);
  assert.ok(f.calls.every(c => c.method === 'getGenesisHash'));
});

test('V6 Solana insufficient funds, high fee, and simulation failure cannot broadcast', async () => {
  const f = await fixture();
  f.state.balance = 1;
  await assert.rejects(f.gateway.prepare(f.intent), /Solana payment operation failed/);
  f.state.balance = 1_000_000_000; f.state.fee = 100_001;
  await assert.rejects(f.gateway.prepare(f.intent), /Solana payment operation failed/);
  f.state.fee = 5000; f.state.simulationError = { InstructionError: [0, 'failure'] };
  await assert.rejects(f.gateway.prepare(f.intent), /Solana payment operation failed/);
  assert.equal(f.calls.filter(c => c.method === 'sendTransaction').length, 0);
});

test('V6 Solana tampered signature and wrong amount cannot broadcast', async () => {
  const f = await fixture(); const prepared = await f.gateway.prepare(f.intent);
  const altered = Buffer.from(prepared.rawTransaction, 'base64'); altered[1] ^= 1;
  await assert.rejects(f.gateway.broadcast(altered.toString('base64')), /Solana payment operation failed/);
  await assert.rejects(f.gateway.prepare({ ...f.intent, amountAtomic: '1000001' }), /Solana payment operation failed/);
  assert.equal(f.calls.filter(c => c.method === 'sendTransaction').length, 0);
});

test('Solana configuration and RPC failures fail closed without provider details', async () => {
  const f = await fixture();
  await assert.rejects(createSolanaGateway('http://mock.invalid', f.seed, f.seller.address), /HTTPS/);
  f.state.rpcError = true;
  await assert.rejects(f.gateway.balances(), error => error instanceof Error && !error.message.includes('sensitive') && /Solana payment operation failed/.test(error.message));
  f.gateway.close();
  await assert.rejects(f.gateway.balances(), /Solana payment operation failed/);
});

test('Solana test wallets persist with private file permissions and reject permissive files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eb-solana-wallets-')); const path = join(dir, 'wallets.json');
  const first = await loadSolanaWallets(path); const bytes = await readFile(path);
  const second = await loadSolanaWallets(path);
  assert.equal(first.buyerAddress, second.buyerAddress);
  assert.notEqual(first.buyerAddress, first.sellerAddress);
  assert.deepEqual(await readFile(path), bytes);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await chmod(path, 0o644);
  await assert.rejects(loadSolanaWallets(path), /0600/);
});
