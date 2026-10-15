import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createPublicHandler } from '../src/public-worker.js';

type Element = {
  attributes: Record<string, string>; hidden: boolean; disabled: boolean; value: string; textContent: string; className: string;
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
    const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
    const element: Element = {
      attributes: attrs,
      hidden: /\bhidden\b/.test(attributes), disabled: false, value: id === 'arm' ? 'B' : '', textContent: '', className: '', tabIndex: 0,
      onclick: () => {}, onchange: () => {}, setAttribute: (name, value) => { attrs[name] = value; }, removeAttribute: name => { delete attrs[name]; }, focus: () => {}, scrollIntoView: () => {},
      querySelector: () => elements.get(({ experience: 'experience-heading', compatibility: 'compatibility-heading', 'payment-panel': 'settlement-heading' } as Record<string, string>)[id])!,
    };
    elements.set(id, element); if (tag === 'button') buttons.push(element);
  }
  const get = (id: string) => { const value = elements.get(id); assert.ok(value, `Missing UI element ${id}`); return value; };
  const requests: string[] = [];
  const serve = createPublicHandler({}, '', { status: 'blocked' });
  let failNext = '';
  let heldPath = ''; let releaseHeld = () => {}; let held: Promise<void>;
  const fetch = async (path: string, init?: RequestInit) => {
    requests.push(path);
    if (heldPath === path) { heldPath = ''; await held; }
    if (failNext === path) { failNext = ''; return Response.json({ error: 'Temporary preview failure' }, { status: 503 }); }
    if (!publicMode && path === '/api/config') return Response.json({ publicDemo: false, mode: 'local', maxFee: '0', currency: 'ETH' });
    return serve(new Request('https://exbridge.world' + path, init));
  };
  // Run the shipped handlers. Only DOM layout, focus and the timer are stubbed; requests reach the real Worker.
  await runInNewContext(`(async () => { ${script}\n })()`, {
    document: { getElementById: get, querySelectorAll: () => buttons, body: { classList: { add: () => {} } } },
    fetch, AbortSignal, sessionStorage: { getItem: () => null }, setInterval: () => 0,
  });
  return { get, requests, hold: (path: string) => { heldPath = path; held = new Promise<void>(resolve => { releaseHeld = resolve; }); return () => releaseHeld(); }, fail: (path: string) => { failNext = path; } };
}

test('V17/V18: public preview guides baseline, compatible recovery and restart without payment', async () => {
  const { get, requests, hold } = await browser();
  assert.equal(get('demo-scene').attributes['data-state'], 'ready');
  assert.equal(get('scene-status').textContent, 'Baseline not measured.');
  assert.equal(get('scene-force').textContent, '12 N simulated baseline');
  assert.equal(get('experience').hidden, false);
  assert.equal(get('compatibility').hidden, true);
  assert.equal(get('payment-panel').hidden, true);
  await get('publish').onclick();
  assert.equal(get('experience').hidden, true);
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('baseline-outcome').textContent, 'slip · 12 N');
  assert.equal(get('demo-scene').attributes['data-state'], 'failure');
  assert.equal(get('scene-status').textContent, 'Baseline result: slip.');
  assert.equal(get('scene-force').textContent, '12 N simulated force');
  await get('match').onclick();
  assert.equal(get('compatibility').hidden, true);
  assert.equal(get('payment-panel').hidden, false);
  assert.equal(get('recover').hidden, false);
  assert.equal(get('demo-scene').attributes['data-state'], 'matched');
  assert.match(get('scene-status').textContent, /Recovery not measured/);
  assert.equal(get('scene-force').textContent, '8 N simulated advisory');
  const release = hold('/api/demo/recovery');
  const pending = get('recover').onclick();
  assert.equal(get('demo-scene').attributes['data-state'], 'measuring');
  assert.equal(get('scene-force').textContent, '8 N simulated advisory');
  assert.equal(get('recover').disabled, true);
  release(); await pending;
  assert.equal(get('memory-outcome').textContent, 'success · 8 N');
  assert.equal(get('demo-scene').attributes['data-state'], 'success');
  assert.equal(get('scene-force').textContent, '8 N simulated force');
  await get('restart-demo').onclick();
  assert.equal(get('experience').hidden, false);
  assert.equal(get('payment-panel').hidden, true);
  assert.equal(get('memory-outcome').textContent, 'Not run');
  assert.equal(get('demo-scene').attributes['data-state'], 'ready');
  assert.equal(requests.some(path => path.startsWith('/api/orders')), false);
});

test('V17/V18: an incompatible machine stays at compatibility and a failed request can be retried', async () => {
  const { get, fail } = await browser();
  fail('/simulation/run'); await get('publish').onclick();
  assert.equal(get('experience').hidden, false);
  assert.equal(get('publish').disabled, false);
  await get('publish').onclick();
  get('arm').value = 'C'; get('arm').onchange();
  assert.equal(get('demo-scene').attributes['data-state'], 'checking');
  assert.equal(get('demo-scene').attributes['data-arm'], 'C');
  assert.equal(get('scene-machine').textContent, 'Arm C · vacuum gripper');
  assert.equal(get('scene-force').textContent, 'Recovery not measured');
  await get('match').onclick();
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('payment-panel').hidden, true);
  assert.equal(get('recover').hidden, true);
  assert.match(get('match-result').textContent, /incompatible/);
  assert.equal(get('demo-scene').attributes['data-state'], 'blocked');
  assert.equal(get('demo-scene').attributes['data-arm'], 'C');
  get('arm').value = 'B'; get('arm').onchange();
  assert.equal(get('demo-scene').attributes['data-state'], 'checking');
  assert.equal(get('demo-scene').attributes['data-arm'], 'B');
  fail('/experiences/query'); await get('match').onclick();
  assert.equal(get('compatibility').hidden, false);
  assert.equal(get('match').disabled, false);
  assert.match(get('notice').textContent, /Temporary preview failure/);
  assert.equal(get('demo-scene').attributes['data-state'], 'error');
  await get('match').onclick(); await get('recover').onclick();
  fail('/api/demo/recovery'); await get('recover').onclick();
  assert.equal(get('memory-outcome').textContent, 'Not run');
  assert.equal(get('recover').disabled, false);
  assert.equal(get('demo-scene').attributes['data-state'], 'error');
  assert.equal(get('scene-force').textContent, 'Not measured');
  assert.equal(get('payment-panel').hidden, false);
  await get('recover').onclick();
  assert.equal(get('memory-outcome').textContent, 'success · 8 N');
  await get('change-machine').onclick();
  assert.equal(get('demo-scene').attributes['data-state'], 'checking');
  assert.equal(get('scene-force').textContent, 'Recovery not measured');
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
  assert.equal(get('demo-scene').attributes['data-state'], 'ready');
  assert.equal(get('recover').hidden, true);
  await get('baseline').onclick();
  assert.equal(requests.includes('/simulation/run'), true);
});
