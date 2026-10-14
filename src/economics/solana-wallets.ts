import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createKeyPairSignerFromPrivateKeyBytes } from '@solana/kit';
import { z } from 'zod';

const schema = z.strictObject({
  buyerSeed: z.string().regex(/^[a-f0-9]{64}$/),
  sellerSeed: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function loadSolanaWallets(path: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await writeFile(path, JSON.stringify({ buyerSeed: randomBytes(32).toString('hex'), sellerSeed: randomBytes(32).toString('hex') }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('Could not create Solana test wallets.');
  }
  if (((await stat(path)).mode & 0o077) !== 0) throw new Error('Solana test wallet file must have mode 0600.');
  try {
    const saved = schema.parse(JSON.parse(await readFile(path, 'utf8')));
    const buyerSecret = Uint8Array.from(Buffer.from(saved.buyerSeed, 'hex'));
    const sellerSecret = Uint8Array.from(Buffer.from(saved.sellerSeed, 'hex'));
    const buyer = await createKeyPairSignerFromPrivateKeyBytes(buyerSecret);
    const seller = await createKeyPairSignerFromPrivateKeyBytes(sellerSecret);
    if (buyer.address === seller.address) throw new Error();
    return { buyerSecret, sellerSecret, buyerAddress: buyer.address, sellerAddress: seller.address };
  } catch { throw new Error('Solana test wallet file is invalid. Keep the file for recovery.'); }
}
