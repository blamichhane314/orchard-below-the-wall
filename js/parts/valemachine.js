// valemachine.js — chapter II "Machine" of the Long Vale (the factorization
// world; design/SCRIPT_FACTOR_WORLD.md ch II; confusion-atlas/02-bridge.md is
// the bug catalog these beats implement). Region x −22..22, z −28..−8.
//
// The evaluation bridge: the two-forms stone carries x²+5x+6 and (x+2)(x+3)
// side by side; three feed stones are worked IN ORDER x = 1 → 2 → 0 (the
// origin beat lands last, as revelation); then the free basin takes ANY
// integer x and the machine computes both forms live, each feed adding a row
// to the carved table — factors change, structure persists (the inoculation
// against BR-FIXED-FACTORS). The recognition gate at z −10 offers candidate
// readings of what was seen; each wrong reading is one atlas-02 entry and the
// machine itself refutes it (ghost stone / crank walk / the dial handed over),
// then the door hears another reading. The base-ten stone (x=10: 156 = 12·13)
// stands lattice-sealed off the path, architect-note only.
//
// PERCEPTUAL CONTRACT (Law 4): every number shown is computed at render/feed
// time from enc.machine's {a,b,c} — the pair (p,q) is SEARCHED for (p·q = c,
// p+q = b), values come from a·x²+b·x+c, door readings from (x+p)(x+q), the
// impostor from swapping b and c. Nothing numeric is stored as an answer.
//
// Deviations: none of substance. During the crank-walk repair the walked
// chips ignore the 9.5 m gate for the length of the beat (the beat is watched
// from the door, ~12 m off); everything else is proximity-gated as specified.

import * as THREE from '../../vendor/three/three.module.js';

const mat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, metalness: 0, ...o });
const glow = (c, op = 0.9) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ---------- siting (world metres; the region is x −22..22, z −28..−8) -------
// South → north: the two-forms stone confronts the walker, the three feed
// stones zigzag onward in working order, the basin stands before the door.
// The base-ten stone is EAST, off every walked line (never on the main path).
export const SITE = {
  forms:  { x: 0, z: -24, ry: 0 },
  stones: [{ x: -2.8, z: -21.4, ry: 0.55 }, { x: 2.8, z: -19.2, ry: -0.55 }, { x: 0, z: -16.6, ry: 0 }],
  basin:  { x: 0, z: -13.4 },
  ghost:  { x: -3.2, z: -12.3, ry: 0.45 },
  base10: { x: 9, z: -14, ry: -0.9 },
  gateZ: -10, doorHalf: 0.95, fenceXMin: -22, fenceXMax: 22,
};
export const BASIN_RANGE = 99;            // |x| the basin accepts (typed, so negatives arrive)
const NEAR = 9.5;                         // chip visibility gate (m)
const CRANK_STEP = 2.2, CRANK_TAIL = 0.6; // crank-walk beat: seconds per stone, settle
const GHOST_DUR = 7.0;                    // ghost beat length (s)

// ---------- placeholder strings (owner-authored voice, Law 2) ---------------
// ALL player-facing prose below is PLACEHOLDER until the owner writes it.
// Speech discipline (atlas 02 §6β) is observed even in placeholders: the world
// says "at x = …, the doors read …" — never "the factors are" — except inside
// the offered MISREADINGS, which quote a student voice on purpose.
const S = {
  formsPrompt: 'Read the stone', formsLabel: 'Two carvings side by side on one stone',
  stonePrompt: 'Work the stone', stoneLabel: 'A feed stone, carved with a number for x',
  basinPrompt: 'Feed the basin', basinLabel: 'A stone basin with a dial, open to any number',
  doorPrompt: 'Read the door', doorLabel: 'A fence and a door across the vale',
  formsH2: 'The two-forms stone',
  formsLede: 'One stone, two carvings. Neither moves. Between them stands an equals sign, and the vale beyond does not explain itself.',
  formsFoot: 'Three feed stones wait past this one. Each is carved with a number for x.',
  basinH2: 'The free basin',
  basinLede: 'The dial takes any number you choose — your number, not the room’s. Both carvings compute in front of you.',
  basinCols: ['x', 'the long carving', 'the doors'],
  basinLocked: 'The dial is still. The feed stones come first, in their order.',
  basinHunt: 'Somewhere an x where the two carvings part ways — if such a number exists, the dial will find it.',
  basinFeed: 'Turn the dial',
  doorH2: 'The door in the fence',
  doorLocked: 'The door is listening for the feed stones. They speak in order.',
  doorLede: 'The door asks what you saw. Choose the reading you believe.',
  doorAgain: 'The door will hear another reading.',
  doorOpenLede: 'The door stands open. The vale runs on north.',
  repairLede: {
    'one-point': 'A pale stone has risen beside the door. Watch what it agrees with — and where it parts.',
    'fixed-factors': 'The feed stones are speaking again, in their order. The carvings on the two-forms stone are not moving.',
    'coincidence': 'The basin waits for a number of your own. Not the room’s numbers — yours.',
    'solved-it': 'Take the dial and hunt: find one x where the two carvings disagree. The hunt is the answer.',
  },
  // the five offered readings (student voice; wrong ones are atlas entries)
  opts: (d) => [
    { tag: 'fixed-factors', text: `So the factors of the long carving are ${d.d1} and ${d.d2}.` },
    { tag: 'one-point', text: `Both made ${d.v1} at x = 1 — one match is enough. Same thing.` },
    { tag: 'true', text: 'Feed both the same x and they hand back the same number — and the door side hands it back already cut into two factors. Any x.' },
    { tag: 'solved-it', text: 'x = 1 is the answer — it makes the two sides equal.' },
    { tag: 'coincidence', text: 'The stones picked numbers where the carvings happen to agree.' },
  ],
};

// ---------- MANIFEST (chunks; each ends with a complete-marker) --------------
//  1 head    — imports, helpers, siting, placeholder strings, derivation, skeleton
//  2 geometry— forms stone, feed stones, basin, ghost, base-ten seal, fence+door
//  3 cards   — panel(st): forms / stone / basin / door / repair / open
//  4 events  — onInteract + onPanel: feeds, order enforcement, recognition routing
//  5 beats   — update(): door swing, crank walk, ghost rise, repair completion
//  6 chips   — labels(L, architectOn), proximity gates, architect notes

// ---------- truth derivation (Law 4: nothing numeric stored as an answer) ----
// The pair (p,q) is SEARCHED for (p·q = c, p+q = b; monic block — a = 1); the
// impostor is the b↔c swap (atlas 02 §1 ghost fact: 2·6 fathers (x+1)(x+5)).
export const derive = (M) => {
  const { a, b, c } = M;
  const pairOf = (sum, prod) => {
    for (let i = -60; i <= 60; i++) if (i * (sum - i) === prod) return [Math.min(i, sum - i), Math.max(i, sum - i)];
    return null;
  };
  const [p, q] = pairOf(b, c);
  const [gp, gq] = pairOf(c, b);                    // the swapped machine's pair
  return {
    a, b, c, p, q, gp, gq,
    poly:  (x) => a * x * x + b * x + c,            // the long carving, evaluated live
    doors: (x) => [x + p, x + q],                   // handed back already cut in two
    gpoly: (x) => a * x * x + c * x + b,            // the impostor: b and c swapped
  };
};

class ValeMachine {
  constructor(ctx) {
    this.ctx = ctx; this.enc = ctx.enc; this.log = ctx.log; this.PH = ctx.PH;
    this.M = ctx.enc.machine; this.T = derive(this.M);
    this.colliders = []; this.solid = []; this.interactables = [];
    this.time = 0; this._p = null;
    this.fed = 0; this._stoneFed = [false, false, false];
    this.rows = [];                       // the growing x | value | factors table
    this.gateOpen = false; this._doorT = 0;
    this.card = 'forms'; this.stoneIdx = -1;
    this.repair = null;                   // {tag, done, feeds, need} active spur
    this.crank = null; this.ghostBeat = null; this.ghostUp = 0;
    this.reads = 0; this.rejoins = 0; this.choiceT0 = 0; this._refuted = {};
    this._basinErr = null;
    this.panelAnchor = { x: 0, z: -15, reach: 14 };
    this._build();                        // chunk 2
  }
  _ms() { return Math.round((this.time - this.choiceT0) * 1000); }
}
export default ValeMachine;
// —— chunk 1/6 (head) complete

// ---------- chunk 2 — geometry ----------------------------------------------
const invisibleMat = () => new THREE.MeshBasicMaterial({ visible: false });

ValeMachine.prototype._stone = function (r, x, z, ry, w, h, d, hex) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, h * 0.22, d * 1.5), mat(jitter(0x6f6a60, r)));
  base.position.y = h * 0.11; g.add(base);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(jitter(hex, r)));
  slab.position.y = h * 0.22 + h / 2 - 0.02; slab.rotation.x = -0.09; g.add(slab);
  g.position.set(x, 0, z); g.rotation.y = ry;
  this.ctx.scene.add(g); this.solid.push(slab);
  return g;
};
ValeMachine.prototype._proxy = function (x, z, w, h, act, rig) {
  // FAT invisible gaze proxy — standalone in the scene, never under an occluder
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), invisibleMat());
  p.position.set(x, h / 2, z);
  p.userData.act = { part: 'vale-machine', reach: 7, ...act };
  p.userData.glowRoot = rig;
  this.ctx.scene.add(p); this.interactables.push(p);
  return p;
};
ValeMachine.prototype._build = function () {
  const r = rng(20811);
  const { forms, stones, basin, ghost, base10, gateZ, doorHalf, fenceXMin, fenceXMax } = SITE;
  // the two-forms stone — one wide slab; the carvings themselves are chips (ch 6)
  this._formsRig = this._stone(r, forms.x, forms.z, forms.ry, 3.4, 2.1, 0.5, 0x7d7668);
  this._proxy(forms.x, forms.z, 4.2, 2.6, { kind: 'forms', prompt: S.formsPrompt, label: S.formsLabel }, this._formsRig);
  this.colliders.push({ type: 'circle', x: forms.x, z: forms.z, r: 1.6 });
  // three feed stones, sited in working order (site i ↔ stoneOrder[i])
  this._stoneRigs = stones.map((s, i) => {
    const rig = this._stone(r, s.x, s.z, s.ry, 1.15, 1.35, 0.42, 0x8a8274);
    this._proxy(s.x, s.z, 1.9, 1.9, { kind: 'stone', idx: i, prompt: S.stonePrompt, label: S.stoneLabel }, rig);
    this.colliders.push({ type: 'circle', x: s.x, z: s.z, r: 0.85 });
    return rig;
  });
  // the free basin — squat bowl + a dial that only turns once the stones spoke
  const bg = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.6, 9), mat(jitter(0x6a7160, r)));
  bowl.position.y = 0.3; bg.add(bowl);
  this._dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 7), mat(0x4a4640));
  this._dial.position.y = 0.9; bg.add(this._dial);
  bg.position.set(basin.x, 0, basin.z); this.ctx.scene.add(bg); this.solid.push(bowl);
  this._basinRig = bg;
  this._proxy(basin.x, basin.z, 2.2, 1.6, { kind: 'basin', prompt: S.basinPrompt, label: S.basinLabel }, bg);
  this.colliders.push({ type: 'circle', x: basin.x, z: basin.z, r: 1.05 });
  // ghost stone — pale, below ground until the one-point spur raises it
  this._ghostRig = new THREE.Group();
  const gs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.34), mat(0xb9b4ac));
  gs.position.y = 0.95; this._ghostRig.add(gs);
  this._ghostRig.position.set(ghost.x, -1.8, ghost.z); this._ghostRig.rotation.y = ghost.ry;
  this._ghostRig.visible = false; this.ctx.scene.add(this._ghostRig);
  this.colliders.push({
    type: 'aabb', minX: ghost.x - 0.6, maxX: ghost.x + 0.6, minZ: ghost.z - 0.35, maxZ: ghost.z + 0.35,
    active: () => this.ghostUp > 0.5,
  });
  // base-ten stone — EAST, off every walked line, sealed in an honest lattice
  this._b10Rig = this._stone(r, base10.x, base10.z, base10.ry, 1.3, 1.6, 0.45, 0x777d6b);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.3, 0.09), mat(0x55534c));
    bar.position.set(base10.x + Math.cos(a) * 1.15, 1.15, base10.z + Math.sin(a) * 1.15);
    this.ctx.scene.add(bar); this.solid.push(bar);
  }
  this.colliders.push({ type: 'circle', x: base10.x, z: base10.z, r: 1.35 });
  // fence + door across the vale at the region's recognition line (z = −10)
  const fenceMat = mat(0x5e5648), railY = [0.45, 1.05];
  const seg = (x0, x1) => {
    railY.forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.09, 0.09), fenceMat);
      rail.position.set((x0 + x1) / 2, y, gateZ); this.ctx.scene.add(rail);
    });
    for (let x = x0; x <= x1 + 0.01; x += 2.75) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.14), fenceMat);
      post.position.set(Math.min(x, x1), 0.675, gateZ); this.ctx.scene.add(post);
    }
  };
  seg(fenceXMin, -doorHalf); seg(doorHalf, fenceXMax);
  // the door: hinged at the west jamb, swings north when the reading is true
  this._doorPivot = new THREE.Group();
  this._doorPivot.position.set(-doorHalf, 0, gateZ);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 - 0.06, 1.28, 0.08), mat(0x776b52));
  leaf.position.set(doorHalf, 0.7, 0); this._doorPivot.add(leaf);
  this.ctx.scene.add(this._doorPivot); this.solid.push(leaf);
  this._proxy(0, gateZ + 0.9, 2.6, 1.9, { kind: 'door', prompt: S.doorPrompt, label: S.doorLabel }, this._doorPivot);
  this.colliders.push({ type: 'aabb', minX: fenceXMin, maxX: -doorHalf, minZ: gateZ - 0.18, maxZ: gateZ + 0.18 });
  this.colliders.push({ type: 'aabb', minX: doorHalf, maxX: fenceXMax, minZ: gateZ - 0.18, maxZ: gateZ + 0.18 });
  this.colliders.push({
    type: 'aabb', minX: -doorHalf, maxX: doorHalf, minZ: gateZ - 0.18, maxZ: gateZ + 0.18,
    active: () => !this.gateOpen,
  });
};
// —— chunk 2/6 (geometry) complete

// ---------- chunk 3 — cards -------------------------------------------------
// Strings the head table lacked (PLACEHOLDER prose, same discipline: the world
// says "the doors read …", never "the factors are").
Object.assign(S, {
  stoneH2: 'A feed stone',
  stoneCarved: (n) => `Carved on it: x = ${n}.`,
  stoneLocked: 'This stone is silent. The feed stones speak in their order.',
  stoneFeedBtn: 'Feed the stone',
  stoneRead: (x, v, f0, f1) => `At x = ${x}, both carvings made ${v} — and the doors read ${f0} and ${f1}.`,
  stoneRhyme: (f0, f1) => `The 12 you cut in the first vale — your own ${f0} × ${f1} — stands here before you.`,
  stoneOrigin: 'The crank rests at zero, and the stones land on the two ends of the carving themselves — the pair, before any rule is spoken.',
  basinBadX: 'The dial takes a whole number, up to 99 either way.',
  basinDone: 'The dial is yours. It stays.',
});

ValeMachine.prototype.panel = function (st) {
  if (!st || st.panel !== 'p:vale-machine') return '';
  const K = this.PH && this.PH.K ? this.PH.K.bind(this.PH) : (t) => t;
  const M = this.M, T = this.T;
  const eq = `<div class="eq">${K(`${M.tex} \\;=\\; ${M.factoredTex}`, true)}</div>`;
  switch (this.card) {
    case 'forms':
      return `<h2>${S.formsH2}</h2><p class="lede">${S.formsLede}</p>${eq}<p class="muted">${S.formsFoot}</p>`;
    case 'stone-locked':
      return `<h2>${S.stoneH2}</h2><p class="lede">${S.stoneLocked}</p>`;
    case 'stone': {
      const i = this.stoneIdx, xv = M.stoneOrder[i];
      if (!this._stoneFed[i])
        return `<h2>${S.stoneH2}</h2><p class="lede">${S.stoneCarved(xv)}</p>${eq}` +
               `<button class="btn primary" data-act="feed-stone">${S.stoneFeedBtn}</button>`;
      const v = T.poly(xv), [f0, f1] = T.doors(xv);
      let extra = '';
      const tw = this.enc._vale && this.enc._vale.twelveFactorization;
      if (xv === 1 && Array.isArray(tw) && Math.min(...tw) === T.doors(1)[0] && Math.max(...tw) === T.doors(1)[1])
        extra = `<p class="lede">${S.stoneRhyme(...tw)}</p>`;                    // the chapter-I rhyme
      if (xv === 0) extra = `<p class="lede">${S.stoneOrigin}</p>`;              // the origin beat, last
      return `<h2>${S.stoneH2}</h2>` +
             `<div class="eq">${K(`${M.tex} \\to ${v}`, true)}</div>` +
             `<div class="eq">${K(`${M.factoredTex} \\to ${f0} \\cdot ${f1}`, true)}</div>` +
             `<p class="lede">${S.stoneRead(xv, v, f0, f1)}</p>${extra}`;
    }
    case 'basin-locked':
      return `<h2>${S.basinH2}</h2><p class="lede">${S.basinLocked}</p>`;
    case 'basin': {
      const hunting = this.repair && !this.repair.done &&
        (this.repair.tag === 'solved-it' || this.repair.tag === 'coincidence');
      const lede = hunting && this.repair.tag === 'solved-it' ? S.basinHunt : S.basinLede;
      const rows = this.rows.map((r) =>
        `<tr><td>${r.x}</td><td>${r.value}</td><td>${r.f[0]} · ${r.f[1]}</td></tr>`).join('');
      const head = `<tr><th>${S.basinCols[0]}</th><th>${S.basinCols[1]}</th><th>${S.basinCols[2]}</th></tr>`;
      const err = this._basinErr ? `<p class="muted">${S.basinBadX}</p>` : '';
      const done = this.repair && this.repair.done && this.repair.feeds > 0 ? `<p class="muted">${S.basinDone}</p>` : '';
      return `<h2>${S.basinH2}</h2><p class="lede">${lede}</p>` +
             `<table style="width:100%;text-align:center">${head}${rows}</table>${err}${done}` +
             `<input class="gate-in" id="vm-x" type="text" inputmode="numeric" autofocus placeholder="x">` +
             `<button class="btn primary" data-act="feed-basin">${S.basinFeed}</button>`;
    }
    case 'door-locked':
      return `<h2>${S.doorH2}</h2><p class="lede">${S.doorLocked}</p>`;
    case 'repair':
      return `<h2>${S.doorH2}</h2><p class="lede">${S.repairLede[this.repair ? this.repair.tag : 'one-point']}</p>`;
    case 'door': {
      const d = { d1: T.doors(1)[0], d2: T.doors(1)[1], v1: T.poly(1) };
      const opts = S.opts(d).map((o) => this._refuted[o.tag]
        ? `<p class="muted" style="text-decoration:line-through">${o.text}</p>`
        : `<button class="btn" data-act="read" data-tag="${o.tag}" style="display:block;width:100%;margin:4px 0;text-align:left">${o.text}</button>`
      ).join('');
      return `<h2>${S.doorH2}</h2><p class="lede">${this.reads ? S.doorAgain : S.doorLede}</p>${opts}`;
    }
    case 'door-open':
      return `<h2>${S.doorH2}</h2><p class="lede">${S.doorOpenLede}</p>`;
  }
  return '';
};
// —— chunk 3/6 (cards) complete

// ---------- chunk 4 — events ------------------------------------------------
ValeMachine.prototype.onInteract = function (act, PH) {
  if (PH) this.PH = PH;
  if (!act || !this.PH) return;
  const open = (card, ms) => {
    this.card = card; this.PH.openPanel('p:vale-machine');
    if (ms) this.PH.dismissLater('p:vale-machine', ms);
  };
  if (act.kind === 'forms') open('forms', 8000);
  else if (act.kind === 'stone') {
    if (act.idx > this.fed) return open('stone-locked', 3200);   // order is content
    this.stoneIdx = act.idx;
    open('stone', this._stoneFed[act.idx] ? 5000 : 0);           // replays self-dismiss
  } else if (act.kind === 'basin') {
    if (this.fed < 3) return open('basin-locked', 3200);
    open('basin', 0);                                            // mid-exercise: stays
  } else if (act.kind === 'door') {
    if (this.gateOpen) return open('door-open', 3600);
    if (this.fed < 3) return open('door-locked', 3200);
    if (this.repair && !this.repair.done) return open('repair', 3600);
    this.choiceT0 = this.time;                                   // think-time starts now
    open('door', 0);
  }
};

ValeMachine.prototype._feedStone = function () {
  const i = this.stoneIdx;
  if (i !== this.fed || this._stoneFed[i]) return;
  const xv = this.M.stoneOrder[i], v = this.T.poly(xv), f = this.T.doors(xv);
  this.rows.push({ x: xv, value: v, f });
  this._stoneFed[i] = true; this.fed++;
  this.log.push('vale.machine.feed', { x: xv, value: v, factors: f, src: 'stone' });
  this.PH.refresh(); this.PH.dismissLater('p:vale-machine', 5200);
};

ValeMachine.prototype._feedBasin = function (raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!/^[+-]?\d+$/.test(s) || Math.abs(parseInt(s, 10)) > BASIN_RANGE) {
    this._basinErr = true; this.PH.refresh(); return;            // text input: we validate
  }
  this._basinErr = false;
  const x = parseInt(s, 10), v = this.T.poly(x), f = this.T.doors(x);
  this.rows.push({ x, value: v, f });
  this.log.push('vale.machine.feed', { x, value: v, factors: f, src: 'basin' });
  const rp = this.repair;
  if (rp && !rp.done && rp.need > 0 && ++rp.feeds >= rp.need) rp.done = true;
  this.PH.refresh();                                             // stays open, refocused
};

ValeMachine.prototype._choose = function (tag) {
  const d = { d1: this.T.doors(1)[0], d2: this.T.doors(1)[1], v1: this.T.poly(1) };
  const opt = S.opts(d).find((o) => o.tag === tag);
  if (!opt || this._refuted[tag] || this.gateOpen) return;
  this.log.push('vale.machine.read', { chose: opt.text, tag, nth: this.reads, ms: this._ms() });
  this.reads++;
  if (tag === 'true') {
    this.gateOpen = true;
    (this.enc._vale = this.enc._vale ?? {}).machineDone = true;  // our own key only
    this.log.push('vale.machine.gate', { nth: this.reads - 1, ms: this._ms() });
    this.card = 'door-open'; this.PH.refresh(); this.PH.dismissLater('p:vale-machine', 4200);
    return;
  }
  this._refuted[tag] = true; this.rejoins++;
  this.repair = {
    tag, done: false, feeds: 0,
    need: tag === 'coincidence' ? 1 : tag === 'solved-it' ? 2 : 0,
  };
  if (tag === 'fixed-factors') this.crank = { t: 0, stage: 0 };  // stones flow, doors don't
  if (tag === 'one-point') this.ghostBeat = { t: 0 };            // the impostor rises
  this.card = 'repair'; this.PH.refresh(); this.PH.dismissLater('p:vale-machine', 3800);
};

ValeMachine.prototype.onPanel = function (ev, PH) {
  if (PH) this.PH = PH;
  if (!ev) return;
  if (ev.type === 'keydown') {
    if (ev.key === 'Enter' && this.card === 'basin' && ev.target)
      this._feedBasin(ev.target.value);
    return;
  }
  const t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : ev.target;
  const a = t && t.dataset ? t.dataset.act : null;
  if (a === 'feed-stone') this._feedStone();
  else if (a === 'feed-basin') {
    const el = typeof document !== 'undefined' ? document.getElementById('vm-x') : null;
    this._feedBasin(el ? el.value : '');
  } else if (a === 'read') this._choose(t.dataset.tag);
};
// —— chunk 4/6 (events) complete

// ---------- chunk 5 — beats (update) ----------------------------------------
// anticipation → ease → settle (0..1, tiny pull-back first, soft overshoot)
const antic = (t) => {
  if (t <= 0) return 0;
  if (t < 0.15) return -0.05 * Math.sin((t / 0.15) * Math.PI);
  const s = clamp((t - 0.15) / 0.85, 0, 1);
  return smooth(s) + 0.06 * Math.sin(Math.PI * s) * (1 - s);
};

ValeMachine.prototype.update = function (dt, u) {
  this.time += dt;
  if (u && u.controls && u.controls.pos) this._p = u.controls.pos;
  // the door swings only when the true reading was chosen (predicate already off)
  if (this.gateOpen && this._doorT < 1) {
    this._doorT = clamp(this._doorT + dt / 1.6, 0, 1);
    if (this._doorPivot) this._doorPivot.rotation.y = -1.92 * antic(this._doorT);
  }
  // the dial turns slowly once it is the player's (basin unlocked)
  if (this._dial && this.fed >= 3) this._dial.rotation.y += dt * 0.5;
  // crank walk (BR-FIXED-FACTORS): the stones flow, the two-forms stone doesn't
  if (this.crank) {
    this.crank.t += dt;
    this.crank.stage = Math.min(Math.floor(this.crank.t / CRANK_STEP), 2);
    const ph = (this.crank.t % CRANK_STEP) / CRANK_STEP;
    this._stoneRigs.forEach((rig, i) => {
      rig.position.y = i === this.crank.stage ? 0.08 * Math.sin(Math.PI * clamp(ph * 1.15, 0, 1)) : 0;
    });
    if (this.crank.t >= CRANK_STEP * 3 + CRANK_TAIL) {
      this._stoneRigs.forEach((rig) => { rig.position.y = 0; });
      this.crank = null;
      if (this.repair) this.repair.done = true;      // the door will hear another reading
    }
  }
  // ghost rise (BR-ONE-POINT): the impostor agrees at x=1 and parts at x=2
  if (this.ghostBeat) {
    this.ghostBeat.t += dt;
    this._ghostRig.visible = true;
    this.ghostUp = smooth(clamp(this.ghostBeat.t / 1.2, 0, 1));
    this._ghostRig.position.y = -1.8 + 1.8 * this.ghostUp;
    if (this.ghostBeat.t >= 1.2 + GHOST_DUR) {
      this.ghostBeat = null;                          // the stone STAYS risen (a trace)
      if (this.repair) this.repair.done = true;
    }
  }
};
// —— chunk 5/6 (beats) complete

// ---------- chunk 6 — chips (labels) ----------------------------------------
ValeMachine.prototype.labels = function (L, architectOn) {
  if (!L || !L.set) return;
  const M = this.M, T = this.T;
  const { forms, stones, basin, ghost, base10 } = SITE;
  const p = this._p;
  const near = (x, z, d = NEAR) => !!p && (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) <= d * d;
  // the two carvings, side by side on the one stone
  if (near(forms.x, forms.z))
    L.set('vm-forms', { tex: `${M.tex} \\;=\\; ${M.factoredTex}`, x: forms.x, y: 2.75, z: forms.z });
  if (architectOn)
    L.set('vm-forms-a', { tex: `\\text{numbers} \\to \\text{polynomials: the evaluation bridge}`,
      x: forms.x, y: 3.35, z: forms.z, kind: 'architect' });
  // feed stones: carved x before feeding; value = f0·f1 after (or during the crank
  // walk, which ignores the 9.5 m gate for the length of the beat — watched afar)
  stones.forEach((s, i) => {
    const xv = M.stoneOrder[i];
    const walked = !!this.crank && this.crank.stage >= i;
    if (!walked && !near(s.x, s.z)) return;
    let tex = `x = ${xv}`;
    if (this._stoneFed[i] || walked) {
      const v = T.poly(xv), [f0, f1] = T.doors(xv);
      tex = `x = ${xv}:\\;\\; ${v} = ${f0} \\cdot ${f1}`;
    }
    L.set('vm-stone' + i, { tex, x: s.x, y: 2.05, z: s.z });
  });
  // basin: the last row of the growing table hangs over the bowl
  if (near(basin.x, basin.z)) {
    const last = this.rows[this.rows.length - 1];
    L.set('vm-basin', {
      tex: last ? `x = ${last.x}:\\;\\; ${last.value} = ${last.f[0]} \\cdot ${last.f[1]}` : 'x',
      x: basin.x, y: 1.95, z: basin.z,
    });
  }
  // ghost stone, once risen: the impostor form and its near-miss, felt once
  if (this.ghostUp > 0.15) {
    const g1 = T.gpoly(1), v1 = T.poly(1), g2 = T.gpoly(2), v2 = T.poly(2);
    L.set('vm-ghost', { tex: `x^{2} + ${M.c}x + ${M.b}`, x: ghost.x, y: 2.5, z: ghost.z });
    L.set('vm-ghost2', {
      tex: `x=1:\\; ${v1} = ${g1} \\qquad x=2:\\; ${v2} \\ne ${g2}`,
      x: ghost.x, y: 1.95, z: ghost.z,
    });
  }
  // the sealed base-ten stone speaks only under architect view
  if (architectOn) {
    const [f0, f1] = T.doors(10);
    L.set('vm-b10', {
      tex: `x = 10:\\;\\; ${T.poly(10)} = ${f0} \\cdot ${f1}\\;\\; \\text{(sealed: the polynomial IS the numeral)}`,
      x: base10.x, y: 2.6, z: base10.z, kind: 'architect',
    });
  }
};
// —— chunk 6/6 (chips) complete
