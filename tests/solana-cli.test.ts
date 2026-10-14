import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKeyPairSignerFromPrivateKeyBytes, getAddressEncoder } from '@solana/kit';
import { readCliWallet } from '../scripts/solana-cli-demo.js';

async function fixture() {
  const secret = randomBytes(32);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(secret);
  const bytes = [...secret, ...getAddressEncoder().encode(signer.address)];
  const path = join(await mkdtemp(join(tmpdir(), 'eb-cli-wallet-')), 'id.json');
  const contents = JSON.stringify(bytes);
  await writeFile(path, contents, { mode: 0o600 });
  return { path, bytes, contents, secret, signer };
}

test('CLI wallet loads the existing identity without changing its key file', async () => {
  const f = await fixture();
  const wallet = await readCliWallet(f.path);
  assert.equal(wallet.buyerAddress, f.signer.address);
  assert.deepEqual(wallet.buyerSecret, Uint8Array.from(f.secret));
  assert.equal(await readFile(f.path, 'utf8'), f.contents);
});

test('CLI wallet rejects a mismatched public key and malformed key data', async () => {
  const f = await fixture();
  const changed = [...f.bytes]; changed[63] ^= 1;
  for (const contents of [JSON.stringify(changed), JSON.stringify([1, 2]), 'not-json']) {
    await writeFile(f.path, contents);
    await assert.rejects(readCliWallet(f.path), /CLI wallet file is invalid/);
    assert.equal(await readFile(f.path, 'utf8'), contents);
  }
});

test('CLI wallet refuses a key file readable by other users', async () => {
  const f = await fixture();
  await chmod(f.path, 0o644);
  await assert.rejects(readCliWallet(f.path), /mode 0600/);
  assert.equal(await readFile(f.path, 'utf8'), f.contents);
});
