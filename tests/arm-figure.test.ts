import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const modelSource = () => readFileSync('public/arm-model.js', 'utf8');
const model = () => runInNewContext(modelSource() + ';exbridgeArmModel');
function harness(still = false, observer = true) {
  const geometry = model();
  const nodes = new Map<string, any>();
  const listeners = new Map<string, (event?: any) => void>();
  const ids = ['arm-workcell', 'arm-context', 'arm-lesson', 'arm-pause', 'arm-next', 'arm-readout', 'arm-detail', 'arm-story',
    ...geometry.stages.map((_: unknown, i: number) => 'arm-stage-' + i),
    ...geometry.parts(geometry.pose(0)).flatMap((part: any) => part.faces.map((_: unknown, i: number) => `${part.id}-face-${i}`))];
  for (const id of ids) {
    const attrs: Record<string, string> = {};
    nodes.set(id, { hidden: true, textContent: '', attrs,
      setAttribute: (name: string, value: string) => { attrs[name] = String(value); },
      removeAttribute: (name: string) => { delete attrs[name]; },
      addEventListener: (name: string, fn: (event?: any) => void) => listeners.set(id + ':' + name, fn),
    });
  }
  let intersection: (entries: any[]) => void = () => {};
  let changed: () => void = () => {};
  let serial = 0;
  const queue = new Map<number, (now: number) => void>();
  const media = { matches: still, addEventListener: (_: string, fn: () => void) => { changed = fn; } };
  const document = { hidden: false, getElementById: (id: string) => nodes.get(id),
    addEventListener: (name: string, fn: () => void) => listeners.set('document:' + name, fn) };
  const context: Record<string, unknown> = { document, matchMedia: () => media,
    requestAnimationFrame: (fn: (now: number) => void) => { queue.set(++serial, fn); return serial; },
    cancelAnimationFrame: (id: number) => queue.delete(id),
  };
  if (observer) context.IntersectionObserver = class {
    constructor(fn: (entries: any[]) => void) { intersection = fn; }
    observe() {}
  };
  runInNewContext(modelSource() + '\n' + readFileSync('public/arm-figure.js', 'utf8'), context);
  return { nodes, queue, document,
    event: (id: string, event: string, value?: any) => listeners.get(id + ':' + event)?.(value),
    visible: (value: boolean) => intersection([{ isIntersecting: !value }, { isIntersecting: value }]),
    reduced: (value: boolean) => { media.matches = value; changed(); },
    frame: (now: number) => { const entries = [...queue.values()]; queue.clear(); entries.forEach(fn => fn(now)); },
  };
}

test('V25: articulated geometry keeps links attached through the illustrated reach and loop', () => {
  const m = model();
  const distance = (p: number[], q: number[]) => Math.hypot(...p.map((v, i) => v - q[i]));
  for (let time = 0; time <= 20; time += .05) {
    const state = m.pose(time);
    for (const side of ['a', 'b']) {
      const q = m.joints(side, state[side]);
      assert.ok(Math.abs(distance(q.shoulder, q.elbow) - 75) < 1e-8);
      assert.ok(Math.abs(distance(q.elbow, q.wrist) - 70) < 1e-8);
      assert.ok(q.wrist[2] - 32 >= 16, 'Fingers remain above the bench');
    }
    for (const part of m.parts(state)) for (const face of part.faces) {
      assert.ok(!/NaN|Infinity/.test(face.d));
      const coords = (face.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      coords.forEach((v: number, i: number) => assert.ok(v >= 0 && v <= (i % 2 ? 440 : 680), 'Pose stays inside the drawing'));
    }
  }
  for (const side of ['a', 'b']) {
    const home = m.joints(side, 0), reached = m.joints(side, 1);
    assert.ok(Math.abs(home.wrist[0] - reached.wrist[0]) > 50);
    assert.ok(home.wrist[2] - reached.wrist[2] > 70);
    for (const time of [0,5,10,15,20]) {
      const before = m.pose(time - .0001), after = m.pose(time + .0001);
      assert.ok(distance(m.joints(side, before[side]).wrist, m.joints(side, after[side]).wrist) < .01);
    }
  }
  for (const side of ['a', 'b']) {
    const open = m.parts({ ...m.pose(0), [side === 'a' ? 'gripA' : 'gripB']: 0 });
    const closed = m.parts({ ...m.pose(0), [side === 'a' ? 'gripA' : 'gripB']: 1 });
    for (const sign of [-1,1]) {
      const id = `${side}-finger-${sign}`;
      assert.notEqual(open.find((p: any) => p.id === id).faces[3].d, closed.find((p: any) => p.id === id).faces[3].d, 'Both jaws open and close');
    }
  }
  assert.equal(m.pose(5).lesson, -98);
  assert.equal(m.pose(6).checked, false);
  assert.equal(m.pose(10).lesson, 0);
  assert.equal(m.pose(13.5).lesson, 98);
  assert.equal(m.pose(2.5).gripA, 1);
  assert.equal(m.pose(0).gripA, 0);
  assert.equal(m.pose(7.5).lesson, 0);
  assert.equal(m.pose(7.5).checked, true);
  assert.equal(m.pose(12.5).lessonVisible, true);
  assert.equal(m.pose(17.5).gripB, 1);
  const svg = readFileSync('public/arm-figure.svg', 'utf8');
  for (const part of m.parts(m.pose(0))) for (const [i, face] of part.faces.entries()) {
    assert.ok(svg.includes(`id="${part.id}-face-${i}" class="robot-face" data-shade="${face.shade}" d="${face.d}"`), 'Static no-JS pose matches the model');
  }
});

test('V24/V25: motion changes joint paths, keeps playing on hover, and stops when paused, hidden, or offscreen', () => {
  const h = harness();
  const initial = h.nodes.get('a-upper-face-3').attrs.d;
  assert.equal(h.queue.size, 0);
  h.visible(true);
  h.frame(0);
  for (let i = 1; i <= 50; i++) h.frame(i * 50);
  assert.notEqual(h.nodes.get('a-upper-face-3').attrs.d, initial);
  const pose = h.nodes.get('a-upper-face-3').attrs.d;
  h.event('arm-workcell', 'pointerenter');
  h.event('arm-workcell', 'focusin');
  assert.equal(h.queue.size, 1, 'Hover and focus must not stop the requested playback');
  h.event('arm-pause', 'click');
  assert.equal(h.queue.size, 0);
  h.frame(5000);
  assert.equal(h.nodes.get('a-upper-face-3').attrs.d, pose);
  assert.equal(h.nodes.get('arm-pause').textContent, 'Play animation');
  h.event('arm-pause', 'click');
  assert.equal(h.queue.size, 1);
  h.visible(false);
  assert.equal(h.queue.size, 0);
  h.visible(true);
  h.frame(999999);
  assert.equal(h.nodes.get('a-upper-face-3').attrs.d, pose, 'Resume does not jump across hidden time');
  h.document.hidden = true;
  h.event('document', 'visibilitychange');
  assert.equal(h.queue.size, 0);
  h.document.hidden = false;
  h.event('document', 'visibilitychange');
  assert.equal(h.queue.size, 1);
});

test('V24/V25: reduced motion stays still; manual steps keep lesson, caption and active stage in sync', () => {
  const h = harness(true), m = model();
  h.visible(true);
  assert.equal(h.queue.size, 0);
  assert.equal(h.nodes.get('arm-pause').disabled, true);
  assert.equal(h.nodes.get('arm-pause').textContent, 'Motion off');
  for (const stage of [1,2,3,0]) {
    h.event('arm-next', 'click');
    const state = m.pose(stage * 5 + 2.5);
    assert.equal(h.nodes.get('arm-readout').textContent, m.stages[stage][0]);
    assert.equal(h.nodes.get('arm-detail').textContent, m.stages[stage][1]);
    assert.equal(h.nodes.get('arm-lesson').attrs.opacity, state.lessonVisible ? '1' : '0');
    assert.equal(h.nodes.get('arm-stage-' + stage).attrs['aria-current'], 'step');
    assert.equal(h.nodes.get('arm-story').attrs['aria-live'], 'polite');
    for (const part of m.parts(state)) for (const [i, face] of part.faces.entries()) assert.equal(h.nodes.get(`${part.id}-face-${i}`).attrs.d, face.d);
  }
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
  assert.equal(fallback.nodes.get('arm-readout').textContent, m.stages[1][0]);
});
