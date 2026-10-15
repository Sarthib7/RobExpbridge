/* Concept animation only. No requests, robot control, or measured outcomes. */
(() => {
  const figure = document.getElementById('arm-workcell');
  if (!figure) return;
  const tools = ['a', 'b'].map(id => document.getElementById(`arm-${id}-tool`));
  const context = document.getElementById('arm-context');
  const pause = document.getElementById('arm-pause');
  const next = document.getElementById('arm-next');
  const readout = document.getElementById('arm-readout');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = ['01 / Arm A contributes', '02 / Check the context', '03 / Arm B consults'];
  let elapsed = reduced.matches ? 1.5 : 0, frame = null, previous = null, inView = false, paused = false, engaged = false;
  function paint(manual = false) {
    const step = Math.floor(elapsed / 3) % 3;
    const amount = manual ? 1 : (1 - Math.cos((elapsed % 3) / 3 * Math.PI * 2)) / 2;
    tools.forEach((tool, i) => {
      const active = (i === 0 && step === 0) || (i === 1 && step === 2);
      tool.setAttribute('transform', `translate(0 ${(active ? amount : 0) * Number(tool.dataset.stroke)})`);
    });
    context.setAttribute('opacity', step === 1 ? '1' : '0.35');
    if (readout.textContent !== labels[step]) readout.textContent = labels[step];
  }
  function running() { return inView && !document.hidden && !paused && !reduced.matches && !engaged; }
  function sync() {
    if (running() && frame === null) frame = requestAnimationFrame(tick);
    else if (!running()) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = null;
    }
    pause.textContent = reduced.matches ? 'Motion off' : paused ? 'Play animation' : 'Pause animation';
    pause.disabled = reduced.matches;
  }
  function tick(now) {
    frame = null;
    if (!running()) { previous = null; return; }
    if (previous !== null) elapsed = (elapsed + Math.min((now - previous) / 1000, 0.05)) % 9;
    previous = now;
    paint();
    sync();
  }
  pause.hidden = false;
  next.hidden = false;
  pause.addEventListener('click', () => {
    paused = !paused;
    if (!paused) engaged = false; // Explicit Play overrides hover/focus suspension.
    readout.setAttribute('aria-live', 'off');
    sync();
  });
  next.addEventListener('click', () => {
    paused = true;
    elapsed = ((Math.floor(elapsed / 3) + 1) % 3) * 3 + 1.5;
    readout.setAttribute('aria-live', 'polite');
    paint(true);
    sync();
  });
  figure.addEventListener('pointerenter', () => { engaged = true; sync(); });
  figure.addEventListener('pointerleave', () => {
    engaged = figure.contains(document.activeElement) && document.activeElement !== pause;
    sync();
  });
  figure.addEventListener('focusin', () => { engaged = true; sync(); });
  figure.addEventListener('focusout', event => { engaged = figure.contains(event.relatedTarget); sync(); });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => {
    elapsed = Math.floor(elapsed / 3) * 3 + 1.5;
    paint(true);
    sync();
  });
  if ('IntersectionObserver' in globalThis) {
    new IntersectionObserver(entries => { inView = entries[entries.length - 1].isIntersecting; sync(); }).observe(figure);
  } // Without visibility observation, keep a still figure and working manual steps.
  paint(reduced.matches);
  sync();
})();
