import { z } from 'zod';
import { buildServer } from '../src/server.js';
import { createRuntime } from '../src/economics/runtime.js';
import { startLocalNode, rpc } from './local-node.js';
const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 3333);
const dataDir = process.env.EB_DATA_DIR ?? 'data/local';
const node = await startLocalNode(8545, dataDir);
let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;
let app: ReturnType<typeof buildServer> | undefined;
let closed = false;
async function close() {
  if (closed) return; closed = true;
  try { await app?.close(); await runtime?.close(); } finally { await node.stop(); }
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void close(); });
try {
 runtime = await createRuntime('local', dataDir, node.url);
 await rpc(node.url, 'anvil_setBalance', [runtime.gateway.buyerAddress, '0x8ac7230489e80000']);
 app = buildServer(runtime.store, runtime.orders);
 await app.listen({ host: '127.0.0.1', port });
 console.log(`ExperienceBridge local EVM: http://127.0.0.1:${port}`);
 console.log('Local chain 31337. Buyer funded with local test ETH. No peaq transaction occurs in this mode.');
} catch (error) { await close(); throw error; }
