import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUnits } from 'ethers';
import { createRuntime } from '../src/economics/runtime.js';
import { buildServer } from '../src/server.js';
import { fixture } from '../src/sim/assembly.js';

const args = new Map(process.argv.slice(2).map(argument => {
  const match = /^--(network|count|run-id)=(.+)$/.exec(argument);
  if (!match) throw new Error('Use --network=agung|solana-devnet --count=10..15 --run-id=<unique-name>.');
  return [match[1], match[2]];
}));
const network = args.get('network');
const count = Number(args.get('count') ?? '12');
const runId = args.get('run-id');
if (network !== 'agung' && network !== 'solana-devnet') throw new Error('A public test network is required: agung or solana-devnet.');
if (!Number.isInteger(count) || count < 10 || count > 15) throw new Error('Count must be an integer from 10 to 15.');
if (!runId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(runId)) throw new Error('Provide a unique --run-id using 1 to 64 letters, digits, underscores or hyphens.');

const reportDirectory = 'data/evidence';
await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
const reportPath = join(reportDirectory, `${runId}-${network}.json`);
// Exclusive creation prevents rerunning an existing batch and paying twice.
const reportFile = await open(reportPath, 'wx', 0o600).catch(() => {
  throw new Error(`Report already exists or cannot be created: ${reportPath}. Inspect its existing orders before starting another batch.`);
});
await reportFile.close();
type Row = {
  id: string; date: string; state: string; reason?: string; orderId?: string; recordDigest?: string;
  baseline?: string; recovery?: string; incompatibleQuoteStatus?: number; unpaidRunStatus?: number;
  network: string; chainId?: number | string; genesisHash?: string; transactionHash?: string | null;
  explorerUrl?: string | null; amount?: string; currency?: string; blockNumber?: number;
  finality?: string; retry?: string;
};
const rows: Row[] = Array.from({ length: count }, (_, index) => ({
  id: `${runId}-${index + 1}`, date: new Date().toISOString(), state: 'not_run', network,
}));
const report = {
  provenance: 'VERIFIED only for executed checks; not_run and blocked rows are not successful runs.',
  scenario: 'Synthetic fixed robot fixture. Payments use real test tokens. No physical robot commands.',
  runId, network, requestedCount: count, startedAt: new Date().toISOString(),
  finishedAt: null as string | null, status: 'starting',
  preflight: {} as { buyerAddress?: string; sellerAddress?: string; buyerBalance?: string; minimumBuyerBalance?: string; currency?: string; reason?: string },
  rows,
};
async function persist() {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  const temporaryPath = reportPath + '.' + randomUUID() + '.tmp';
  const temporaryFile = await open(temporaryPath, 'wx', 0o600);
  try {
    await temporaryFile.writeFile(bytes);
    await temporaryFile.sync();
    await temporaryFile.close();
    await rename(temporaryPath, reportPath);
  } catch (error) {
    await temporaryFile.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
await persist();
let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;
let app: ReturnType<typeof buildServer> | undefined;
try {
  runtime = await createRuntime(network, process.env.EB_DATA_DIR ?? 'data/local', network === 'agung' ? process.env.PEAQ_RPC_URL : process.env.SOLANA_RPC_URL);
  app = buildServer(runtime.store, runtime.orders);
  const gateway = runtime.gateway;
  report.preflight = { buyerAddress: gateway.buyerAddress, sellerAddress: gateway.sellerAddress };
  await persist();
  const headers = { 'x-experiencebridge-client': 'local-ui' };
  const request = (method: 'GET' | 'POST', url: string, payload?: object, token?: string) => app!.inject({
    method, url, ...(payload ? { payload } : {}),
    headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const balances = await gateway.balances();
  const decimals = network === 'solana-devnet' ? 9 : 18;
  const reserve = parseUnits(gateway.maxFee, decimals);
  const minimum = (BigInt(gateway.amountAtomic) + reserve) * BigInt(count);
  report.preflight = { ...report.preflight, buyerBalance: balances.buyer, minimumBuyerBalance: minimum.toString() + ' atomic units', currency: gateway.currency };
  if (parseUnits(balances.buyer, decimals) < minimum) {
    report.status = 'blocked';
    report.preflight.reason = `Insufficient buyer test tokens for all prices plus the maximum ${gateway.maxFee}-${gateway.currency} fee reserve per payment.`;
    for (const row of rows) { row.state = 'blocked'; row.reason = report.preflight.reason; }
    process.exitCode = 2;
  } else {
    report.status = 'running';
    await persist();
    const published = await request('POST', '/api/demo/publish', {});
    assert.equal(published.statusCode, 200);
    const record = (await runtime.store.all()).find(item => item.id === 'exp-001');
    assert.ok(record);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      let token: string | undefined;
      row.date = new Date().toISOString();
      row.state = 'checking'; row.recordDigest = record.integrity.sha256;
      row.chainId = gateway.chainId;
      if (network === 'solana-devnet') row.genesisHash = String(gateway.chainId);
      row.amount = gateway.price; row.currency = gateway.currency;
      await persist();
      try {
        const baseline = await request('POST', '/simulation/run', { context: fixture });
        assert.equal(baseline.statusCode, 200);
        row.baseline = baseline.json().outcome;
        assert.equal(row.baseline, 'slip');
        const incompatible = await request('POST', '/api/orders', { experienceId: record.id, context: { ...fixture, gripper: 'vacuum-v2' }, idempotencyKey: randomUUID() });
        row.incompatibleQuoteStatus = incompatible.statusCode;
        assert.equal(incompatible.statusCode, 422);
        const quote = await request('POST', '/api/orders', { experienceId: record.id, context: fixture, idempotencyKey: randomUUID() });
        assert.equal(quote.statusCode, 200);
        let order = quote.json().order;
        token = quote.json().token;
        row.orderId = order.id; row.recordDigest = order.recordDigest; row.state = 'quoted';
        assert.equal(row.recordDigest, record.integrity.sha256);
        await persist();
        const unpaid = await request('POST', `/api/orders/${row.orderId}/run`, {}, token);
        row.unpaidRunStatus = unpaid.statusCode;
        assert.equal(unpaid.statusCode, 402);
        // Save intent before signing. Uncertain outcomes never start another order.
        row.state = 'payment_attempted'; await persist();
        const paid = await request('POST', `/api/orders/${row.orderId}/pay`, {}, token);
        if (paid.statusCode !== 200) throw new Error('Payment preparation or submission did not succeed.');
        order = paid.json().order;
        row.transactionHash = order.transactionHash; row.explorerUrl = order.explorerUrl;
        row.state = order.state; await persist();
        assert.ok(row.transactionHash);
        const retry = await request('POST', `/api/orders/${row.orderId}/pay`, {}, token);
        assert.equal(retry.statusCode, 200);
        assert.equal(retry.json().order.transactionHash, row.transactionHash);
        row.retry = 'Same order returned the same transaction hash.';
        const deadline = Date.now() + 90_000;
        do {
          const checked = await request('POST', `/api/orders/${row.orderId}/verify`, {}, token);
          assert.equal(checked.statusCode, 200);
          order = checked.json().order;
          row.state = order.state; row.finality = order.state; await persist();
          if (order.state !== 'pending') break;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } while (Date.now() < deadline);
        assert.equal(order.state, 'confirmed');
        const advisory = await request('GET', `/api/orders/${row.orderId}/advisory`, undefined, token);
        assert.equal(advisory.statusCode, 200); assert.ok(advisory.json().advisory);
        const recovery = await request('POST', `/api/orders/${row.orderId}/run`, {}, token);
        assert.equal(recovery.statusCode, 200);
        row.recovery = recovery.json().outcome; assert.equal(row.recovery, 'success');
        const evidence = await gateway.verify({
          buyer: gateway.buyerAddress, seller: gateway.sellerAddress,
          amountAtomic: gateway.amountAtomic, data: order.data,
        }, row.transactionHash!);
        assert.equal(evidence.state, 'confirmed');
        row.blockNumber = evidence.blockNumber; row.finality = evidence.reason; row.state = 'confirmed';
        await persist();
      } catch {
        // Fetch only the public order view. Never persist tokens or signed bytes.
        if (row.orderId && token) {
          try {
            const current = await request('GET', `/api/orders/${row.orderId}`, undefined, token);
            if (current.statusCode === 200) {
              const order = current.json().order;
              row.transactionHash = order.transactionHash; row.explorerUrl = order.explorerUrl;
              row.finality = order.state;
            }
          } catch { /* The saved order ID remains available for manual reconciliation. */ }
        }
        row.state = row.finality === 'pending' ? 'pending' : 'failed';
        row.reason = 'A required check failed or finality was not established. Inspect this order before any further payment.';
        for (const remaining of rows.slice(index + 1)) remaining.reason = 'Not executed because an earlier run needs reconciliation.';
        report.status = 'incomplete'; process.exitCode = 2; await persist(); break;
      }
    }
    if (rows.every(row => row.state === 'confirmed')) report.status = 'confirmed';
  }
} catch {
  report.status = 'blocked'; report.preflight.reason = 'Runtime, network, funding, or sample preflight failed. No additional batch payments were attempted.';
  for (const row of rows) if (row.state === 'not_run') { row.state = 'blocked'; row.reason = report.preflight.reason; }
  process.exitCode = 2;
} finally {
  report.finishedAt = new Date().toISOString();
  await persist();
  await app?.close(); await runtime?.close();
}
console.log(JSON.stringify({ reportPath, status: report.status, confirmed: rows.filter(row => row.state === 'confirmed').length, requested: count }));
