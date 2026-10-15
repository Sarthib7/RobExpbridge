import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function harness(still = false, observer = true) {
  const nodes = new Map<string, any>();
  const listeners = new Map<string, (event?: any) => void>();
  for (const id of ['arm-workcell', 'arm-a-tool', 'arm-b-tool', 'arm-context', 'arm-pause', 'arm-next', 'arm-readout']) {
    const attrs: Record<string, string> = {};
    nodes.set(id, { dataset: { stroke: '25' }, hidden: true, textContent: '', attrs,
      contains: (node: unknown) => node === nodes.get('arm-next') || node === nodes.get('arm-pause'),
      setAttribute: (name: string, value: string) => { attrs[name] = value; },
      addEventListener: (name: string, fn: (event?: any) => void) => listeners.set(id + ':' + name, fn),
    });
  }
  let intersection: (entries: any[]) => void = () => {};
  let changed: () => void = () => {};
  let serial = 0;
  const queue = new Map<number, (now: number) => void>();
  const media = { matches: still, addEventListener: (_: string, fn: () => void) => { changed = fn; } };
  const document = { hidden: false, activeElement: null as unknown, getElementById: (id: string) => nodes.get(id),
    addEventListener: (name: string, fn: () => void) => listeners.set('document:' + name, fn) };
  const context: Record<string, unknown> = { document, matchMedia: () => media,
    requestAnimationFrame: (fn: (now: number) => void) => { queue.set(++serial, fn); return serial; },
    cancelAnimationFrame: (id: number) => queue.delete(id),
  };
  if (observer) context.IntersectionObserver = class {
    constructor(fn: (entries: any[]) => void) { intersection = fn; }
    observe() {}
  };
  runInNewContext(readFileSync('public/arm-figure.js', 'utf8'), context);
  return { nodes, queue, document,
    event: (id: string, event: string, value?: any) => listeners.get(id + ':' + event)!(value),
    visible: (value: boolean) => intersection([{ isIntersecting: value }]),
    reduced: (value: boolean) => { media.matches = value; changed(); },
    frame: (now: number) => { const entries = [...queue.values()]; queue.clear(); entries.forEach(fn => fn(now)); },
  };
}

test('V24: concept motion follows elapsed time and stops when paused, hidden, or offscreen', () => {
  const h = harness();
  assert.equal(h.queue.size, 0);
  h.visible(true);
  h.frame(0);
  for (let i = 1; i <= 30; i++) h.frame(i * 50);
  assert.equal(h.nodes.get('arm-a-tool').attrs.transform, 'translate(0 25)');
  assert.equal(h.nodes.get('arm-b-tool').attrs.transform, 'translate(0 0)');
  h.event('arm-pause', 'click');
  assert.equal(h.queue.size, 0);
  assert.equal(h.nodes.get('arm-pause').textContent, 'Play animation');
  h.event('arm-workcell', 'pointerenter');
  h.event('arm-workcell', 'focusin');
  h.event('arm-pause', 'click');
  assert.equal(h.queue.size, 1, 'Explicit Play overrides hover and focus');
  h.document.activeElement = h.nodes.get('arm-pause');
  h.event('arm-workcell', 'pointerleave');
  assert.equal(h.queue.size, 1, 'Leaving the focused Play control must keep playing');
  h.document.activeElement = null;
  h.visible(false);
  assert.equal(h.queue.size, 0);
  h.visible(true);
  h.document.hidden = true;
  h.event('document', 'visibilitychange');
  assert.equal(h.queue.size, 0);
  h.document.hidden = false;
  h.event('document', 'visibilitychange');
  assert.equal(h.queue.size, 1);
  h.event('arm-workcell', 'pointerenter');
  assert.equal(h.queue.size, 0);
  h.event('arm-workcell', 'pointerleave');
  assert.equal(h.queue.size, 1);
  h.event('arm-workcell', 'focusin');
  assert.equal(h.queue.size, 0);
  h.event('arm-workcell', 'focusout', { relatedTarget: null });
  assert.equal(h.queue.size, 1);
});

test('V24: reduced motion and missing observer stay still; manual steps preserve the concept sequence', () => {
  const h = harness(true);
  h.visible(true);
  assert.equal(h.queue.size, 0);
  assert.equal(h.nodes.get('arm-pause').disabled, true);
  assert.equal(h.nodes.get('arm-pause').textContent, 'Motion off');
  h.event('arm-next', 'click');
  assert.equal(h.nodes.get('arm-readout').textContent, '02 / Check the context');
  assert.equal(h.nodes.get('arm-context').attrs.opacity, '1');
  assert.equal(h.nodes.get('arm-readout').attrs['aria-live'], 'polite');
  h.event('arm-next', 'click');
  assert.equal(h.nodes.get('arm-readout').textContent, '03 / Arm B consults');
  assert.equal(h.nodes.get('arm-a-tool').attrs.transform, 'translate(0 0)');
  assert.equal(h.nodes.get('arm-b-tool').attrs.transform, 'translate(0 25)');
  h.event('arm-next', 'click');
  assert.equal(h.nodes.get('arm-readout').textContent, '01 / Arm A contributes');
  assert.equal(h.queue.size, 0);
  h.reduced(false);
  assert.equal(h.queue.size, 0, 'Manual step keeps the tour paused');
  h.event('arm-pause', 'click');
  assert.equal(h.queue.size, 1);
  h.reduced(true);
  assert.equal(h.queue.size, 0);
  const fallback = harness(false, false);
  assert.equal(fallback.queue.size, 0);
  fallback.event('arm-next', 'click');
  assert.equal(fallback.nodes.get('arm-readout').textContent, '02 / Check the context');
});
