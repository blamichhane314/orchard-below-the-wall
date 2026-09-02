// bellyard.js — the Bell Yard, the Layer-2 TRAINING SPACE. Simplified core of
// design/parts/layer-training-bell-yard.md: a walled clearing far west of the
// world, entered through the standing stone (main.js routes its E here) and
// left by a smaller return stone. One rep at a time: a thrown path hangs as a
// standing gold tube, a numbered cord is stretched at the rep's height, the
// player hangs a bell on a knot, and a spark rides the rule — where the path
// truly comes down through the cord, the truth happens. Ring or miss, the
// distance is countable in knots. Five reps, then the yard takes the measure:
// mean miss becomes, by an explicit formula, the strength of 'falling-arc' in
// the bag (game.setStrength) — thereafter the band width the instrument reads
// with at the fig (reading.js consumes st.strengths['falling-arc']).
//
// PERCEPTUAL CONTRACT (Law 4): knots on the cord = enc.bellYard.cordSlots;
// the drawn tube is sampled from the rep's own c + b·u + a·u²; the cord hangs
// at the same h the truth is solved against. True crossings are derived at
// runtime from the quadratic (far root, per _truth_note) and stored nowhere.
// One unit of the rule = SCALE metres of yard, everywhere at once.

import * as THREE from '../../vendor/three/three.module.js';
import { n, quadTex } from '../fmt.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const flat = (o) => { o.rotation.x = Math.PI / 2; return o; };
const Cy = (...a) => new THREE.CylinderGeometry(...a);
const To = (...a) => new THREE.TorusGeometry(...a);
const Sp = (...a) => new THREE.SphereGeometry(...a);
/** shadowed mesh at (x,y,z) under parent; shadow=false for glow/thin dressing */
const M = (geo, material, x, y, z, parent, shadow = true) => {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = shadow;
  parent.add(o);
  return o;
};

// yard numbers (world metres). The enclave sits far west of the x=-17.5 wall,
// reachable only by the portal; its own collider ring keeps walkers on the disc.
const C0 = { x: -40, z: 1 };          // yard centre
const R_FLOOR = 7.6, R_TREES = 8.7, R_RING = 8.35;
const SCALE = 1.15;                    // metres per rule-unit (brief ~1.2, trimmed so 12 knots + posts sit inside the clearing)
const APZ = C0.z;                      // the apparatus plane: through the centre, spark seen broadside from the north
const X0 = C0.x - 6 * SCALE;           // u = 0 (the arc's west foot); knots at u = 0..cordSlots
const ENTER = { x: -38.6, z: 5.6, lx: -40.5, ly: 2.6, lz: APZ };   // arrive facing the apparatus
const RET = { x: -35.7, z: 4.0 };      // the return stone, at the yard's NE edge
const POST_H = 4.4;

// beats (s) — anticipation, eased motion, settle (contract Law)
const T_DROP = 0.42, T_SWAY = 0.85, T_BREATH = 0.35, T_FLIGHT = 2.5, T_VERDICT = 1.7, T_SWAP = 1.15, T_MARK = 1.5;
const MISS_FLOOR_AT = 3;               // knots of mean miss that floor the grade (enc _truth_note)
const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];   // PLACEHOLDER world voice

export default class BellYard {
  /** @param ctx { scene, world, enc, log, PH, game } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH, game }) {
    this.log = log; this.PH = PH; this.game = game;
    this.P = world.palette;
    this.C = enc.bellYard;
    if (!this.C || !this.C.reps?.length || !game) throw new Error('bell-yard needs enc.bellYard and ctx.game');
    this.stoneAt = world.entities.find((e) => e.id === 'standing-stone')?.at ?? { x: 5.4, z: 0 };

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: C0.x, z: C0.z, reach: 9 };

    this.inYard = false; this.phase = 'idle'; this.anim = null;
    this.rep = 0; this.misses = []; this.placed = null; this.grade = null;
    this.saved = null;                 // {x, z, fx, fz} — where the portal will put you back
    this.thinkT0 = 0; this.t = 0; this._ctl = null; this.nearYard = false;
    this.cordY = 0; this.cordYT = 0; this.dipT = -1; this.dipA = 0;
    this.ringT = -1; this.markT = -1; this.pulseT = -1; this.landT = -1;
    this.glowK = 0; this.glowT = 0; this.litStuds = 0;
    this.arc = null; this.arcMat = null; this.arcOld = null; this.arcOldMat = null;

    this._buildYard(scene);
    this._buildApparatus(scene);
    this._mountRep(0, true);

    // Enter in the knot field commits — parts wire their own card inputs
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'byKnot') { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ---------- truths, derived every time (never stored — _truth_note) ----------
  /** ascending real roots of a·u² + b·u + c = 0, or null */
  _roots(a, b, c) {
    const d = b * b - 4 * a * c;
    if (d < 0) return null;
    const r = Math.sqrt(d);
    return [(-b + r) / (2 * a), (-b - r) / (2 * a)].sort((p, q) => p - q);
  }
  /** where rep i's path passes its own cord height: {near, far} in knot units */
  _truthOf(i) {
    const R = this.C.reps[i];
    const rs = this._roots(R.a, R.b, R.c - R.h);
    if (!rs) { const u = -R.b / (2 * R.a); return { near: u, far: u }; }   // degenerate data: vertex
    return { near: rs[0], far: rs[1] };
  }
  /** where rep i's path lands (y = 0), clamped to the cord's reach */
  _landOf(i) {
    const R = this.C.reps[i];
    const rs = this._roots(R.a, R.b, R.c);
    return Math.min(this.C.cordSlots + 0.4, rs ? rs[1] : -R.b / (2 * R.a));
  }

  // ---------- build: the clearing ----------
  _buildYard(scene) {
    const { P } = this;
    const r = rng(9219);
    const g = new THREE.Group();
    g.position.set(C0.x, 0, C0.z);
    this.gYard = g;

    // — the floor: a pale vellum stone disc, rimmed — the yard IS this circle
    const disc = M(new THREE.CircleGeometry(R_FLOOR, 30), mat(P.vellum, { flatShading: false }), 0, 0.02, 0, g, false);
    disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true;
    flat(M(To(R_FLOOR, 0.09, 6, 44), mat(P.stoneLit), 0, 0.05, 0, g, false)).receiveShadow = true;
    this.arriveRing = flat(M(To(1.0, 0.05, 6, 24), glow(P.gold, 0), ENTER.x - C0.x, 0.07, ENTER.z - C0.z, g, false));

    // — the enclosure: a dense ring of tall dark trees, denser than the orchard's
    const canopyCols = ['#1c332a', P.canopyNear, '#22412f'];
    for (let i = 0; i < 24; i++) {
      const aa = (i / 24) * Math.PI * 2 + (r() - 0.5) * 0.14;
      const rad = R_TREES + (i % 2) * 0.9 + r() * 0.4;
      const tx = Math.cos(aa) * rad, tz = Math.sin(aa) * rad;
      const h = 6.4 + r() * 2.6;
      M(Cy(0.09, 0.2, h * 0.5, 6), mat(jitter('#4a3d2e', r)), tx, h * 0.25, tz, g);
      for (let j = 0; j < 3; j++) {
        const blob = M(new THREE.IcosahedronGeometry(1, 1), mat(jitter(canopyCols[(i + j) % 3], r)),
          tx + (r() - 0.5) * 0.7, h * (0.42 + j * 0.24), tz + (r() - 0.5) * 0.7, g);
        blob.scale.set(1.5 - j * 0.28 + r() * 0.4, 1.15 - j * 0.14, 1.5 - j * 0.28 + r() * 0.4);
      }
    }

    // — warm lantern posts (the bridge's language), ringing the working floor
    this.lamps = [];
    for (const [lx, lz] of [[-36.73, 5.67], [-43.27, 5.67], [-43.27, -3.67], [-36.73, -3.67], [-40, 7.9]]) {
      const x = lx - C0.x, z = lz - C0.z;
      M(Cy(0.06, 0.09, 1.9, 7), mat(P.trunk), x, 0.95, z, g);
      M(Sp(0.08, 8, 6), mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.25 }), x, 1.98, z, g, false);
      const pl = new THREE.PointLight(new THREE.Color(P.lamp), 0.85, 6.5, 1.8);
      pl.position.set(x, 1.9, z);
      g.add(pl);
      this.lamps.push(pl);
      this.colliders.push({ type: 'circle', x: lx, z: lz, r: 0.15 });
    }

    // — the low central plinth: the yard's heart; it will glow to the grade,
    //   and its four studs are the toolbox's strength dots, made stone
    M(Cy(0.62, 0.74, 0.5, 9), mat(P.stone), 0, 0.25, 0, g);
    this.glowDisc = M(new THREE.CircleGeometry(0.5, 18), glow(P.gold, 0.05), 0, 0.505, 0, g, false);
    this.glowDisc.rotation.x = -Math.PI / 2;
    this.studMats = [];
    for (let j = 0; j < 4; j++) {
      const aa = Math.PI / 2 + (j - 1.5) * 0.52;   // arced toward the arrival side
      const sm = mat('#6b5c40', { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.02 });
      this.studMats.push(sm);
      M(Sp(0.05, 7, 6), sm, Math.cos(aa) * 0.42, 0.53, Math.sin(aa) * 0.42, g, false);
    }
    this.plinthLight = new THREE.PointLight(new THREE.Color(P.gold), 0, 5.5, 1.8);
    this.plinthLight.position.set(0, 1.3, 0);
    g.add(this.plinthLight);
    this.colliders.push({ type: 'circle', x: C0.x, z: C0.z, r: 0.78 });

    // — the RETURN STONE: the standing stone's language, smaller, at the edge
    const gr = new THREE.Group();
    gr.position.set(RET.x, 0, RET.z);
    M(Cy(0.22, 0.35, 1.75, 6), mat(P.stone), 0, 0.87, 0, gr).rotation.y = 0.5;
    for (let i = 0; i < 3; i++) {
      M(new THREE.BoxGeometry(0.34, 0.045, 0.045),
        mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.35 }), 0.04, 0.55 + i * 0.38, 0.26, gr, false);
    }
    gr.userData.act = this._retAct = {
      part: 'bell-yard', kind: 'return',
      prompt: 'Touch the stone',                          // PLACEHOLDER
      label: 'A low stone, cut with the same grooves',    // PLACEHOLDER
      reach: 7,
    };
    scene.add(gr);
    this.colliders.push({ type: 'circle', x: RET.x, z: RET.z, r: 0.45 });
    const retProxy = M(new THREE.BoxGeometry(1.2, 2.2, 1.2), glow('#000', 0), RET.x, 1.1, RET.z, scene, false);
    retProxy.userData.act = this._retAct;
    retProxy.userData.glowRoot = gr;

    // — perimeter: a quiet ring of overlapping colliders — the clearing has an
    //   inside. (2D map; the trees beyond are scenery, never walkable.)
    for (let i = 0; i < 24; i++) {
      const aa = (i / 24) * Math.PI * 2;
      this.colliders.push({ type: 'circle', x: C0.x + Math.cos(aa) * R_RING, z: C0.z + Math.sin(aa) * R_RING, r: 1.15 });
    }

    scene.add(g);
    this.solid.push(g, gr);
    this.interactables.push(gr, retProxy);
  }

  // ---------- build: the apparatus (pedestal, posts, cord, bell, spark) ----------
  _buildApparatus(scene) {
    const { P, C } = this;
    const g = new THREE.Group();
    g.position.set(X0, 0, APZ);        // local x = u·SCALE — the rule's own axis
    this.gApp = g;
    const span = C.cordSlots * SCALE;

    // pedestal at the arc's foot (u = 0): where every throw springs from
    M(Cy(0.42, 0.55, 0.55, 8), mat(P.stone), 0, 0.275, 0, g);
    M(Cy(0.3, 0.3, 0.05, 8), mat(P.stoneLit), 0, 0.575, 0, g, false);
    this.colliders.push({ type: 'circle', x: X0, z: APZ, r: 0.55 });

    // two posts carrying the cord, just past the numbered span
    for (const px of [-0.5, span + 0.5]) {
      M(Cy(0.09, 0.13, POST_H, 7), mat(P.trunk), px, POST_H / 2, 0, g);
      M(Sp(0.11, 7, 6), mat('#6b5a44'), px, POST_H + 0.04, 0, g);
      this.colliders.push({ type: 'circle', x: X0 + px, z: APZ, r: 0.16 });
    }

    // the CORD group: one rig that glides to each rep's height. Knots at every
    // whole u (0..cordSlots, from the data), a tick under every 2nd — the same
    // numbers the labels wear and the truth is solved against.
    const cg = new THREE.Group();
    g.add(cg); this.cordG = cg;
    const cord = M(Cy(0.02, 0.02, span + 1.0, 5), mat('#8a6d3f'), span / 2, 0, 0, cg, false);
    cord.rotation.z = Math.PI / 2;
    const knotM = mat('#4d4436');
    for (let k = 0; k <= C.cordSlots; k++) {
      M(Sp(k % 2 ? 0.05 : 0.062, 6, 5), knotM, k * SCALE, 0, 0, cg, false);
      if (k % 2 === 0) M(new THREE.BoxGeometry(0.018, 0.13, 0.018), knotM, k * SCALE, -0.12, 0, cg, false);
    }

    // the bell — bronze, born on Hang, hidden between reps
    const bg = new THREE.Group();
    this.bellMat = mat('#8a6136', { roughness: 0.45, metalness: 0.35, emissive: new THREE.Color(P.gold), emissiveIntensity: 0 });
    M(To(0.035, 0.012, 6, 12), this.bellMat, 0, -0.02, 0, bg, false);
    M(Cy(0.055, 0.115, 0.17, 8), this.bellMat, 0, -0.15, 0, bg);
    M(Cy(0.12, 0.125, 0.035, 8), this.bellMat, 0, -0.245, 0, bg);
    M(Sp(0.028, 6, 5), mat('#38332e'), 0, -0.27, 0, bg, false);
    bg.visible = false;
    cg.add(bg); this.bell = bg;

    // the strike ring (on a rung bell) and the ember marker (at a missed truth)
    this.pulse = M(To(0.2, 0.02, 6, 20), glow(P.gold, 0), 0, 0, 0, cg, false);   // faces ±z: the viewing side
    this.pulse.visible = false;
    const mk = new THREE.Group();
    M(Sp(0.06, 8, 6), glow(P.brick, 1), 0, 0, 0, mk, false);
    M(To(0.13, 0.014, 6, 18), glow(P.parchment, 0.9), 0, 0, 0, mk, false);
    mk.visible = false; cg.add(mk); this.marker = mk;

    // the spark that rides the rule, and its light
    this.spark = M(Sp(0.07, 8, 6), glow('#ffe9b0', 1), 0, 0, 0, g, false);
    this.spark.visible = false;
    this.sparkL = new THREE.PointLight(new THREE.Color(P.lamp), 0, 4, 2);
    this.spark.add(this.sparkL);
    this.landRing = flat(M(To(0.3, 0.03, 6, 20), glow(P.gold, 0), 0, 0, 0, g, false));
    this.landRing.visible = false;

    // one E-target for the whole rig + a fat gaze proxy (standalone, contract)
    g.userData.act = this._cordAct = {
      part: 'bell-yard', kind: 'cord',
      prompt: 'Hang the bell',                              // PLACEHOLDER
      label: 'A hung path, and a cord of counted knots',    // PLACEHOLDER
      reach: 7,
    };
    scene.add(g);
    this.solid.push(g);
    this.interactables.push(g);
    const proxy = M(new THREE.BoxGeometry(span + 2.2, 3.0, 1.7), glow('#000', 0), C0.x, 2.5, APZ, scene, false);
    proxy.userData.act = this._cordAct;
    proxy.userData.glowRoot = g;
    this.interactables.push(proxy);
  }

  /** sample rep i's own rule into a standing tube (reading.js's arc language) */
  _buildArc(i) {
    const R = this.C.reps[i];
    const land = this._landOf(i);
    const pts = [];
    for (let s = 0; s <= 40; s++) {
      const u = (s / 40) * land;
      pts.push(new THREE.Vector3(u * SCALE, Math.max(0.05, (R.c + R.b * u + R.a * u * u) * SCALE), 0));
    }
    const m = glow(this.P.gold, 0.95);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.035, 6), m));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow(this.P.gold, 0.95));
    foot.position.copy(pts[0]);
    grp.add(foot);
    this.gApp.add(grp);
    return { grp, m };
  }

  /** stand rep i ready: arc up (instant or risen by the swap), cord at its height */
  _mountRep(i, instant) {
    this.rep = i;
    const a = this._buildArc(i);
    this.arc = a.grp; this.arcMat = a.m;
    this.cordYT = this.C.reps[i].h * SCALE;
    if (instant) { this.cordY = this.cordYT; this.arc.scale.y = 1; }
    else { this.arc.scale.y = 0.001; this.arcMat.opacity = 0; }
    this.cordG.position.y = this.cordY;
    this.placed = null;
    this.thinkT0 = performance.now();
  }

  _resetRound(freshGrade) {
    for (const g of [this.arc, this.arcOld]) if (g) this.gApp.remove(g);
    this.arc = this.arcOld = null;
    this.misses = [];
    this.bell.visible = this.marker.visible = this.spark.visible = this.landRing.visible = false;
    this.sparkL.intensity = 0;
    this.ringT = this.markT = this.dipT = this.landT = -1;
    this.bellMat.emissiveIntensity = 0;
    this.bell.rotation.z = 0; this.bell.scale.setScalar(1); this.bell.position.y = 0;
    if (freshGrade) { this.grade = null; this.glowT = 0; this.litStuds = 0; }
    this._mountRep(0, true);
  }

  // ---------- the portal round-trip ----------
  _enter() {
    // block only when genuinely standing in the enclave (a dev-warp can leave
    // inYard stale; a second E must not clobber a good save with a yard pos)
    let px = this.stoneAt.x;
    try { px = this.game.playerPos().x; } catch {}
    if (this.inYard && px < -17) return;
    // save where to put the player back — position AND heading. If the save
    // looks wrong (already west of the wall, non-finite), fall back to the
    // standing stone: the round-trip must never strand anyone.
    try {
      const p = this.game.playerPos();
      const f = this._ctl?.forward?.() ?? { x: -1, z: 0 };
      this.saved = (Number.isFinite(p.x) && Number.isFinite(p.z) && p.x > -17)
        ? { x: p.x, z: p.z, fx: f.x, fz: f.z } : null;
    } catch { this.saved = null; }
    try {
      this.PH.dismissPanel();
      this._resetRound(true);           // retraining: fresh reps, the old grade will be overwritten
      this.game.teleport(ENTER.x, ENTER.z, ENTER.lx, ENTER.ly, ENTER.lz);
    } catch { return; }                 // if the yard cannot take you, you never left
    this.inYard = true;
    this.phase = 'ready';
    this.pulseT = 0;
    this.log.push('bellyard.enter', { fromX: +(this.saved?.x ?? this.stoneAt.x).toFixed(2), fromZ: +(this.saved?.z ?? this.stoneAt.z).toFixed(2) });
  }

  _exit() {
    this.PH.dismissPanel();
    const s = this.saved;
    const ok = s && Number.isFinite(s.x) && Number.isFinite(s.z) && s.x > -17;
    this.log.push('bellyard.exit', { graded: !!this.grade, completedReps: this.misses.length });
    try {
      if (ok) this.game.teleport(s.x, s.z, s.x + s.fx * 4, 1.5, s.z + s.fz * 4);
      else this.game.teleport(this.stoneAt.x + 1.3, this.stoneAt.z + 1.6, this.stoneAt.x, 1.4, this.stoneAt.z);
    } catch {
      this.game.teleport(this.stoneAt.x + 1.3, this.stoneAt.z + 1.6, this.stoneAt.x, 1.4, this.stoneAt.z);
    }
    this.inYard = false;
    this.saved = null;
    this.phase = 'idle';
    this._resetRound(false);            // the next entrant finds rep 1 standing; the plinth keeps its glow
  }

  // ---------- interaction ----------
  onInteract(act, PH) {
    if (act.entity === 'standing-stone') { this._enter(); return; }
    if (act.kind === 'return') { this._exit(); return; }
    if (act.kind === 'cord') {
      if (this.phase !== 'ready' && this.phase !== 'done') return;   // the yard is mid-answer: watch it
      PH.openPanel('p:bell-yard');
      if (this.phase === 'ready') document.getElementById('byKnot')?.focus();
    }
  }

  onPanel(ev) {
    if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#byHang')) this._commit();
  }

  _commit() {
    if (this.phase !== 'ready') return;
    const el = document.getElementById('byKnot');
    if (!el) return;
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) { el.focus(); return; }
    const placed = clamp(v, 0, this.C.cordSlots);
    el.blur();
    this.placed = placed;
    // the truth, derived NOW from the same numbers the tube was drawn with
    const { far } = this._truthOf(this.rep);
    const missKnots = Math.abs(placed - far);
    const ring = missKnots <= this.C.tolerance;
    this.misses.push(missKnots);
    this.log.push('bellyard.rep', {
      rep: this.rep + 1, placed, true: +far.toFixed(2),
      missKnots: +missKnots.toFixed(2), outcome: ring ? 'ring' : 'miss',
      ms: Math.round(performance.now() - this.thinkT0),
    });
    this.PH.dismissPanel();             // step aside — the drop and the spark are the answer
    this.bell.visible = true;
    this.bell.position.set(placed * SCALE, 0.55, 0);
    this.bell.rotation.z = 0; this.bell.scale.setScalar(1);
    this.bellMat.emissiveIntensity = 0;
    this.phase = 'drop';
    this.anim = { t: 0 };
  }

  // GRADE (enc.bellYard.strength + _truth_note):
  //   s = ceil − (ceil − floor) · min(meanMiss, 3) / 3
  // mean miss 0 knots → ceil (1.0); ≥ 3 knots → floor (0.2); linear between.
  // Written straight into the bag: this IS the band width the Falling Arc
  // reads with from now on (reading.js, degraded()); regraded on every visit.
  _grade() {
    const S = this.C.strength;
    const mean = this.misses.reduce((p, q) => p + q, 0) / this.misses.length;
    const s = clamp(S.ceil - (S.ceil - S.floor) * Math.min(mean, MISS_FLOOR_AT) / MISS_FLOOR_AT, S.floor, S.ceil);
    this.game.setStrength('falling-arc', s);
    this.grade = { s, mean };
    this.glowT = s;
    this.litStuds = Math.round(s * 4);
    this.log.push('bellyard.grade', {
      misses: this.misses.map((m) => +m.toFixed(2)).join('|'),
      meanMiss: +mean.toFixed(2), strength: +s.toFixed(3),
    });
    this.phase = 'done';
    this.PH.openPanel('p:bell-yard');
  }

  // ---------- per-frame ----------
  update(dt, u) {
    this.t += dt;
    if (u && u.controls) {
      this._ctl = u.controls;
      this.nearYard = Math.hypot(u.controls.pos.x - C0.x, u.controls.pos.z - C0.z) < 14;
    }
    const a = this.anim;

    if (this.phase === 'drop') {
      // gravity takes the bell to its knot; a settle sway; one held breath
      a.t += dt;
      if (a.t < T_DROP) this.bell.position.y = 0.55 * (1 - (a.t / T_DROP) ** 2);
      else {
        this.bell.position.y = 0;
        const s = a.t - T_DROP;
        this.bell.rotation.z = 0.28 * Math.sin(s * 10) * Math.exp(-2.6 * s);
      }
      if (a.t >= T_DROP + T_SWAY) {
        this.bell.rotation.z = 0;
        this.phase = 'charge';
        this.anim = { t: 0 };
        const R = this.C.reps[this.rep];
        this.spark.visible = true;
        this.spark.scale.setScalar(0.001);
        this.spark.position.set(0, R.c * SCALE, 0);
      }
    } else if (this.phase === 'charge') {
      // anticipation at the foot: the spark gathers before it goes
      a.t += dt;
      const k = smooth(Math.min(1, a.t / T_BREATH));
      this.spark.scale.setScalar(0.2 + 0.8 * k);
      this.sparkL.intensity = 0.9 * k;
      if (a.t >= T_BREATH) {
        const { near, far } = this._truthOf(this.rep);   // derived again at use — never carried
        this.phase = 'flight';
        this.anim = { t: 0, u: 0, near, far, land: this._landOf(this.rep), fade: 0 };
      }
    } else if (this.phase === 'flight') {
      // the spark rides the rule at constant ground-speed: du/dt is flat, so
      // dy/dt IS the rule's own slope — it slows into the crown and gathers
      // speed coming down. The ease is the mathematics, not an animator's
      // curve (design doc's thesis); it moves along the arc, never teleports.
      a.t += dt;
      const uPrev = a.u;
      a.u = Math.min(a.land, (a.t / T_FLIGHT) * a.land);
      const R = this.C.reps[this.rep];
      const y = R.c + R.b * a.u + R.a * a.u * a.u;
      this.spark.position.set(a.u * SCALE, Math.max(0.06, y * SCALE), 0);
      // the near crossing: the cord takes a light blow going up (no bell law
      // here — the ask names the coming-down crossing; the far root is truth)
      if (uPrev < a.near && a.u >= a.near) { this.dipT = 0; this.dipA = 0.02; }
      // the far crossing: THE truth happens, ring or countable miss
      if (uPrev < a.far && a.u >= a.far) {
        this.dipT = 0; this.dipA = 0.05;
        const missed = Math.abs(this.placed - a.far) > this.C.tolerance;
        if (!missed) {
          this.ringT = 0;
          this.pulse.visible = true;
          this.pulse.position.set(this.placed * SCALE, -0.14, 0);
        } else {
          this.markT = 0;
          this.marker.visible = true;
          this.marker.position.set(a.far * SCALE, 0, 0);
        }
      }
      if (a.u >= a.land) {
        if (a.fade === 0) { this.landT = 0; this.landRing.position.set(a.land * SCALE, 0.06, 0); this.landRing.visible = true; }
        a.fade += dt;
        this.spark.scale.setScalar(Math.max(0.001, 1 - a.fade / 0.3));
        this.sparkL.intensity = Math.max(0, 0.9 * (1 - a.fade / 0.3));
        if (a.fade >= 0.3) { this.spark.visible = false; this.phase = 'verdict'; this.anim = { t: 0 }; }
      }
    } else if (this.phase === 'verdict') {
      // hold while the marker burns / the bell swings — the lesson is countable
      a.t += dt;
      if (a.t >= T_VERDICT) {
        if (this.rep + 1 < this.C.reps.length) {
          this.arcOld = this.arc; this.arcOldMat = this.arcMat;
          this.bell.visible = false;
          this._mountRep(this.rep + 1, false);
          this.phase = 'swap';
          this.anim = { t: 0 };
        } else {
          this.bell.visible = false;
          this._grade();
        }
      }
    } else if (this.phase === 'swap') {
      // the spent throw sets; the next rises; the cord glides to its height
      a.t += dt;
      const k = Math.min(1, a.t / T_SWAP);
      if (this.arcOld) {
        this.arcOld.scale.y = Math.max(0.02, 1 - 0.95 * smooth(Math.min(1, k * 1.3)));
        this.arcOldMat.opacity = 0.95 * (1 - smooth(k));
      }
      const k2 = smooth(clamp((k - 0.3) / 0.7, 0, 1));
      this.arc.scale.y = Math.max(0.001, k2);
      this.arcMat.opacity = 0.95 * k2;
      if (k >= 1) {
        if (this.arcOld) this.gApp.remove(this.arcOld);
        this.arcOld = this.arcOldMat = null;
        this.arc.scale.y = 1; this.arcMat.opacity = 0.95;
        this.phase = 'ready';
        this.anim = null;
        this.thinkT0 = performance.now();   // think-clock: the rep stands ready
      }
    }

    // the cord glides toward its rep's height; a strike dips it briefly
    this.cordY += (this.cordYT - this.cordY) * Math.min(1, dt * 3.2);
    let dip = 0;
    if (this.dipT >= 0) {
      this.dipT += dt;
      dip = -this.dipA * Math.sin(Math.PI * Math.min(1, this.dipT / 0.35));
      if (this.dipT >= 0.35) this.dipT = -1;
    }
    this.cordG.position.y = this.cordY + dip;

    // ring: pulse, ripple bob, gold flash — unmistakably a YES
    if (this.ringT >= 0) {
      this.ringT += dt;
      const t = this.ringT;
      this.bellMat.emissiveIntensity = t < 1.1 ? 1.4 * (1 - t / 1.1) + 0.2 : 0.28;
      this.bell.scale.setScalar(1 + 0.16 * Math.sin(Math.PI * Math.min(1, t / 0.35)));
      this.bell.rotation.z = 0.3 * Math.sin(t * 11) * Math.exp(-2.2 * t);
      const pk = 1 + t * 2.6;
      this.pulse.scale.set(pk, pk, 1);
      this.pulse.material.opacity = Math.max(0, 0.85 * (1 - t / 0.7));
      if (t >= 1.4) { this.ringT = -1; this.pulse.visible = false; this.bellMat.emissiveIntensity = 0.25; }
    }
    // miss: the ember burns at the true place for T_MARK, then it is gone
    if (this.markT >= 0) {
      this.markT += dt;
      const f = 1 - this.markT / T_MARK;
      this.marker.children[0].material.opacity = Math.max(0, (0.55 + 0.45 * Math.sin(this.markT * 16)) * f);
      this.marker.children[1].material.opacity = Math.max(0, 0.9 * f);
      if (this.markT >= T_MARK) { this.markT = -1; this.marker.visible = false; }
    }
    if (this.landT >= 0) {
      this.landT += dt;
      const k = 1 + this.landT * 3;
      this.landRing.scale.set(k, k, 1);
      this.landRing.material.opacity = Math.max(0, 0.6 * (1 - this.landT / 0.45));
      if (this.landT >= 0.45) { this.landT = -1; this.landRing.visible = false; }
    }
    if (this.pulseT >= 0) {
      this.pulseT += dt;
      const k = 1 + this.pulseT * 3.2;
      this.arriveRing.scale.set(k, k, 1);
      this.arriveRing.material.opacity = Math.max(0, 0.7 * (1 - this.pulseT / 0.9));
      if (this.pulseT >= 0.9) this.pulseT = -1;
    }

    // the standing arc breathes; the lanterns live a little
    if (this.arcMat && this.phase !== 'swap') this.arcMat.opacity = 0.88 + 0.07 * Math.sin(this.t * 1.7);
    for (let i = 0; i < this.lamps.length; i++) this.lamps[i].intensity = 0.85 + 0.06 * Math.sin(this.t * 2.1 + i * 1.7);

    // the plinth eases toward the grade it holds
    this.glowK += (this.glowT - this.glowK) * Math.min(1, dt * 1.6);
    this.glowDisc.material.opacity = 0.05 + 0.7 * this.glowK * (0.85 + 0.15 * Math.sin(this.t * 1.8));
    this.plinthLight.intensity = 1.5 * this.glowK;
    for (let j = 0; j < 4; j++) this.studMats[j].emissiveIntensity = j < this.litStuds ? 0.15 + 0.85 * this.glowK : 0.02;
  }

  // ---------- chips ----------
  labels(L, architectOn) {
    if (!this.nearYard && !this.inYard) return;
    const R = this.C.reps[this.rep];
    const cy = this.cordY;
    // knot numerals every 2nd knot — the same 0..cordSlots the truth lives on
    for (let k = 0; k <= this.C.cordSlots; k += 2) {
      L.set('by-n' + k, { tex: String(k), x: X0 + k * SCALE, y: cy - 0.42, z: APZ, kind: 'plain', dy: 0 });
    }
    // the carved rule over the pedestal + the cord's height at the east post:
    // together they are sufficient to place the bell by pure solving (Law 1)
    L.set('by-rule', { tex: quadTex(R.c, R.b, -R.a, 2), x: X0 + 0.3, y: 2.35, z: APZ, kind: 'rule', dy: 0 });
    L.set('by-h', { tex: `y = ${n(R.h, 1)}`, x: X0 + this.C.cordSlots * SCALE + 0.55, y: cy + 0.45, z: APZ, kind: 'rule', dy: 0 });
    if (architectOn) {
      const A = this.C.architect;
      L.set('by-arch', {
        tex: `\\texttt{${(A?.concept ?? 'training').replace(/ /g, '\\ ')}}`,
        x: C0.x, y: 5.7, z: C0.z, kind: 'architect', dy: 0,
      });
      const { far } = this._truthOf(this.rep);
      L.set('by-archx', {
        tex: `${n(-R.a, 2)}x^{2} - ${n(R.b, 2)}x + ${n(R.h - R.c, 2)} = 0,\\ x^{*} = ${n(far, 2)}\\ (\\pm ${n(this.C.tolerance, 1)})`,
        x: X0 + far * SCALE, y: cy + 1.0, z: APZ, kind: 'architect', dy: 0,
      });
    }
  }

  // ---------- card ----------
  // PLACEHOLDER strings throughout (owner-authored voice, Law 2). The equation
  // is BUILT from the rep's numbers at render time — never typed literals.
  panel(st) {
    const K = this.PH.K, C = this.C;
    if (this.phase === 'done' && this.grade) {
      const full = Math.round(this.grade.s * 4);
      const dots = `<span class="dots">${'●'.repeat(full)}${'○'.repeat(4 - full)}</span>`;
      return `
        <h2>The bell yard</h2>
        <p class="lede">The yard takes your measure.</p>
        <p>The Falling Arc sits ${dots} in the bag.</p>
        <p class="muted">Out there, its reading holds exactly this firmly — no more, no less. The low stone at the yard's edge reads you out; the grooves will read you in again whenever you want a truer hand.</p>
        ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${C.architect.depth}. misses (knots): ${this.misses.map((m) => n(m, 2)).join(', ')} → mean ${n(this.grade.mean, 2)} → s = ${n(C.strength.ceil, 1)} − ${n(C.strength.ceil - C.strength.floor, 1)}·min(mean, ${MISS_FLOOR_AT})/${MISS_FLOOR_AT} = ${n(this.grade.s, 3)}, written to strengths['falling-arc']. Regraded, not ratcheted.</p></div>` : ''}`;
    }
    if (this.phase !== 'ready') return '';
    const R = C.reps[this.rep];
    const eq = K(`${quadTex(R.c, R.b, -R.a, 2)},\\quad y = ${n(R.h, 1)}`, true);
    return `
      <h2>The bell yard</h2>
      <p class="lede">${C.ask}</p>
      <p>The ${ORD[this.rep] ?? `${this.rep + 1}th`} of ${C.reps.length} throws hangs ready. Where it comes <em>down</em> through the cord, hang the bell — the knots count the way.</p>
      <div class="eq">${eq}</div>
      <div class="gate-in">
        <input type="number" id="byKnot" min="0" max="${C.cordSlots}" step="any" value="" placeholder="knot">
        <button class="btn primary" id="byHang">Hang the bell</button>
      </div>
      <p class="muted tiny">The numerals mark every second knot. Whole knots are honest answers; a hand that has solved may split them.</p>
      ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${C.architect.depth}. Truth = far root of ${n(-R.a, 2)}x² − ${n(R.b, 2)}x + ${n(R.h - R.c, 2)} = 0, derived at runtime, tolerance ±${n(C.tolerance, 1)} knots. Miss distances grade the bag.</p></div>` : ''}`;
  }
}
