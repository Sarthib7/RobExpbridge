import { join } from 'node:path';
import { mkdir, open, unlink } from 'node:fs/promises';
import { Store } from '../memory/store.js';
import { createGateway, type NetworkMode } from './chain.js';
import { loadTestWallets } from './wallets.js';
import { createSolanaGateway } from './solana.js';
import { loadSolanaWallets } from './solana-wallets.js';
import { Orders } from './orders.js';
export async function createRuntime(mode: NetworkMode = 'agung', dataDir = 'data/local', rpcUrl?: string) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const lockPath = join(dataDir, `runtime-${mode}.lock`);
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new Error(`Another ${mode} runtime owns this data directory, or a previous run left ${lockPath}. Stop the other server first. Inspect stale locks before removal.`); }
  let gateway: ReturnType<typeof createGateway> | undefined;
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    gateway?.close(); await lock.close(); await unlink(lockPath);
  };
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, mode, startedAt: new Date().toISOString() }));
    if (mode === 'solana-devnet') {
      const wallets = await loadSolanaWallets(join(dataDir, 'solana-test-wallets.json'));
      gateway = await createSolanaGateway(rpcUrl ?? 'https://api.devnet.solana.com', wallets.buyerSecret, wallets.sellerAddress);
    } else {
      const wallets = await loadTestWallets(join(dataDir, 'test-wallets.json'));
      gateway = createGateway(mode, rpcUrl ?? (mode === 'agung' ? 'https://peaq-agung.api.onfinality.io/public' : 'http://127.0.0.1:8545'), wallets.buyerPrivateKey, wallets.sellerAddress);
    }
    const store = new Store(join(dataDir, `experiences-${mode}.json`));
    const orders = new Orders(join(dataDir, `orders-${mode}.json`), store, gateway);
    return { store, orders, gateway, close };
  } catch (error) { await close(); throw error; }
}
