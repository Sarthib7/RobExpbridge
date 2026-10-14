import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/batch-runs.ts', import.meta.url));
const loader = import.meta.resolve('tsx');
function run(directory: string, args: string[]) {
  const result = spawnSync(process.execPath, ['--import', loader, script, ...args], {
    cwd: directory,
    env: { ...process.env, EB_DATA_DIR: join(directory, 'private'), PEAQ_RPC_URL: 'http://127.0.0.1:1' },
    encoding: 'utf8', timeout: 15_000,
  });
  assert.ifError(result.error);
  return result;
}
const args = ['--network=agung', '--count=12', '--run-id=reused'];

test('batch rejects invalid arguments before creating data', async () => {
  for (const input of [
    ['--network=local', '--count=12', '--run-id=reused'],
    ['--network=agung', '--count=16', '--run-id=reused'],
    ['--network=agung', '--count=12', '--run-id=../escape'],
  ]) {
    const directory = await mkdtemp(join(tmpdir(), 'eb-batch-args-'));
    assert.notEqual(run(directory, input).status, 0);
    assert.deepEqual(await readdir(directory), []);
  }
});

test('batch preserves existing malformed reports and refuses run ID reuse', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eb-batch-existing-'));
  const evidence = join(directory, 'data', 'evidence');
  await mkdir(evidence, { recursive: true });
  const path = join(evidence, 'reused-agung.json');
  const original = 'incomplete historical report';
  await writeFile(path, original);
  const result = run(directory, args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Report already exists or cannot be created/);
  assert.equal(await readFile(path, 'utf8'), original);
  assert.deepEqual(await readdir(directory), ['data']);
});

test('batch records blocked setup without reporting a payment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eb-batch-blocked-'));
  // The HTTP URL fails the Agung HTTPS guard before any RPC request.
  const result = run(directory, args);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(await readFile(join(directory, 'data', 'evidence', 'reused-agung.json'), 'utf8'));
  assert.equal(report.status, 'blocked');
  assert.equal(report.requestedCount, 12);
  assert.equal(report.rows.length, 12);
  assert.ok(report.rows.every((row: { state: string; transactionHash?: string }) => row.state === 'blocked' && !row.transactionHash));
  assert.equal(JSON.parse(result.stdout).confirmed, 0);
});
