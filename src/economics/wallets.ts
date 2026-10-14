import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Wallet } from 'ethers';
import { z } from 'zod';
const walletSchema = z.strictObject({ buyerPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/), sellerPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });
export async function loadTestWallets(path: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    const keys = { buyerPrivateKey: Wallet.createRandom().privateKey, sellerPrivateKey: Wallet.createRandom().privateKey };
    await writeFile(path, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('Could not create local test wallets.'); }
  if (((await stat(path)).mode & 0o077) !== 0) throw new Error('Test wallet file must have mode 0600.');
  let keys;
  try { keys = walletSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
  catch { throw new Error('Local test wallet file is invalid. Keep the file for recovery.'); }
  return { ...keys, buyerAddress: new Wallet(keys.buyerPrivateKey).address, sellerAddress: new Wallet(keys.sellerPrivateKey).address };
}
