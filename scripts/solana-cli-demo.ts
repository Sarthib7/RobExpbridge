import { readFile, stat, mkdir, open, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createKeyPairSignerFromPrivateKeyBytes, getAddressDecoder, address } from '@solana/kit';
import { z } from 'zod';
import { createSolanaGateway } from '../src/economics/solana.js';
import { Orders } from '../src/economics/orders.js';
import { Store } from '../src/memory/store.js';
import { buildServer } from '../src/server.js';

export async function readCliWallet(path: string) {
  if (((await stat(path)).mode & 0o077) !== 0) throw new Error('CLI wallet file must have mode 0600.');
  try {
    const bytes = Uint8Array.from(z.array(z.number().int().min(0).max(255)).length(64).parse(JSON.parse(await readFile(path, 'utf8'))));
    const buyerSecret = bytes.slice(0, 32);
    const signer = await createKeyPairSignerFromPrivateKeyBytes(buyerSecret);
    if (getAddressDecoder().decode(bytes.slice(32)) !== signer.address) throw new Error();
    return { buyerSecret, buyerAddress: signer.address };
  } catch { throw new Error('CLI wallet file is invalid. Its contents were not changed.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 3336);
  const seller = address(z.string().min(1).parse(process.env.SOLANA_SELLER_ADDRESS));
  const wallet = await readCliWallet(process.env.SOLANA_KEYPAIR_PATH ?? join(homedir(), '.config/solana/id.json'));
  const gateway = await createSolanaGateway(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', wallet.buyerSecret, seller);
  const dataDir = process.env.EB_DATA_DIR ?? 'data/local/cli-solana';
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const lockPath = join(dataDir, 'runtime-solana-devnet.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { gateway.close(); throw new Error('Another runtime owns this directory. Inspect existing runtime state before retrying.'); }
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true; gateway.close(); await lock.close(); await unlink(lockPath);
  };
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, network: 'solana-devnet', buyerAddress: wallet.buyerAddress }));
    const store = new Store(join(dataDir, 'experiences-solana-devnet.json'));
    const app = buildServer(store, new Orders(join(dataDir, 'orders-solana-devnet.json'), store, gateway));
    app.addHook('onClose', close);
    await app.listen({ host: '127.0.0.1', port });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close(); });
    console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, network: 'Solana devnet', buyerAddress: wallet.buyerAddress, sellerAddress: seller, keyFileCopied: false }));
  } catch (error) { await close(); throw error; }
}
