import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createPublicHandler } from '../src/public-worker.js';

type Element = {
  hidden: boolean; disabled: boolean; value: string; textContent: string; className: string;
  onclick: () => Promise<void> | void; onchange: () => void; tabIndex: number;
  setAttribute: (name: string, value: string) => void; removeAttribute: (name: string) => void;
  querySelector: (selector: string) => Element; focus: () => void; scrollIntoView: () => void;
};

async function browser(publicMode = true) {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = new Map<string, Element>();
  const buttons: Element[] = [];
  for (const match of html.matchAll(/<([a-z0-9-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const [, tag, attributes, id] = match;
    const element: Element = {
      hidden: /\bhidden\b/.test(attributes), disabled: false, value: id === 'arm' ? 'B' : '', textContent: '', className: '', tabIndex: 0,
      onclick: () => {}, onchange: () => {}, setAttribute: () => {}, removeAttribute: () => {}, focus: () => {}, scrollIntoView: () => {},
      querySelector: () => elements.get(({ experience: 'experience-heading', compatibility: 'compatibility-heading', 'payment-panel': 'settlement-heading' } as Record<string, string>)[id])!,
    };
    elements.set(id, element); if (tag === 'button') buttons.push(element);
  }
  const get = (id: string) => { const value = elements.get(id); assert.ok(value, `Missing UI element ${id}`); return value; };
  const requests: string[] = [];
  const serve = createPublicHandler({}, '', { status: 'blocked' });
  let failNext = '';
  const fetch = async (path: string, init?: RequestInit) => {
    requests.push(path);
    if (failNext === path) { failNext = ''; return Response.json({ error: 'Temporary preview failure' }, { status: 503 }); }
    if (!publicMode && path === '/api/config') return Response.json({ publicDemo: false, mode: 'local', maxFee: '0', currency: 'ETH' });
    return serve(new Request('https://exbridge.world' + path, init));
  };
  // Run the shipped handlers. Only DOM layout, focus and the timer are stubbed; requests reach the real Worker.
  await runInNewContext(`(async () => { ${script}\n })()`, {
    document: { getElementById: get, querySelectorAll: () => buttons, body: { classList: { add: () => {} } } },
    fetch, AbortSignal, sessionStorage: { getItem: () => null }, setInterval: () => 0,
  });
  return { get, requests, fail: (path: string) => { failNext = path; } };
}

test('V17: public preview guides baseline, compatible recovery and restart without payment', async () => {
  const { get, requests } = await browser();
  assert.equal(get('experience').hidden, false);
  assert.equal(get('compatibility').hidden, true);
  assert.equal(get('payment-panel').hidden, true);
  await get('publish').onclick();
  assert.equal(get('experience').hidden, true);
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('baseline-outcome').textContent, 'slip · 12 N');
  await get('match').onclick();
  assert.equal(get('compatibility').hidden, true);
  assert.equal(get('payment-panel').hidden, false);
  assert.equal(get('recover').hidden, false);
  await get('recover').onclick();
  assert.equal(get('memory-outcome').textContent, 'success · 8 N');
  await get('restart-demo').onclick();
  assert.equal(get('experience').hidden, false);
  assert.equal(get('payment-panel').hidden, true);
  assert.equal(get('memory-outcome').textContent, 'Not run');
  assert.equal(requests.some(path => path.startsWith('/api/orders')), false);
});

test('V17: an incompatible machine stays at compatibility and a failed request can be retried', async () => {
  const { get, fail } = await browser();
  fail('/simulation/run'); await get('publish').onclick();
  assert.equal(get('experience').hidden, false);
  assert.equal(get('publish').disabled, false);
  await get('publish').onclick();
  get('arm').value = 'C'; get('arm').onchange();
  await get('match').onclick();
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('payment-panel').hidden, true);
  assert.equal(get('recover').hidden, true);
  assert.match(get('match-result').textContent, /incompatible/);
  get('arm').value = 'B'; get('arm').onchange();
  fail('/experiences/query'); await get('match').onclick();
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('match').disabled, false);
  assert.match(get('notice').textContent, /Temporary preview failure/);
  await get('match').onclick(); await get('recover').onclick();
  fail('/api/demo/recovery'); await get('recover').onclick();
  assert.equal(get('memory-outcome').textContent, 'Not run');
  assert.equal(get('recover').disabled, false);
  assert.equal(get('payment-panel').hidden, false);
  await get('recover').onclick();
  assert.equal(get('memory-outcome').textContent, 'success · 8 N');
  await get('change-machine').onclick();
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('payment-panel').hidden, true);
  assert.equal(get('memory-outcome').textContent, 'Not run');
});

test('V17: local workspaces retain explicit publish and baseline actions', async () => {
  const { get, requests } = await browser(false);
  await get('publish').onclick();
  assert.equal(requests.includes('/simulation/run'), false);
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('payment-panel').hidden, false);
  assert.equal(get('recover').hidden, true);
  await get('baseline').onclick();
  assert.equal(requests.includes('/simulation/run'), true);
});
