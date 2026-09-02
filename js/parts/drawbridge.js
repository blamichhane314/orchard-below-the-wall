// drawbridge.js — the Keeper's Drawbridge, region 2's far gate. A pair of iron
// bars must pass two checks that never share a number: laid end to end they
// fill the gauge (sum), folded at their joint and cast they must weigh the
// deck (product). Every countable multiplicity — deck straps, gauge notches,
// slab grid, fan ticks, overhang, gap — is generated from enc.drawbridge plus
// the live pair; no stored answers (Law 4, _truth_note). Refusal is always
// motion, never text: a proud bar, a rattling gap, a beam resting cocked, a
// crank that freewheels (Law 3). Design: design/parts/mid-pair-drawbridge.md.

import * as THREE from '../../vendor/three/three.module.js';

const matS = (c, o = {}) =>
  new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, metalness: 0, ...o });
const glow = (c, op = 0.9) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
const bg = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cg = (r0, r1, h, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
/** make, place, shadow, attach — rotation in radians */
const put = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
};
const easeIO = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const DEG = Math.PI / 180, HPI = Math.PI / 2;
const now = () => performance.now();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// Siting. The road runs along z ≈ 0.35; the headrace crosses it at x 47.2–48.8
// and spans the whole corridor, so nothing east of it is reachable until the
// deck falls — the working foundry therefore sits entirely on the WEST bank
// (the brief's x-range spans the race; reachability wins). One world unit of
// bar length = U metres = one notch = one grid cell, everywhere.
const U = 0.28;
const RACE = { x0: 47.2, x1: 48.8, gapLo: -0.45, gapHi: 1.15, z0: -2.2, z1: 9.2 };
const TT = 0.44;                               // casting-table top
const CH = { x0: 43.7, z: 3.2, barY: TT + 0.005 };   // gauge channel line (along x)
const IRON = '#3a3a40', RUST = '#5a4038', MELT = '#ff9a3c';

export default class Drawbridge {
  constructor(ctx) {
    this.scene = ctx.scene; this.log = ctx.log;
    this.P = ctx.world.palette;
    this.E = ctx.enc.drawbridge;
    this.colliders = []; this.solid = []; this.interactables = [];

    // the only numbers any visible count may derive from
    this.span = this.E.gauge.span; this.weight = this.E.deck.weight;
    this.lengths = this.E.rack.lengths; this.times = this.E.times;
    this.dpu = this.E.beam.degPerUnit; this.stopDeg = this.E.beam.stopDeg;
    this.chX1 = CH.x0 + this.span * U;

    // state machine: rest stages + ONE busy flag (this.anim). E during any
    // animation is ignored; every animation path ends in a rest stage, so
    // nothing can wedge and failure always hands the bars back.
    this.stage = 'yard';        // yard | molded | slabready | cocked | pinned | open
    this.anim = null; this.open = false;
    this.hand = [];             // up to two { len, entry } — entry = rack slot
    this.pair = null; this.pairSrc = null;   // committed at the gauge; restored on spoil
    this.readAt = this.mark = 0;
    this.lays = this.takes = this.hangs = 0;
    this.pile = []; this.fx = [];
    this.beamDeg = this.beamTarget = 0;
    this.cockedAt = this.tt = 0;

    this._buildRace();
    this._buildDeck();
    this._buildTable();
    this._buildRack();
    this._buildLadle();
    this._buildBalance();
    this._buildWindlass();
    this._buildWreck();
    this._buildHand();
    this._proxies();
  }

  // ---------- the headrace: curbs, water, abutment ----------
  _buildRace() {
    const g = new THREE.Group();
    // the ground plane already exists at y = 0, so the race brims: a dark bed
    // just above grade carrying the water film (a true cut would need a hole
    // build.js cannot give); shallow water, no falling mechanic
    const xM = (RACE.x0 + RACE.x1) / 2, zM = (RACE.z0 + RACE.z1) / 2;
    put(g, bg(RACE.x1 - RACE.x0, 0.03, RACE.z1 - RACE.z0), matS('#20302c'), xM, 0.015, zM);
    put(g, bg(RACE.x1 - RACE.x0 - 0.08, 0.012, RACE.z1 - RACE.z0),
      matS('#2c4440', { flatShading: false, emissive: new THREE.Color('#16282a'), emissiveIntensity: 0.5 }), xM, 0.045, zM);
    // stone curbs both edges, broken only at the deck line
    for (const [cx, m] of [[RACE.x0, matS(this.P.stone)], [RACE.x1, matS('#7c766a')]]) {
      for (const [z0, z1] of [[RACE.z0, RACE.gapLo], [RACE.gapHi, RACE.z1]]) {
        put(g, bg(0.3, 0.35, z1 - z0), m, cx, 0.175, (z0 + z1) / 2);
        this.colliders.push({ type: 'aabb', minX: cx - 0.15, maxX: cx + 0.15, minZ: z0, maxZ: z1 });
      }
    }
    // east abutment cheek by the deck — carries the deck's numeral
    put(g, bg(0.55, 1.15, 0.6), matS(this.P.stoneLit), 48.9, 0.575, 1.47);
    this.colliders.push({ type: 'aabb', minX: 48.62, maxX: 49.18, minZ: 1.17, maxZ: 1.77 });
    // while the deck stands, the race gap is no crossing either
    this.colliders.push({ type: 'aabb', minX: 46.95, maxX: 49.05, minZ: RACE.gapLo, maxZ: RACE.gapHi, active: () => !this.open });
    this.scene.add(g); this.solid.push(g);
  }

  // ---------- the deck: vertical slab, strap count = weight ----------
  _buildDeck() {
    const pivot = new THREE.Group();
    pivot.position.set(48.85, 0.12, 0.35);          // hinge at its east base
    const Ld = 2.05;
    put(pivot, bg(0.12, Ld, 1.55), matS('#4b4438'), 0, Ld / 2, 0);
    // straps on the west face — a signboard while raised, the underside once
    // lowered; count generated from deck.weight, never written as a number
    const strapM = matS(IRON, { roughness: 0.7 });
    for (let i = 0; i < this.weight; i++) {
      put(pivot, bg(0.05, 0.085, 1.62), strapM, -0.085, 0.12 + (i + 0.5) * (1.82 / this.weight), 0);
    }
    const railM = matS('#5a4a38');
    for (const zz of [-0.7, 0.7]) put(pivot, bg(0.05, Ld - 0.12, 0.07), railM, 0.085, Ld / 2, zz);
    for (const zz of [-0.55, 0.55]) put(pivot, cg(0.07, 0.07, 0.22), matS(IRON), 0, 0, zz, HPI);
    this.deck = pivot;
    this.scene.add(pivot); this.solid.push(pivot);
  }

  // ---------- casting table: gauge channel, notches, stops, wings, walls ----------
  _buildTable() {
    const g = new THREE.Group();
    put(g, bg(2.5, TT, 2.1), matS(this.P.stone), 44.7, TT / 2, 2.4);
    put(g, bg(this.span * U + 0.14, 0.012, 0.18), matS('#6f695d'), (CH.x0 + this.chX1) / 2, TT + 0.006, CH.z);
    const stopM = matS(this.P.stoneLit);
    for (const sx of [CH.x0 - 0.07, this.chX1 + 0.07]) put(g, bg(0.09, 0.11, 0.24), stopM, sx, TT + 0.055, CH.z);
    // notch ticks: exactly span of them, one per unit segment — the count IS
    // the carving; three fainter apron ticks past the east stop let a proud
    // overhang be counted on the same spacing
    const tickM = matS(this.P.ink), faintM = matS('#7c766a');
    for (let i = 0; i < this.span; i++) put(g, bg(0.022, 0.016, 0.15), tickM, CH.x0 + (i + 0.5) * U, TT + 0.014, CH.z);
    for (let i = 0; i < 3; i++) put(g, bg(0.02, 0.014, 0.12), faintM, this.chX1 + (i + 0.5) * U, TT + 0.013, CH.z);
    // wing hinge knuckles along the channel's north lip (the fold's joint line)
    for (let i = 0; i < 2; i++) put(g, cg(0.03, 0.03, 0.16, 7), matS(IRON), CH.x0 + 0.6 + i * 1.1, TT + 0.03, CH.z - 0.12, 0, 0, HPI);
    // follower walls (parked out of sight until the fold closes the mold)
    this.wallN = put(g, bg(1, 0.12, 0.07), stopM, 0, -2, 0);
    this.wallW = put(g, bg(0.07, 0.12, 1), stopM, 0, -2, 0);
    this.wallN.visible = this.wallW.visible = false;
    this.scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'aabb', minX: 43.45, maxX: 45.95, minZ: 1.35, maxZ: 3.45 });
  }

  // ---------- rack: one bay per length in enc.rack.lengths, two bars each ----------
  _buildRack() {
    const g = new THREE.Group();
    const N = this.lengths.length, x0 = 43.7, w = 3.15 / N;
    const woodM = matS('#5a4a38');
    put(g, bg(3.25, 0.1, 0.3), woodM, x0 + 1.575, 0.05, 4.8);
    put(g, bg(3.25, 0.09, 0.09), woodM, x0 + 1.575, 1.02, 4.97);
    for (let i = 0; i <= N; i++) put(g, bg(0.05, 1.06, 0.05), woodM, x0 + i * w, 0.53, 4.95);
    this.bayX = (len) => x0 + (this.lengths.indexOf(len) + 0.5) * w;
    // one bay per length, two bars each: length ∝ value, leaning on the rail
    this.rackBars = new Map();
    const barM = matS(IRON, { roughness: 0.75 });
    for (const len of this.lengths) {
      this.rackBars.set(len, [-0.075, 0.075].map((dx) => ({
        mesh: put(g, bg(0.07, len * U, 0.07), barM, this.bayX(len) + dx, (len * U) / 2 + 0.06, 4.78 + dx * 0.4, -0.16),
        taken: false,
      })));
    }
    this.scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'aabb', minX: 43.55, maxX: 47.0, minZ: 4.6, maxZ: 5.1 });
  }

  // ---------- ladle over coals; the boom aims at the live mold ----------
  _buildLadle() {
    const g = new THREE.Group();
    put(g, cg(0.07, 0.1, 1.8, 7), matS('#4b3f31'), 43.05, 0.9, 2.4);
    this.coal = put(g, new THREE.SphereGeometry(0.19, 9, 7),
      matS('#c96b2e', { emissive: new THREE.Color('#e07a30'), emissiveIntensity: 1.1 }), 43.05, 0.13, 2.4);
    this.coal.scale.y = 0.55;
    const cl = new THREE.PointLight(new THREE.Color('#e8935a'), 0.7, 3.5, 1.8);
    cl.position.set(43.05, 0.45, 2.4);
    g.add(cl);
    this.boomG = new THREE.Group();
    this.boomG.position.set(43.05, 1.78, 2.4);
    this.boomRest = Math.atan2(-1, -0.6);            // parked pointing away, south-west
    this.boomG.rotation.y = this.boomRest;
    const armGeo = bg(1, 0.07, 0.07); armGeo.translate(0.5, 0, 0);   // stretches outward from the post
    this.boomArm = put(this.boomG, armGeo, matS('#4b3f31'), 0, 0, 0);
    this.boomArm.scale.x = 0.9;
    this.cup = put(this.boomG, cg(0.1, 0.075, 0.14), matS(IRON), 0.9, -0.1, 0);
    g.add(this.boomG);
    this.scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'circle', x: 43.05, z: 2.4, r: 0.32 });
  }

  // ---------- balance: post, beam, fan of unit ticks, sling, pin ----------
  _buildBalance() {
    const g = new THREE.Group();
    put(g, bg(0.16, 2.3, 0.16), matS('#4b3f31'), 46.08, 1.15, 3.6);
    this.beamG = new THREE.Group();
    this.beamG.position.set(46.08, 2.3, 3.6);        // beam along z; north arm takes the slab
    put(this.beamG, bg(0.09, 0.09, 1.7), matS('#7a6448'), 0, 0, 0);
    put(this.beamG, bg(0.02, 0.3, 0.02), matS(IRON), 0, -0.15, 0.8);   // counter-side chain stub
    this.slingG = new THREE.Group();                 // counter-rotated: the slab hangs level
    this.slingG.position.set(0, 0, -0.85);
    for (const dx of [-0.12, 0.12]) put(this.slingG, bg(0.018, 0.6, 0.018), matS(IRON), dx, -0.3, 0);
    this.beamG.add(this.slingG);
    g.add(this.beamG);
    // fan: one tick per degPerUnit across ±stopDeg — 2·(stop/dpu)+1 of them,
    // derived; the beam's edge is the pointer, the tilt is the whole reading
    const nT = Math.round(this.stopDeg / this.dpu);
    const goldM = matS(this.P.gold, { emissive: new THREE.Color(this.P.gold), emissiveIntensity: 0.3 }), inkM = matS(this.P.ink);
    for (let k = -nT; k <= nT; k++) {
      const a = k * this.dpu * DEG;
      put(g, bg(0.02, 0.15, 0.02), k === 0 ? goldM : inkM,
        46.18, 2.3 + 0.36 * Math.sin(a), 3.6 - 0.36 * Math.cos(a), a - HPI);
    }
    // the pin waits on its bracket above the hub; level lets it fall
    put(g, bg(0.2, 0.03, 0.1), matS(this.P.stoneLit), 46.08, 2.56, 3.6);
    this.pin = put(g, cg(0.028, 0.028, 0.24), matS(IRON, { roughness: 0.6 }), 46.08, 2.7, 3.6);
    this.pinY0 = 2.7;
    this.scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'circle', x: 46.08, z: 3.6, r: 0.22 });
  }

  // ---------- windlass at the bank edge; rope runs over to the deck hinge ----------
  _buildWindlass() {
    const g = new THREE.Group();
    put(g, bg(0.5, 0.5, 0.4), matS(this.P.stone), 46.95, 0.25, 1.6);
    put(g, cg(0.14, 0.14, 0.34, 9), matS('#5a4a38'), 46.95, 0.62, 1.6, HPI);
    this.crank = new THREE.Group();
    this.crank.position.set(46.95, 0.62, 1.38);
    put(this.crank, bg(0.05, 0.3, 0.04), matS(IRON), 0, 0.15, 0);
    put(this.crank, cg(0.025, 0.025, 0.14, 7), matS('#4b3f31'), 0, 0.3, -0.07, HPI);
    g.add(this.crank);
    const pts = [new THREE.Vector3(46.95, 0.68, 1.6), new THREE.Vector3(47.9, 0.42, 1.0), new THREE.Vector3(48.85, 0.55, 0.42)];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.02, 5), matS('#6b5a44')));
    // spoil ground: slabs stack here, grid up — the hunt's history in iron
    put(g, new THREE.CircleGeometry(0.5, 16), matS('#565a4c', { flatShading: false }), 46.75, 0.015, 4.3, -HPI);
    this.scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'circle', x: 46.95, z: 1.6, r: 0.28 });
    this.colliders.push({ type: 'circle', x: 46.75, z: 4.3, r: 0.42 });
  }

  // ---------- the wreck: the keeper's last pair, autopsy in scenery ----------
  _buildWreck() {
    const [wp, wq] = this.E.wreck.pair;
    const g = new THREE.Group();
    const rustM = matS(RUST, { roughness: 1 });
    for (const [len, x, z, ry] of [[wp, 43.32, 3.66, 0.42], [wq, 43.78, 3.94, -0.22]]) {
      put(g, bg(len * U, 0.07, 0.07), rustM, x, 0.04, z, 0, ry);
    }
    // the cracked slab: sum passed, product short — its grid says so, face up
    const sg = new THREE.Group();
    put(sg, bg(wp * U, 0.09, wq * U), matS('#4a3c33'), 0, 0, 0);
    for (let i = 0; i < wp; i++) for (let j = 0; j < wq; j++) {
      put(sg, bg(U - 0.06, 0.024, U - 0.06), rustM, (i + 0.5 - wp / 2) * U, 0.055, (j + 0.5 - wq / 2) * U);
    }
    put(sg, bg(0.03, 0.1, wq * U + 0.05), matS('#26221d'), U * 0.3, 0.005, 0, 0, 0.12);
    sg.position.set(46.6, -0.045, 2.5);              // half-sunk beside the balance
    sg.rotation.set(0.06, 0.55, 0.02);
    g.add(sg);
    this.scene.add(g); this.solid.push(g);
  }

  // ---------- carried bars: two display meshes riding low in front of the camera ----------
  _buildHand() {
    this.handM = [0, 1].map(() => {
      const m = new THREE.Mesh(bg(1, 0.05, 0.05), matS(IRON, { roughness: 0.7 }));
      m.visible = false;
      this.scene.add(m);
      return m;
    });
  }

  _proxies() {
    const mk = (w, h, d, x, y, z, act) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(x, y, z);
      m.userData.act = { part: 'drawbridge', ...act };
      this.scene.add(m); this.interactables.push(m);
      return m;
    };
    // PLACEHOLDER prompt/label strings throughout — owner authors
    for (const len of this.lengths) {
      mk(0.32, 1.3, 0.55, this.bayX(len), 0.68, 4.75,
        { bay: len, prompt: 'Take the bar', label: 'Iron, cut to length', reach: 6.5 });
    }
    mk(this.span * U + 0.5, 0.5, 0.6, (CH.x0 + this.chX1) / 2, TT + 0.2, CH.z,
      { gauge: true, prompt: 'Lay the pair', label: 'The gauge-bed', reach: 6.5 });
    mk(0.55, 1.7, 0.55, 43.05, 0.9, 2.4,
      { ladle: true, prompt: 'Tip the ladle', label: 'Molten iron', reach: 6.5 });
    mk(0.6, 1.1, 0.6, 46.95, 0.55, 1.6,
      { windlass: true, prompt: 'Work the windlass', label: 'The bridge chain', reach: 6.5 });
    this.slabProxy = mk(1.0, 0.55, 1.0, 44.7, TT + 0.3, 2.4,
      { slab: true, prompt: 'Heft the slab', label: 'Cast iron', reach: 6.5 });
    this.slabProxy.visible = false;
  }

  // ---------- interaction: E routes here; any running animation owns the yard ----------
  onInteract(act) {
    if (this.anim) return;
    if (act.bay !== undefined) return this._takeBar(act.bay);
    if (act.gauge) return this._layPair();
    if (act.ladle) return this._pour();
    if (act.slab) return this._slabAct();
    if (act.windlass) return this._crank();
  }

  _takeBar(len) {
    if (this.stage !== 'yard') return;              // the machine is mid-cycle
    const slots = this.rackBars.get(len);
    const entry = slots && slots.find((s) => !s.taken);
    if (!entry) return;
    if (this.hand.length === 2) this._returnBar(this.hand.shift());   // trade the older bar back
    entry.taken = true; entry.mesh.visible = false;
    this.hand.push({ len, entry });
    this.takes++;
    this.log.push('draw.bar.take', { length: len, inHand: this.hand.map((h) => h.len) });
    this._syncHand();
  }

  _returnBar(h) {
    h.entry.taken = false; h.entry.mesh.visible = true;
    this.log.push('draw.bar.return', { length: h.len });
  }

  _syncHand() {
    for (let i = 0; i < 2; i++) {
      const h = this.hand[i], m = this.handM[i];
      m.visible = !!h;
      if (h) m.scale.set(h.len * 0.075, 1, 1);
    }
  }

  // ---------- the lay: two-stage lower, then the bed answers ----------
  _layPair() {
    if (this.stage !== 'yard' || this.hand.length < 2) return;
    const p = this.hand[0].len, q = this.hand[1].len;
    const fit = p + q - this.span;
    // second bar's rest pose carries the verdict: flat when it fits or falls
    // short, riding up the east stop when the pair runs long
    const poses = [
      { len: p, tx: CH.x0 + (p / 2) * U, ty: CH.barY, rotZ: 0 },
      { len: q, tx: CH.x0 + (p + q / 2) * U, ty: fit > 0 ? CH.barY + 0.065 : CH.barY, rotZ: fit > 0 ? Math.atan2(0.13, q * U) : 0 },
    ];
    this.wb = poses.map((d, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(d.len * U, 0.07, 0.07), matS(IRON, { roughness: 0.75 }));
      const hm = this.handM[i];
      m.position.copy(hm.position); m.quaternion.copy(hm.quaternion);
      m.scale.set(0.075 / U, 0.71, 0.71);
      m.castShadow = true;
      hm.visible = false;
      this.scene.add(m);
      return { ...d, mesh: m, from: m.position.clone(), fq: m.quaternion.clone() };
    });
    this.layFit = fit;
    this._go('layA', 0.5);
  }

  _verdict() {
    const [p, q] = [this.hand[0].len, this.hand[1].len];
    this.lays++;
    this.log.push('draw.gauge.lay', { pair: [p, q], fit: this.layFit, ms: Math.round(now() - this.mark) });
    if (this.layFit === 0) {
      const pulse = new THREE.Mesh(new THREE.PlaneGeometry(this.span * U, 0.34), glow(this.P.gold, 0));
      pulse.rotation.x = -HPI; pulse.position.set((CH.x0 + this.chX1) / 2, TT + 0.03, CH.z);
      this._fx(pulse, 0.8, (m, k) => { m.material.opacity = 0.55 * Math.sin(Math.PI * k); });
      this._go('click', 0.35);
    } else if (this.layFit > 0) this._go('hold', 1.2, { next: 'return' });   // proud by d, countable
    else this._go('hold', 0.35, { next: 'slide' });                          // gap at the east stop
  }

  _foldStart() {
    const p = this.hand[0].len, q = this.hand[1].len;
    this.pair = [p, q];
    this.pairSrc = [this.hand[0].entry, this.hand[1].entry];
    this.hand = [];                                  // committed: the pair is the machine's now
    const b2 = this.wb[1].mesh;
    this.foldPivot = new THREE.Group();
    this.foldPivot.position.set(CH.x0 + p * U, CH.barY, CH.z);
    this.scene.add(this.foldPivot);
    this.foldPivot.add(b2);
    b2.position.set((q * U) / 2, 0, 0); b2.rotation.set(0, 0, 0);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(q * U, 0.016, 0.16), matS(this.P.stoneLit));
    wing.position.set((q * U) / 2, -0.045, 0);
    this.foldPivot.add(wing);
    this._go('fold', this.times.foldS);
  }

  // ---------- pour: boom over, tip, fill for pourSPerArea × area seconds ----------
  _pour() {
    if (this.stage !== 'molded') return;
    const [p, q] = this.pair, area = p * q;
    const cx = CH.x0 + (p * U) / 2, cz = CH.z - (q * U) / 2;
    const dx = cx - 43.05, dz = cz - 2.4, d = Math.hypot(dx, dz);
    this.pd = { cx, cz, p, q, area, aim: Math.atan2(-dz, dx), d, T: this.times.pourSPerArea * area };
    this._go('boom', 1.0);
  }

  _buildSlab(p, q, cx, cz) {
    const g = new THREE.Group();
    put(g, bg(p * U - 0.02, 0.1, q * U - 0.02), matS(IRON), 0, 0, 0);
    // the stamp: exactly p × q raised squares, from the live pair
    const cellM = matS('#46464e', { roughness: 0.8 });
    for (let i = 0; i < p; i++) for (let j = 0; j < q; j++) {
      put(g, bg(U - 0.05, 0.03, U - 0.05), cellM, (i + 0.5 - p / 2) * U, 0.062, (j + 0.5 - q / 2) * U);
    }
    g.position.set(cx, TT + 0.02, cz);
    this.scene.add(g);
    this.slab = { g, p, q };
  }

  // ---------- slab: hoist to the sling, or clear a cocked failure to the pile ----------
  _slabAct() {
    if (this.stage === 'slabready') {
      this.slabProxy.visible = false;
      this._go('hoist', 1.3, {
        from: this.slab.g.position.clone(),
        to: new THREE.Vector3(46.08, 1.68, 2.75),    // under the north arm, beam at rest
      });
    } else if (this.stage === 'cocked' && now() - this.cockedAt >= 1500) {
      const g = this.slab.g;
      g.getWorldPosition(_v); g.getWorldQuaternion(_q1);
      this.slingG.remove(g); this.scene.add(g);
      g.position.copy(_v); g.quaternion.copy(_q1);
      const n = this.pile.length;
      const to = new THREE.Vector3(46.75 + ((n * 0.37) % 0.24) - 0.12, 0.07 + n * 0.125, 4.3 + ((n * 0.53) % 0.3) - 0.15);
      _q2.setFromEuler(new THREE.Euler(0, ((n * 0.7) % 0.6) - 0.3, 0));
      // the bars leave the mold for their bays while the slab goes to the pile
      const b2 = this.wb[1].mesh;
      b2.getWorldPosition(_v2); b2.getWorldQuaternion(_q3);
      this.foldPivot.remove(b2); this.scene.add(b2);
      b2.position.copy(_v2); b2.quaternion.copy(_q3);
      const rets = this.wb.map((w, i) => {
        const src = this.pairSrc[i].mesh;
        return { mesh: w.mesh, from: w.mesh.position.clone(), fq: w.mesh.quaternion.clone(), to: src.position.clone(), tq: src.quaternion.clone() };
      });
      this.beamTarget = 0;
      this.slabProxy.visible = false;
      this._go('spoil', 1.3, { from: g.position.clone(), fq: g.quaternion.clone(), to, tq: _q2.clone(), rets });
    }
  }

  _weighStart() {
    const [p, q] = this.pair, area = p * q;
    const diff = area - this.weight;
    const target = Math.max(-this.stopDeg, Math.min(this.stopDeg, this.dpu * diff));
    const swings = diff === 0 ? Math.max(2, this.times.settleSwings - 1) : this.times.settleSwings;
    // take-up heave: grows with load and error, decays to the honest angle —
    // the beam never snaps, it settles
    const A0 = Math.min(this.stopDeg * 0.7, 3.5 + Math.abs(diff) * 1.2 + area * 0.12);
    this._go('weigh', 2.6, { target, A0, w: (2 * Math.PI * swings) / 2.6, lam: 1.35, diff, area, swings });
  }

  // ---------- windlass: pawl bites only through the seated pin ----------
  _crank() {
    if (this.stage === 'pinned') this._go('deckfall', 2.0);
    else if (this.stage !== 'open') {
      this.log.push('draw.crank.freewheel', { pinSeated: false });
      this._go('freewheel', 1.15);
    }
  }

  _go(phase, T, dat = {}) { this.anim = { phase, t: 0, T, ...dat }; }

  _fx(mesh, life, tick) { this.scene.add(mesh); this.fx.push({ mesh, life, t: 0, tick }); }

  _puffs(n, x, y, z, color, spread, rise) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), glow(color, 0.5));
      s.position.set(x + (i - (n - 1) / 2) * spread, y, z + (i % 2) * spread * 0.6 - spread * 0.3);
      s.userData.y0 = y;
      this._fx(s, 0.8, (m, k) => {
        m.position.y = m.userData.y0 + rise * k;
        m.scale.setScalar(1 + 2 * k);
        m.material.opacity = 0.5 * (1 - k);
      });
    }
  }

  _handAnchor(cam, i) {
    _v.set(i === 0 ? -0.24 : 0.26, i === 0 ? -0.31 : -0.26, -0.62);
    return cam.localToWorld(_v);
  }

  // ---------- per-frame ----------
  update(dt, u) {
    this.tt += dt;
    const cam = u.camera;
    cam.updateMatrixWorld();

    if (!this.readAt) {
      const dx = u.controls.pos.x - 47.6, dz = u.controls.pos.z - 2.4;
      if (dx * dx + dz * dz < 256) {                 // first sight of the yard starts the clock
        this.readAt = this.mark = now();
        this.log.push('draw.read', { span: this.span, weight: this.weight });
      }
    }

    // carried bars ride the camera like hands
    this.hand.forEach((h, i) => {
      const m = this.handM[i];
      if (!m.visible) return;
      m.position.copy(this._handAnchor(cam, i));
      m.quaternion.copy(cam.quaternion);
      m.rotateZ(i ? 0.1 : -0.12); m.rotateY(i ? -0.4 : 0.35);
    });

    this.coal.material.emissiveIntensity = 1.0 + 0.3 * Math.sin(this.tt * 7.3) + 0.18 * Math.sin(this.tt * 12.1);

    // transient fx
    for (const f of this.fx) { f.t += dt; f.t >= f.life ? this.scene.remove(f.mesh) : f.tick(f.mesh, f.t / f.life); }
    this.fx = this.fx.filter((f) => f.t < f.life);

    if (this.anim) this._tick(dt, cam);

    // the beam eases toward its held truth except while the weigh drives it
    if (!this.anim || this.anim.phase !== 'weigh') {
      this.beamDeg += (this.beamTarget - this.beamDeg) * Math.min(1, dt * 2.6);
    }
    this.beamG.rotation.x = -this.beamDeg * DEG;
    this.slingG.rotation.x = this.beamDeg * DEG;     // the sling hangs plumb; the slab stays level

    if (this.stage === 'cocked' && this.slab) {      // keep the E-target on the hanging slab
      this.slab.g.getWorldPosition(_v2);
      this.slabProxy.position.copy(_v2);
    }
  }

  _tick(dt, cam) {
    const a = this.anim;
    a.t += dt;
    const t = Math.min(1, a.t / a.T), done = a.t >= a.T;

    if (a.phase === 'layA') {                        // first stage: up and over the channel
      const s = easeIO(t);
      for (const w of this.wb) {
        _v.set(w.tx, TT + 0.6, CH.z);
        w.mesh.position.lerpVectors(w.from, _v, s);
        w.mesh.quaternion.copy(w.fq).slerp(_q1.identity(), s);
        w.mesh.scale.set(0.075 / U + (1 - 0.075 / U) * s, 0.71 + 0.29 * s, 0.71 + 0.29 * s);
      }
      if (done) this._go('layB', 0.55);
    } else if (a.phase === 'layB') {                 // second stage: the lower, and the answer
      const s = t * t;
      for (const w of this.wb) {
        _v.set(w.tx, TT + 0.6, CH.z);
        _v2.set(w.tx, w.ty, CH.z);
        w.mesh.position.lerpVectors(_v, _v2, s);
        w.mesh.rotation.z = w.rotZ * s;
      }
      if (done) this._verdict();
    } else if (a.phase === 'click') {                // fits: a settle you can feel
      for (const w of this.wb) w.mesh.position.y = w.ty - 0.012 * Math.sin(Math.PI * t);
      if (done) this._go('still', 0.5);              // held breath before the fold
    } else if (a.phase === 'still') {
      if (done) this._foldStart();
    } else if (a.phase === 'fold') {                 // the signature: the line becomes a corner
      this.foldPivot.rotation.y = HPI * easeIO(t);
      this.foldPivot.position.y = CH.barY + 0.08 * Math.sin(Math.PI * t);
      if (done) {
        const [p, q] = this.pair;
        const zN = CH.z - q * U - 0.045, cx = CH.x0 + (p * U) / 2;
        this.wallN.scale.set(p * U + 0.12, 1, 1); this.wallN.position.set(cx, TT + 0.06, zN - 0.5);
        this.wallW.scale.set(1, 1, q * U + 0.12); this.wallW.position.set(CH.x0 - 0.545, TT + 0.06, CH.z - (q * U) / 2);
        this.wallN.visible = this.wallW.visible = true;
        this._go('close', 0.45, { zN, wx: CH.x0 - 0.045 });
      }
    } else if (a.phase === 'close') {                // follower walls whisper in
      const s = easeOut(t);
      this.wallN.position.z = a.zN - 0.5 * (1 - s);
      this.wallW.position.x = a.wx - 0.5 * (1 - s);
      if (done) { this.stage = 'molded'; this.anim = null; this.log.push('draw.mold.fold', { pair: this.pair }); }
    } else if (a.phase === 'hold') {                 // the misfit shown still, long enough to count
      if (done) this._go(a.next, a.next === 'slide' ? 0.4 : 0.65);
    } else if (a.phase === 'slide') {                // short by d: the hollow shove, gap intact
      const s = easeIO(t);
      for (const w of this.wb) {
        if (w.sx === undefined) w.sx = w.mesh.position.x;   // untouched since the lay
        w.mesh.position.x = w.sx + Math.abs(this.layFit) * U * s;
      }
      if (done) this._go('hold', 0.55, { next: 'return' });
    } else if (a.phase === 'return') {               // failure hands the bars back, always
      const s = easeIO(t);
      this.wb.forEach((w, i) => {
        if (s === 0) return;
        if (!w.r0) { w.r0 = w.mesh.position.clone(); w.rq = w.mesh.quaternion.clone(); }
        w.mesh.position.lerpVectors(w.r0, this._handAnchor(cam, i), s);
        w.mesh.quaternion.copy(w.rq).slerp(cam.quaternion, s);
        w.mesh.scale.set(1 - (1 - 0.075 / U) * s, 1 - 0.29 * s, 1 - 0.29 * s);
      });
      if (done) {
        for (const w of this.wb) this.scene.remove(w.mesh);
        this.wb = null;
        this._syncHand();
        this.hand.forEach((h, i) => this.handM[i].position.copy(this._handAnchor(cam, i)));
        this.anim = null;
      }
    } else if (a.phase === 'boom') {                 // the ladle comes over with mass
      const s = easeIO(t);
      this.boomG.rotation.y = this.boomRest + (this.pd.aim - this.boomRest) * s;
      this.boomArm.scale.x = 0.9 + (this.pd.d - 0.9) * s;
      this.cup.position.x = this.boomArm.scale.x;
      if (done) this._go('tip', 0.35);
    } else if (a.phase === 'tip') {
      this.cup.rotation.z = -1.0 * easeIO(t);
      if (done) {
        const { p, q, cx, cz } = this.pd;
        this.fill = new THREE.Mesh(new THREE.BoxGeometry(p * U - 0.06, 0.1, q * U - 0.06),
          matS(MELT, { emissive: new THREE.Color('#ff801f'), emissiveIntensity: 1.8 }));
        this.fill.scale.y = 0.04;
        this.fill.position.set(cx, TT + 0.007, cz);
        this.scene.add(this.fill);
        this.stream = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1, 0.045), glow('#ffc06a', 0.95));
        this.stream.scale.y = 1.62 - TT;
        this.stream.position.set(cx, (1.62 + TT) / 2, cz);
        this.scene.add(this.stream);
        this._go('pour', this.pd.T);
      }
    } else if (a.phase === 'pour') {                 // duration IS the area — a bigger slab pours longer
      const { cx, cz } = this.pd;
      this.fill.scale.y = 0.04 + 0.96 * t;
      this.fill.position.set(cx, TT + 0.005 + 0.05 * this.fill.scale.y, cz);
      const top = TT + 0.005 + 0.1 * this.fill.scale.y;
      const len = Math.max(0.05, 1.62 - top);
      this.stream.scale.y = len;
      this.stream.position.set(cx, top + len / 2, cz);
      this.fill.material.emissiveIntensity = 1.7 + 0.25 * Math.sin(this.tt * 21);
      if (done) {
        this.log.push('draw.pour', { pair: this.pair, area: this.pd.area, pourMs: Math.round(this.pd.T * 1000) });
        this.scene.remove(this.stream); this.stream = null;
        this._puffs(3, this.pd.cx, TT + 0.16, this.pd.cz, '#cfd8ce', 0.16, 0.5);   // quench steam
        this._go('quench', 1.1, { hot: new THREE.Color(MELT), cold: new THREE.Color(IRON) });
      }
    } else if (a.phase === 'quench') {               // tone falls to iron-dark
      this.fill.material.color.copy(a.hot).lerp(a.cold, t);
      this.fill.material.emissiveIntensity = 1.8 * (1 - t);
      this.cup.rotation.z = -1.0 * (1 - t);
      if (done) this._go('unmold', 0.7, { q: this.pair[1] });
    } else if (a.phase === 'unmold') {               // wings open, boom retires
      const s = easeIO(t);
      const zN = CH.z - a.q * U - 0.045;
      this.wallN.position.z = zN - 0.5 * s;
      this.wallW.position.x = CH.x0 - 0.045 - 0.5 * s;
      this.boomG.rotation.y = this.pd.aim + (this.boomRest - this.pd.aim) * s;
      this.boomArm.scale.x = this.pd.d + (0.9 - this.pd.d) * s;
      this.cup.position.x = this.boomArm.scale.x;
      if (done) {
        this.wallN.visible = this.wallW.visible = false;
        this.scene.remove(this.fill); this.fill = null;
        this._buildSlab(this.pd.p, this.pd.q, this.pd.cx, this.pd.cz);
        this._go('slabrise', 0.6);
      }
    } else if (a.phase === 'slabrise') {
      this.slab.g.position.y = TT + 0.02 + 0.31 * easeOut(t) + 0.015 * Math.sin(Math.PI * t);
      if (done) {
        this.slab.g.position.y = TT + 0.33;
        this.stage = 'slabready';
        this.slabProxy.position.set(this.pd.cx, TT + 0.45, this.pd.cz);
        this.slabProxy.visible = true;
        this.anim = null;
      }
    } else if (a.phase === 'hoist') {                // the carry to the sling, eased, with lift
      const s = easeIO(t);
      this.slab.g.position.lerpVectors(a.from, a.to, s);
      this.slab.g.position.y += 0.35 * Math.sin(Math.PI * s);
      this.slab.g.rotation.y = 0.12 * Math.sin(Math.PI * s);
      if (done) {
        this.slingG.add(this.slab.g);
        this.slab.g.position.set(0, -0.62, 0);
        this.slab.g.rotation.set(0, 0, 0);
        this._weighStart();
      }
    } else if (a.phase === 'weigh') {                // damped honest swings; settles, never snaps
      const k = Math.min(1, a.t / 1.0);
      this.beamDeg = a.target * easeIO(k) + a.A0 * Math.sin(a.w * a.t) * Math.exp(-a.lam * a.t);
      if (done) {
        this.beamDeg = a.target; this.beamTarget = a.target;
        this.hangs++;
        this.log.push('draw.slab.hang', {
          pair: this.pair, area: a.area, weight: this.weight,
          diff: a.diff, settleDeg: a.target, swings: a.swings,
        });
        if (a.diff === 0) this._go('pindrop', 1.0);  // held silence, then gravity takes it
        else { this.stage = 'cocked'; this.cockedAt = now(); this.slabProxy.visible = true; this.anim = null; }
      }
    } else if (a.phase === 'pindrop') {              // quick drop, tiny bounce: the solved sound
      const k = Math.max(0, (t - 0.45) / 0.55);
      const drop = k < 0.55 ? (k / 0.55) * (k / 0.55) * 0.26 : 0.26 - 0.02 * Math.sin(((k - 0.55) / 0.45) * Math.PI);
      this.pin.position.y = this.pinY0 - drop;
      if (done) {
        this.pin.position.y = this.pinY0 - 0.26;
        this.log.push('draw.pin.drop', { pair: this.pair, attempts: this.hangs, msSinceRead: Math.round(now() - this.readAt) });
        this.stage = 'pinned';
        this.anim = null;
      }
    } else if (a.phase === 'spoil') {                // failure priced, preserved, readable
      const s = easeIO(t);
      this.slab.g.position.lerpVectors(a.from, a.to, s);
      this.slab.g.position.y += 0.3 * Math.sin(Math.PI * s);
      this.slab.g.quaternion.copy(a.fq).slerp(a.tq, s);
      for (const r of a.rets) {
        r.mesh.position.lerpVectors(r.from, r.to, s);
        r.mesh.quaternion.copy(r.fq).slerp(r.tq, s);
      }
      if (done) {
        this.slab.g.position.copy(a.to); this.slab.g.quaternion.copy(a.tq);
        this.pile.push(this.slab.g);
        this.log.push('draw.slab.spoil', { pair: this.pair, pileSize: this.pile.length });
        for (const r of a.rets) this.scene.remove(r.mesh);
        for (const src of this.pairSrc) { src.taken = false; src.mesh.visible = true; }
        this.scene.remove(this.foldPivot);
        this.wb = null; this.slab = null; this.pair = null; this.pairSrc = null;
        this.mark = now();                           // the rethink clock restarts here
        this.stage = 'yard';
        this.anim = null;
      }
    } else if (a.phase === 'deckfall') {             // earned mass: eased-in fall, ~2 s
      this.deck.rotation.z = HPI * Math.pow(t, 2.4);
      this.crank.rotation.z -= dt * (4 + 10 * t);   // pawl biting: crank turns with the fall
      if (done) {
        this.open = true;                            // race-gap collider releases with the seat
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 20), glow('#b8b09c', 0.6));
        ring.rotation.x = -HPI; ring.position.set(46.95, 0.2, 0.35);
        this._fx(ring, 0.7, (m, k) => { m.scale.setScalar(1 + 5 * k); m.material.opacity = 0.6 * (1 - k); });
        this._puffs(3, 46.85, 0.15, 0.35, '#b8b09c', 0.3, 0.35);                   // seat dust
        this.log.push('draw.bridge.open', {
          pairsTried: this.lays, barsHandled: this.takes,
          totalMs: Math.round(now() - this.readAt),
        });
        this._go('deckseat', 0.45);
      }
    } else if (a.phase === 'deckseat') {             // seat-boom: a small recoil, then rest
      this.deck.rotation.z = HPI - 0.05 * Math.sin(Math.PI * t) * (1 - t);
      if (done) { this.deck.rotation.z = HPI; this.stage = 'open'; this.anim = null; }
    } else if (a.phase === 'freewheel') {            // no pin, no bite: refusal as motion
      this.crank.rotation.z -= dt * 26 * (1 - 0.7 * t);
      if (done) this.anim = null;
    }
  }

  // ---------- readings: numerals only, anchored to their stones ----------
  labels(L, architectOn) {
    L.set('db-span', { tex: String(this.span), x: this.chX1 + 0.24, y: TT + 0.44, z: CH.z, kind: 'rule', dy: 0 });
    L.set('db-weight', { tex: String(this.weight), x: 48.88, y: 1.34, z: 1.47, kind: 'rule', dy: 0 });
    for (const len of this.lengths) {
      L.set('db-bay' + len, { tex: String(len), x: this.bayX(len), y: 1.3, z: 4.72, kind: 'plain', dy: 0 });
    }
    if (architectOn) {
      L.set('db-arch', { tex: this.E.architect.tex, x: 47.6, y: 3.4, z: 2.4, kind: 'architect', dy: 0 });
    }
  }

  panel() { return ''; }                             // world-first: this part has no card
  panelAnchor = null;
}

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

