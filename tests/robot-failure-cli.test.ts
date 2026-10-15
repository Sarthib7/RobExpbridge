import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const loader = import.meta.resolve('tsx');

async function workspace(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'eb-robot-study-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'scripts'));
  await cp(new URL('../scripts/robot-failure-study.ts', import.meta.url), join(directory, 'scripts/robot-failure-study.ts'));
  await cp(new URL('../data/case-studies/robot-failures', import.meta.url), join(directory, 'data/case-studies/robot-failures'), { recursive: true });
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  const data = join(directory, 'data/case-studies/robot-failures');
  const run = () => {
    const result = spawnSync(process.execPath, ['--import', loader, join(directory, 'scripts/robot-failure-study.ts')], {
      cwd: directory, encoding: 'utf8', timeout: 15_000,
    });
    assert.ifError(result.error);
    return result;
  };
  return { data, run };
}

function rejected(result: ReturnType<typeof spawnSync>) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'robot-failure-study: dataset verification or evaluation failed\n');
}

test('V15: CLI reproduces the recorded report with intact local sources', async t => {
  const { run } = await workspace(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const actual = JSON.parse(result.stdout);
  const expected = JSON.parse(await readFile(new URL('../data/evidence/robot-failure-case-study-20261015.json', import.meta.url), 'utf8'));
  assert.ok(Number.isFinite(Date.parse(actual.observedAt)));
  delete actual.observedAt;
  delete expected.observedAt;
  assert.deepEqual(actual, expected);
});

for (const file of ['lp1.data', 'lp1_data.csv']) {
  test(`V15: CLI rejects byte corruption in ${file} even when parsed values are unchanged`, async t => {
    const { data, run } = await workspace(t);
    const path = join(data, file);
    const text = await readFile(path, 'utf8');
    // Both changes preserve numeric values and row alignment. Only integrity can reject them.
    const changed = file === 'lp1.data' ? text + '\n' : text.replace(/(\r?\n)/, '$1 ');
    assert.notEqual(changed, text);
    await writeFile(path, changed);
    rejected(run());
  });
}

test('V15: CLI rejects a changed frozen protocol', async t => {
  const { data, run } = await workspace(t);
  const path = join(data, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.protocol.frozenAt = '2000-01-01T00:00:00Z';
  await writeFile(path, JSON.stringify(manifest));
  rejected(run());
});

test('V15: CLI rejects misaligned Kaggle rows even with a matching local file hash', async t => {
  const { data, run } = await workspace(t);
  const path = join(data, 'lp1_data.csv');
  const text = await readFile(path, 'utf8');
  const changed = text.replace(/(\r?\n)([+-]?\d+),/, (_, newline, value) => `${newline}${Number(value) + 1},`);
  assert.notEqual(changed, text);
  await writeFile(path, changed);
  const manifestPath = join(data, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files['lp1_data.csv'] = { bytes: Buffer.byteLength(changed), sha256: createHash('sha256').update(changed).digest('hex') };
  await writeFile(manifestPath, JSON.stringify(manifest));
  rejected(run());
});
