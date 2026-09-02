// The Ways — terrain for the trajectory wood (design: each chosen way is its
// own visual world; pockets isolated by fog; the trailhead is the only shared
// ground). Vertical slice: trailhead pocket + the Birchlight pocket (ignores-a).
// Atmosphere is scene-global, so pocket identity = a preset the part crossfades
// through dyn.wood when the player passes a mouth.
import * as THREE from '../vendor/three/three.module.js';
import { rng, mat, jitter } from './build.js';

const BIRCH_C = { x: 0, z: 315 };    // pocket centres, mutually beyond fog range
const PINE_C  = { x: -300, z: 315 };
const RISE_C  = { x: 300, z: 315 };
export const SHIFTS = { 'ignores-a': 0, 'swap': -300, 'true': 300 };

export const PRESETS = {
  trailhead: { skyTop: '#a8bda6', skyBot: '#dfe6d6', fog: '#d8dfd0', fogN: 16, fogF: 78,
               sunC: '#f2e6c8', sunI: 1.55, hemiC: '#cfd9c4', hemiI: 1.0, ambI: 0.8 },
  birch:     { skyTop: '#cfe0b8', skyBot: '#eef2da', fog: '#e8eed6', fogN: 22, fogF: 105,
               sunC: '#fff4d8', sunI: 2.05, hemiC: '#e2ecca', hemiI: 1.28, ambI: 0.95 },
  pine:      { skyTop: '#8fa694', skyBot: '#cfd8cb', fog: '#c6cfc4', fogN: 12, fogF: 68,
               sunC: '#e8e0c8', sunI: 1.35, hemiC: '#aebfae', hemiI: 0.85, ambI: 0.72 },
  rise:      { skyTop: '#a3b8a0', skyBot: '#d8e2d2', fog: '#d0dccc', fogN: 18, fogF: 92,
               sunC: '#f6ecd2', sunI: 1.72, hemiC: '#c6d4bc', hemiI: 1.05, ambI: 0.85 },
  train:     { skyTop: '#b8c2a8', skyBot: '#e8e2cc', fog: '#e0dcc8', fogN: 18, fogF: 85,
               sunC: '#f6e8c0', sunI: 1.8, hemiC: '#d8d2b8', hemiI: 1.15, ambI: 0.9 },
};
const TRAIN_C = { x: 0, z: -300 };

function heightField(x, z) {
  const w = (cx, cz, R) => { const d = Math.hypot(x - cx, z - cz); return Math.max(0, Math.min(1, 1 - (d - R) / 22)); };
  const wT = w(0, 2, 34), wB = w(BIRCH_C.x, BIRCH_C.z, 58), wP = w(PINE_C.x, PINE_C.z, 58), wR = w(RISE_C.x, RISE_C.z, 58), wG = w(0, -300, 40);
  const n = (a, f) => a * (Math.sin(x * .13) * Math.cos((z - 315) * .11) + .4 * Math.sin((x + z) * .21)) * f;
  const climb = Math.max(0, Math.min(60, z - 300)) * .05 * wR;    // the rise: ~3 m gained mouth → summit
  return n(.35, wT) + n(.6, wB) + n(.45, wP) + n(.85, wR) + n(.25, wG) + climb;
}

// the birch trail's spine — the part places its stations on these numbers
export const BIRCH_PATH = [[0, 293], [3, 301], [-2, 309], [2, 317], [0, 325], [-3, 333], [0, 341], [3, 349], [0, 357], [0, 362]];

function spine(ctrl) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const pts = [];
  for (let i = 0; i <= 240; i++) { const p = c.getPoint(i / 240); p.y = heightField(p.x, p.z); pts.push(p); }
  return pts;
}
const distTo = (pts, x, z) => { let d = 1e9; for (let i = 0; i < pts.length; i += 4) d = Math.min(d, Math.hypot(pts[i].x - x, pts[i].z - z)); return d; };

function ribbon(scene, pts, w, color, r) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)];
    const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L, ww = w * (0.8 + r() * 0.5);
    pos.push(p.x + nx * ww, p.y + .09, p.z + nz * ww, p.x - nx * ww, p.y + .09, p.z - nz * ww);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { flatShading: false, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
}

function patch(scene, cx, cz, sx, sz, color) {
  const g = new THREE.PlaneGeometry(sx, sz, Math.round(sx / 1.6), Math.round(sz / 1.6));
  g.rotateX(-Math.PI / 2);
  const a = g.attributes.position;
  for (let i = 0; i < a.count; i++) a.setY(i, heightField(a.getX(i) + cx, a.getZ(i) + cz));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { flatShading: false }));
  m.position.set(cx, 0, cz);
  m.receiveShadow = true;
  scene.add(m);
}

function birchTree(r, s) {
  const g = new THREE.Group(), H = (5.5 + r() * 3) * s;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.1 * s, .17 * s, H, 7), mat('#e8e4da'));
  t.position.y = H / 2; t.castShadow = true; g.add(t);
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(.2 * s, .08, .05), mat('#33302a'));
    d.position.set(0, H * (.12 + .12 * i), .13 * s * (i % 2 ? .6 : -.6));
    d.rotation.y = r() * 3.14; g.add(d);
  }
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), mat('#7f9c55'));
  c.position.y = H * .95; c.scale.y = .7; c.castShadow = true; g.add(c);
  g.rotation.z = (r() - .5) * .08;
  return g;
}
function pineTree(r, s) {
  const g = new THREE.Group(), H = (8 + r() * 3) * s;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.14 * s, .3 * s, H, 7), mat('#5a4a38'));
  t.position.y = H / 2; t.castShadow = true; g.add(t);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((2.1 - .5 * i) * s, H * .3, 8), mat(i ? '#33553f' : '#2b4438'));
    c.position.y = H * (.5 + .18 * i); c.castShadow = true; g.add(c);
  }
  return g;
}
function bushBlob(r, s) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.5 * s, 0), mat('#375a3c'));
  m.position.y = .32 * s; m.scale.y = .7; m.castShadow = true;
  return m;
}
function groveTree(r, s) {
  const g = new THREE.Group(), H = (3 + r() * 2.4) * s;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.13 * s, .22 * s, H, 7), mat('#5a4a38'));
  t.position.y = H / 2; t.castShadow = true; g.add(t);
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 + r() * .8) * s, 0), mat(r() < .5 ? '#2b4438' : '#33553f'));
    c.position.set((r() - .5) * 1.3 * s, H * (.82 + r() * .3), (r() - .5) * 1.3 * s);
    c.scale.y = .75; c.castShadow = true; g.add(c);
  }
  return g;
}

export function buildWood(scene, world, enc) {
  const P = world.palette;
  const dyn = { canopies: [], motes: null, t: 0, waystones: [] };
  const colliders = [];
  const solid = [];
  const interact = [];
  const r = rng(9182);

  // ---------- sky, light (preset-driven, follows the player) ----------
  scene.fog = new THREE.Fog(new THREE.Color('#d8dfd0'), 16, 78);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#a8bda6') }, bottom: { value: new THREE.Color('#dfe6d6') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.18, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    })
  );
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#cfd9c4'), new THREE.Color('#43503b'), 1.0);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(new THREE.Color('#4a5540'), 0.8);
  scene.add(amb);
  const sun = new THREE.DirectionalLight('#f2e6c8', 1.55);
  sun.position.set(12, 26, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 90 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  const sunTarget = new THREE.Object3D(); scene.add(sunTarget); sun.target = sunTarget;
  scene.add(sun);
  dyn.atmo = { skyMat: sky.material, hemi, amb, sun };
  dyn.groundH = heightField;

  // preset crossfade + follow — driven each frame by the part's update
  let cur = { ...PRESETS.trailhead }, tgt = { ...PRESETS.trailhead }, mix = 1;
  const cl = (h) => new THREE.Color(h);
  dyn.wood = {
    setPocket(name, instant) { tgt = { ...PRESETS[name] }; if (instant) { cur = { ...tgt }; mix = 1; } else mix = 0; },
    update(dt, camera) {
      mix = Math.min(1, mix + dt / 1.4);
      const k = mix * mix * (3 - 2 * mix);
      const L = (a, b) => a + (b - a) * k;
      // the world-wide night toggle (N) blends every pocket toward one dark —
      // the pocket system owns these handles each frame, so it must carry night
      const at = (typeof window !== 'undefined' && window.__lw && window.__lw.atmo) ? window.__lw.atmo.t : 0;
      const nt = at * at * (3 - 2 * at);
      const NC = { skyTop: cl('#131c31'), skyBot: cl('#1c2536'), fog: cl('#161e2c'), sunC: cl('#bccce8'), hemiC: cl('#56679c') };
      const col = (a, b, n) => cl(a).lerp(cl(b), k).lerp(n, nt);
      sky.material.uniforms.top.value.copy(col(cur.skyTop, tgt.skyTop, NC.skyTop));
      sky.material.uniforms.bottom.value.copy(col(cur.skyBot, tgt.skyBot, NC.skyBot));
      scene.fog.color.copy(col(cur.fog, tgt.fog, NC.fog));
      scene.fog.near = L(cur.fogN, tgt.fogN);
      scene.fog.far = L(cur.fogF, tgt.fogF) * (1 - .15 * nt);
      sun.color.copy(col(cur.sunC, tgt.sunC, NC.sunC));
      sun.intensity = L(cur.sunI, tgt.sunI) * (1 - .42 * nt);
      hemi.color.copy(col(cur.hemiC, tgt.hemiC, NC.hemiC));
      hemi.intensity = L(cur.hemiI, tgt.hemiI) * (1 - nt) + 1.0 * nt;
      amb.intensity = L(cur.ambI, tgt.ambI) * (1 - nt) + .95 * nt;
      if (mix >= 1) cur = { ...tgt };
      if (camera) {           // the dome and the shadow window travel with the walker
        sky.position.set(camera.position.x, 0, camera.position.z);
        sun.position.set(camera.position.x + 12, 26, camera.position.z + 8);
        sunTarget.position.set(camera.position.x, 0, camera.position.z);
      }
    },
    blazeTrunks: [],
  };

  // ---------- trailhead pocket ----------
  patch(scene, 0, 2, 110, 84, P.ground);
  { // worn ground: spawn → item stone → the three mouths
    const way = spine([[0, -16], [0, -6], [0, 4], [0, 12], [0, 17]]);
    ribbon(scene, way, 1.0, P.groundLit, r);
    ribbon(scene, spine([[0, 8], [5, 12], [10, 15.5]]), .7, P.groundLit, r);
    ribbon(scene, spine([[0, 8], [-5, 12], [-10, 15.5]]), .7, P.groundLit, r);
  }
  // grove trees ringing the clearing; the treeline wall at z 14..20 with gaps at x −10 / 0 / +10
  for (let i = 0; i < 70; i++) {
    const x = -42 + r() * 84, z = -20 + r() * 42;
    const dC = Math.hypot(x, z - 2);
    if (dC < 12 && z < 13) continue;                               // the clearing stays open
    if (z > 13 && z < 21) {                                        // the treeline: solid but for the mouths
      if (Math.abs(x - 10) < 2.2 || Math.abs(x + 10) < 2.2 || Math.abs(x) < 2.2) continue;
    } else if (z >= 21) continue;                                  // beyond the wall: nothing (fog owns it)
    const t = groveTree(r, .9 + r() * .6);
    t.position.set(x, heightField(x, z), z);
    scene.add(t);
    colliders.push({ type: 'circle', x, z, r: .45 });
    solid.push(t);
  }
  // extra treeline density so the wall reads as a wall
  for (let x = -40; x <= 40; x += 2.6) {
    if (Math.abs(x - 10) < 2.4 || Math.abs(x + 10) < 2.4 || Math.abs(x) < 2.4) continue;
    const jx = x + (r() - .5) * 1.2, jz = 15.5 + (r() - .5) * 3.4;
    const t = groveTree(r, 1.0 + r() * .7);
    t.position.set(jx, heightField(jx, jz), jz);
    scene.add(t);
    colliders.push({ type: 'circle', x: jx, z: jz, r: .45 });
    solid.push(t);
  }
  // previews: a taste of each destination stands just beyond its gap
  for (const [dx, mk] of [[10, 'birch'], [-10, 'pine']]) {
    for (let i = 0; i < 3; i++) {
      const x = dx + (r() - .5) * 3.5, z = 21.5 + r() * 4;
      const t = mk === 'birch' ? birchTree(r, .8 + r() * .4) : pineTree(r, .7 + r() * .3);
      t.position.set(x, heightField(x, z), z);
      scene.add(t); solid.push(t);
    }
  }
  { // rise preview: boulders and a log step beyond the centre gap
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.5 + r() * .7, 0), mat('#7b7f6f'));
      b.scale.set(1, .6, .85);
      const x = (r() - .5) * 3, z = 22 + r() * 3;
      b.position.set(x, heightField(x, z) + .2, z); b.castShadow = true;
      scene.add(b); solid.push(b);
    }
  }
  // grass
  {
    const geo = new THREE.ConeGeometry(.045, .3, 5); geo.translate(0, .15, 0);
    const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const inst = new THREE.InstancedMesh(geo, m, 420);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let i = 0; i < 420; i++) {
      const x = -45 + r() * 90, z = -20 + r() * 40;
      e.set((r() - .5) * .2, r() * Math.PI, (r() - .5) * .2); q.setFromEuler(e);
      sc.setScalar(.7 + r() * 1.2);
      M.compose(new THREE.Vector3(x, heightField(x, z), z), q, sc);
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, jitter(r() < .3 ? P.groundLit : '#54683c', r, .02, .1, .1));
    }
    inst.receiveShadow = true; scene.add(inst);
  }

  // ---------- the birch pocket (ignores-a) ----------
  patch(scene, BIRCH_C.x, BIRCH_C.z, 130, 150, '#55663d');
  const bp = spine(BIRCH_PATH);
  ribbon(scene, bp, .95, '#95835f', r);
  ribbon(scene, spine([[0, 359], [4, 357], [7.5, 354.5]]), .75, '#95835f', r);   // home spur to the return ring
  for (let i = 0; i < 120; i++) {
    const x = BIRCH_C.x - 55 + r() * 110, z = BIRCH_C.z - 68 + r() * 140;
    const d = distTo(bp, x, z);
    if (d < 2.1 || d > 30) continue;
    const t = birchTree(r, .75 + r() * .65);
    t.position.set(x, heightField(x, z), z);
    scene.add(t);
    colliders.push({ type: 'circle', x, z, r: .4 });
    solid.push(t);
    if (d < 5) dyn.wood.blazeTrunks.push({ x, z, t });
  }
  for (let i = 0; i < 150; i++) {   // verge growth
    const p = bp[Math.floor(r() * bp.length)];
    const a = r() * 6.28, d = 1.5 + r() * 2.4;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (distTo(bp, x, z) < 1.2) continue;
    const u = r() < .55 ? bushBlob(r, .55 + r() * .5) : (() => { const g = new THREE.Mesh(new THREE.ConeGeometry(.05, .4, 5), mat('#5c7345')); g.position.y = .18; return g; })();
    u.position.set(x, heightField(x, z), z);
    scene.add(u);
  }

  // ---------- the pine pocket (swap) ----------
  patch(scene, PINE_C.x, PINE_C.z, 130, 150, '#5d5138');
  const shift = (dx) => BIRCH_PATH.map(([x, z]) => [x + dx, z]);
  const pp = spine(shift(-300));
  ribbon(scene, pp, .95, '#7a6647', r);
  // the way home loops off BEFORE the arch — this way's arch never opens
  ribbon(scene, spine([[-300, 330], [-296.5, 328.5], [-292.5, 326.5]]), .75, '#7a6647', r);
  for (let i = 0; i < 105; i++) {
    const x = PINE_C.x - 55 + r() * 110, z = PINE_C.z - 68 + r() * 140;
    const d = distTo(pp, x, z);
    if (d < 2.1 || d > 30) continue;
    const t = pineTree(r, .8 + r() * .55);
    t.position.set(x, heightField(x, z), z);
    scene.add(t);
    colliders.push({ type: 'circle', x, z, r: .45 });
    solid.push(t);
  }
  for (let i = 0; i < 6; i++) {   // light shafts through the firs
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + r() * 1.6, 15),
      new THREE.MeshBasicMaterial({ color: '#fff7e0', transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const p = pp[30 + Math.floor(r() * 170)];
    s.position.set(p.x + (r() - .5) * 7, 7, p.z + (r() - .5) * 7);
    s.rotation.set(0, r() * 3.14, .36);
    scene.add(s);
  }
  for (let i = 0; i < 90; i++) {   // needle-floor tufts, sparse
    const p = pp[Math.floor(r() * pp.length)];
    const a = r() * 6.28, d = 1.5 + r() * 2.6;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (distTo(pp, x, z) < 1.2) continue;
    const g = new THREE.Mesh(new THREE.ConeGeometry(.05, .35, 5), mat('#6b7a4c'));
    g.position.set(x, heightField(x, z) + .16, z);
    scene.add(g);
  }

  // ---------- the rise pocket (true way; the climb) ----------
  patch(scene, RISE_C.x, RISE_C.z, 130, 150, '#4c5a3e');
  const rp = spine(shift(300));
  ribbon(scene, rp, .95, '#7d6a4e', r);
  ribbon(scene, spine([[300, 359], [304, 357], [307.5, 354.5]]), .75, '#7d6a4e', r);
  for (let i = 0; i < 110; i++) {
    const x = RISE_C.x - 55 + r() * 110, z = RISE_C.z - 68 + r() * 140;
    const d = distTo(rp, x, z);
    if (d < 2.1 || d > 30) continue;
    const t = r() < .4 ? pineTree(r, .68 + r() * .4) : groveTree(r, .95 + r() * .6);
    t.position.set(x, heightField(x, z), z);
    scene.add(t);
    colliders.push({ type: 'circle', x, z, r: .45 });
    solid.push(t);
  }
  for (let i = 0; i < 9; i++) {    // boulders flanking the climb
    const p = rp[Math.floor(r() * rp.length)];
    const a = r() * 6.28, d = 2.2 + r() * 5;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.6 + r() * 1.1, 0), mat('#7b7f6f'));
    b.scale.set(1, .6, .85);
    b.position.set(x, heightField(x, z) + .25, z);
    b.castShadow = true;
    scene.add(b); solid.push(b);
    colliders.push({ type: 'circle', x, z, r: .7 });
  }
  for (let i = 0; i < 3; i++) {    // log steps where the way gains ground
    const p = rp[150 + i * 18], q = rp[151 + i * 18];
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, 2.1, 7), mat('#5f4d36'));
    l.rotation.z = Math.PI / 2;
    l.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    l.position.set(p.x, p.y + .1, p.z);
    l.castShadow = true;
    scene.add(l);
  }
  for (let i = 0; i < 110; i++) {  // verge
    const p = rp[Math.floor(r() * rp.length)];
    const a = r() * 6.28, d = 1.5 + r() * 2.4;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (distTo(rp, x, z) < 1.2) continue;
    const u = r() < .5 ? bushBlob(r, .5 + r() * .5) : (() => { const g = new THREE.Mesh(new THREE.ConeGeometry(.05, .42, 5), mat('#5c7345')); g.position.y = .19; return g; })();
    u.position.set(x, heightField(x, z), z);
    scene.add(u);
  }

  // ---------- the training grove (a = 1 revision; calm study light) ----------
  patch(scene, TRAIN_C.x, TRAIN_C.z, 110, 110, '#576540');
  { const plaza = new THREE.Mesh(new THREE.CircleGeometry(11, 28), mat(P.groundLit, { flatShading: false }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, heightField(0, -302) + .012, -302);
    plaza.receiveShadow = true;
    scene.add(plaza);
  }
  for (let i = 0; i < 26; i++) {   // a sheltering ring of trees around the clearing
    const a = (i / 26) * Math.PI * 2 + r() * .2;
    const d = 16 + r() * 8;
    const x = Math.cos(a) * d, z = -302 + Math.sin(a) * d;
    const t = groveTree(r, 1.0 + r() * .6);
    t.position.set(x, heightField(x, z), z);
    scene.add(t);
    colliders.push({ type: 'circle', x, z, r: .45 });
    solid.push(t);
  }

  return { colliders, solid, interact, dyn };
}
