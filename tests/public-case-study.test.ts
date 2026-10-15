import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { renderPublicCaseStudy } from '../scripts/public-case-study.js';
import { renderDemoPage, renderEvidencePage } from '../scripts/public-site.js';

const reportPath = '../data/evidence/robot-failure-case-study-20261015.json';
const loadReport = async () => JSON.parse(await readFile(new URL(reportPath, import.meta.url), 'utf8'));

test('V16/V19/V20: built public pages serve report-backed study and working navigation without paid access', async () => {
  const build = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'scripts/build-public.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30_000,
  });
  assert.ifError(build.error);
  assert.equal(build.status, 0, build.stderr);
  const { default: worker } = await import(pathToFileURL(resolve('dist/public/worker.js')).href);
  const get = (path: string) => worker.fetch(new Request('https://exbridge.world' + path));
  const page = await get('/case-study');
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
  const root = await (await get('/')).text();
  assert.ok(root.includes('id="demo"'));
  assert.ok(root.includes('id="about"'));
  assert.ok(root.includes('id="case-study"'));
  assert.ok(!root.includes('src="/app.js"'));
  const demo = await (await get('/demo')).text();
  assert.ok(demo.includes('id="demo-scene"'));
  assert.ok(demo.includes('src="/app.js"'));
  assert.ok(demo.includes('id="case-study" class="study-teaser"'));
  assert.ok(!root.includes('id="publish"'), 'The overview must not start the interactive demo');
  assert.ok(!root.includes('class="study-results"'), 'The overview links to the full study instead of stacking its results');
  for (const [path, title, current] of [
    ['/', 'About | exbridge', '/#about'],
    ['/demo', 'exbridge | A Noesora product', '/demo#demo'],
    ['/showcases', 'Showcases | exbridge', '/showcases'],
    ['/case-study', 'Recorded failure case study | exbridge', '/case-study'],
    ['/evidence', 'Run evidence | exbridge', '/evidence'],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /text\/html/);
    assert.match(response.headers.get('content-security-policy')!, /script-src 'self'/);
    const body = await response.text();
    assert.ok(body.includes(`<title>${title}</title>`));
    const header = body.match(/<header class="site-header">[\s\S]*?<\/header>/)![0];
    assert.equal([...header.matchAll(/aria-current="page"/g)].length, 1);
    assert.ok(new RegExp(`href="${current}" aria-current="page"`).test(header));
    assert.ok(header.includes('href="https://noesora.xyz"'));
    assert.equal([...body.matchAll(/<h1(?:\s|>)/g)].length, 1);
    if (path !== '/demo') assert.ok(!body.includes('src="/app.js"'), 'Static pages must not initialize demo/payment handlers');
    // Follow every local link in the built page, including source assets and anchors.
    for (const [, href] of body.matchAll(/href="([/#][^"]*)"/g)) {
      const target = new URL(href, 'https://exbridge.world' + path);
      const destination = await get(target.pathname);
      assert.equal(destination.status, 200, `${path} has a broken link: ${href}`);
      if (target.hash) assert.ok((await destination.text()).includes(`id="${target.hash.slice(1)}"`), `Missing anchor: ${href}`);
    }
  }
  for (const path of ['/demo', '/showcases', '/case-study', '/evidence']) assert.equal(await (await get(path + '/')).text(), await (await get(path)).text());
  const catalog = await (await get('/showcases')).text();
  assert.equal([...catalog.matchAll(/<article class="showcase-card">/g)].length, 2);
  const publicEvidence = await (await get('/evidence')).text();
  const evidenceSource = await readFile(new URL('../evidence.md', import.meta.url), 'utf8');
  for (const [, label, path] of evidenceSource.matchAll(/\[([^\]\n]+)\]\(((?:data|docs)\/[^\s)]+)\)/g)) {
    assert.ok(publicEvidence.includes(`href="https://github.com/Sarthib7/RobExpbridge/blob/main/${path}"`), `Unlinked citation: ${label}`);
    await readFile(new URL('../' + path, import.meta.url));
  }
  const rawEvidence = await get('/evidence.md');
  assert.match(rawEvidence.headers.get('content-type')!, /text\/plain/);
  assert.equal(await rawEvidence.text(), await readFile(new URL('../evidence.md', import.meta.url), 'utf8'));
  assert.equal((await get('/showcases/missing')).status, 404);
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


test('V19: public page construction escapes evidence and rejects a missing demo slot', () => {
  const evidence = '<script>alert("wallet")</script>& private <tag>';
  const html = renderEvidencePage(evidence);
  assert.ok(!html.includes(evidence));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;wallet&quot;)&lt;/script&gt;&amp; private &lt;tag&gt;'));
  assert.throws(() => renderDemoPage('<body><main>Missing slots</main>'), /slots missing/);
});


test('V21: evidence citations link to source files and keep unsafe markup inert', () => {
  const html = renderEvidencePage('[paid run](data/evidence/run.json) [runbook](docs/runbook.md) [receipt](https://explorer.example/tx/abc?cluster=devnet&view=full)');
  assert.ok(html.includes('<a href="https://github.com/Sarthib7/RobExpbridge/blob/main/data/evidence/run.json">paid run</a>'));
  assert.ok(html.includes('<a href="https://github.com/Sarthib7/RobExpbridge/blob/main/docs/runbook.md">runbook</a>'));
  assert.ok(html.includes('<a href="https://explorer.example/tx/abc?cluster=devnet&amp;view=full">receipt</a>'));
  const hostile = renderEvidencePage('<script>alert(1)</script> [bad](javascript:alert) [relative](//evil.example) [<img src=x>](https://example.com)');
  assert.ok(!hostile.includes('<script>'));
  assert.ok(!hostile.includes('<img'));
  assert.ok(!hostile.includes('href="javascript:'));
  assert.ok(!hostile.includes('href="//evil.example'));
  assert.ok(hostile.includes('<a href="https://example.com">&lt;img src=x&gt;</a>'));
});


test('V23: public study percentages follow a different valid count fixture', () => {
  // Synthetic formatting fixture, not a second dataset result.
  const html = renderPublicCaseStudy({
    sourceCount: 8, referenceCount: 4, queryCount: 4,
    retrieval: { correct: 2, total: 4 }, majorityBaseline: { correct: 3, total: 4 }, falseNormalCount: 1,
    predictions: [
      { truth: 'obstruction', prediction: 'obstruction', majorityPrediction: 'obstruction' },
      { truth: 'obstruction', prediction: 'normal', majorityPrediction: 'obstruction' },
      { truth: 'obstruction', prediction: 'collision', majorityPrediction: 'obstruction' },
      { truth: 'normal', prediction: 'normal', majorityPrediction: 'obstruction' },
    ],
    executionAuthority: false, recoveryOutcomesMeasured: false,
  });
  assert.ok(html.includes('50%<meter min="0" max="4" value="2"'));
  assert.ok(html.includes('75%<meter min="0" max="4" value="3"'));
  assert.ok(!html.includes('35%'));
});
