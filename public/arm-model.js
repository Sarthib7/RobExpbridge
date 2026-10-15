/* Illustration geometry only. World units and poses are artistic choices, not robot specifications. */
const exbridgeArmModel = (() => {
  const rad = Math.PI / 180;
  const camera = { origin: [340, 325], scale: 1.12, azimuth: 70, elevation: 18 };
  const a = camera.azimuth * rad, e = camera.elevation * rad, scale = camera.scale * Math.sqrt(1.6);
  const view = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
  const dot = (p, q) => p.reduce((sum, v, i) => sum + v * q[i], 0);
  const add = (p, q) => p.map((v, i) => v + q[i]);
  const mul = (p, n) => p.map(v => v * n);
  function project([x, y, z]) {
    return [camera.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * scale,
      camera.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * scale];
  }
  const path = points => points.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(v => v.toFixed(2)).join(' ')}`).join('') + 'Z';
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const lerp = (x, y, t) => x + (y - x) * t;
  const stages = [
    ['01 / Arm A records a lesson', 'A local attempt becomes a record with task context and evidence.'],
    ['02 / Check before sharing', 'Compare task, gripper and evidence. A mismatch must stop the transfer.'],
    ['03 / Arm B receives advice', 'A compatible lesson becomes an advisory. The controller keeps control.'],
    ['04 / Arm B tries locally', 'The controller decides whether to act. This motion is illustrative, not a measured recovery.'],
  ];
  function pose(elapsed) {
    const clock = ((elapsed % 20) + 20) % 20, stage = Math.floor(clock / 5), t = (clock % 5) / 5;
    const reach = t < .35 ? ease(t / .35) : t < .65 ? 1 : 1 - ease((t - .65) / .35);
    const closed = ease((t - .25) / .15) * (1 - ease((t - .65) / .15));
    return { stage, t, a: stage === 0 ? reach : 0, b: stage === 3 ? reach : 0,
      gripA: stage === 0 ? closed : 0, gripB: stage === 3 ? closed : 0,
      // A moving card denotes information, not a physical object or network transaction.
      lesson: stage === 1 ? lerp(-98, 0, ease(t * 2)) : stage === 2 ? lerp(0, 98, ease(t * 1.5)) : 0,
      lessonHeight: stage === 1 ? lerp(108, 70, ease(t * 2)) : stage === 2 ? lerp(70, 108, ease(t * 1.5)) : 108,
      lessonOpacity: stage === 1 ? ease(t / .12) : stage === 2 ? ease((1 - t) / .12) : 0,
      lessonVisible: stage === 1 || stage === 2, checked: stage === 1 && t >= .5 || stage === 2 || stage === 3,
    };
  }
  function joints(side, amount) {
    const direction = side === 'a' ? 1 : -1, base = side === 'a' ? -165 : 165;
    const dx = lerp(55, 108, amount), dz = lerp(128, 48, amount) - 55;
    const l1 = 75, l2 = 70;
    const elbowAngle = -Math.acos(Math.max(-1, Math.min(1, (dx * dx + dz * dz - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
    const shoulderAngle = Math.atan2(dz, dx) - Math.atan2(l2 * Math.sin(elbowAngle), l1 + l2 * Math.cos(elbowAngle));
    const shoulder = [base, 0, 55];
    const elbow = [base + direction * l1 * Math.cos(shoulderAngle), 0, 55 + l1 * Math.sin(shoulderAngle)];
    const wrist = [base + direction * dx, 0, 55 + dz];
    return { shoulder, elbow, wrist, shoulderAngle, elbowAngle, wristAngle: direction * .28 * (1 - amount) };
  }
  function box(id, centre, half, angle = 0, color = 'metal') {
    const c = Math.cos(angle), s = Math.sin(angle);
    const axes = [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    const faces = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const normal = mul(axes[axis], sign), other = [0, 1, 2].filter(i => i !== axis);
      const points = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => add(add(add(centre, mul(axes[axis], half[axis] * sign)), mul(axes[other[0]], half[other[0]] * u)), mul(axes[other[1]], half[other[1]] * v)));
      const light = normal[2] * .7 - normal[0] * .15 + normal[1] * .25;
      faces.push({ d: dot(normal, view) > 0 ? path(points) : '', shade: Math.max(0, Math.min(3, Math.round((light + 1) * 1.5))) });
    }
    return { id, faces, color };
  }
  function parts(state) {
    const result = [];
    for (const side of ['a', 'b']) {
      const q = joints(side, state[side]), base = q.shoulder[0], grip = side === 'a' ? state.gripA : state.gripB;
      const put = (name, centre, half, angle = 0, color) => result.push(box(`${side}-${name}`, centre, half, angle, color));
      const link = (name, from, to, y, width, depth) => {
        const centre = from.map((v, i) => (v + to[i]) / 2); centre[1] = y;
        put(name, centre, [Math.hypot(to[0]-from[0],to[2]-from[2]) / 2, depth, width], Math.atan2(to[2]-from[2],to[0]-from[0]));
      };
      put('mount', [base,0,5], [24,23,5]);
      put('pedestal', [base,0,28], [16,15,18]);
      link('upper', q.shoulder, q.elbow, -3, 8, 9);
      link('upper-rib', q.shoulder, q.elbow, 7, 4, 2);
      link('forearm', q.elbow, q.wrist, -2, 6, 7);
      link('forearm-rib', q.elbow, q.wrist, 6, 2, 1);
      for (const [name, at, radius] of [['shoulder', q.shoulder, 13], ['elbow', q.elbow, 11], ['wrist', q.wrist, 8]]) {
        const angle = name === 'wrist' ? q.wristAngle : 0;
        put(name, at, [radius,10,radius], angle, 'joint');
        put(name+'-cap', add(at,[0,11,0]), [radius-3,1,radius-3], angle);
        if (name !== 'wrist') for (const sign of [-1,1]) put(`${name}-bolt-${sign}`, add(at,[sign*(radius-5),13,0]), [1.4,1,1.4]);
      }
      const tool = (name, offset, half, color) => {
        const [x,y,z] = offset, c = Math.cos(q.wristAngle), s = Math.sin(q.wristAngle);
        put(name, add(q.wrist,[x*c-z*s,y,x*s+z*c]), half, q.wristAngle, color);
      };
      tool('ram', [0,0,-10], [5,5,6]);
      tool('palm', [0,0,-16], [10,11,3]);
      const gap = lerp(14,9,grip);
      for (const sign of [-1,1]) {
        tool('finger-'+sign, [0,sign*gap,-25], [6,2,7], 'grip');
        tool('pad-'+sign, [0,sign*(gap-2),-29], [6,1,3], 'joint');
      }
    }
    return result;
  }
  function markup(state) {
    return parts(state).map(part => `<g data-robot-part="${part.id}" class="robot-${part.color}">${part.faces.map((face,i) => `<path id="${part.id}-face-${i}" class="robot-face" data-shade="${face.shade}" d="${face.d}"/>`).join('')}</g>`).join('');
  }
  return { camera, project, pose, joints, parts, markup, stages };
})();
