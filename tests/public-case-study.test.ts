import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { renderPublicCaseStudy } from '../scripts/public-case-study.js';

const reportPath = '../data/evidence/robot-failure-case-study-20261015.json';
const loadReport = async () => JSON.parse(await readFile(new URL(reportPath, import.meta.url), 'utf8'));

test('V16: built public demo serves report-backed results, diagram and evidence without paid access', async () => {
  const build = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'scripts/build-public.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30_000,
  });
  assert.ifError(build.error);
  assert.equal(build.status, 0, build.stderr);
  const { default: worker } = await import(pathToFileURL(resolve('dist/public/worker.js')).href);
  const get = (path: string) => worker.fetch(new Request('https://exbridge.world' + path));
  const page = await get('/');
  assert.equal(page.status, 200);
  const html = await page.text();
  const report = await loadReport();
  assert.ok(html.includes(`<td>${report.retrieval.correct} / ${report.queryCount}</td><td><span class="study-score">75%<meter min="0" max="${report.queryCount}" value="${report.retrieval.correct}"`));
  assert.ok(html.includes(`<td>${report.majorityBaseline.correct} / ${report.queryCount}</td><td><span class="study-score">35%<meter min="0" max="${report.queryCount}" value="${report.majorityBaseline.correct}"`));
  assert.ok(html.includes(`${report.falseNormalCount} faulty traces were labeled normal.`));
  assert.ok(html.includes('aria-labelledby="case-study-heading"'));
  assert.ok(html.includes('<ol class="study-flow">'));
  assert.ok(html.includes('not recovery success or pre-failure prediction'));
  assert.ok(html.includes('outside the paid advisory path'));
  assert.deepEqual(await (await get('/data/evidence/robot-failure-case-study-20261015.json')).json(), report);
  const manifest = await get('/data/case-studies/robot-failures/manifest.json');
  assert.equal(manifest.headers.get('content-type'), 'application/json');
  assert.equal((await manifest.json()).rights.license, 'CC-BY-4.0');
  const order = await worker.fetch(new Request('https://exbridge.world/api/orders', {
    method: 'POST', headers: { 'x-experiencebridge-client': 'local-ui' }, body: '{}',
  }));
  assert.equal(order.status, 403);
});

test('V16: public case-study rendering rejects missing or inconsistent evidence and execution claims', async () => {
  const report = await loadReport();
  assert.throws(() => renderPublicCaseStudy({}));
  assert.throws(() => renderPublicCaseStudy({ ...report, queryCount: 21 }));
  assert.throws(() => renderPublicCaseStudy({ ...report, falseNormalCount: 99 }));
  assert.throws(() => renderPublicCaseStudy({ ...report, falseNormalCount: 2 }));
  assert.throws(() => renderPublicCaseStudy({ ...report, retrieval: { ...report.retrieval, correct: 14 } }));
  assert.throws(() => renderPublicCaseStudy({ ...report, predictions: report.predictions.slice(1) }));
  assert.throws(() => renderPublicCaseStudy({ ...report, executionAuthority: true }));
  assert.throws(() => renderPublicCaseStudy({ ...report, recoveryOutcomesMeasured: true }));
});
