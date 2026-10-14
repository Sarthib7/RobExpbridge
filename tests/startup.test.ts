import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('V4 invalid PORT fails before creating wallets, data, or a runtime lock', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'eb-startup-'));
  const dataDir = join(parent, 'data');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: 'invalid', PAYMENT_MODE: 'agung', EB_DATA_DIR: dataDir },
    encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ZodError/);
  assert.deepEqual(await readdir(parent), [], 'Invalid configuration must not create runtime data.');
});


for (const port of ['invalid', '0', '65536', '3333.5']) {
 test(`V13 local EVM rejects PORT=${port} before runtime side effects`, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'eb-local-startup-'));
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/local.ts'], {
   cwd: process.cwd(),
   env: { ...process.env, PATH: '', PORT: port, EB_DATA_DIR: join(parent, 'data') },
   encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.deepEqual(await readdir(parent), [], 'Invalid configuration must not create runtime data or start Anvil.');
  assert.match(result.stderr, /ZodError/);
 });
}
