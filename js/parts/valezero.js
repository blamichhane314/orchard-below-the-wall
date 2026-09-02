// valezero.js — Chapter V — Zero · part id 'vale-zero' · A Learning World (spike-3d)
// Region x -22..22, z 46..66; the way runs along x=0; the FINALE DOOR crosses z 62.
// Contract: js/parts/_contract.md. Truths are DERIVED at runtime (zero-product on
// factors found by search); every claim is judged by substitution into the ORIGINAL
// equation, in view. No stored answers anywhere in this file.
//
// MANIFEST — chunks appended in order; each ends "// —— chunk n/11 (<name>) complete":
//   1/11 head     — imports, placeholder-string table, rational helpers, derivation, class skeleton
//   2/11 props    — palette, materials, primitive/stone/proxy/flag builders
//   3/11 stones   — product stones ▢·▢=12 and ▢·▢=0, pebble racks, way-stone at (0,56)
//   4/11 machine  — the small leftward-walk machine on the centerpiece ground
//   5/11 courts   — court builder (rail, crossing notches, altitude line) + 4 courts + match stone
//   6/11 gate     — fence + finale door across z 62 (active() collider) + reward stand
//   7/11 update   — clock, animation queue, door swing (anticipation → ease → settle)
//   8/11 labels   — KaTeX chips, 9.5 m distance gating, architect layer
//   9/11 panel    — onInteract + panel(st) cards per focus
//  10/11 onpanel  — delegated input events → stones / walk / match / claims / reward
//  11/11 claims   — substitution-in-view, census close, gate opening, vale.done

import * as THREE from '../../vendor/three/three.module.js';

// ——— placeholder-string table (ALL player-facing text; owner-replaceable) ———
const STR = {
  wayH: 'Two product stones, and the last door',
  wayL: 'Twelve can be made many ways; zero cannot. Past the courts, the last door only opens for numbers that land the whole line on nothing.',
  s12H: 'The stone of twelve', s12L: 'Two numbers that make 12. It takes every true pair, and it never moves.',
  s0H: 'The stone of nothing', s0L: 'Two numbers that make 0.',
  forcing: 'every pair this stone has taken carries a 0',
  askPair: 'Offer the pair', pairA: 'first', pairB: 'second',
  walkH: 'The small machine', walkL: 'The old machine, rebuilt small. Feed it a number and watch the ground answer. Try walking left: 0, then −1, then −2.',
  feed: 'Feed it', walkRoot: 'the ground reads 0 here — a root, found by walking',
  courtH: { learn: 'The first court', obs: 'The court of two', warm: 'The wide court', finale: 'The last door' },
  courtL: { learn: 'Stand a number where this line lands on 0. The court sets your claim into the line, in view.',
    obs: 'This court asks for 2, not 0. Stand a number where the line lands on 2.',
    warm: 'A heavier line. Stand its zero-places. Watch the plate of 2: it never reaches zero.',
    finale: 'The door takes the places where this line lands on 0 — all of them.' },
  claim: 'Stand it', census0: 'Close the census', census1: 'Keep looking',
  censusOpen: 'the ground still crosses where no flag stands',
  gcfNote: 'the 2 never reaches zero — a factor that forces nothing',
  payoff: 'a half-step root: no plain-x ground could ever put a door here',
  matchH: 'The matching stone', matchL: 'The bridge read the arms as values: x+2 = 3, so x+3 = 4, and 3·4 = 12. Choose a pair of 12 for the arms.',
  m1: 'one body, one place — both arms must name the SAME x',
  m2: 'the arms sit one apart at every x. Now the product is 0: which pairs of 0 sit one apart?',
  m3: 'a pair that makes 0 must carry 0 — so an arm must BE 0. The zero rule, derived.',
  rewardH: 'The stand beyond the door', rewardL: 'The vale is walked.',
  rewardDoc: 'The document of the vale: twelve gave its pairs; the machine walked left; the courts read the ground; and at nothing, one hard question fell into two easy ones.',
  take: 'Take it', doorChip: 'the last door', standNote: 'the court is unmoved',
};

// ——— exact rationals (claims, substitution, truth) ———
function gcdi(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
function frac(n, d = 1) { if (d < 0) { n = -n; d = -d; } const g = gcdi(n, d) || 1; return { n: n / g, d: d / g }; }
function frMul(A, B) { return frac(A.n * B.n, A.d * B.d); }
function frEq(A, B) { return A.n === B.n && A.d === B.d; }
function frIsZero(A) { return A.n === 0; }
function frNum(A) { return A.n / A.d; }
function frStr(A) { return A.d === 1 ? String(A.n) : A.n + '/' + A.d; }
function frTex(A) { return A.d === 1 ? String(A.n) : (A.n < 0 ? '-' : '') + '\\tfrac{' + Math.abs(A.n) + '}{' + A.d + '}'; }
// evaluate a·x² + b·x + c at X exactly: (a·n² + b·n·d + c·d²) / d²
function evalQ(a, b, c, X) { return frac(a * X.n * X.n + b * X.n * X.d + c * X.d * X.d, X.d * X.d); }
// parse signed integers, decimals, and fractions ("-3/2" ≡ "-1.5"); null = refused
function parseNum(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(/−/g, '-').replace(/\s+/g, '');
  if (/^[+-]?\d+$/.test(s)) return frac(parseInt(s, 10), 1);
  let m = s.match(/^([+-]?)(\d*)\.(\d+)$/);
  if (m && (m[2] !== '' || m[3] !== '')) {
    const sign = m[1] === '-' ? -1 : 1;
    const whole = m[2] === '' ? '0' : m[2];
    return frac(sign * parseInt(whole + m[3], 10), Math.pow(10, m[3].length));
  }
  m = s.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (m) { const d = parseInt(m[2], 10); if (d === 0) return null; return frac(parseInt(m[1], 10), d); }
  return null;
}
// ——— truth derivation: factor A·x² + B·x + C over the integers (C ≠ 0 here) ———
function deriveQuad(a, b, c) {
  const k = gcdi(gcdi(a, b), c) || 1;                    // the GCF plate (warm court: 2)
  const A = a / k, B = b / k, C = c / k;
  for (let m1 = 1; m1 <= A; m1++) {
    if (A % m1) continue; const m2 = A / m1;
    for (let n1 = -Math.abs(C); n1 <= Math.abs(C); n1++) {
      if (n1 === 0 || C % n1) continue; const n2 = C / n1;
      if (m1 * n2 + m2 * n1 === B)
        return { k, f1: { m: m1, n: n1 }, f2: { m: m2, n: n2 }, roots: [frac(-n1, m1), frac(-n2, m2)] };
    }
  }
  return null;
}
function texQuad(a, b, c, rhs) {
  const ax = a === 1 ? 'x^2' : a + 'x^2';
  return ax + (b >= 0 ? '+' : '') + b + 'x' + (c >= 0 ? '+' : '') + c + '=' + rhs;
}

export default class ValeZero {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene; this.enc = ctx.enc; this.log = ctx.log; this.PH = ctx.PH;
    this.colliders = []; this.solid = []; this.interactables = [];
    this.time = 0; this._t0 = {}; this._ppos = null; this._anims = []; this.focus = 'way'; this.panelAnchor = null;
    const Z = (this.enc && this.enc.zero) || { courts: [] };
    this.courts = (Z.courts || []).map((ct) => {
      const d = deriveQuad(ct.a, ct.b, ct.c - ct.rhs);
      const roots = d ? (frEq(d.roots[0], d.roots[1]) ? [d.roots[0]] : d.roots.slice()) : [];
      const roleKey = ct.role === 'observability' ? 'obs' : (ct.role === 'warmup' ? 'warm' : ct.role);
      return { a: ct.a, b: ct.b, c: ct.c, rhs: ct.rhs, role: ct.role, roleKey, d, roots,
        claims: [], tries: 0, done: false, lastTex: '', rig: null, flags: [], notches: [], pos: { x: 0, z: 0 } };
    });
    this.byRole = {}; for (const c of this.courts) this.byRole[c.roleKey] = c;
    this.stones = { twelve: { pairs: [], tries: 0, rig: null }, zero: { pairs: [], tries: 0, rig: null, forced: false } };
    this.walk = { fed: [], rootFound: false, carX: 0, carTX: 0, val: null, rig: null };
    this.match = { stage: 0, picks: [], zeroPicks: [], derived: false, tries: 0 };
    this.gateOpen = false; this.doorT = -1; this.door = null; this.payoffSeen = false;
    this.rewardTaken = false; this.doneLogged = false;
    (this.enc._vale = this.enc._vale ?? {}).zero = { gateOpen: false, done: false };
    this._buildAll(); // props/stations built by chunks 2–6
  }
}
// —— chunk 1/11 (head) complete

// ——— chunk 2: palette, materials, small builders ———
const PAL = { stone: 0x8a8578, dark: 0x6e6a5f, wood: 0x77603f, ink: 0x3a3630,
  glow: 0x9fe8c8, miss: 0xe8a37a, zero: 0xbfd9ff, brass: 0xcdaa62 };
function mat(hex, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: rough, metalness: 0.05 });
}
function gmat(hex, op = 0.85) { return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op }); }
const INVIS = new THREE.MeshBasicMaterial({ visible: false });
function box(w, h, d, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; }
function jig(o, r = 0.05) { o.rotation.y += (Math.random() - 0.5) * r; o.rotation.z += (Math.random() - 0.5) * r * 0.4; }

const VZ = ValeZero.prototype;

// a standing stone: base box + tilted face slab; returns the rig (added to scene+solid)
VZ._stone = function (x, z, w, h, tint) {
  const rig = new THREE.Group(); rig.position.set(x, 0, z);
  const base = box(w, h * 0.62, w * 0.55, mat(PAL.stone)); base.position.y = h * 0.31; rig.add(base);
  const face = box(w * 0.86, h * 0.52, w * 0.16, mat(tint ?? PAL.dark));
  face.position.set(0, h * 0.66, w * 0.24); face.rotation.x = -0.16; rig.add(face);
  jig(rig, 0.12); this.scene.add(rig); this.solid.push(rig);
  return rig;
};
// FAT invisible gaze proxy, standalone in the scene (never under an occluder)
VZ._proxy = function (x, z, w, h, d, act, glowRoot) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), INVIS);
  p.position.set(x, h / 2, z);
  p.userData.act = Object.assign({ part: 'vale-zero' }, act);
  if (glowRoot) p.userData.glowRoot = glowRoot;
  this.scene.add(p); this.interactables.push(p);
  return p;
};
// a glowing value flag (thin column) whose height animates toward a target
VZ._flag = function (parent, x, z, hex) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), gmat(hex ?? PAL.glow, 0.8));
  f.position.set(x, 0.05, z); f.scale.y = 0.001; f.userData.tH = 0.001;
  parent.add(f); return f;
};
// eased one-shot animations: {dur, fn(t01)} — drained in update()
VZ._anim = function (dur, fn, done) { this._anims.push({ t: 0, dur, fn, done }); };
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
// settle: overshoot then decay (anticipation handled by callers)
function settle(t) { return 1 + Math.sin(t * 9) * (1 - t) * 0.08; }
VZ._ms = function (key) { return Math.round((this.time - (this._t0[key] ?? this.time)) * 1000); };
VZ._mark = function (key) { this._t0[key] = this.time; };
VZ._push = function (type, data) { this.log && this.log.push(type, Object.assign({ world: 'vale' }, data)); };
// miss pulse: a brief dull flash on a rig's face — failure shown, never told
VZ._missPulse = function (rig) {
  if (!rig) return;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), gmat(PAL.miss, 0.0));
  halo.position.set(0, 1.15, 0.3); rig.add(halo);
  this._anim(0.7, (t) => { halo.material.opacity = 0.5 * Math.sin(Math.PI * t); }, () => rig.remove(halo));
};
VZ._buildAll = function () {
  this._buildStones(); this._buildMachine(); this._buildCourts(); this._buildGate();
};
// —— chunk 2/11 (props) complete

// ——— chunk 3: the two product stones + way-stone ———
VZ._buildStones = function () {
  // west: ▢·▢ = 12 — a dozen answers stand, the stone unmoved
  const s12 = this._stone(-2.9, 48.7, 1.5, 2.1, PAL.dark);
  this.stones.twelve.rig = s12;
  const r12 = box(2.0, 0.18, 0.9, mat(PAL.wood)); r12.position.set(-2.9, 0.42, 47.5); jig(r12, 0.06);
  this.scene.add(r12); this.solid.push(r12); this.stones.twelve.rack = r12;
  this._proxy(-2.9, 48.7, 2.4, 2.6, 2.2, { kind: 'stone12', prompt: STR.askPair, label: STR.s12H }, s12);
  this.colliders.push({ type: 'circle', x: -2.9, z: 48.7, r: 0.95 }, { type: 'circle', x: -2.9, z: 47.5, r: 0.9 });
  // east: ▢·▢ = 0 — the forcing stone: every pair it takes carries a 0
  const s0 = this._stone(2.9, 48.7, 1.5, 2.1, 0x5a6675);
  this.stones.zero.rig = s0;
  const r0 = box(2.0, 0.18, 0.9, mat(PAL.wood)); r0.position.set(2.9, 0.42, 47.5); jig(r0, 0.06);
  this.scene.add(r0); this.solid.push(r0); this.stones.zero.rack = r0;
  this._proxy(2.9, 48.7, 2.4, 2.6, 2.2, { kind: 'stone0', prompt: STR.askPair, label: STR.s0H }, s0);
  this.colliders.push({ type: 'circle', x: 2.9, z: 48.7, r: 0.95 }, { type: 'circle', x: 2.9, z: 47.5, r: 0.9 });
  // the way-stone at the chapter entity (0, 56): frames the chapter
  const ws = this._stone(0, 56, 0.9, 1.3, PAL.stone);
  this.wayStone = ws;
  this._proxy(0, 56, 1.6, 2.0, 1.4, { kind: 'way', prompt: 'Read the stones', label: STR.wayH }, ws);
  this.colliders.push({ type: 'circle', x: 0, z: 56, r: 0.6 });
};
// a pebble token for an accepted pair; the zero stone's pebbles carry a glowing 0-ring
VZ._pebble = function (stone, pair) {
  const st = this.stones[stone]; const i = st.pairs.length - 1;
  const rack = st.rack; if (!rack) return;
  const px = -0.8 + (i % 5) * 0.4, pz = -0.22 + Math.floor(i / 5) % 3 * 0.24;
  const peb = box(0.16, 0.12, 0.14, mat(stone === 'zero' ? 0x7d8ba0 : PAL.brass, 0.7));
  peb.position.set(px, 0.42, pz); jig(peb, 0.5);
  if (stone === 'zero') { // highlight the contained zero — the forcing property, seen
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), gmat(PAL.zero, 0.9));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; peb.add(ring);
  }
  peb.position.y = 1.6; // drop in: anticipation is the hover, ease the fall, settle the bounce
  this._anim(0.55, (t) => { peb.position.y = 1.6 - (1.6 - 0.52) * easeOut(t) * settle(t); },
    () => { peb.position.y = 0.52; });
  rack.add(peb);
};
// —— chunk 3/11 (stones) complete

// ——— chunk 4: the small leftward-walk machine (Ch-II machine rebuilt small) ———
const RAIL = { lo: -6, hi: 2, k: 0.55 };                 // x-value → local metres
function railX(v) { return (Math.max(RAIL.lo, Math.min(RAIL.hi, v)) + 2) * RAIL.k; }
VZ._buildMachine = function () {
  const g = this.byRole.learn;                            // the centerpiece ground x²+5x+6
  const rig = new THREE.Group(); rig.position.set(-6, 0, 52.5);
  const bed = box(5.2, 0.3, 1.6, mat(PAL.dark)); bed.position.y = 0.15; rig.add(bed);
  const rail = box(4.8, 0.06, 0.14, mat(PAL.brass, 0.5)); rail.position.y = 0.34; rig.add(rail);
  for (let v = RAIL.lo; v <= RAIL.hi; v++) {              // integer notches on the rail
    const n = box(0.05, 0.1, 0.22, mat(v === 0 ? PAL.brass : PAL.ink, 0.6));
    n.position.set(railX(v), 0.36, 0); rig.add(n);
  }
  const car = box(0.3, 0.24, 0.3, mat(PAL.wood, 0.6)); car.position.set(railX(0), 0.48, 0);
  rig.add(car);
  const flag = this._flag(rig, railX(0), 0.5, PAL.glow); flag.position.y = 0.6;
  const hood = box(1.4, 1.1, 0.9, mat(PAL.stone)); hood.position.set(2.9, 0.55, -0.2); rig.add(hood);
  jig(rig, 0.04); this.scene.add(rig); this.solid.push(rig);
  this.walk.rig = rig; this.walk.car = car; this.walk.flag = flag; this.walk.g = g;
  this.walk.carX = railX(0); this.walk.carTX = railX(0);
  this._proxy(-6, 52.5, 5.6, 2.0, 2.4, { kind: 'walk', prompt: STR.feed, label: STR.walkH, reach: 7 }, rig);
  this.colliders.push({ type: 'aabb', minX: -8.8, maxX: -3.2, minZ: 51.6, maxZ: 53.4 });
};
// feed the machine an x: the carriage walks, the flag eases to the computed value
VZ._feed = function (str) {
  const w = this.walk, g = w.g; if (!g) return;
  const X = parseNum(str);
  const nth = ++this.walk.tries || (this.walk.tries = 1);
  if (!X) { this._missPulse(w.rig); this._push('vale.zero.walk', { x: str, ok: false, why: 'parse', nth, ms: this._ms('walk') }); this._mark('walk'); return; }
  const val = evalQ(g.a, g.b, g.c, X);
  w.fed.push({ X, val }); w.val = val; w.lastX = X;
  w.carTX = railX(frNum(X));
  const f = w.flag, tH = Math.max(0.02, Math.min(12, Math.abs(frNum(val))) * 0.14);
  f.userData.tH = tH; f.position.x = w.carTX;
  f.material.color.set(frIsZero(val) ? PAL.glow : PAL.zero);
  this._push('vale.zero.walk', { x: frStr(X), value: frStr(val), ok: true, nth, ms: this._ms('walk') });
  this._mark('walk');
  if (frIsZero(val) && !w.rootFound) {
    w.rootFound = true;
    this._push('vale.zero.walk.root', { x: frStr(X), ms: this._ms('walk-root') });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 16), gmat(PAL.glow, 0.9));
    ring.rotation.x = Math.PI / 2; ring.position.set(w.carTX, 0.4, 0); w.rig.add(ring);
    this._anim(0.9, (t) => { ring.scale.setScalar(0.2 + easeOut(t) * settle(t) * 0.8); });
  }
};
// —— chunk 4/11 (machine) complete

// ——— chunk 5: courts (rail, crossing notches, altitude line, arms rack) + match stone ———
const VSCALE = 0.14; // value → flag height
VZ._buildCourt = function (court, x, z) {
  court.pos = { x, z };
  const rig = new THREE.Group(); rig.position.set(x, 0, z);
  const bed = box(5.0, 0.26, 1.5, mat(PAL.stone)); bed.position.y = 0.13; rig.add(bed);
  const slab = this._stone(0, 0, 1.3, 1.9, PAL.dark); this.scene.remove(slab); this.solid.pop();
  slab.position.set(1.9, 0, -1.15); rig.add(slab);      // equation slab beside the bed
  const rail = box(4.6, 0.05, 0.12, mat(PAL.brass, 0.5)); rail.position.y = 0.3; rig.add(rail);
  for (let v = RAIL.lo; v <= RAIL.hi; v++) {
    const n = box(0.04, 0.08, 0.2, mat(PAL.ink, 0.6)); n.position.set(railX(v), 0.31, 0); rig.add(n);
  }
  // target altitude line: the height every claim's flag must land on
  const alt = box(4.6, 0.03, 0.03, gmat(PAL.brass, 0.55));
  alt.position.set(0, 0.32 + court.rhs * VSCALE, 0.14); rig.add(alt);
  // the ground's crossings, shown flagless: derived roots, an unclaimed PRESENCE each
  court.notches = court.roots.map((r) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 14), gmat(PAL.zero, 0.35));
    ring.rotation.x = Math.PI / 2; ring.position.set(railX(frNum(r)), 0.33, 0); rig.add(ring);
    return { r, ring, flag: null };
  });
  // arms rack: the factor plates — [GCF k if >1] · f1 · f2 — read at the last claimed x
  const arms = []; const d = court.d;
  const parts = d ? (d.k > 1 ? [{ kind: 'k', v: d.k }] : []).concat([{ kind: 'f', f: d.f1 }, { kind: 'f', f: d.f2 }]) : [];
  parts.forEach((p, i) => {
    const px = -1.2 + i * 0.5;
    const plate = box(0.3, 0.05, 0.3, mat(PAL.wood, 0.6)); plate.position.set(px, 0.29, 0.55); rig.add(plate);
    const f = this._flag(rig, px, 0.55, p.kind === 'k' ? PAL.miss : PAL.zero); f.position.y = 0.31;
    if (p.kind === 'k') { f.userData.tH = Math.max(0.02, p.v * VSCALE); f.material.color.set(PAL.brass); }
    arms.push({ p, f });
  });
  court.arms = arms;
  jig(rig, 0.03); this.scene.add(rig); this.solid.push(rig); court.rig = rig;
  const role = court.roleKey;
  this._proxy(x, z, 5.4, 2.2, 2.6, { kind: 'court', role, prompt: STR.claim, label: STR.courtH[role], reach: 7 }, rig);
  this.colliders.push({ type: 'aabb', minX: x - 2.6, maxX: x + 2.6, minZ: z - 0.85, maxZ: z + 0.85 });
};
VZ._buildCourts = function () {
  if (this.byRole.learn) this._buildCourt(this.byRole.learn, 6, 53);
  if (this.byRole.obs) this._buildCourt(this.byRole.obs, -7, 56.5);
  if (this.byRole.warm) this._buildCourt(this.byRole.warm, -5.5, 59.6);
  if (this.byRole.finale) this._buildCourt(this.byRole.finale, 3.0, 60.5); // beside the door; the way to the gap stays open
  // the matching stone: the bridge's inheritance, x+2 = 3 (arms as values of 12)
  const ms = this._stone(7, 57.5, 1.3, 1.9, 0x6d5f70);
  const bedm = box(3.0, 0.22, 1.1, mat(PAL.dark)); bedm.position.set(7, 0.11, 58.6); jig(bedm, 0.05);
  this.scene.add(bedm); this.solid.push(bedm);
  this.match.rig = ms; this.match.bed = bedm; this.match.marks = [];
  this._proxy(7, 57.9, 2.6, 2.2, 2.8, { kind: 'match', prompt: 'Match the arms', label: STR.matchH, reach: 7 }, ms);
  this.colliders.push({ type: 'circle', x: 7, z: 57.5, r: 0.85 },
    { type: 'aabb', minX: 5.5, maxX: 8.5, minZ: 58.1, maxZ: 59.1 });
};
// two demand markers on the match bed: where each arm-equation says to stand
VZ._matchShow = function (x1, x2) {
  const bed = this.match.bed; if (!bed) return;
  for (const m of this.match.marks) bed.remove(m); this.match.marks = [];
  [x1, x2].forEach((xv, i) => {
    if (xv === null) return;
    const mk = box(0.14, 0.5, 0.14, gmat(i === 0 ? PAL.glow : PAL.miss, 0.9));
    mk.position.set(Math.max(-1.3, Math.min(1.3, xv * 0.4)), 0.5, i === 0 ? -0.2 : 0.2);
    mk.scale.y = 0.01; bed.add(mk); this.match.marks.push(mk);
    this._anim(0.5, (t) => { mk.scale.y = easeOut(t) * settle(t); }, () => { mk.scale.y = 1; });
  });
  if (x1 !== null && x2 !== null && x1 === x2 && this.match.marks.length === 2)
    this.match.marks[1].position.z = -0.2; // one body, one place: the marks coincide
};
// —— chunk 5/11 (courts) complete

// ——— chunk 6: fence + finale door across z 62 + the reward stand beyond ———
VZ._buildGate = function () {
  const mkFence = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const railT = box(w, 0.12, 0.12, mat(PAL.wood, 0.7)); railT.position.set(cx, 1.35, 62);
    const railB = box(w, 0.12, 0.12, mat(PAL.wood, 0.7)); railB.position.set(cx, 0.7, 62);
    this.scene.add(railT, railB); this.solid.push(railT, railB);
    for (let px = x0 + 0.6; px < x1; px += 2.4) {
      const post = box(0.22, 1.7, 0.22, mat(PAL.dark, 0.8)); post.position.set(px, 0.85, 62);
      jig(post, 0.06); this.scene.add(post); this.solid.push(post);
    }
  };
  mkFence(-22, -1.15); mkFence(1.15, 22);
  this.colliders.push(
    { type: 'aabb', minX: -22, maxX: -1.15, minZ: 61.75, maxZ: 62.25 },
    { type: 'aabb', minX: 1.15, maxX: 22, minZ: 61.75, maxZ: 62.25 },
    // the door itself: solid only while shut — active() predicate, flipped by the finale
    { type: 'aabb', minX: -1.2, maxX: 1.2, minZ: 61.75, maxZ: 62.25, active: () => !this.gateOpen });
  // door: hinged at the west jamb, swings north when the census closes complete
  const jambW = box(0.3, 2.2, 0.3, mat(PAL.dark, 0.8)); jambW.position.set(-1.3, 1.1, 62);
  const jambE = box(0.3, 2.2, 0.3, mat(PAL.dark, 0.8)); jambE.position.set(1.3, 1.1, 62);
  this.scene.add(jambW, jambE); this.solid.push(jambW, jambE);
  const pivot = new THREE.Group(); pivot.position.set(-1.15, 0, 62);
  const panel = box(2.3, 1.9, 0.12, mat(PAL.wood, 0.6)); panel.position.set(1.15, 1.0, 0);
  const stripe = box(2.3, 0.1, 0.14, gmat(PAL.glow, 0.0)); stripe.position.set(1.15, 1.0, 0);
  pivot.add(panel, stripe); this.scene.add(pivot); this.solid.push(pivot);
  this.door = pivot; this.doorStripe = stripe;
  // the reward stand beyond the door
  const ped = box(0.7, 1.0, 0.7, mat(PAL.stone)); ped.position.set(0, 0.5, 64.3); jig(ped, 0.08);
  const doc = box(0.42, 0.05, 0.55, gmat(PAL.brass, 0.9)); doc.position.set(0, 1.06, 64.3); doc.rotation.y = 0.2;
  this.scene.add(ped, doc); this.solid.push(ped); this.rewardDoc = doc;
  this._proxy(0, 64.3, 1.4, 1.8, 1.4, { kind: 'reward', prompt: STR.take, label: STR.rewardH, reach: 6 }, ped);
  this.colliders.push({ type: 'circle', x: 0, z: 64.3, r: 0.5 });
};
VZ._openGate = function () {
  if (this.gateOpen) return;
  this.gateOpen = true; this.enc._vale.zero.gateOpen = true; this.doorT = 0;
  this._push('vale.zero.gate', { ms: this._ms('finale'), open: true });
};
// —— chunk 6/11 (gate) complete

// ——— chunk 7: update — clock, anims, door swing, carriage and flag easing ———
VZ.update = function (dt, u) {
  this.time += dt;
  if (u && u.controls && u.controls.pos) this._ppos = u.controls.pos;
  // one-shot animations
  if (this._anims.length) {
    for (const a of this._anims) { a.t += dt; a.k = Math.min(1, a.t / a.dur); a.fn(a.k); }
    this._anims = this._anims.filter((a) => { if (a.k >= 1) { a.done && a.done(); return false; } return true; });
  }
  // flags ease toward their target heights, bottom-anchored
  if (this._flags) for (const f of this._flags) {
    if (f.userData.baseY === undefined) f.userData.baseY = f.position.y;
    f.scale.y += (f.userData.tH - f.scale.y) * Math.min(1, dt * 5);
    f.position.y = f.userData.baseY + f.scale.y / 2;
  }
  // the machine carriage walks; its value flag walks with it
  const w = this.walk;
  if (w.car) {
    w.car.position.x += (w.carTX - w.car.position.x) * Math.min(1, dt * 3.2);
    w.flag.position.x = w.car.position.x;
  }
  // door swing: anticipation → ease → settle
  if (this.doorT >= 0 && this.door) {
    this.doorT += dt; const t = this.doorT, OPEN = -1.9;
    let ang;
    if (t < 0.35) ang = 0.09 * Math.sin(Math.PI * t / 0.35);          // anticipation: presses shut
    else if (t < 1.55) ang = OPEN * easeOut((t - 0.35) / 1.2);         // the swing
    else if (t < 2.5) { const s = (t - 1.55) / 0.95; ang = OPEN + Math.sin(s * 8) * (1 - s) * 0.07; }
    else { ang = OPEN; this.doorT = -2; }                              // settled
    this.door.rotation.y = ang;
    this.doorStripe.material.opacity = Math.min(0.8, Math.max(0, t * 0.8));
  }
};
// patch _flag to register with the easing list (kept here so chunk 2 stays frozen)
const _mkFlag = VZ._flag;
VZ._flag = function (parent, x, z, hex) {
  const f = _mkFlag.call(this, parent, x, z, hex);
  (this._flags = this._flags || []).push(f); return f;
};
// —— chunk 7/11 (update) complete

// ——— chunk 8: label chips (KaTeX), distance-gated at 9.5 m; architect layer ———
function texSub(a, b, c, X, val) { // the substitution line, in view: e.g. (-1)^2+5·(-1)+6=2
  const xs = (X.d === 1 && X.n >= 0) ? frTex(X) : '(' + frTex(X) + ')';
  return (a === 1 ? '' : a + '\\cdot ') + xs + '^2+' + b + '\\cdot ' + xs + '+' + c + '=' + frTex(val);
}
VZ._near = function (x, z, d) {
  const p = this._ppos; if (!p) return false;
  const dx = p.x - x, dz = p.z - z; return dx * dx + dz * dz < (d ?? 9.5) * (d ?? 9.5);
};
VZ.labels = function (L, architectOn) {
  const S = this.stones, W = this.walk;
  if (this._near(-2.9, 48.7)) L.set('vz-s12', { tex: '\\square\\cdot\\square=12', x: -2.9, y: 2.55, z: 48.7 });
  if (this._near(2.9, 48.7)) L.set('vz-s0', { tex: '\\square\\cdot\\square=0', x: 2.9, y: 2.55, z: 48.7 });
  if (S.zero.forced && this._near(2.9, 47.5)) L.set('vz-force', { html: STR.forcing, x: 2.9, y: 1.35, z: 47.5, dy: 6 });
  if (this._near(-6, 52.5, 9.5)) {
    L.set('vz-mach', { tex: 'x^2+5x+6', x: -6, y: 2.1, z: 52.2 });
    if (W.lastX) L.set('vz-mval', { tex: texSub(W.g.a, W.g.b, W.g.c, W.lastX, W.val), x: -6, y: 1.55, z: 52.9 });
    if (W.rootFound) L.set('vz-mroot', { html: STR.walkRoot, x: -6 + (W.carTX || 0), y: 1.0, z: 53.0, dy: 6 });
  }
  for (const c of this.courts) {
    const role = c.roleKey;
    if (!this._near(c.pos.x, c.pos.z, 9.5)) continue;
    L.set('vz-eq-' + role, { tex: texQuad(c.a, c.b, c.c, c.rhs), x: c.pos.x + 1.9, y: 2.45, z: c.pos.z - 1.15 });
    if (c.lastTex) L.set('vz-sub-' + role, { tex: c.lastTex, x: c.pos.x, y: 2.0, z: c.pos.z + 0.6 });
    if (role === 'warm' && c.claims.length) L.set('vz-gcf', { html: STR.gcfNote, x: c.pos.x - 1.2, y: 1.25, z: c.pos.z + 0.55, dy: 6 });
    if (role === 'finale' && this.payoffSeen) L.set('vz-pay', { html: STR.payoff, x: c.pos.x, y: 1.5, z: c.pos.z - 0.6, dy: 6 });
  }
  if (this._near(7, 57.5, 9.5)) {
    L.set('vz-match', { tex: '(x+2)(x+3)=12', x: 7, y: 2.45, z: 57.5 });
    if (this.match.derived) L.set('vz-m3', { html: STR.m3, x: 7, y: 1.2, z: 58.6, dy: 6 });
  }
  if (this._near(0, 62, 9.5)) L.set('vz-door', { html: STR.doorChip, x: 0, y: 2.5, z: 62, dy: 4 });
  if (architectOn) {
    const A = (id, note, x, y, z) => L.set(id, { html: note, x, y, z, kind: 'architect' });
    A('vz-a-s', 'stratum: solving · the forcing stone — pair-set at 0 degenerates (atlas 04 §1)', 0, 3.0, 48.7);
    A('vz-a-w', 'SV-EVAL-NEG prerequisite gate: leftward walk, predict-then-see', -6, 2.6, 52.5);
    A('vz-a-l', 'Station A: =0 centerpiece; split/census/check', 6, 2.8, 53);
    A('vz-a-o', 'Station B: =2 — SV-ZP-ANY-N observability court (load-bearing)', -7, 2.8, 56.5);
    A('vz-a-m', 'SV-VALUE-MATCH home; repair derives zero-product', 7, 2.9, 57.5);
    A('vz-a-wm', 'warm-up: GCF plate 2 forces nothing', -5.5, 2.8, 59.6);
    A('vz-a-f', 'FINALE: a≠1 payoff — the fraction root −3/2; gate predicate', 0, 3.0, 61.2);
  }
};
// —— chunk 8/11 (labels) complete

// ——— chunk 9: onInteract + panel cards ———
VZ.onInteract = function (act, PH) {
  if (!act) return;
  const kind = act.kind === 'court' ? 'court-' + act.role : act.kind;
  this.focus = kind;
  if (!(kind in this._t0)) this._mark(kind);
  if (kind === 'court-finale') this._mark('finale');
  if (kind === 'walk') { this._mark('walk'); this._mark('walk-root'); }
  const at = act.kind === 'court' ? this.byRole[act.role].pos
    : { stone12: { x: -2.9, z: 48.7 }, stone0: { x: 2.9, z: 48.7 }, walk: { x: -6, z: 52.5 },
        match: { x: 7, z: 57.5 }, reward: { x: 0, z: 64.3 }, way: { x: 0, z: 56 } }[kind] || { x: 0, z: 56 };
  this.panelAnchor = { x: at.x, z: at.z, reach: 9 };
  (PH || this.PH).openPanel('p:vale-zero');
};
const IN = (id) => '<input class="gate-in" type="text" id="' + id + '" data-enter="' + id + '" autocomplete="off">';
const BTN = (k, label, primary) => '<button class="btn' + (primary ? ' primary' : '') + '" data-k="' + k + '">' + label + '</button>';
VZ._stonePanel = function (key) {
  const st = this.stones[key === 'stone12' ? 'twelve' : 'zero'];
  const K = this.PH.K, target = key === 'stone12' ? 12 : 0;
  let h = '<h2>' + (key === 'stone12' ? STR.s12H : STR.s0H) + '</h2>'
    + '<p class="lede">' + (key === 'stone12' ? STR.s12L : STR.s0L) + '</p>'
    + '<div class="eq">' + K('\\square\\cdot\\square=' + target) + '</div>'
    + IN('vz-a') + ' ' + IN('vz-b') + ' ' + BTN('pair:' + key, STR.askPair, true);
  if (st.pairs.length) {
    const shown = st.pairs.slice(-6).map((p) => frStr(p[0]) + '\\cdot' + frStr(p[1])).join(',\\;');
    h += '<div class="eq">' + K(shown) + '</div>';
  }
  if (key === 'stone0' && st.forced) h += '<p class="muted">' + STR.forcing + '</p>';
  return h;
};
VZ._courtPanel = function (role) {
  const c = this.byRole[role]; if (!c) return '';
  const K = this.PH.K;
  let h = '<h2>' + STR.courtH[role] + '</h2><p class="lede">' + STR.courtL[role] + '</p>'
    + '<div class="eq">' + K(texQuad(c.a, c.b, c.c, c.rhs)) + '</div>';
  if (!c.done) {
    h += IN('vz-c') + ' ' + BTN('claim:' + role, STR.claim, true);
    if (c.claims.length) {
      h += '<div class="eq">' + K('x=' + c.claims.map(frTex).join(',\\;')) + '</div>'
        + BTN('census:' + role, STR.census0, false) + ' ' + BTN('look:' + role, STR.census1, false);
    }
  } else {
    h += '<div class="eq">' + K('x=' + c.claims.map(frTex).join(',\\;')) + '</div>';
    if (role === 'finale' && this.payoffSeen) h += '<p class="muted">' + STR.payoff + '</p>';
    if (role === 'warm') h += '<p class="muted">' + STR.gcfNote + '</p>';
  }
  return h;
};
VZ.panel = function (st) {
  if (!st || st.panel !== 'p:vale-zero') return '';
  const K = this.PH.K, f = this.focus, M = this.match;
  if (f === 'stone12' || f === 'stone0') return this._stonePanel(f);
  if (f && f.startsWith('court-')) return this._courtPanel(f.slice(6));
  if (f === 'walk') {
    let h = '<h2>' + STR.walkH + '</h2><p class="lede">' + STR.walkL + '</p>'
      + '<div class="eq">' + K('x^2+5x+6') + '</div>' + IN('vz-x') + ' ' + BTN('feed', STR.feed, true);
    if (this.walk.fed.length) {
      const tr = this.walk.fed.slice(-4).map((e) => frTex(e.X) + '\\to ' + frTex(e.val)).join(',\\;');
      h += '<div class="eq">' + K(tr) + '</div>';
    }
    return h;
  }
  if (f === 'match') {
    let h = '<h2>' + STR.matchH + '</h2><p class="lede">' + STR.matchL + '</p>'
      + '<div class="eq">' + K('(x+2)(x+3)=12') + '</div>';
    if (M.stage === 0) h += BTN('mpick:3,4', '3 · 4') + ' ' + BTN('mpick:2,6', '2 · 6') + ' ' + BTN('mpick:1,12', '1 · 12');
    if (M.lastPick) {
      const [u, v] = M.lastPick;
      h += '<div class="eq">' + K('x+2=' + u + '\\;\\to\\;x=' + (u - 2) + '\\qquad x+3=' + v + '\\;\\to\\;x=' + (v - 3)) + '</div>';
      if (u - 2 !== v - 3) h += '<p class="muted">' + STR.m1 + '</p>';
    }
    if (M.stage === 1) {
      h += '<p class="lede">' + STR.m2 + '</p>' + BTN('mzero:0,1', '0 · 1') + ' ' + BTN('mzero:-1,0', '−1 · 0');
      if (M.zeroPicks.length) h += '<div class="eq">' + K(M.zeroPicks.map((p) => 'x=' + (p[0] - 2)).join(',\\;')) + '</div>';
    }
    if (M.derived) h += '<div class="eq">' + K('x=-2,\\;x=-3') + '</div><p class="muted">' + STR.m3 + '</p>';
    return h;
  }
  if (f === 'reward') {
    return '<h2>' + STR.rewardH + '</h2><p class="lede">'
      + (this.rewardTaken ? STR.rewardDoc : STR.rewardL) + '</p>'
      + (this.rewardTaken ? '' : BTN('take', STR.take, true));
  }
  return '<h2>' + STR.wayH + '</h2><p class="lede">' + STR.wayL + '</p>'
    + '<div class="eq">' + K('\\square\\cdot\\square=12\\qquad\\square\\cdot\\square=0') + '</div>';
};
// —— chunk 9/11 (panel) complete

// ——— chunk 10: delegated panel events ———
// value lookup: test-injectable (ev.values) with DOM fallback
VZ._val = function (ev, id) {
  if (ev && ev.values && id in ev.values) return ev.values[id];
  const doc = (ev && ev.target && ev.target.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  const el = doc && doc.getElementById ? doc.getElementById(id) : null;
  return el ? el.value : '';
};
VZ._refocus = function (ev, id) {
  const doc = (ev && ev.target && ev.target.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.getElementById) return;
  queueMicrotask(() => { const el = doc.getElementById(id); if (el) { el.focus(); el.select && el.select(); } });
};
VZ.onPanel = function (ev, PH) {
  PH = PH || this.PH;
  const t = ev && ev.target;
  let k = t && t.dataset ? t.dataset.k : null;
  if (!k && ev && ev.key === 'Enter' && t && t.dataset && t.dataset.enter) {
    const id = t.dataset.enter;
    if (id === 'vz-a' || id === 'vz-b') k = 'pair:' + this.focus;
    else if (id === 'vz-x') k = 'feed';
    else if (id === 'vz-c' && this.focus && this.focus.startsWith('court-')) k = 'claim:' + this.focus.slice(6);
  }
  if (!k) return;
  const [op, arg] = k.split(':');
  if (op === 'pair') { this._pairSubmit(arg, this._val(ev, 'vz-a'), this._val(ev, 'vz-b')); PH.refresh(); this._refocus(ev, 'vz-a'); }
  else if (op === 'feed') { this._feed(this._val(ev, 'vz-x')); PH.refresh(); this._refocus(ev, 'vz-x'); }
  else if (op === 'claim') { this._claim(arg, this._val(ev, 'vz-c')); PH.refresh(); this._refocus(ev, 'vz-c'); }
  else if (op === 'census') { this._census(arg, PH); PH.refresh(); }
  else if (op === 'look') { this._push('vale.zero.court.look', { court: arg, ms: this._ms('court-' + arg) }); this._refocus(ev, 'vz-c'); }
  else if (op === 'mpick') { this._matchPick(arg.split(',').map(Number)); PH.refresh(); }
  else if (op === 'mzero') { this._matchZero(arg.split(',').map(Number)); PH.refresh(); }
  else if (op === 'take') { this._takeReward(PH); PH.refresh(); }
};
// the two product stones: exact pair judgment; the stone takes or it does not
VZ._pairSubmit = function (which, aStr, bStr) {
  const key = which === 'stone12' ? 'twelve' : 'zero';
  const st = this.stones[key], target = key === 'twelve' ? 12 : 0;
  const nth = ++st.tries, ms = this._ms(which); this._mark(which);
  const A = parseNum(aStr), B = parseNum(bStr);
  if (!A || !B) {
    this._missPulse(st.rig);
    this._push('vale.zero.stones.pair', { stone: key, a: aStr, b: bStr, ok: false, why: 'parse', nth, ms });
    return;
  }
  const ok = frEq(frMul(A, B), frac(target));
  const dup = st.pairs.some((p) => frEq(p[0], A) && frEq(p[1], B));
  this._push('vale.zero.stones.pair', { stone: key, a: frStr(A), b: frStr(B), ok, dup, nth, ms });
  if (!ok) { this._missPulse(st.rig); return; }
  if (!dup) { st.pairs.push([A, B]); this._pebble(key, [A, B]); }
  if (key === 'zero' && !st.forced && st.pairs.length >= 3) {
    st.forced = true; // every accepted pair carries a 0 — a theorem, surfaced as scenery
    this._push('vale.zero.stones.forced', { pairs: st.pairs.length, ms: this._ms('stone0') });
  }
};
// —— chunk 10/11 (onpanel) complete

// ——— chunk 11: substitution-in-view, census, gate opening, vale.done ———
// stand a claim in a court: the world substitutes it into the ORIGINAL, in view
VZ._claim = function (role, str) {
  const c = this.byRole[role]; if (!c || c.done) return;
  const nth = ++c.tries, key = 'court-' + role, ms = this._ms(key); this._mark(key);
  const X = parseNum(str);
  if (!X) {
    this._missPulse(c.rig);
    this._push('vale.zero.court.claim', { court: role, claim: str, ok: false, why: 'parse', nth, ms });
    return;
  }
  const val = evalQ(c.a, c.b, c.c, X);                    // ground-read of the original
  const ok = frEq(val, frac(c.rhs));
  c.lastTex = texSub(c.a, c.b, c.c, X, val);
  // marker walks in and its flag rises to the computed altitude — landing (or not) in view
  if (c.marker) { c.rig.remove(c.marker); c.marker = null; }
  if (c.mflag) { c.mflag.userData.tH = 0.001; }
  const mx = railX(frNum(X));
  const mk = box(0.16, 0.14, 0.16, mat(PAL.ink, 0.5)); mk.position.set(mx, 1.4, 0); c.rig.add(mk);
  this._anim(0.5, (t) => { mk.position.y = 1.4 - (1.4 - 0.4) * easeOut(t) * settle(t); }, () => { mk.position.y = 0.4; });
  c.marker = mk;
  const fl = this._flag(c.rig, mx, 0.05, ok ? PAL.glow : PAL.miss); fl.position.y = 0.33;
  fl.userData.tH = Math.max(0.02, Math.min(12, Math.abs(frNum(val))) * VSCALE);
  c.mflag = fl;
  for (const a of c.arms) if (a.p.kind === 'f') {          // the arms read alongside
    const av = frac(a.p.f.m * X.n + a.p.f.n * X.d, X.d);
    a.f.userData.tH = Math.max(0.02, Math.min(12, Math.abs(frNum(av))) * VSCALE);
    a.f.material.color.set(frIsZero(av) ? PAL.glow : PAL.zero);
  }
  const dup = c.claims.some((r) => frEq(r, X));
  this._push('vale.zero.court.claim', { court: role, claim: str, x: frStr(X), value: frStr(val), ok, dup, nth, ms });
  if (!ok) { this._missPulse(c.rig); return; }
  if (dup) return;
  c.claims.push(X);
  const notch = c.notches.find((n) => frEq(n.r, X));
  if (notch && !notch.flag) {                              // the crossing gains its flag
    const pole = box(0.05, c.rhs * VSCALE + 0.5, 0.05, mat(PAL.brass, 0.5));
    pole.position.set(railX(frNum(X)), (c.rhs * VSCALE + 0.5) / 2 + 0.3, 0);
    const cap = box(0.16, 0.1, 0.05, gmat(PAL.glow, 0.9)); cap.position.y = (c.rhs * VSCALE + 0.5) / 2;
    pole.add(cap); c.rig.add(pole); notch.flag = pole; notch.ring.material.opacity = 0.9;
  }
  if (role === 'finale' && X.d > 1 && !this.payoffSeen) {  // the half-step root: the payoff
    this.payoffSeen = true;
    this._push('vale.zero.finale.fraction', { x: frStr(X), ms: this._ms('finale') });
  }
};
// close the census: complete → the court closes (finale: the door swings); early → the
// unclaimed crossings pulse, flagless — an omission shown, never told
VZ._census = function (role, PH) {
  const c = this.byRole[role]; if (!c || c.done) return;
  const missing = c.notches.filter((n) => !n.flag);
  const complete = missing.length === 0 && c.claims.length > 0;
  this._push('vale.zero.court.census', { court: role, complete, missing: missing.length, ms: this._ms('court-' + role) });
  if (!complete) {
    for (const n of missing) this._anim(1.4, (t) => { n.ring.material.opacity = 0.35 + 0.6 * Math.abs(Math.sin(t * Math.PI * 3)); });
    return;
  }
  c.done = true;
  this._push('vale.zero.court.done', { court: role, tries: c.tries, ms: this._ms('court-' + role) });
  if (role === 'finale') this._openGate();
  (PH || this.PH).dismissLater('p:vale-zero', 2600);       // the world's answer is watched
};
VZ._matchPick = function (pv) {
  const [u, v] = pv; const M = this.match;
  const nth = ++M.tries, ms = this._ms('match'); this._mark('match');
  M.lastPick = [u, v]; M.picks.push([u, v]);
  const x1 = u - 2, x2 = v - 3, consistent = x1 === x2;
  this._matchShow(x1, x2);
  const ground = consistent ? evalQ(1, 5, 6, frac(x1)) : null;
  this._push('vale.zero.match.pick', { pair: u + 'x' + v, x1, x2, consistent,
    ground: ground ? frStr(ground) : null, nth, ms });
  if (consistent) M.stage = 1;
};
VZ._matchZero = function (pv) {
  const [u, v] = pv; const M = this.match;
  if (M.stage < 1 || u * v !== 0 || v - u !== 1) return;   // one-apart pairs of 0 only
  const x = u - 2;                                          // both arms name this same x
  if (!M.zeroPicks.some((p) => p[0] === u)) M.zeroPicks.push([u, v]);
  this._push('vale.zero.match.zero', { pair: u + 'x' + v, x, ms: this._ms('match') }); this._mark('match');
  if (M.zeroPicks.length >= 2 && !M.derived) {
    M.derived = true;                                       // zero-product, DERIVED from the repair
    this._push('vale.zero.match.derive', { places: M.zeroPicks.map((p) => p[0] - 2), ms: this._ms('match-all') });
  }
};
VZ._takeReward = function (PH) {
  if (this.rewardTaken) return;
  this.rewardTaken = true;
  const doc = this.rewardDoc;
  if (doc) this._anim(1.2, (t) => { doc.position.y = 1.06 + easeOut(t) * 0.5; doc.rotation.y = 0.2 + t * Math.PI * 2; });
  this._push('vale.zero.reward', { ms: this._ms('reward') });
  if (!this.doneLogged) {
    this.doneLogged = true; this.enc._vale.zero.done = true;
    this._push('vale.done', { ms: Math.round(this.time * 1000) });
  }
  (PH || this.PH).dismissLater('p:vale-zero', 4200);
};
// —— chunk 11/11 (claims) complete
