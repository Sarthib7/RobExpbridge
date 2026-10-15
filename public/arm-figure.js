/* Concept animation only. No requests, robot control, or measured outcomes. */
(() => {
  const figure = document.getElementById('arm-workcell');
  if (!figure) return;
  const model = exbridgeArmModel;
  const paths = new Map(model.parts(model.pose(0)).flatMap(part => part.faces.map((_, i) => {
    const id = `${part.id}-face-${i}`;
    return [id, { node: document.getElementById(id), d: null, shade: null }];
  })));
  const context = document.getElementById('arm-context');
  const lesson = document.getElementById('arm-lesson');
  const pause = document.getElementById('arm-pause');
  const next = document.getElementById('arm-next');
  const readout = document.getElementById('arm-readout');
  const detail = document.getElementById('arm-detail');
  const story = document.getElementById('arm-story');
  const stages = model.stages.map((_, i) => document.getElementById(`arm-stage-${i}`));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0, frame = null, previous = null, inView = false, paused = false, shown = -1, drawnPose = '';
  function paint() {
    const state = model.pose(elapsed);
    const poseKey = [state.a, state.b, state.gripA, state.gripB].join(',');
    if (poseKey !== drawnPose) {
      drawnPose = poseKey;
      for (const part of model.parts(state)) part.faces.forEach((face, i) => {
        const ref = paths.get(`${part.id}-face-${i}`);
        if (ref.d !== face.d) { ref.node.setAttribute('d', face.d); ref.d = face.d; }
        if (ref.shade !== face.shade) { ref.node.setAttribute('data-shade', face.shade); ref.shade = face.shade; }
      });
    }
    const point = model.project([state.lesson, -5, state.lessonHeight]);
    lesson.setAttribute('transform', `translate(${point.join(' ')})`);
    lesson.setAttribute('opacity', String(state.lessonOpacity));
    context.setAttribute('opacity', state.checked ? '1' : '0.35');
    if (shown !== state.stage) {
      shown = state.stage;
      readout.textContent = model.stages[shown][0];
      detail.textContent = model.stages[shown][1];
      stages.forEach((node, i) => {
        if (i === shown) node.setAttribute('aria-current', 'step');
        else node.removeAttribute('aria-current');
      });
    }
  }
  function running() { return inView && !document.hidden && !paused && !reduced.matches; }
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
    if (previous !== null) elapsed = (elapsed + Math.min((now - previous) / 1000, 0.05)) % 20;
    previous = now;
    paint();
    sync();
  }
  pause.hidden = false;
  next.hidden = false;
  pause.addEventListener('click', () => {
    paused = !paused;
    story.setAttribute('aria-live', 'off');
    sync();
  });
  next.addEventListener('click', () => {
    paused = true;
    elapsed = ((Math.floor(elapsed / 5) + 1) % 4) * 5 + 2.5;
    story.setAttribute('aria-live', 'polite');
    paint();
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  if ('IntersectionObserver' in globalThis) {
    new IntersectionObserver(entries => { inView = entries[entries.length - 1].isIntersecting; sync(); }).observe(figure);
  } // Without visibility observation, keep a still figure and working manual steps.
  paint();
  sync();
})();
