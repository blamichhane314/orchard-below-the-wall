// js/parts/valepair.js — registry id 'vale-pair' (pre-wired by main.js)
// Chapter III — Pair (stratum: polynomials, a = 1). Item x^2+5x+6, to be FACTORED.
// FORK P1: true rule (multiply to c, add to b) vs swap rule (multiply to b, add to c).
// The swap confidently yields (1,5) -> (x+1)(x+5): passes a lone x=1 check (12 = 12),
// dies at the assay stones (x=0 reads 5 against the ground's 6). Truths derived at
// runtime from enc block 'pair' — nothing stored. Atlas 03. Region x -22..22, z -8..14.
//
// MANIFEST (chunks, in order):
//   1/8 head             — imports, placeholder strings, truth derivation, class skeleton
//   2/8 build-hub        — trail-stone, two mouths with carved numeric rule slabs, zones
//   3/8 build-stations   — true trail: two-faced search aid + laying station; swap station
//   4/8 build-assay-gate — assay stones (x = 0, 1, 2), fence + door across z 12
//   5/8 update           — fork/rejoin state machine, door swing, slab drift, assay reveal
//   6/8 labels           — KaTeX chips, numeric register; architect notes
//   7/8 panel            — card HTML per mode
//   8/8 events           — onInteract / onPanel: commit, lay, assay run, repair, gate
import * as THREE from '../../vendor/three/three.module.js';

// ---- PLACEHOLDER STRINGS (all player-facing copy; marked per contract) ----------------
export const STR = {
  stoneLabel:  'A fork where two rules part ways',        // PLACEHOLDER (vale.json fallback)
  stonePrompt: 'Read the trail-stone',                    // PLACEHOLDER
  stoneLede:   'Two carved rules part ways here. Walk the way you believe; the stones along it answer.', // PLACEHOLDER
  wantsPair:   'wants to be two brackets. Which two numbers?', // PLACEHOLDER
  searchPrompt:'Consult the two-faced aid',               // PLACEHOLDER
  searchLabel: 'The search station',                      // PLACEHOLDER
  faceC:       'pairs that multiply to',                  // PLACEHOLDER (face S-c heading)
  faceB:       'pairs that add to',                       // PLACEHOLDER (face S-b heading)
  carryBtn:    'Carry this pair',                         // PLACEHOLDER
  layPrompt:   'Lay the pair into brackets',              // PLACEHOLDER
  layLabel:    'The laying station',                      // PLACEHOLDER
  layBtn:      'Lay it',                                  // PLACEHOLDER
  layEmpty:    'Nothing to lay yet. The aid up the trail helps a search.', // PLACEHOLDER
  layDone:     'Laid. The assay stones by the gate will test it.', // PLACEHOLDER
  swapPrompt:  'Read the carved search',                  // PLACEHOLDER
  swapLabel:   'A finished search, carved',               // PLACEHOLDER
  swapTake:    'Take the pair',                           // PLACEHOLDER
  swapBoth:    'Both lines hold. The search is done.',    // PLACEHOLDER (the confident beat)
  assayPrompt: 'Assay the claim',                         // PLACEHOLDER
  assayLabel:  'The assay stones',                        // PLACEHOLDER
  assayEmpty:  'The stones wait for a claim — a laid form, brackets and all.', // PLACEHOLDER
  assayBtn:    'Test it at 0, 1, 2',                      // PLACEHOLDER
  assayAgree:  'agrees',                                  // PLACEHOLDER
  assayLied:   'agreed — the point that lied',            // PLACEHOLDER
  assayReads:  'reads',                                   // PLACEHOLDER
  against:     'against',                                 // PLACEHOLDER
  cleanLine:   'Three agreements. The same thing, twice written. The door answers.', // PLACEHOLDER
  failCorner:  'The ends multiply into the corner:',      // PLACEHOLDER
  failCross:   'The cross pieces add into the middle:',   // PLACEHOLDER
  groundReads: 'the ground reads',                        // PLACEHOLDER
  rechoice:    'The form is dead. Walk back to the fork; choose again.', // PLACEHOLDER
  doorLabel:   'The chapter door',                        // PLACEHOLDER
  doorPrompt:  'Try the door',                            // PLACEHOLDER
  doorShut:    'The door answers to the stones, not to hands.', // PLACEHOLDER
  doorOpen:    'Open. The braid is ahead.',               // PLACEHOLDER
};

// ---- truth derivation (runtime only; perceptual contract) -----------------------------
export function derivePair(b, c) {          // true rule: p*q = c, p+q = b -> [2,3]
  for (let p = 1; p * p <= c; p++) if (c % p === 0 && p + c / p === b) return [p, c / p];
  return null;
}
export function deriveSwapPair(b, c) {      // swap rule: p*q = b, p+q = c -> [1,5]
  for (let p = 1; p * p <= b; p++) if (b % p === 0 && p + b / p === c) return [p, b / p];
  return null;
}
export function evalOrig(enc, x) { return enc.a * x * x + enc.b * x + enc.c; }
export function evalClaim(p, q, x) { return (x + p) * (x + q); }
export function assayClaim(enc, p, q) {     // any claimed (p,q) at x in {0,1,2}, side by side
  return [0, 1, 2].map((x) => {
    const lhs = evalOrig(enc, x), rhs = evalClaim(p, q, x);
    return { x, lhs, rhs, ok: lhs === rhs };
  });
}
export function isCleanPair(enc, p, q) { return assayClaim(enc, p, q).every((r) => r.ok); } // order-free
export function ladderC(b, c) {             // S-c: factor pairs of c, sums shown, descending
  const out = [];
  for (let p = 1; p * p <= c; p++) if (c % p === 0) out.push({ p, q: c / p, sum: p + c / p, hit: p + c / p === b });
  return out.sort((r, s) => s.sum - r.sum);
}
export function ladderB(b, c) {             // S-b: summand pairs of b, products shown, ascending
  const out = [];
  for (let p = 1; p <= b - p; p++) out.push({ p, q: b - p, prod: p * (b - p), hit: p * (b - p) === c });
  return out.sort((r, s) => r.prod - s.prod);
}
export function ladderSwap(b, c) {          // the swap search: factor pairs of b, sums vs c
  const out = [];
  for (let p = 1; p * p <= b; p++) if (b % p === 0) out.push({ p, q: b / p, sum: p + b / p, hit: p + b / p === c });
  return out;
}

// ---- materials ------------------------------------------------------------------------
const M = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
const GLOW = (color, opacity = 0.85) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity });

export default class ValePair {
  constructor(ctx) {
    this.ctx = ctx;
    this.enc = (ctx.enc && ctx.enc.pair) || { a: 1, b: 5, c: 6, tex: 'x^{2} + 5x + 6', inocTex: '1 \\cdot 6' };
    this.ent = ((ctx.world && ctx.world.entities) || []).find((e) => e.id === 'vale-pair') ||
      { at: { x: 0, z: 2 }, label: STR.stoneLabel, prompt: STR.stonePrompt, reach: 8 };
    this.truePair = derivePair(this.enc.b, this.enc.c);        // [2,3] — derived, not stored
    this.swapPair = deriveSwapPair(this.enc.b, this.enc.c);    // [1,5] — derived, not stored
    this.colliders = []; this.solid = []; this.interactables = [];
    // fork/rejoin machine (zone idiom): fork fires only from 'hub', rejoin only from 'out'
    this.state = 'hub'; this.chosen = null; this.rejoins = 0;
    this.time = 0; this.choiceT0 = 0; this._entered = false; this._zoneLast = {};
    this.claim = null;         // {p, q, src:'search'|'swap'}  — accepted at search, tested at assay
    this.built = false;        // a laid FORM exists (assay takes forms, not bare pairs)
    this.assay = { running: false, t: 0, order: [], results: null, done: false, shown: 0 };
    this.gateOpen = false; this.doorT = 0; this._slab = null; this._slabAnim = null;
    this.pmode = 'stone'; this._faceLogged = {}; this._playerPos = null;
    if (ctx.enc) (ctx.enc._vale = ctx.enc._vale ?? {}).pair = { gateOpen: false, factored: false };
    this.panelAnchor = { x: 0, z: 8, reach: 14 };
    this._build();
  }
  _log(type, data) { this.ctx.log && this.ctx.log.push(type, Object.assign({ world: 'vale' }, data)); }
  _ms() { return Math.round((this.time - this.choiceT0) * 1000); }
  _build() { this._buildHub(); this._buildStations(); this._buildAssayGate(); }
}
// —— chunk 1/8 (head) complete

// ---- 2/8 build-hub: trail-stone, the two mouths, fork/rejoin zones --------------------
ValePair.prototype._proxy = function (x, y, z, sx, sy, sz, act, glowRoot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  m.userData.act = Object.assign({ part: 'vale-pair' }, act);
  if (glowRoot) m.userData.glowRoot = glowRoot;
  this.ctx.scene.add(m);            // standalone in the scene, NOT under an occluder
  this.interactables.push(m);
  return m;
};
ValePair.prototype._slabStone = function (x, z, w, h, rotY, tilt, color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.35, 0.5), M(0x6d6a63));
  base.position.y = 0.17;
  const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), M(color));
  face.position.y = 0.3 + h / 2; face.rotation.x = tilt;
  g.add(base, face); g.position.set(x, 0, z); g.rotation.y = rotY;
  this.ctx.scene.add(g); this.solid.push(g);
  return g;
};
ValePair.prototype._buildHub = function () {
  const ax = this.ent.at.x, az = this.ent.at.z;                 // (0, 2) from vale.json
  // trail-stone: the ways part around it — walking is choosing
  const stone = this._slabStone(ax, az, 1.1, 1.5, 0, -0.09, 0x7b776d);
  this.colliders.push({ type: 'circle', x: ax, z: az, r: 0.6 });
  this._proxy(ax, 1.0, az, 2.2, 2.4, 2.2,
    { kind: 'stone', prompt: this.ent.prompt || STR.stonePrompt,
      label: this.ent.label || STR.stoneLabel, reach: this.ent.reach || 8 }, stone);
  // two mouths in open ground, x -22..22: ways SEEN parting, no corridors
  this.mouthTrue = { x: 5, z: 3 };   // east — rule carved: multiply to 1*6, add to 5
  this.mouthSwap = { x: -5, z: 3 };  // west — rule carved: multiply to 5, add to 6
  this._slabStone(this.mouthTrue.x, this.mouthTrue.z, 1.4, 1.3, -0.5, -0.12, 0x8a8578);
  this._slabStone(this.mouthSwap.x, this.mouthSwap.z, 1.4, 1.3, 0.5, -0.12, 0x8a8578);
  this.colliders.push({ type: 'circle', x: this.mouthTrue.x, z: this.mouthTrue.z, r: 0.7 });
  this.colliders.push({ type: 'circle', x: this.mouthSwap.x, z: this.mouthSwap.z, r: 0.7 });
  // a low way-scatter of pebbles marking the two departing trails (props only, no colliders)
  const peb = M(0x9a948a);
  [[2.2, 3.2], [3.4, 4.0], [4.6, 4.9], [6.2, 5.6],           // toward the true trail NE
   [-2.2, 3.2], [-3.4, 4.0], [-4.6, 4.9], [-6.2, 5.6]        // toward the swap trail NW
  ].forEach(([px, pz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), peb);
    p.position.set(px, 0.05, pz); p.rotation.y = px * 0.7;
    this.ctx.scene.add(p);
  });
  // zones (ground rects): fork fires only from 'hub', rejoin only from 'out'
  this.ZONES = [
    { id: 'f-true', kind: 'fork', tag: 'true', minX: 2, maxX: 12, minZ: 0.5, maxZ: 6 },
    { id: 'f-swap', kind: 'fork', tag: 'swap', minX: -12, maxX: -2, minZ: 0.5, maxZ: 6 },
    { id: 'r-hub', kind: 'rejoin', minX: -2, maxX: 2, minZ: -0.5, maxZ: 1.4 },
  ];
};
// —— chunk 2/8 (build-hub) complete

// ---- 3/8 build-stations: two-faced search aid, laying station, swap station -----------
ValePair.prototype._buildStations = function () {
  // TRUE TRAIL (east). The search station: one stone, two faces — both strategies honored
  // (S-c: factor pairs of c, keep the sum; S-b: summand pairs of b, keep the product).
  // Direction is a strategy, never forked (atlas 03 A1-DIRECTION); observed via faces.
  this.aidAt = { x: 11, z: 6 };
  const aid = new THREE.Group();
  const aw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.18), M(0x84806f)); // west face: S-c
  aw.position.set(-0.12, 1.15, 0); aw.rotation.y = 0.25;
  const ae = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.18), M(0x6f8480)); // east face: S-b
  ae.position.set(0.12, 1.15, 0); ae.rotation.y = -0.25;
  const ab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 0.9), M(0x6d6a63));
  ab.position.y = 0.2;
  aid.add(ab, aw, ae); aid.position.set(this.aidAt.x, 0, this.aidAt.z);
  this.ctx.scene.add(aid); this.solid.push(aid);
  this.colliders.push({ type: 'circle', x: this.aidAt.x, z: this.aidAt.z, r: 0.8 });
  this._proxy(this.aidAt.x, 1.2, this.aidAt.z, 2.6, 2.6, 2.6,
    { kind: 'search', prompt: STR.searchPrompt, label: STR.searchLabel, reach: 7 }, aid);
  // The laying station: a plinth where the pair becomes a FORM; product target carved 1*6
  // (the inoculation: never bare 6 — the a*c rule wearing its a=1 disguise).
  this.layAt = { x: 8, z: 9.5 };
  const lay = new THREE.Group();
  const lp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 1.0), M(0x7b6f5e));
  lp.position.y = 0.42;
  const lc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.1), M(0x8a8578)); // the 1*6 carving face
  lc.position.set(0, 0.75, -0.55); lc.rotation.x = -0.25;
  lay.add(lp, lc); lay.position.set(this.layAt.x, 0, this.layAt.z);
  this.ctx.scene.add(lay); this.solid.push(lay);
  this.colliders.push({ type: 'circle', x: this.layAt.x, z: this.layAt.z, r: 0.75 });
  this._proxy(this.layAt.x, 0.9, this.layAt.z, 2.4, 2.2, 2.2,
    { kind: 'lay', prompt: STR.layPrompt, label: STR.layLabel, reach: 7 }, lay);
  // SWAP TRAIL (west). A finished search, carved — the swap rule run to completion:
  // its only rung (1,5) satisfies BOTH its lines (1*5=5, 1+5=6). Confidence by design.
  this.swapAt = { x: -10, z: 6 };
  const sw = new THREE.Group();
  const sf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.8, 0.2), M(0x84766f));
  sf.position.set(0, 1.2, 0); sf.rotation.x = -0.08;
  const sb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.9), M(0x6d6a63));
  sb.position.y = 0.2;
  sw.add(sb, sf); sw.position.set(this.swapAt.x, 0, this.swapAt.z); sw.rotation.y = 0.35;
  this.ctx.scene.add(sw); this.solid.push(sw);
  this.colliders.push({ type: 'circle', x: this.swapAt.x, z: this.swapAt.z, r: 0.8 });
  this._proxy(this.swapAt.x, 1.2, this.swapAt.z, 2.6, 2.6, 2.6,
    { kind: 'swap', prompt: STR.swapPrompt, label: STR.swapLabel, reach: 7 }, sw);
};
// The claimed form, made physical: two half-slabs (one bracket each) on a low sled.
// Split halves so a failed assay can part them — failure visible, never verbal.
ValePair.prototype._buildClaimSlab = function (p, q, x, z) {
  this._removeSlab();
  const g = new THREE.Group();
  const mk = (dx) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.14), M(0xcfc9b8));
    h.position.set(dx, 1.05, 0);
    return h;
  };
  const l = mk(-0.42), r = mk(0.42);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.2), GLOW(0xd9c97e, 0.7));
  rim.position.set(0, 0.5, 0);
  g.add(l, r, rim);
  g.userData = { p, q, halves: [l, r], rim, dead: 0 };
  g.position.set(x, 0, z);
  this.ctx.scene.add(g);
  this._slab = g; this._slabAnim = null;
  return g;
};
ValePair.prototype._removeSlab = function () {
  if (this._slab) { this.ctx.scene.remove(this._slab); this._slab = null; this._slabAnim = null; }
};
// —— chunk 3/8 (build-stations) complete

// ---- 4/8 build-assay-gate: the assay stones (x = 0,1,2) and the chapter gate ----------
ValePair.prototype._buildAssayGate = function () {
  // THE ASSAY STONES — the standing verb introduced here: any claimed form is tested
  // at x = 0, 1, 2 side by side with the original. Three agreements = identity
  // (complete for quadratics). Values are computed at runtime, never stored.
  this.assayAt = { x: 0, z: 10 };
  this.stones = [];
  const rig = new THREE.Group();
  [0, 1, 2].forEach((tx, i) => {
    const sx = (i - 1) * 3;                       // stones at x -3, 0, +3 on the ground
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.9), M(0x76736a));
    pil.position.set(sx, 0.75, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 1.05), M(0x8a8578));
    cap.position.set(sx, 1.58, 0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), GLOW(0x333333, 0.0));
    lamp.position.set(sx, 1.72, 0);
    rig.add(pil, cap, lamp);
    this.stones.push({ tx, wx: sx, lamp, lit: false, verdict: null });
    this.colliders.push({ type: 'circle', x: sx, z: this.assayAt.z, r: 0.55 });
  });
  rig.position.set(this.assayAt.x, 0, this.assayAt.z);
  this.ctx.scene.add(rig); this.solid.push(rig);
  this._proxy(this.assayAt.x, 1.1, this.assayAt.z, 8.2, 2.8, 2.4,
    { kind: 'assay', prompt: STR.assayPrompt, label: STR.assayLabel, reach: 8 }, rig);
  // THE GATE at z 12: fence + door across the vale; the door answers to a clean assay.
  this.gateZ = 12;
  const fence = new THREE.Group();
  const rail = (minX, maxX, y) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.12, 0.12), M(0x5e5648));
    r.position.set((minX + maxX) / 2, y, 0);
    fence.add(r);
  };
  for (let px = -22; px <= 22; px += 2.05) {
    if (px > -1.9 && px < 1.9) continue;                       // the door bay stays clear
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), M(0x5e5648));
    post.position.set(px, 0.75, 0);
    fence.add(post);
  }
  rail(-22, -1.6, 0.6); rail(-22, -1.6, 1.2); rail(1.6, 22, 0.6); rail(1.6, 22, 1.2);
  fence.position.set(0, 0, this.gateZ);
  this.ctx.scene.add(fence); this.solid.push(fence);
  // door: hinge pivot at x -1.5; swings west-north when the assay is clean
  this.doorPivot = new THREE.Group();
  this.doorPivot.position.set(-1.5, 0, this.gateZ);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.45, 0.14), M(0x8a7a5a));
  leaf.position.set(1.5, 0.78, 0);
  this.doorPivot.add(leaf);
  this.ctx.scene.add(this.doorPivot); this.solid.push(this.doorPivot);
  this.colliders.push({ type: 'aabb', minX: -22, maxX: -1.6, minZ: this.gateZ - 0.25, maxZ: this.gateZ + 0.25 });
  this.colliders.push({ type: 'aabb', minX: 1.6, maxX: 22, minZ: this.gateZ - 0.25, maxZ: this.gateZ + 0.25 });
  this.colliders.push({ type: 'aabb', minX: -1.7, maxX: 1.7, minZ: this.gateZ - 0.25, maxZ: this.gateZ + 0.25,
    active: () => !this.gateOpen });                            // predicate collider (supported)
  this._proxy(0, 0.9, this.gateZ, 3.4, 2.2, 1.6,
    { kind: 'door', prompt: STR.doorPrompt, label: STR.doorLabel, reach: 6 }, this.doorPivot);
};
// —— chunk 4/8 (build-assay-gate) complete

// ---- 5/8 update: zone machine, door swing, slab drift/death, assay reveal -------------
const easeOutBack = (s) => { const c1 = 1.70158, c3 = c1 + 1; const u = s - 1; return 1 + c3 * u * u * u + c1 * u * u; };
const smooth = (s) => s * s * (3 - 2 * s);
ValePair.prototype._zoneHit = function (z) {
  if (z.kind === 'fork') {
    this._log('vale.pair.fork', { tag: z.tag, nth: this.rejoins, ms: this._ms() });
    this.state = 'out'; this.chosen = z.tag;
  } else {
    this._log('vale.pair.rejoin', { from: this.chosen, ms: this._ms() });
    this.state = 'hub'; this.rejoins++; this.chosen = null; this.choiceT0 = this.time;
  }
};
ValePair.prototype.update = function (dt, u) {
  this.time += dt;
  if (u && u.controls && u.controls.pos) {
    const p = u.controls.pos; this._playerPos = p;
    if (!this._entered && p.z > -7.5 && p.z < 14 && Math.abs(p.x) < 22) {
      this._entered = true; this.choiceT0 = this.time;       // the choice clock starts here
    }
    const inside = {};
    for (const z of this.ZONES) {
      const isIn = p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ;
      if (isIn) {
        inside[z.id] = true;
        if (!this._zoneIn || !this._zoneIn[z.id]) {          // entry transition only
          if (z.kind === 'fork' && this.state === 'hub') this._zoneHit(z);
          else if (z.kind === 'rejoin' && this.state === 'out') this._zoneHit(z);
        }
      }
    }
    this._zoneIn = inside;
  }
  // door: anticipation (a breath inward) -> eased swing with overshoot -> settle
  if (this.gateOpen && this.doorT < 1) {
    this.doorT = Math.min(1, this.doorT + dt / 1.6);
    const t = this.doorT;
    this.doorPivot.rotation.y = t < 0.15 ? -0.12 * (t / 0.15) : easeOutBack((t - 0.15) / 0.85) * 1.75;
  }
  // claim slab: drift to the stones, or die (halves part and sink) after a failed assay
  if (this._slab && this._slabAnim) {
    const A = this._slabAnim;
    A.t = Math.min(1, A.t + dt / A.dur);
    if (A.type === 'drift') {
      const s = smooth(A.t);
      this._slab.position.x = A.fx + (A.tx - A.fx) * s;
      this._slab.position.z = A.fz + (A.tz - A.fz) * s;
      this._slab.position.y = Math.sin(s * Math.PI) * 0.35;   // a carried arc, no teleports
      if (A.t >= 1) this._slabAnim = null;
    } else if (A.type === 'die') {
      const s = A.t, ud = this._slab.userData;
      ud.halves[0].position.x = -0.42 - s * 0.9; ud.halves[1].position.x = 0.42 + s * 0.9;
      ud.halves[0].rotation.z = s * 0.6; ud.halves[1].rotation.z = -s * 0.6;
      ud.halves.forEach((h) => { h.position.y = 1.05 - s * s * 1.0; });
      ud.rim.material.opacity = 0.7 * (1 - s);
      if (A.t >= 1) this._removeSlab();
    }
  }
  // assay reveal: one stone at a time — the bug's blind point FIRST, the kill after
  if (this.assay.running) {
    this.assay.t += dt;
    if (this.assay.t >= 0.9 && this.assay.shown < this.assay.order.length) {
      this.assay.t = 0;
      const r = this.assay.order[this.assay.shown++];
      const st = this.stones.find((s) => s.tx === r.x);
      st.lit = true; st.verdict = r.ok;
      st.lamp.material.color.set(r.ok ? 0xd9c97e : 0xb0503f);
      st.lamp.material.opacity = 0.95;
      if (this.assay.shown >= this.assay.order.length) {
        this.assay.running = false; this.assay.done = true;
        this._assayFinish();                                   // chunk 8
      }
    }
  }
  for (const st of this.stones) if (st.lit && st.verdict === false)
    st.lamp.material.opacity = 0.75 + 0.2 * Math.sin(this.time * 9);  // an unquiet red
};
// —— chunk 5/8 (update) complete

// ---- 6/8 labels: numeric-register chips; detail chips quiet beyond ~9.5 m -------------
ValePair.prototype.labels = function (L, architectOn) {
  const e = this.enc, p = this._playerPos;
  const near = (x, z, d = 9.5) => p ? ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) <= d * d) : false;
  const ax = this.ent.at.x, az = this.ent.at.z;
  L.set('vp-item', { tex: e.tex, x: ax, y: 2.35, z: az });                    // the item, overhead
  // the two mouths carry their carved rules as numeric chips — walking is choosing
  L.set('vp-mouth-true', { html: `×→${e.a}·${e.c}<br>+→${e.b}`,
    x: this.mouthTrue.x, y: 2.1, z: this.mouthTrue.z });                      // 1·6, never bare 6
  L.set('vp-mouth-swap', { html: `×→${e.b}<br>+→${e.c}`,
    x: this.mouthSwap.x, y: 2.1, z: this.mouthSwap.z });
  if (near(this.aidAt.x, this.aidAt.z)) {                                     // the two faces
    const lc = ladderC(e.b, e.c).map((r) => `${r.p}·${r.q}→${r.sum}${r.hit ? ' ✓' : ''}`).join('<br>');
    const lb = ladderB(e.b, e.c).map((r) => `${r.p}+${r.q}→${r.prod}${r.hit ? ' ✓' : ''}`).join('<br>');
    L.set('vp-aid-c', { html: lc, x: this.aidAt.x - 0.9, y: 2.45, z: this.aidAt.z });
    L.set('vp-aid-b', { html: lb, x: this.aidAt.x + 0.9, y: 2.45, z: this.aidAt.z });
  }
  if (near(this.layAt.x, this.layAt.z))
    L.set('vp-lay', { tex: e.inocTex, x: this.layAt.x, y: 1.65, z: this.layAt.z - 0.6 });
  if (near(this.swapAt.x, this.swapAt.z)) {
    const rung = ladderSwap(e.b, e.c).find((r) => r.hit);
    if (rung) L.set('vp-swap-ladder', {
      html: `${rung.p}·${rung.q}=${e.b} ✓<br>${rung.p}+${rung.q}=${e.c} ✓`,
      x: this.swapAt.x, y: 2.55, z: this.swapAt.z });
  }
  if (this._slab) L.set('vp-claim', {
    tex: `(x+${this._slab.userData.p})(x+${this._slab.userData.q})`,
    x: this._slab.position.x, y: 2.15, z: this._slab.position.z });
  for (const st of this.stones) {
    L.set('vp-as-' + st.tx, { tex: `x=${st.tx}`, x: st.wx, y: 2.35, z: this.assayAt.z });
    if (st.lit && this.assay.results) {
      const r = this.assay.results.find((q) => q.x === st.tx);                // runtime values
      L.set('vp-asv-' + st.tx, { tex: r.ok ? `${r.rhs} = ${r.lhs}` : `${r.rhs} \\ne ${r.lhs}`,
        x: st.wx, y: 1.95, z: this.assayAt.z, dy: 6 });
    }
  }
  if (architectOn) {                                                          // symbolic layer
    L.set('vp-arch-fork', { html: 'FORK P1 · stratum poly a=1 · atlas 03', kind: 'architect', x: ax, y: 2.9, z: az });
    L.set('vp-arch-swap', { html: 'A1-SWAP {pq=b, p+q=c} → (1,5); blind x=1, dies x=0',
      kind: 'architect', x: this.mouthSwap.x, y: 2.7, z: this.mouthSwap.z });
    L.set('vp-arch-dir', { html: 'A1-DIRECTION: strategy observed (S-c/S-b), never forked',
      kind: 'architect', x: this.aidAt.x, y: 3.1, z: this.aidAt.z });
    L.set('vp-arch-inoc', { html: 'inoculation α: product target a·c (1·6) — the a≠1 seam',
      kind: 'architect', x: this.layAt.x, y: 2.3, z: this.layAt.z });
    L.set('vp-arch-assay', { html: '3 agreements = identity; corridor order: blind gate first',
      kind: 'architect', x: this.assayAt.x, y: 3.0, z: this.assayAt.z });
  }
};
// —— chunk 6/8 (labels) complete

// ---- 7/8 panel: card HTML per mode (classes reused: h2 .lede .eq .gate-in .btn .muted) -
ValePair.prototype._K = function (tex, display) {
  const PH = this.ctx.PH;
  return PH && PH.K ? PH.K(tex, display) : tex;
};
ValePair.prototype.panel = function (st) {
  if (!st || st.panel !== 'p:vale-pair') return '';
  const e = this.enc, K = (t, d) => this._K(t, d), m = this.pmode;
  if (m === 'stone') {
    // the stone states NO verdict: two carved ways, the choosing is the walking
    return `<h2>${this.ent.label || STR.stoneLabel}</h2>
      <div class="lede">${STR.stoneLede}</div>
      <div class="eq">${K(e.tex, true)}</div>
      <div class="lede">${STR.wantsPair}</div>
      <div class="eq">${K(`\\text{west: }\\times\\to ${e.b},\\ +\\to ${e.c}\\qquad\\text{east: }\\times\\to ${e.a}\\cdot ${e.c},\\ +\\to ${e.b}`)}</div>`;
  }
  if (m === 'search') {
    const lc = ladderC(e.b, e.c).map((r) => `<div>${r.p}·${r.q} → ${r.sum}${r.hit ? ' ✓' : ''}</div>`).join('');
    const lb = ladderB(e.b, e.c).map((r) => `<div>${r.p}+${r.q} → ${r.prod}${r.hit ? ' ✓' : ''}</div>`).join('');
    return `<h2>${STR.searchLabel}</h2>
      <div class="eq">${K(e.tex, true)}</div>
      <div style="display:flex;gap:1.2em">
        <button class="btn" data-vp="face-c">${STR.faceC} ${K(e.inocTex)}${lc}</button>
        <button class="btn" data-vp="face-b">${STR.faceB} ${K(String(e.b))}${lb}</button>
      </div>
      <div class="gate-in"><input id="vp-p" type="text" size="3" autocomplete="off">
        <input id="vp-q" type="text" size="3" autocomplete="off">
        <button class="btn primary" data-vp="carry">${STR.carryBtn}</button></div>`;
  }
  if (m === 'lay') {
    if (!this.claim) return `<h2>${STR.layLabel}</h2><div class="lede">${STR.layEmpty}</div>`;
    const { p, q } = this.claim;
    if (this.built) return `<h2>${STR.layLabel}</h2><div class="lede">${STR.layDone}</div>
      <div class="eq">${K(`(x+${p})(x+${q})`, true)}</div>`;
    return `<h2>${STR.layLabel}</h2>
      <div class="eq">${K(`(x+${p})(x+${q})`, true)}</div>
      <div class="muted">${K(`${p}\\cdot ${q}`)} — ${K(e.inocTex)}?</div>
      <button class="btn primary" data-vp="lay">${STR.layBtn}</button>`;
  }
  if (m === 'swap') {
    const rung = ladderSwap(e.b, e.c).find((r) => r.hit);
    if (!rung) return `<h2>${STR.swapLabel}</h2><div class="eq">${K(e.tex, true)}</div>`;
    if (this.built && this.claim && this.claim.src === 'swap')
      return `<h2>${STR.swapLabel}</h2>
        <div class="eq">${K(`(x+${this.claim.p})(x+${this.claim.q})`, true)}</div>
        <div class="lede">${STR.layDone}</div>`;
    return `<h2>${STR.swapLabel}</h2>
      <div class="eq">${K(e.tex, true)}</div>
      <div class="eq">${K(`${rung.p}\\cdot ${rung.q} = ${e.b}\\ \\checkmark\\qquad ${rung.p}+${rung.q} = ${e.c}\\ \\checkmark`)}</div>
      <div class="lede">${STR.swapBoth}</div>
      <button class="btn primary" data-vp="take">${STR.swapTake} (${rung.p}, ${rung.q})</button>`;
  }
  if (m === 'assay') {
    if (!this.built || !this._slab)
      return `<h2>${STR.assayLabel}</h2><div class="lede">${STR.assayEmpty}</div>`;
    const { p, q } = this._slab.userData;
    return `<h2>${STR.assayLabel}</h2>
      <div class="eq">${K(`(x+${p})(x+${q})\\ \\overset{?}{=}\\ ${e.tex}`, true)}</div>
      <button class="btn primary" data-vp="run">${STR.assayBtn}</button>`;
  }
  if (m === 'fail' && this.assay.results) {
    const R = this.assay.results, { p, q } = this.assay.pair;
    const rows = R.map((r) => `<div>${K(`x=${r.x}`)}: ${r.ok
      ? `${r.rhs} = ${r.lhs} — ${R.every((s) => s.ok) ? STR.assayAgree : STR.assayLied}`
      : `${STR.assayReads} ${r.rhs} ${STR.against} ${r.lhs}`}</div>`).join('');
    return `<h2>${STR.assayLabel}</h2>${rows}
      <div class="lede">${STR.failCorner} ${K(`${p}\\cdot ${q} = ${p * q}`)} — ${STR.groundReads} ${K(String(e.c))}.</div>
      <div class="lede">${STR.failCross} ${K(`${p}x + ${q}x = ${p + q}x`)} — ${STR.groundReads} ${K(`${e.b}x`)}.</div>
      <div class="eq">${K(e.tex, true)}</div>
      <div class="muted">${STR.rechoice}</div>`;
  }
  if (m === 'clean' && this.assay.pair) {
    const { p, q } = this.assay.pair;
    return `<h2>${STR.assayLabel}</h2>
      <div class="eq">${K(`${e.tex} = (x+${p})(x+${q})`, true)}</div>
      <div class="lede">${STR.cleanLine}</div>`;
  }
  if (m === 'door') return `<h2>${STR.doorLabel}</h2>
    <div class="lede">${this.gateOpen ? STR.doorOpen : STR.doorShut}</div>`;
  return '';
};
// —— chunk 7/8 (panel) complete

// ---- 8/8 events: interact, panel events, assay run/finish, gate -----------------------
ValePair.prototype.onInteract = function (act, PH) {
  if (!act || act.part !== 'vale-pair') return;
  this.pmode = act.kind;
  if (act.kind === 'search') this._faceLogged = {};
  if (act.kind === 'assay' && this.assay.done && this.assay.results && this.built) this.pmode = 'assay';
  this._log('vale.pair.probe', { site: act.kind === 'stone' ? 'trail-stone' : act.kind, ms: this._ms() });
  PH.openPanel('vale-pair');
};
ValePair.prototype._readPair = function () {
  if (typeof document === 'undefined') return null;
  const gp = document.getElementById('vp-p'), gq = document.getElementById('vp-q');
  if (!gp || !gq) return null;
  const ok = (s) => /^\d{1,3}$/.test(String(s).trim()) && parseInt(s, 10) >= 1;
  if (!ok(gp.value) || !ok(gq.value)) return null;             // self-validated (text inputs)
  return [parseInt(gp.value, 10), parseInt(gq.value, 10)];
};
ValePair.prototype.onPanel = function (ev, PH) {
  let t = ev && ev.target;
  while (t && !(t.dataset && t.dataset.vp)) t = t.parentElement;
  const v = t && t.dataset ? t.dataset.vp : null;
  if (ev && ev.type === 'keydown' && ev.key === 'Enter' && this.pmode === 'search') return this._carry(PH);
  if (!v) return;
  if (v === 'face-c' || v === 'face-b') {                      // strategy observed, never forked
    const mode = v === 'face-c' ? 'c-mult' : 'b-add';
    if (!this._faceLogged[mode]) { this._faceLogged[mode] = 1; this._log('vale.pair.strategy', { mode, ms: this._ms() }); }
    return;
  }
  if (v === 'carry') return this._carry(PH);
  if (v === 'lay' && this.claim && !this.built) {
    this.built = true;
    this._buildClaimSlab(this.claim.p, this.claim.q, this.layAt.x, this.layAt.z + 1.1);
    this._log('vale.pair.probe', { site: 'lay', pair: [this.claim.p, this.claim.q], ms: this._ms() });
    PH.refresh(); PH.dismissLater('vale-pair', 1600); return;
  }
  if (v === 'take') {                                          // the confident swap commit
    const rung = ladderSwap(this.enc.b, this.enc.c).find((r) => r.hit);
    if (!rung) return;
    this.claim = { p: rung.p, q: rung.q, src: 'swap' }; this.built = true;
    this._buildClaimSlab(rung.p, rung.q, this.swapAt.x + 1.5, this.swapAt.z + 0.7);
    this._log('vale.pair.probe', { site: 'swap-commit', pair: [rung.p, rung.q], ms: this._ms() });
    PH.refresh(); PH.dismissLater('vale-pair', 1600); return;
  }
  if (v === 'run' && this.built && this._slab) return this._runAssay(PH);
};
ValePair.prototype._carry = function (PH) {
  const pr = this._readPair();
  if (!pr) { PH.refresh(); return; }                           // invalid: card stays, no scolding
  this.claim = { p: pr[0], q: pr[1], src: 'search' };          // ANY pair accepted at search —
  this.built = false; this._removeSlab();                      // choosing IS running one's rule
  this._log('vale.pair.probe', { site: 'carry', pair: pr, ms: this._ms() });
  PH.refresh(); PH.dismissLater('vale-pair', 1400);
};
ValePair.prototype._runAssay = function (PH) {
  const { p, q } = this._slab.userData;
  const results = assayClaim(this.enc, p, q);                  // computed at runtime, side by side
  // corridor choreography: the claim's AGREEING points light first (the false confirmation),
  // the killing point after — for (1,5): x=1 agrees at 12 first, then x=0 reads 5 against 6.
  const order = results.filter((r) => r.ok).concat(results.filter((r) => !r.ok));
  for (const st of this.stones) { st.lit = false; st.verdict = null; st.lamp.material.opacity = 0; }
  this.assay = { running: true, t: 0.2, shown: 0, order, results, pair: { p, q }, done: false };
  this._slabAnim = { type: 'drift', t: 0, dur: 1.1, fx: this._slab.position.x, fz: this._slab.position.z,
    tx: this.assayAt.x, tz: this.assayAt.z - 1.6 };
  this._log('vale.pair.probe', { site: 'assay-run', pair: [p, q], ms: this._ms() });
  if (PH) PH.dismissPanel();                                   // world-first: watch the stones
};
ValePair.prototype._assayFinish = function () {
  const A = this.assay, pair = [A.pair.p, A.pair.q], clean = A.results.every((r) => r.ok);
  const PH = this.ctx.PH;
  if (clean) {
    this.gateOpen = true; this.doorT = 0;                      // predicate flips; door swings
    if (this.ctx.enc && this.ctx.enc._vale) this.ctx.enc._vale.pair = { gateOpen: true, factored: true };
    this._log('vale.pair.gate', { pair, ok: true, nth: this.rejoins, ms: this._ms() });
    this.pmode = 'clean';
    if (PH) { PH.openPanel('vale-pair'); PH.dismissLater('vale-pair', 4500); }
  } else {
    this._log('vale.pair.gate', { pair, ok: false, nth: this.rejoins, ms: this._ms(),
      fails: A.results.filter((r) => !r.ok).map((r) => r.x),
      lied: A.results.filter((r) => r.ok).map((r) => r.x) });  // the point(s) that lied
    this.pmode = 'fail';                                       // repair: connection, not re-teaching
    this._slabAnim = { type: 'die', t: 0, dur: 1.8 };          // the form dies, visibly
    this.claim = null; this.built = false;                     // re-choice must be walked (rejoin)
    if (PH) { PH.openPanel('vale-pair'); PH.dismissLater('vale-pair', 9000); }
  }
};
// —— chunk 8/8 (events) complete
