import * as THREE from '../../vendor/three/three.module.js';

// ============================================================================
// vale-twelve — Chapter I of the Factorization World (stratum: numbers)
// Region x −22..22, z −62..−28. Owns the plaza (three arches at z −52),
// the pebble tray (the 3×4 pebbles ARE the data), and the Twelve-Gate at
// z −30 (open TEXT input; classifier per design/confusion-atlas/01-integers.md).
//
// MANIFEST (chunks, appended in order; each ends with a complete marker):
//   1/8 head       — imports, manifest, STR placeholder table, enc derivation,
//                    helpers, class skeleton (constructor + export)
//   2/8 classifier — parse + classifyTwelve (pure, named export; truth derived
//                    at runtime from N, never stored)
//   3/8 plaza      — three arches at z −52; west/east sealed (lattice+collider),
//                    centre open; architect names
//   4/8 tray       — tray, 12 pebbles from enc data, ghost frame, layouts,
//                    gaze proxy
//   5/8 gate       — fence+door across the vale at z −30, active() collider,
//                    door rig, gate proxy
//   6/8 interact   — onInteract, panel(st) card HTML, panelAnchor
//   7/8 onPanel    — input routing → repair beats, gate open, memory
//                    (enc._vale.twelveFactorization), logs vale.twelve.*
//   8/8 update+labels — pebble easing, door swing (anticipation→ease→settle),
//                    distance-checked chips, architect chips
// ============================================================================

// ---- player-facing strings — ALL PLACEHOLDERS (register: first course) ------
const STR = {
  trayTitle:   'The tray',                                          // PLACEHOLDER
  trayLede:    'Count the rows. Read what they say.',               // PLACEHOLDER
  trayGoOn:    'The gate to the north asks for twelve.',            // PLACEHOLDER
  gateTitle:   'The Twelve-Gate',                                   // PLACEHOLDER
  gateLede:    'Give one factorization of 12 — any true product opens the way.', // PLACEHOLDER
  gateBtn:     'Lay it',                                            // PLACEHOLDER
  hintTypes:   'Numbers and ×. Enter commits.',                     // PLACEHOLDER
  addSplit:    (k, m) => `Two equal parts — equal parts are what rows count. The tray lays it: ${k} × ${m}.`, // PLACEHOLDER
  addUneven:   (a, b) => `${a} + ${b} makes 12, but the rows come out uneven. Sums are loose; products are rows.`, // PLACEHOLDER
  listSocket:  (d) => `The tray takes your ${d} as one row. ${d} × ▢ = 12 — what fills the socket?`, // PLACEHOLDER
  tailFold:    (a, t) => `A block and a tail. The tail is one more column: ${a} × ${a} + ${t} = ${a} × ${a + 1}.`, // PLACEHOLDER
  ranOut:      (a) => `Rows of ${a} — the tray runs out mid-row. The remainder stands.`, // PLACEHOLDER
  leftOver:    (n) => `The frame fills, and ${n} pebbles are left standing.`, // PLACEHOLDER
  frameEmpty:  'The frame stands mostly empty. Count what it asks for.', // PLACEHOLDER
  wholeOnly:   'This tray stocks whole pebbles only.',               // PLACEHOLDER
  inParts:     'In parts — ▢ × ▢.',                                  // PLACEHOLDER
  opened:      'The rows fill the frame exactly. The gate knows this shape.', // PLACEHOLDER
  gateLabel:   'The Twelve-Gate',                                    // PLACEHOLDER
  trayLabel:   'A pebble tray',                                      // PLACEHOLDER
  promptTray:  'Work the tray',                                      // PLACEHOLDER
  promptGate:  'Answer the gate',                                    // PLACEHOLDER
};

// ---- data derivation (enc block `twelve`; truth derived, never stored) ------
function deriveTwelve(enc) {
  const b = (enc && enc.twelve) || {};
  const N = Number.isInteger(b.n) ? b.n : 12;
  const rows = (b.openers && Number.isInteger(b.openers.rows)) ? b.openers.rows : 3;
  const cols = (b.openers && Number.isInteger(b.openers.cols)) ? b.openers.cols : 4;
  return { N, rows, cols }; // rows*cols === N by data contract; pebbles are built FROM this
}

// ---- helpers ----------------------------------------------------------------
const now = () => (globalThis.performance && performance.now) ? performance.now() : Date.now();
function mat(hex, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: rough, flatShading: true });
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
}
// world palette (content/vale.json palette)
const PAL = { stone: 0x8a8578, stoneLit: 0xa49d8c, trunk: 0x5a4a38, ink: 0x26221d,
  gold: 0xc8a24a, vellum: 0xe2d6bb, ground: 0x4a5c3a };

export default class ValeTwelve {
  constructor(ctx) {
    this.ctx = ctx;
    this.log = ctx.log;
    this.enc = ctx.enc;
    this.data = deriveTwelve(ctx.enc);
    this.colliders = [];
    this.solid = [];
    this.interactables = [];
    this.time = 0;
    // state machine: 'opener' (tray read) → 'gate' (asking) → 'open' (done)
    this.phase = 'opener';
    this.mode = 'tray';          // which card the panel shows: 'tray' | 'gate'
    this.gateOpen = false;
    this.doorT = -1;             // <0 idle; ≥0 swing timeline (s)
    this.socketDiv = null;       // pending divisor for the LIST completion socket
    this.feedback = '';          // current card feedback line (already-safe text)
    this.feedbackEq = '';        // KaTeX tex for the card .eq, '' = default reading
    this.readingTex = `${this.data.rows} \\times ${this.data.cols} = ${this.data.N}`;
    this._raw = '';              // mirrored text-input value (event-shape defensive)
    this._askT0 = 0;             // think-time anchor: gate card opened
    this._gateT0 = 0;            // first time the gate was ever asked
    this._pebbles = [];          // meshes; targets in _pebbles[i].userData.tgt
    this._PH = null;
    this.panelAnchor = { x: 0, z: -38, reach: 9 };
    this._buildPlaza();
    this._buildTray();
    this._buildGate();
  }
}
// —— chunk 1/8 (head) complete

// ---- classifier (pure; atlas 01 §4 routing; truth = product===N at runtime) --
const TIMES = /[×xX*·⋅]/;
function _num(s) { const v = Number(s); return Number.isFinite(v) ? v : null; }
function _term(s) { // one +/− term → {factors:[..]|null}
  const parts = s.split(TIMES).map(t => t.trim()).filter(t => t.length);
  if (!parts.length) return null;
  const fs = parts.map(_num);
  return fs.some(v => v === null) ? null : fs;
}
export function classifyTwelve(raw, N = 12) {
  const s = String(raw ?? '').trim().replace(/−/g, '-').replace(/\s+/g, ' ');
  if (!s) return { cls: 'empty' };
  if (/[a-wyzA-WYZ]/.test(s)) return { cls: 'noparse' };            // letters (x = times)
  // comma/space list of bare numbers (no operators)
  if (!TIMES.test(s) && !/[+\-]/.test(s) && /[, ]/.test(s)) {
    const list = s.split(/[, ]+/).map(_num);
    if (list.some(v => v === null)) return { cls: 'noparse' };
    if (list.length === 2 && Number.isInteger(list[0]) && Number.isInteger(list[1])
        && list[0] * list[1] === N) return { cls: 'pair', a: list[0], b: list[1] }; // demand assembly
    const d = list.find(v => Number.isInteger(v) && v > 1 && v < N && N % v === 0)
           ?? list.find(v => Number.isInteger(v) && v > 0 && N % v === 0);
    return d ? { cls: 'list', d, list } : { cls: 'noparse' };
  }
  if (/[+\-]/.test(s)) {                                             // additive expression
    const terms = s.split(/(?=[+\-])/).map(t => t.trim());
    const sign = t => t.startsWith('-') ? -1 : 1;
    const strip = t => t.replace(/^[+\-]\s*/, '');
    const parsed = terms.map(t => ({ sg: sign(t), fs: _term(strip(t)) }));
    if (parsed.some(p => !p.fs)) return { cls: 'noparse' };
    const vals = parsed.map(p => p.sg * p.fs.reduce((x, y) => x * y, 1));
    const v = vals.reduce((x, y) => x + y, 0);
    const hasProd = parsed.some(p => p.fs.length > 1);
    if (v === N && hasProd) {                                        // INT-TAIL → the fold
      const [a, b] = parsed[0].fs.length > 1 ? parsed[0].fs : [1, parsed[0].fs[0]];
      const tail = v - a * b;
      const folds = tail > 0 && Number.isInteger(tail / a) && tail / a > 0;
      return { cls: 'tail', a, b, tail, folds, add: folds ? tail / a : 0 };
    }
    if (v === N) {                                                   // pure sum, right value
      const eq = vals.every(x => x === vals[0]) && vals.length > 1 && vals[0] > 0;
      return eq ? { cls: 'add-split', k: vals.length, m: vals[0] }   // INT-ADD-SPLIT → convert
                : { cls: 'add-uneven', terms: vals };                // the 7+5 contrast
    }
    return { cls: 'nondiv', sub: 'sum', value: v };                  // wrong value → NO-CHECK family
  }
  if (TIMES.test(s)) {                                               // pure product
    const fs = _term(s);
    if (!fs) return { cls: 'noparse' };
    if (fs.some(v => !Number.isInteger(v))) return { cls: 'rational', factors: fs }; // INT-RATIONAL
    if (fs.some(v => v <= 0)) return { cls: 'noparse' };             // negatives: signs chapter
    const v = fs.reduce((x, y) => x * y, 1);
    if (v === N) {
      const factors = fs.slice().sort((x, y) => x - y);
      return { cls: 'correct', factors, value: v,
               trivial: fs.includes(1), depth: fs.length > 2 };
    }
    const sub = (fs.length === 2 && fs[0] === fs[1] && fs[0] * 2 === N) ? 'half'     // INT-HALF 6×6
              : fs.includes(N) ? 'multiple'                                          // INT-MULTIPLE 12×k
              : (String(fs.join('')) === String(N)) ? 'digit-read' : 'prod';         // 1×2 digit-read
    return { cls: 'nondiv', sub, a: fs[0], b: fs[1], factors: fs, value: v };        // INT-NONDIV/NO-CHECK
  }
  const m = _num(s);                                                 // bare number
  if (m === null) return { cls: 'noparse' };
  if (!Number.isInteger(m)) return { cls: 'rational', factors: [m] };
  if (m === N) return { cls: 'noop' };                               // "12" — in-parts probe
  if (m > 0 && N % m === 0) return { cls: 'list', d: m };            // bare divisor → socket
  return { cls: 'nondiv', sub: 'bare', a: m, value: m };             // rows of m run out
}
// —— chunk 2/8 (classifier) complete

// ---- plaza: three arches at z −52 (west/east sealed, centre open) -----------
ValeTwelve.prototype._buildPlaza = function () {
  const scene = this.ctx.scene;
  const Z = -52;
  const stone = mat(PAL.stone), lit = mat(PAL.stoneLit), dark = mat(PAL.ink, 1.0);
  // [x, sealed, architect concept] — names live in architect view only (vale.json)
  const arches = [
    [-7, true,  'method world: vertex form (sealed)'],
    [ 0, false, 'method world: factorization (this world)'],
    [ 7, true,  'method world: quadratic formula (sealed)'],
  ];
  this._archChips = [];
  for (const [ax, sealed, concept] of arches) {
    const g = new THREE.Group();
    g.position.set(ax, 0, Z);
    g.add(box(0.6, 3.0, 0.6, stone, -1.6, 1.5, 0));   // west post
    g.add(box(0.6, 3.0, 0.6, stone,  1.6, 1.5, 0));   // east post
    g.add(box(4.4, 0.7, 0.7, lit, 0, 3.35, 0));        // lintel (above head: no collider)
    g.add(box(0.9, 0.25, 0.9, lit, -1.6, 3.0, 0));     // capitals
    g.add(box(0.9, 0.25, 0.9, lit,  1.6, 3.0, 0));
    if (sealed) {                                       // honest stone lattice
      for (let i = 0; i < 4; i++) g.add(box(0.09, 3.0, 0.09, dark, -0.975 + i * 0.65, 1.5, 0));
      for (let j = 0; j < 3; j++) g.add(box(2.6, 0.09, 0.09, dark, 0, 0.75 + j * 0.75, 0));
      this.colliders.push({ type: 'aabb', minX: ax - 1.9, maxX: ax + 1.9,
                            minZ: Z - 0.35, maxZ: Z + 0.35 });
    } else {                                            // open centre: posts only
      this.colliders.push({ type: 'aabb', minX: ax - 1.9, maxX: ax - 1.3,
                            minZ: Z - 0.35, maxZ: Z + 0.35 });
      this.colliders.push({ type: 'aabb', minX: ax + 1.3, maxX: ax + 1.9,
                            minZ: Z - 0.35, maxZ: Z + 0.35 });
    }
    scene.add(g);
    this.solid.push(g);
    this._archChips.push({ id: `vt-arch-${ax}`, x: ax, z: Z, text: concept });
  }
};
// —— chunk 3/8 (plaza) complete

// ---- tray: the pebbles ARE the data (N = rows*cols from enc.twelve) ---------
const TRAY = { x: 0, z: -38, top: 0.42, gap: 0.3 };
ValeTwelve.prototype._buildTray = function () {
  const scene = this.ctx.scene;
  const rig = new THREE.Group();
  rig.position.set(TRAY.x, 0, TRAY.z);
  rig.add(box(2.8, 0.36, 2.2, mat(PAL.trunk), 0, 0.18, 0));          // tray body
  rig.add(box(2.8, 0.14, 0.1, mat(PAL.trunk, 1), 0, 0.47, -1.05));   // rims
  rig.add(box(2.8, 0.14, 0.1, mat(PAL.trunk, 1), 0, 0.47, 1.05));
  rig.add(box(0.1, 0.14, 2.2, mat(PAL.trunk, 1), -1.35, 0.47, 0));
  rig.add(box(0.1, 0.14, 2.2, mat(PAL.trunk, 1), 1.35, 0.47, 0));
  scene.add(rig);
  this.solid.push(rig);
  this._trayRig = rig;
  const pebGeo = new THREE.IcosahedronGeometry(0.085, 0);
  const pebMat = mat(PAL.vellum, 0.8);
  for (let i = 0; i < this.data.N; i++) {                             // exactly N — the data
    const p = new THREE.Mesh(pebGeo, pebMat);
    p.userData.tgt = { x: 0, y: TRAY.top + 0.09, z: 0 };
    rig.add(p);
    this._pebbles.push(p);
  }
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false }));
  ghost.rotation.x = -Math.PI / 2;
  ghost.position.y = TRAY.top + 0.02;
  ghost.visible = false;
  rig.add(ghost);
  this._ghost = ghost;
  this.colliders.push({ type: 'aabb', minX: -1.5, maxX: 1.5, minZ: TRAY.z - 1.2, maxZ: TRAY.z + 1.2 });
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.8),
    new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(TRAY.x, 1.0, TRAY.z);                           // standalone, not occluded
  proxy.userData.act = { part: 'vale-twelve', kind: 'tray',
    prompt: STR.promptTray, label: STR.trayLabel, reach: 8 };
  proxy.userData.glowRoot = rig;
  scene.add(proxy);
  this.interactables.push(proxy);
  this._cues = [];                                                    // {at, fn} timed beats
  this._layOpener();
};
// slot → local tray coords, grid centered (row iz of `rows`, col ix of `cols`)
ValeTwelve.prototype._slot = function (ix, iz, cols, rows) {
  return { x: (ix - (cols - 1) / 2) * TRAY.gap, y: TRAY.top + 0.09,
           z: (iz - (rows - 1) / 2) * TRAY.gap };
};
ValeTwelve.prototype._frame = function (cols, rows) {                 // ghost rectangle
  this._ghost.visible = true;
  this._ghost.scale.set(cols * TRAY.gap + 0.06, rows * TRAY.gap + 0.06, 1);
};
ValeTwelve.prototype._pileSpot = function (i, cx, cz) {               // deterministic pile
  const a = i * 2.399963;                                             // golden-angle walk
  const r = 0.16 + 0.085 * Math.sqrt(i);
  return { x: cx + r * Math.cos(a), y: TRAY.top + 0.09, z: cz + r * Math.sin(a) };
};
ValeTwelve.prototype._layOpener = function () {                       // rows×cols from enc
  const { rows, cols } = this.data;
  this._ghost.visible = false;
  this._pebbles.forEach((p, i) =>
    p.userData.tgt = this._slot(i % cols, Math.floor(i / cols), cols, rows));
  this.readingTex = `${rows} \\times ${cols} = ${this.data.N}`;
};
// claim a×b (a rows of b) — honest build: fill claimed frame; shortfall/leftover stand
ValeTwelve.prototype._layClaim = function (a, b) {
  const rows = a, cols = b ?? Math.ceil(this.data.N / a);
  if (b) this._frame(cols, rows); else this._ghost.visible = false;
  this._pebbles.forEach((p, i) => {
    p.userData.tgt = (i < rows * cols)
      ? this._slot(i % cols, Math.floor(i / cols), cols, rows)       // row by row, runs out mid-row
      : this._pileSpot(i, 1.05, 0.75);                                // the remainder stands
  });
};
ValeTwelve.prototype._laySplit = function (k, m) {                    // k equal parts, held apart…
  this._ghost.visible = false;
  this._pebbles.forEach((p, i) => {
    const s = this._slot(i % m, Math.floor(i / m), m, k);
    s.z += (Math.floor(i / m) - (k - 1) / 2) * 0.34;                  // gap: the k counts PARTS
    p.userData.tgt = s;
  });
  this._cues.push({ at: this.time + 1.3, fn: () => {                  // …then the rows close: k×m
    this._pebbles.forEach((p, i) => p.userData.tgt = this._slot(i % m, Math.floor(i / m), m, k));
    this._frame(m, k);
  } });
};
ValeTwelve.prototype._layTail = function (a, b, add) {                // block + tail, then the fold
  this._ghost.visible = false;
  this._pebbles.forEach((p, i) => {
    p.userData.tgt = (i < a * b)
      ? this._slot(i % b, Math.floor(i / b), b, a)
      : this._slot(b + 0.7 + Math.floor((i - a * b) / a), (i - a * b) % a, b, a); // the L tail
  });
  if (add > 0) this._cues.push({ at: this.time + 1.5, fn: () => {     // fold: tail → new columns
    const cols = b + add;
    this._pebbles.forEach((p, i) => p.userData.tgt = this._slot(i % cols, Math.floor(i / cols), cols, a));
    this._frame(cols, a);
    this.readingTex = `${a} \\times ${cols} = ${this.data.N}`;
  } });
};
ValeTwelve.prototype._laySocket = function (d) {                      // one row laid; socket open
  const cols = this.data.N / d;
  this._frame(cols, d);
  this._pebbles.forEach((p, i) => {
    p.userData.tgt = (i < cols) ? this._slot(i, 0, cols, d) : this._pileSpot(i, 1.05, 0.75);
  });
};
ValeTwelve.prototype._layPile = function () {
  this._ghost.visible = false;
  this._pebbles.forEach((p, i) => p.userData.tgt = this._pileSpot(i, 0, 0));
};
ValeTwelve.prototype._laySuccess = function (factors) {               // rectangle of the accepted form
  const rows = factors[0], cols = factors.slice(1).reduce((x, y) => x * y, 1);
  this._frame(cols, rows);
  this._pebbles.forEach((p, i) => p.userData.tgt = this._slot(i % cols, Math.floor(i / cols), cols, rows));
  this.readingTex = factors.join(' \\times ') + ` = ${this.data.N}`;
};
// —— chunk 4/8 (tray) complete

// ---- the Twelve-Gate: fence + door across the vale at z −30 -----------------
const GATE = { z: -30, half: 1.5 };                                   // doorway x −1.5..1.5
ValeTwelve.prototype._buildGate = function () {
  const scene = this.ctx.scene;
  const wood = mat(PAL.trunk), stone = mat(PAL.stone);
  const fence = new THREE.Group();
  for (const sgn of [-1, 1]) {                                        // west / east runs
    const inX = sgn * GATE.half, outX = sgn * 22;
    for (let x = inX + sgn * 0.3; sgn * x < 22; x += sgn * 2.45)      // posts
      fence.add(box(0.22, 1.7, 0.22, wood, x, 0.85, GATE.z));
    const mid = (inX + outX) / 2, len = Math.abs(outX - inX);
    fence.add(box(len, 0.12, 0.12, wood, mid, 1.45, GATE.z));         // rails
    fence.add(box(len, 0.12, 0.12, wood, mid, 0.85, GATE.z));
    this.colliders.push({ type: 'aabb',
      minX: Math.min(inX, outX), maxX: Math.max(inX, outX),
      minZ: GATE.z - 0.25, maxZ: GATE.z + 0.25 });                    // sealed runs: always solid
  }
  fence.add(box(0.34, 2.2, 0.34, stone, -GATE.half - 0.1, 1.1, GATE.z)); // door jambs
  fence.add(box(0.34, 2.2, 0.34, stone,  GATE.half + 0.1, 1.1, GATE.z));
  scene.add(fence);
  this.solid.push(fence);
  // door leaf, hinged on the west jamb; pivot group at the hinge
  const hinge = new THREE.Group();
  hinge.position.set(-GATE.half, 0, GATE.z);
  const leaf = new THREE.Group();
  for (let i = 0; i < 5; i++) leaf.add(box(0.5, 1.9, 0.09, wood, 0.29 + i * 0.55, 0.97, 0));
  leaf.add(box(2.9, 0.12, 0.11, mat(PAL.gold, 0.6), 1.5, 1.55, 0.02)); // brace
  hinge.add(leaf);
  scene.add(hinge);
  this.solid.push(hinge);
  this._door = hinge;
  // gate predicate: solid only while closed — active() flips the instant it opens
  this.colliders.push({ type: 'aabb', minX: -GATE.half, maxX: GATE.half,
    minZ: GATE.z - 0.25, maxZ: GATE.z + 0.25, active: () => !this.gateOpen });
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 1.6),
    new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(0, 1.2, GATE.z);
  proxy.userData.act = { part: 'vale-twelve', kind: 'gate',
    prompt: STR.promptGate, label: STR.gateLabel, reach: 7 };
  proxy.userData.glowRoot = hinge;
  scene.add(proxy);
  this.interactables.push(proxy);
};
// —— chunk 5/8 (gate) complete

// ---- interaction + card -----------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
ValeTwelve.prototype.onInteract = function (act, PH) {
  this._PH = PH;
  if (act.kind === 'gate') {
    this.mode = 'gate';
    if (this.phase === 'opener') this.phase = 'gate';
    this._askT0 = now();
    if (!this._gateT0) this._gateT0 = now();
    this.panelAnchor = { x: 0, z: GATE.z, reach: 8 };
  } else {
    this.mode = 'tray';
    this.panelAnchor = { x: TRAY.x, z: TRAY.z, reach: 9 };
  }
  this.log.push('vale.twelve.station', { kind: act.kind, ms: Math.round(this.time * 1000) });
  PH.openPanel('p:vale-twelve');
  this._focusInput();
};
ValeTwelve.prototype._focusInput = function () {
  if (typeof document === 'undefined') return;
  const el = document.querySelector('.gate-in[data-vt="raw"]');
  if (el) { el.focus(); el.select && el.select(); }
};
ValeTwelve.prototype.panel = function (st) {
  if (!st || st.panel !== 'p:vale-twelve') return '';
  const K = (this._PH && this._PH.K) ? this._PH.K : (t) => `<span class="eq-tex">${esc(t)}</span>`;
  if (this.mode === 'tray')
    return `<h2>${STR.trayTitle}</h2>
      <div class="lede">${STR.trayLede}</div>
      <div class="eq">${K(this.readingTex, true)}</div>
      <div class="muted">${STR.trayGoOn}</div>`;
  if (this.phase === 'open')                                          // gate answered
    return `<h2>${STR.gateTitle}</h2>
      <div class="eq">${K(this.readingTex, true)}</div>
      <div class="muted">${STR.opened}</div>`;
  const eqRow = this.feedbackEq ? `<div class="eq">${K(this.feedbackEq, true)}</div>` : '';
  return `<h2>${STR.gateTitle}</h2>
    <div class="lede">${STR.gateLede}</div>${eqRow}
    <input class="gate-in" type="text" data-vt="raw" value="${esc(this._raw)}"
      autocomplete="off" spellcheck="false" placeholder="3 × 4" />
    <button class="btn primary" data-vt="commit">${STR.gateBtn}</button>
    <div class="muted">${this.feedback || STR.hintTypes}</div>`;
};
// —— chunk 6/8 (interact) complete

// ---- commit routing: every wrong class gets a repair beat, never a rejection --
STR.pairAssemble = (a, b) => `You found them. The socket takes only a runnable product: ${a} × ${b}.`; // PLACEHOLDER
STR.tailFold2 = (a, b, t, c) => `A block and a tail. The tail is one more column: ${a} × ${b} + ${t} = ${a} × ${c}.`; // PLACEHOLDER
STR.wrongCount = (v) => `The pebbles count ${v}. The tray holds 12.`;  // PLACEHOLDER
ValeTwelve.prototype.onPanel = function (ev, PH) {
  this._PH = PH;
  const t = ev && ev.target;
  if (t && t.dataset && t.dataset.vt === 'raw' && typeof t.value === 'string')
    this._raw = t.value;                                              // mirror the input defensively
  const commit = (ev && ev.key === 'Enter') ||
    (t && t.dataset && t.dataset.vt === 'commit');
  if (!commit || this.mode !== 'gate' || this.phase === 'open') return;
  this._commit(this._raw, PH);
};
ValeTwelve.prototype._commit = function (raw, PH) {
  const N = this.data.N;
  const ms = Math.round(now() - this._askT0);
  let res = classifyTwelve(raw, N);
  if (this.socketDiv != null && res.cls === 'list' && res.d !== this.socketDiv
      && this.socketDiv * res.d === N)                                // socket partner filled
    res = { cls: 'correct', factors: [this.socketDiv, res.d].sort((a, b) => a - b),
            value: N, socket: true };
  this.log.push('vale.twelve.input', { raw: String(raw), class: res.cls,
    sub: res.sub, ms });                                              // think-time per entry
  this._askT0 = now();
  const F = this.feedback;
  switch (res.cls) {
    case 'correct':
      this._accept(res.factors, PH, false); break;
    case 'add-split': {                                               // INT-ADD-SPLIT: convert, never reject
      this._laySplit(res.k, res.m);
      this.feedback = STR.addSplit(res.k, res.m);
      this.feedbackEq = Array(res.k).fill(res.m).join('+') + ` = ${res.k} \\times ${res.m}`;
      this.log.push('vale.twelve.repair', { cls: 'add-split', ms });
      const f = [res.k, res.m].sort((a, b) => a - b);
      this._cues.push({ at: this.time + 2.6, fn: () => this._accept(f, this._PH, true) });
      break; }
    case 'add-uneven': {                                              // 7+5: refuses equal rows
      const rows = res.terms.filter(v => v > 0);
      let i = 0;
      this._ghost.visible = false;
      this._pebbles.forEach((p) => {
        const r = (() => { let acc = 0; for (let j = 0; j < rows.length; j++) {
          acc += rows[j]; if (i < acc) return j; } return rows.length - 1; })();
        const before = rows.slice(0, r).reduce((x, y) => x + y, 0);
        p.userData.tgt = this._slot(i - before, r, Math.max(...rows), rows.length);
        i++;
      });
      this.feedback = STR.addUneven(res.terms[0], res.terms[1] ?? 0);
      this.feedbackEq = '';
      break; }
    case 'list':                                                      // INT-LIST → completion socket
      this.socketDiv = res.d;
      this._laySocket(res.d);
      this.feedback = STR.listSocket(res.d);
      this.feedbackEq = `${res.d} \\times \\square = ${N}`;
      this.log.push('vale.twelve.repair', { cls: 'list', ms });
      break;
    case 'pair':                                                      // bare pair: demand assembly
      this.feedback = STR.pairAssemble(res.a, res.b);
      this.feedbackEq = '';
      break;
    case 'tail':                                                      // INT-TAIL → the L-fold
      this._layTail(res.a, res.b, res.add);
      this.feedback = res.folds
        ? STR.tailFold2(res.a, res.b, res.tail, res.b + res.add)
        : STR.wrongCount(N);
      this.feedbackEq = res.folds
        ? `${res.a} \\times ${res.b} + ${res.tail} = ${res.a} \\times (${res.b}+${res.add})`
        : '';
      this.log.push('vale.twelve.repair', { cls: 'tail', ms });
      break;
    case 'nondiv': {                                                  // INT-NONDIV family: build fails honestly
      if (res.sub === 'sum') { this._layPile(); this.feedback = STR.wrongCount(res.value); }
      else {
        const a = res.a, b = res.b;
        this._layClaim(a, b);
        this.feedback = (N % a !== 0) ? STR.ranOut(a)
          : (b && a * b > N) ? STR.frameEmpty
          : (b && a * b < N) ? STR.leftOver(N - a * b) : STR.ranOut(a);
      }
      this.feedbackEq = '';
      this.log.push('vale.twelve.repair', { cls: 'nondiv', sub: res.sub, ms });
      break; }
    case 'rational':                                                  // whole pebbles only (room's rule)
      this._layOpener(); this.feedback = STR.wholeOnly; this.feedbackEq = ''; break;
    case 'noop':                                                      // "12" — in-parts probe
      this.feedback = STR.inParts; this.feedbackEq = `${N} = \\square \\times \\square`; break;
    default:                                                          // empty / noparse
      this.feedback = STR.hintTypes; this.feedbackEq = '';
  }
  if (PH && PH.refresh && (this.feedback !== F || res.cls === 'correct')) PH.refresh();
  else if (PH && PH.refresh) PH.refresh();
  this._focusInput();                                                 // mid-exercise: input refocused
};
ValeTwelve.prototype._accept = function (factors, PH, converted) {
  if (this.gateOpen) return;
  const f = factors.slice().sort((a, b) => a - b);
  this.phase = 'open';
  this.gateOpen = true;                                               // predicate flips NOW
  this.doorT = 0;                                                     // swing begins (anticipation)
  this.socketDiv = null;
  this._laySuccess(f);
  this.feedback = STR.opened;
  this.feedbackEq = '';
  (this.enc._vale = this.enc._vale ?? {}).twelveFactorization = f.slice(); // REMEMBERED for Ch II
  this.log.push('vale.twelve.gate', { factorization: f.slice(),
    ms: Math.round(now() - (this._gateT0 || now())), converted: !!converted });
  if (PH && PH.refresh) PH.refresh();
  if (PH && PH.dismissLater) PH.dismissLater('p:vale-twelve', 2600);  // watch the door, not the card
};
// —— chunk 7/8 (onPanel) complete

// ---- per-frame: pebble easing, door swing, timed beats; chips ---------------
const smooth = (s) => s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s);
ValeTwelve.prototype.update = function (dt, u) {
  this.time += dt;
  if (u && u.controls && u.controls.pos) this._ppos = u.controls.pos; // for label distance checks
  if (this._cues && this._cues.length) {                              // timed repair beats
    const due = this._cues.filter(c => c.at <= this.time);
    this._cues = this._cues.filter(c => c.at > this.time);
    for (const c of due) c.fn();
  }
  const k = 1 - Math.exp(-6.5 * dt);                                  // eased pebble motion
  for (const p of this._pebbles) {
    const t = p.userData.tgt;
    p.position.x += (t.x - p.position.x) * k;
    p.position.y += (t.y - p.position.y) * k;
    p.position.z += (t.z - p.position.z) * k;
  }
  if (this.doorT >= 0 && this.doorT < 9) {                            // anticipation → ease → settle
    this.doorT += dt;
    const t = this.doorT, T1 = 0.22, T2 = 1.35, T3 = 0.5;
    let th;
    if (t < T1) th = 0.09 * smooth(t / T1);                           // lean back first
    else if (t < T1 + T2) th = 0.09 + (-2.02 - 0.09) * smooth((t - T1) / T2); // swing north, overshoot
    else if (t < T1 + T2 + T3) th = -2.02 + 0.10 * smooth((t - T1 - T2) / T3); // settle at −1.92
    else { th = -1.92; this.doorT = 9; }                              // done
    this._door.rotation.y = th;
  }
};
ValeTwelve.prototype.labels = function (L, architectOn) {
  const p = this._ppos;
  const near = (x, z, r) => p && ((p.x - x) ** 2 + (p.z - z) ** 2) <= r * r;
  if (near(TRAY.x, TRAY.z, 9.5))                                      // quiet beyond ~9.5 m
    L.set('vt-read', { tex: this.readingTex, x: TRAY.x, y: 1.55, z: TRAY.z, dy: 0.1 });
  if (near(0, GATE.z, 9.5)) {
    if (this.phase === 'open')
      L.set('vt-gate', { tex: this.readingTex, x: 0, y: 2.6, z: GATE.z });
    else
      L.set('vt-gate', { html: STR.gateLabel, x: 0, y: 2.6, z: GATE.z });
  }
  if (!architectOn) return;                                           // concept names: architect only
  for (const c of this._archChips)
    L.set(c.id, { html: c.text, x: c.x, y: 3.9, z: c.z, kind: 'architect' });
  L.set('vt-strat', { html: 'stratum: numbers — one factorization of 12 (open input)',
    x: 0, y: 3.2, z: GATE.z, kind: 'architect' });
  L.set('vt-diag', { html: 'classifier: atlas 01 — add-split converts · list completes · tail folds · nondiv runs out',
    x: 0, y: 2.9, z: TRAY.z, kind: 'architect' });
};
// —— chunk 8/8 (update+labels) complete
