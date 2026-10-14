import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// V5: stale advice and outcomes must disappear when access cannot be revalidated.
async function browserHarness() {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, disabled: false, textContent: '', className: '', value: 'B',
      replaceChildren() {}, append() {},
    });
    return elements.get(id);
  };
  const order = { id: 'order-1', state: 'confirmed', transactionHash: '0x123',
    expiresAt: new Date(Date.now() + 60000).toISOString(), buyerAddress: 'buyer',
    sellerAddress: 'seller', price: '0.001', currency: 'ETH', reason: 'Confirmed' };
  let failure = '';
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  await runInNewContext(`(async () => { ${source}\n })()`, {
    document: { getElementById: element, querySelectorAll: () => [], createElement: () => ({}) },
    sessionStorage: { getItem: () => JSON.stringify({ id: order.id, token: 'token', paymentAttempted: true }), setItem() {} },
    AbortSignal, setInterval() {},
    fetch: async (path: string) => {
      const failed = Boolean(failure && path.endsWith(failure));
      let data: any = { order };
      if (path === '/api/config') data = { mode: 'local', buyerAddress: 'buyer', sellerAddress: 'seller' };
      if (path === '/api/network') data = { buyerBalance: '1', sellerBalance: '1', currency: 'ETH' };
      if (path.endsWith('/advisory')) data = { advisory: { procedure: 'reduce-force', forceN: 8 }, evidence: { level: 'simulation-tested' } };
      if (path.endsWith('/run')) data = { outcome: 'success', forceN: 8, seed: 1, fixture: 'fixture-7' };
      return { ok: !failed, status: failed ? 422 : 200,
        json: async () => failed ? { error: 'Access cannot be revalidated.' } : data };
    },
  });
  assert.equal(element('advisory').hidden, false);
  await element('recover').onclick();
  assert.equal(element('recovery-result').hidden, false);
  return { element, fail: (suffix: string) => { failure = suffix; } };
}

for (const [failedEndpoint, button] of [['/verify', 'verify'], ['/advisory', 'verify'], ['/run', 'recover']]) {
  test(`V5 ${failedEndpoint} failure clears previous advice and recovery`, async () => {
    const ui = await browserHarness();
    ui.fail(failedEndpoint);
    await ui.element(button).onclick();
    assert.equal(ui.element('advisory').hidden, true);
    assert.equal(ui.element('recovery-result').hidden, true);
    assert.match(ui.element('notice').textContent, /Access cannot be revalidated/);
  });
}

async function publicHarness(snapshot: unknown = { activation: 'not_verified' }, initialFailure = '') {
  const { createPublicHandler } = await import('../src/public-worker.js');
  const handler = createPublicHandler({}, '', snapshot);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const elements = new Map<string, any>();
  const stack: any[] = [];
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)) {
    const [tag, name, attributes] = match;
    if (tag.startsWith('</')) { stack.pop(); continue; }
    const node: any = { hidden: /\bhidden\b/.test(attributes), parent: stack.at(-1), value: 'B', textContent: '', replaceChildren() {}, append() {} };
    const id = /\bid="([^"]+)"/.exec(attributes)?.[1];
    if (id) elements.set(id, node);
    if (!['meta', 'link', 'br', 'input', 'img', 'hr'].includes(name.toLowerCase()) && !tag.endsWith('/>')) stack.push(node);
  }
  const element = (id: string) => { assert.ok(elements.has(id), `Missing DOM ID ${id}`); return elements.get(id); };
  let failure = initialFailure;
  const calls: string[] = [];
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  await runInNewContext(`(async () => { ${source}\n })()`, {
    document: { getElementById: element, querySelectorAll: () => [], createElement: () => ({}) },
    sessionStorage: { getItem() { throw new Error('Public mode must not restore a paid order.'); } },
    AbortSignal, setInterval() {},
    fetch: async (path: string, options: RequestInit) => {
      calls.push(path);
      if (path === failure) return Response.json({ error: 'Injected network failure.' }, { status: 503 });
      return handler(new Request('https://example.test' + path, options));
    },
  });
  return { element, calls, fail: (path: string) => { failure = path; }, visible: (id: string) => {
    for (let node = element(id); node; node = node.parent) if (node.hidden) return false;
    return true;
  } };
}

test('public preview exposes compatible recovery outside hidden payment controls without orders', async () => {
  const ui = await publicHarness();
  assert.equal(ui.visible('recover'), false);
  await ui.element('publish').onclick();
  await ui.element('baseline').onclick();
  assert.match(ui.element('baseline-result').textContent, /slip/);
  await ui.element('match').onclick();
  assert.equal(ui.visible('recover'), true);
  assert.equal(ui.visible('payment'), false);
  assert.equal(ui.visible('quote'), false);
  await ui.element('recover').onclick();
  assert.match(ui.element('recovery-result').textContent, /preview: success/);
  assert.equal(ui.calls.some(path => path.startsWith('/api/orders')), false);
  ui.element('arm').value = 'C'; ui.element('arm').onchange();
  await ui.element('match').onclick();
  assert.equal(ui.visible('recover'), false);
  assert.match(ui.element('match-result').textContent, /incompatible/);
});

test('public failed compatibility recheck removes prior recovery and eligibility', async () => {
  const ui = await publicHarness();
  await ui.element('match').onclick(); await ui.element('recover').onclick();
  assert.equal(ui.visible('recovery-result'), true);
  ui.fail('/experiences/query'); await ui.element('match').onclick();
  assert.equal(ui.visible('recover'), false);
  assert.equal(ui.visible('recovery-result'), false);
  assert.equal(ui.visible('match-result'), false);
  assert.match(ui.element('notice').textContent, /Injected network failure/);
});

test('public failed recovery clears the previous successful result', async () => {
  const ui = await publicHarness();
  await ui.element('match').onclick(); await ui.element('recover').onclick();
  assert.equal(ui.visible('recovery-result'), true);
  ui.fail('/api/demo/recovery'); await ui.element('recover').onclick();
  assert.equal(ui.visible('recovery-result'), false);
  assert.match(ui.element('notice').textContent, /Injected network failure/);
});


const blockedReadiness = {
  status: 'blocked', observedAt: '2026-10-13T03:30:53.410Z',
  machineId: '51313535534380419201753672467894976801162163235323652857087009259400758867845',
  preview: { bondAmount: '400000000000000000' },
  activationStateError: 'MACHINE_NOT_FOUND', error: 'INSUFFICIENT_TEST_TOKENS',
};
test('peaqOS recorded blocked preview displays exact bond and unregistered ID', async () => {
  const ui = await publicHarness(blockedReadiness);
  assert.equal(ui.element('peaqos-status').textContent, 'peaqOS: activation blocked');
  assert.match(ui.element('peaqos-detail').textContent, /Recorded SDK preview/);
  assert.match(ui.element('peaqos-detail').textContent, /2026-10-13T03:30:53.410Z/);
  assert.match(ui.element('peaqos-detail').textContent, /Bond: 0.4 AGUNG \(400000000000000000 wei\)/);
  assert.match(ui.element('peaqos-detail').textContent, /INSUFFICIENT_TEST_TOKENS/);
  assert.match(ui.element('peaqos-detail').textContent, /MACHINE_NOT_FOUND/);
  assert.match(ui.element('peaqos-machine').textContent, /Registration is not established/);
});
test('peaqOS fetch failure does not block simulation', async () => {
  const ui = await publicHarness(blockedReadiness, '/api/peaqos');
  assert.equal(ui.element('peaqos-status').textContent, 'peaqOS: readiness unavailable');
  await ui.element('match').onclick();
  assert.equal(ui.visible('recover'), true);
  await ui.element('recover').onclick();
  assert.match(ui.element('recovery-result').textContent, /preview: success/);
});
