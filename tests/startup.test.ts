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
