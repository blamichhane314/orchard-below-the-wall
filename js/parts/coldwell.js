// coldwell.js — the Cold-Well counterweight hoist. Core rung of
// design/parts/early-cold-well.md: the one-step balance (x + fixed = load).
// A tray of jars hangs low in the well mouth; iron rings hang on a counter
// hook. The player sets a count of rings; they hang one by one, the crank
// turns, and the statics decide. Balance raises the tray, both rope sides
// trading length, watched. A wrong count RUNS AWAY in the error's direction
// at the error's speed — the motion is the verdict, no text (Law 3).
//
// PERCEPTUAL CONTRACT (Law 4): jars on the tray = enc.coldWell.load; rings
// welded to the hook = enc.coldWell.fixed; spares on the stand = enc.coldWell
// .max (so any count the input allows is also physically hangable). needed =
// load − fixed is derived at crank time and stored nowhere. Every countable
// multiplicity the player can see is generated from the numbers the physics
// runs on.

import * as THREE from '../../vendor/three/three.module.js';
import { n } from '../fmt.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const _va = new THREE.Vector3(), _vd = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** stretch a unit-height cylinder between two points (parent-local). */
const ropeSpan = (mesh, ax, ay, az, bx, by, bz) => {
  _va.set(ax, ay, az); _vd.set(bx - ax, by - ay, bz - az);
  const len = Math.max(1e-4, _vd.length());
  mesh.position.copy(_va).addScaledVector(_vd, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, _vd.multiplyScalar(1 / len));
  return mesh;
};

// rig numbers (local metres; group origin = well centre at ground level)
const TRAY0 = 0.34;      // tray at rest: sunk in the mouth, visible below the rim
const TRAY_RIM = 0.78;   // balanced arrival: up out of the mouth, rim height
const TRAY_TOP = 1.36;   // slam cap: the bail knocking under the drum
const TRAY_LOW = 0.10;   // runback cap: just over the water
const HOOK0 = 1.55, HOOK_MIN = 0.75, HOOK_MAX = 1.90;   // conservation, clamped where a side lands
const HOOK_Z = -1.55, DRUM_Y = 1.98, DRUM_R = 0.12;
const SLOT = 0.058;      // ring pitch on horn and stand
const HANG_GAP = 0.12, HANG_T = 0.3;   // one-by-one, watchable

export default class ColdWell {
  /** @param ctx { scene, world, enc, log, PH } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH }) {
    this.log = log; this.PH = PH;
    this.P = world.palette;
    this.C = enc.coldWell;
    this.E = world.entities.find((e) => e.id === 'cold-well');
    if (!this.C || !this.E) throw new Error('cold-well needs enc.coldWell and the world entity');

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: this.E.at.x, z: this.E.at.z, reach: this.E.reach ?? 2.8 };

    this.phase = 'idle'; this.anim = null;
    this.flights = []; this._pending = [];
    this.trayY = TRAY0; this.spin = 0; this.bobT = 9;
    this.solved = false; this.tries = 0; this.err = 0; this.lastX = null;
    this.viewedAt = 0; this.thinkT0 = 0; this.pulse = 0;

    this._build(scene);

    // Enter in the count field commits — main.js's Enter delegation covers the
    // shared cards only, not part panels, so the part listens for its own input
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'cwX') { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ---------- build ----------
  _build(scene) {
    const { P, C, E } = this;
    const r = rng(1187);
    const g = new THREE.Group();
    g.position.set(E.at.x, 0, E.at.z);
    this.g = g;

    const woodM = mat('#6b5a44'), postM = mat(P.trunk), drumM = mat('#7a6448'), ropeM = mat('#8a6d3f');
    const ironM = mat('#4a453f', { roughness: 0.55, metalness: 0.3 });    // player-hung + spares
    const weldM = mat('#38332e', { roughness: 0.6, metalness: 0.3 });     // fixed to the horn: first-hand metal
    const Cy = (...a) => new THREE.CylinderGeometry(...a);
    const Bx = (...a) => new THREE.BoxGeometry(...a);
    const To = (...a) => new THREE.TorusGeometry(...a);
    const ringGeo = To(0.115, 0.03, 6, 14);
    const flat = (o) => { o.rotation.x = Math.PI / 2; return o; };
    /** shadowed mesh at (x,y,z); shadow=false for glow/water/thin dressing */
    const M = (geo, material, x, y, z, parent = g, shadow = true) => {
      const o = new THREE.Mesh(geo, material);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = shadow;
      parent.add(o);
      return o;
    };

    // — the well: low stone ring over a dark shaft, water glinting below
    M(Cy(1.12, 1.18, 0.7, 12, 1, true), mat(jitter(P.stone, r), { side: THREE.DoubleSide }), 0, 0.35, 0);
    flat(M(To(1.12, 0.09, 6, 16), mat(P.stoneLit), 0, 0.7, 0));
    M(Cy(1.03, 1.03, 0.66, 12, 1, true), mat('#2f2a22', { side: THREE.DoubleSide }), 0, 0.37, 0, g, false).receiveShadow = true;
    M(new THREE.CircleGeometry(1.02, 16),
      mat('#24393b', { flatShading: false, emissive: new THREE.Color('#101f21'), emissiveIntensity: 0.6 }),
      0, 0.05, 0, g, false).rotation.x = -Math.PI / 2;
    this.pulseRing = flat(M(To(1.12, 0.05, 6, 22), glow(P.gold, 0), 0, 0.74, 0, g, false));

    // — posts, crossbeam, jib carrying the counter rope clear of the rim
    for (const sx of [-1, 1]) {
      M(Bx(0.14, 2.1, 0.14), postM, sx * 1.5, 1.05, 0);
      M(Bx(0.07, 0.62, 0.07), postM, sx * 1.27, 1.78, 0).rotation.z = sx * 0.72;
    }
    M(Bx(3.34, 0.13, 0.17), woodM, 0, 2.14, 0);
    M(Bx(0.09, 0.09, 1.5), woodM, 0, 2.12, -0.68);
    M(Cy(0.07, 0.07, 0.05, 10), drumM, 0, 2.02, -1.35).rotation.z = Math.PI / 2;   // sheave for the lead

    // — axle + drum + crank: one group, rotation.x is the machine turning
    const axle = new THREE.Group(); axle.position.set(0, DRUM_Y, 0);
    M(Cy(0.045, 0.045, 3.15, 7), postM, 0, 0, 0, axle).rotation.z = Math.PI / 2;
    M(Cy(DRUM_R, DRUM_R, 0.95, 9), drumM, 0, 0, 0, axle).rotation.z = Math.PI / 2;
    M(Bx(0.055, 0.34, 0.055), postM, 1.66, 0.14, 0, axle);                          // crank arm…
    M(Cy(0.033, 0.033, 0.2, 7), woodM, 1.76, 0.3, 0, axle).rotation.z = Math.PI / 2; // …and handle
    g.add(axle); this.axle = axle;

    // — the tray: wood disc, bails to one knot, jars in a countable single
    //   layer. JAR COUNT = enc.coldWell.load, generated — never hand-placed.
    const trayG = new THREE.Group(); trayG.position.y = TRAY0;
    M(Cy(0.62, 0.56, 0.06, 12), woodM, 0, 0, 0, trayG);
    flat(M(To(0.6, 0.025, 5, 14), mat('#5f5040'), 0, 0.05, 0, trayG, false));
    for (let i = 0; i < 3; i++) {
      const aa = (i / 3) * Math.PI * 2 + 0.5;
      ropeSpan(M(Cy(0.013, 0.013, 1, 5), ropeM, 0, 0, 0, trayG, false),
        Math.cos(aa) * 0.55, 0.03, Math.sin(aa) * 0.55, 0, 0.5, 0);
    }
    M(new THREE.SphereGeometry(0.035, 6, 5), ropeM, 0, 0.5, 0, trayG, false);
    this.jarMats = [];
    const onRing = Math.min(C.load, 7);   // a ring of ≤7, leftovers centred: zero occlusion from the rim
    for (let i = 0; i < C.load; i++) {
      const aa = (i / onRing) * Math.PI * 2 + 0.35;
      const jx = i >= onRing ? (i - onRing - (C.load - onRing - 1) / 2) * 0.23 : Math.cos(aa) * 0.4;
      const jz = i >= onRing ? 0 : Math.sin(aa) * 0.4;
      const bodyM = mat(jitter('#a8785a', r));
      this.jarMats.push(bodyM);
      M(Cy(0.1, 0.12, 0.24, 7), bodyM, jx, 0.15, jz, trayG);
      M(Cy(0.055, 0.075, 0.05, 7), mat(P.vellum), jx, 0.295, jz, trayG, false);   // pale wax lid against dark water
    }
    g.add(trayG); this.trayG = trayG;

    // — counter hook: strap, vertical horn, stop plate; the welded rings ride
    //   as children (RING COUNT = enc.coldWell.fixed, generated)
    const hookG = new THREE.Group(); hookG.position.set(0, HOOK0, HOOK_Z);
    M(Bx(0.05, 0.1, 0.02), ironM, 0, -0.02, 0, hookG, false);
    M(Cy(0.027, 0.027, 0.68, 7), ironM, 0, -0.36, 0, hookG);
    M(Cy(0.09, 0.11, 0.035, 8), ironM, 0, -0.7, 0, hookG, false);
    for (let j = 0; j < C.fixed; j++) flat(M(ringGeo, weldM, 0, -0.66 + j * SLOT, 0, hookG));
    g.add(hookG); this.hookG = hookG;

    // — ring stand: the spares the player draws from (STOCK = enc.coldWell.max)
    const standX = 1.4, standZ = -1.5;
    M(Cy(0.16, 0.2, 0.1, 8), mat(P.stone), standX, 0.05, standZ);
    M(Cy(0.04, 0.05, 0.92, 7), postM, standX, 0.56, standZ);
    this.rings = [];
    for (let i = 0; i < C.max; i++) {
      const home = { x: standX + (r() - 0.5) * 0.016, y: 0.14 + i * SLOT, z: standZ + (r() - 0.5) * 0.016 };
      const m = flat(M(ringGeo, ironM, home.x, home.y, home.z));
      this.rings.push({ m, home, state: 'stand', slot: -1 });   // stand slot i is the ring's home for returns
    }

    // — ropes: unit cylinders restretched every frame; the drum→sheave lead is static
    const ropeGeo = Cy(0.022, 0.022, 1, 5);
    this.trayRope = M(ropeGeo, ropeM, 0, 0, 0, g, false);
    this.hookRope = M(ropeGeo, ropeM, 0, 0, 0, g, false);
    ropeSpan(M(ropeGeo, ropeM, 0, 0, 0, g, false), 0, DRUM_Y, -0.13, 0, 2.0, -1.33);

    // — lamp bracket over the mouth: the jars must be countable in one look
    M(Bx(0.42, 0.05, 0.05), postM, -1.26, 1.62, 0);
    M(new THREE.SphereGeometry(0.06, 8, 6),
      mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.3 }), -1.06, 1.55, 0, g, false);
    const lampL = new THREE.PointLight(new THREE.Color(P.lamp), 0.8, 4.5, 1.8);
    lampL.position.set(-1.0, 1.5, 0);
    g.add(lampL);

    // the whole rig is one E-target (prompt/label/reach come from the entity)
    g.userData.act = {
      part: 'cold-well',
      prompt: E.prompt ?? 'Work the well',                       // PLACEHOLDER (owner-authored, world3.json)
      label: E.label ?? 'A well with a counterweighted hoist',   // PLACEHOLDER
      reach: E.reach ?? 2.8,
    };
    scene.add(g);
    this.solid.push(g);
    this.interactables.push(g);

    // a fat invisible gaze-target: from framing distance the eye rests on the
    // rig as a whole, never on a 2 cm rope. Standalone (not under g) so the
    // label-occlusion pass never sees it — interact ray only.
    const gazeProxy = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.6, 2.8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    gazeProxy.position.set(E.at.x, 1.3, E.at.z);
    gazeProxy.userData.act = g.userData.act;
    gazeProxy.userData.glowRoot = g;   // the glow belongs to the visible rig
    scene.add(gazeProxy);
    this.interactables.push(gazeProxy);

    // colliders: the 2D map — ring, posts, stand; nothing above head height
    this.colliders.push(
      { type: 'circle', x: E.at.x, z: E.at.z, r: 1.25 },
      { type: 'circle', x: E.at.x - 1.5, z: E.at.z, r: 0.16 },
      { type: 'circle', x: E.at.x + 1.5, z: E.at.z, r: 0.16 },
      { type: 'circle', x: E.at.x + standX, z: E.at.z + standZ, r: 0.18 },
    );

    this.update(0);   // rest pose for ropes and hook before the first frame
  }

  // ---------- statics, derived every time (never stored) ----------
  _hookY() { return clamp(HOOK0 + TRAY0 - this.trayY, HOOK_MIN, HOOK_MAX); }
  /** move the tray; drum + crank turn by the honest rope delta */
  _setTray(v) { this.spin -= (v - this.trayY) / DRUM_R; this.trayY = v; }

  // ---------- interaction ----------
  onInteract(act, PH) {
    if (!this.viewedAt) {
      this.viewedAt = performance.now();
      this.thinkT0 = this.viewedAt;   // think-clock: first look at the rig
      this.log.push('coldwell.viewed', { load: this.C.load, fixed: this.C.fixed });
    }
    PH.openPanel('p:cold-well');
    if (!this.solved && this.phase === 'idle') document.getElementById('cwX')?.focus();
  }

  onPanel(ev) {
    if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#cwSet')) this._commit();
  }

  _commit() {
    if (this.solved || this.phase !== 'idle') return;   // the rig is busy: watch it
    const el = document.getElementById('cwX');
    if (!el) return;
    const v = Math.round(parseFloat(el.value));
    if (!Number.isFinite(v)) { el.focus(); return; }
    const x = clamp(v, this.C.min, this.C.max);
    el.value = x; el.blur();
    this.lastX = x;
    this.tries++;
    this.err = this.C.fixed + x - this.C.load;   // signed truth, derived NOW
    this.log.push('coldwell.crank', {
      x, net: this.err,
      outcome: this.err === 0 ? 'raise' : this.err > 0 ? 'slam' : 'runback',
      ms: Math.round(performance.now() - this.thinkT0),
    });
    this.phase = 'hang';
    this.anim = { t: 0, next: 0, x };
  }

  _startBack(from) {
    // everything eases back to the start; the hung rings come off the horn,
    // top first, and return to their own stand slots — eased and staggered
    this.phase = 'back';
    this.anim = { t: 0, from };
    const hung = this.rings.filter((q) => q.state === 'hook').sort((p, q) => q.slot - p.slot);
    this._pending = hung.map((ring, j) => ({ ring, at: j * 0.06 }));
  }

  _rest() {
    this.trayY = TRAY0; this.phase = 'idle'; this.anim = null;
    this.thinkT0 = performance.now();   // retry think-clock runs from the settle
    const el = document.getElementById('cwX');
    if (el) { el.focus(); el.select(); }
  }

  // ---------- per-frame ----------
  update(dt) {
    // ring flights (hang and return): lift over, then an eased drop
    if (this.flights.length) {
      for (const f of this.flights) {
        f.t += dt;
        const s = smooth(clamp(f.t / f.T, 0, 1)), u = 1 - s;
        const cy = Math.max(f.ay, f.by) + 0.5;
        f.ring.m.position.set(
          u * u * f.ax + 2 * u * s * ((f.ax + f.bx) / 2) + s * s * f.bx,
          u * u * f.ay + 2 * u * s * cy + s * s * f.by,
          u * u * f.az + 2 * u * s * ((f.az + f.bz) / 2) + s * s * f.bz,
        );
        if (f.t >= f.T) {
          f.ring.state = f.land; f.ring.slot = f.slot;
          if (f.land === 'stand') f.ring.m.position.set(f.bx, f.by, f.bz);
          else this.bobT = 0;   // the stack takes the ring: one small sway
        }
      }
      this.flights = this.flights.filter((f) => f.t < f.T);
    }

    const a = this.anim;
    let shakeX = 0, shakeY = 0, shakeZ = 0;

    if (this.phase === 'hang') {
      a.t += dt;
      while (a.next < a.x && a.t >= a.next * HANG_GAP) {   // one by one — the count is watchable
        let ring = null;
        for (let i = this.rings.length - 1; i >= 0; i--) if (this.rings[i].state === 'stand') { ring = this.rings[i]; break; }
        if (!ring) break;
        const slot = this.C.fixed + a.next;                // hung rings stack above the welded ones
        ring.state = 'fly';
        this.flights.push({
          ring, t: 0, T: HANG_T,
          ax: ring.m.position.x, ay: ring.m.position.y, az: ring.m.position.z,
          bx: 0, by: this._hookY() - 0.66 + slot * SLOT, bz: HOOK_Z, land: 'hook', slot,
        });
        a.next++;
      }
      if (a.next >= a.x && a.t >= a.x * HANG_GAP + HANG_T + 0.25) { this.phase = 'wind'; this.anim = { t: 0 }; }
    } else if (this.phase === 'wind') {
      // anticipation: the pawl lifts, one heavy part-turn takes the weight
      a.t += dt;
      this.spin -= dt * 1.6 * smooth(Math.min(1, a.t / 0.45));
      shakeY = 0.006 * Math.sin(a.t * 42) * (a.t / 0.45);
      if (a.t >= 0.45) {
        if (this.err === 0) { this.phase = 'raise'; this.anim = { t: 0 }; }
        else if (this.err > 0) { this.phase = 'slam'; this.anim = { t: 0, v: 1.1 + 0.8 * this.err }; }
        else { this.phase = 'hope'; this.anim = { t: 0, v: 0.7 + 0.5 * -this.err }; }
      }
    } else if (this.phase === 'raise') {
      // balance: the tray rises as the counter descends — the equality, performed
      a.t += dt;
      this._setTray(TRAY0 + (TRAY_RIM - TRAY0) * smooth(Math.min(1, a.t / 2.0)));
      if (!a.pulsed && a.t >= 1.7) { a.pulsed = true; this.pulse = 1; }
      if (a.t >= 2.0) {
        this.solved = true;
        for (const m of this.jarMats) { m.emissive = new THREE.Color(this.P.gold); m.emissiveIntensity = 0.16; }
        this.log.push('coldwell.raised', { tries: this.tries, totalMs: Math.round(performance.now() - this.viewedAt) });
        this.PH.dismissLater('p:cold-well', 850);   // step aside; the world's answer is the feedback
        this.phase = 'settle'; this.anim = { t: 0 };
      }
    } else if (this.phase === 'settle') {
      a.t += dt;
      this.trayY = TRAY_RIM + 0.028 * Math.sin(a.t * 13) * Math.exp(-4.2 * a.t);
      if (a.t >= 0.8) { this.trayY = TRAY_RIM; this.phase = 'idle'; this.anim = null; }
    } else if (this.phase === 'slam') {
      // too many rings: no hopeful phase — the counter side is already winning.
      // Speed ∝ error size; the stack drives down, the tray flies to the beam
      a.t += dt;
      this._setTray(Math.min(TRAY_TOP, this.trayY + a.v * Math.min(1, a.t / 0.15) * dt));
      if (this.trayY >= TRAY_TOP) { this.phase = 'rattle'; this.anim = { t: 0 }; }
    } else if (this.phase === 'rattle') {
      a.t += dt;
      const f = Math.max(0, 1 - a.t / 0.42);
      shakeX = 0.03 * Math.sin(a.t * 57) * f;
      shakeZ = 0.024 * Math.sin(a.t * 49 + 1.3) * f;
      shakeY = 0.02 * Math.sin(a.t * 63) * f;
      if (a.t >= 0.42) this._startBack(TRAY_TOP);
    } else if (this.phase === 'hope') {
      // too few: one hopeful half-turn, a held beat, then the load overhauls —
      // the tray runs back down at the error's speed. Direction IS the sign
      a.t += dt;
      if (a.t < 0.5) {
        const s = a.t / 0.5;
        this._setTray(TRAY0 + 0.25 * s * (2 - s));
      } else if (a.t >= 0.7) {
        this._setTray(Math.max(TRAY_LOW, this.trayY - a.v * Math.min(1, (a.t - 0.7) / 0.2) * dt));
        if (this.trayY <= TRAY_LOW) this._startBack(TRAY_LOW);
      }
    } else if (this.phase === 'back') {
      a.t += dt;
      while (this._pending.length && a.t >= this._pending[0].at) {
        const { ring } = this._pending.shift();
        ring.state = 'fly';
        this.flights.push({
          ring, t: 0, T: 0.45,
          ax: ring.m.position.x, ay: ring.m.position.y, az: ring.m.position.z,
          bx: ring.home.x, by: ring.home.y, bz: ring.home.z, land: 'stand', slot: -1,
        });
      }
      this._setTray(a.from + (TRAY0 - a.from) * smooth(Math.min(1, a.t / 1.2)));
      if (a.t >= 1.2 && !this._pending.length && !this.flights.length) { this.phase = 'fsettle'; this.anim = { t: 0 }; }
    } else if (this.phase === 'fsettle') {
      a.t += dt;
      this.trayY = TRAY0 + 0.02 * Math.sin(a.t * 16) * Math.exp(-6 * a.t);
      if (a.t >= 0.5) this._rest();   // nothing lost; the count can be tried again
    }

    // tray carries the jars; the shake exists only while rattling
    this.trayG.position.set(shakeX, this.trayY + shakeY, shakeZ);

    // hook side: rope conservation, clamped where the stack meets ground/beam
    this.bobT += dt;
    const bob = 0.022 * Math.sin(this.bobT * 20) * Math.exp(-7 * this.bobT);
    const hookY = this._hookY() + bob;
    this.hookG.position.y = hookY;
    for (const q of this.rings) if (q.state === 'hook') q.m.position.set(0, hookY - 0.66 + q.slot * SLOT, HOOK_Z);

    // the rope sides visibly trade lengths
    ropeSpan(this.trayRope, 0, DRUM_Y, 0.13, this.trayG.position.x, this.trayY + shakeY + 0.5, this.trayG.position.z);
    ropeSpan(this.hookRope, 0, 2.0, -1.36, 0, hookY, HOOK_Z);

    this.axle.rotation.x = this.spin;

    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 1.1);   // one soft gold breath on the rim
      this.pulseRing.material.opacity = this.pulse * 0.7;
      const k = 1 + (1 - this.pulse) * 0.05;
      this.pulseRing.scale.set(k, k, 1);
    }
  }

  // ---------- chips ----------
  labels(L, architectOn) {
    const at = this.E.at;
    // the carved rule floats over the crossbeam while the station is unsolved;
    // after the raise the count is no longer a question, and the chip drops
    if (!this.solved) {
      L.set('cw-rule', {
        tex: `x + ${n(this.C.fixed, 0)} = ${n(this.C.load, 0)}`,   // built from data, never a literal
        x: at.x, y: 2.34, z: at.z, kind: 'rule', dy: 0,
      });
    }
    if (architectOn && this.C.architect && this.C.architect.tex) {
      L.set('cw-arch', { tex: this.C.architect.tex, x: at.x, y: 3.1, z: at.z, kind: 'architect', dy: 0 });
    }
  }

  // ---------- card ----------
  // PLACEHOLDER strings throughout (owner-authored voice, Law 2). The equation
  // is BUILT from enc.coldWell at render time — x + 2 = 6 shaped, never typed.
  panel(st) {
    const C = this.C, K = this.PH.K;
    const eq = K(`x + ${n(C.fixed, 0)} = ${n(C.load, 0)}`, true);
    if (this.solved) {
      return `
        <h2>The cold-well</h2>
        <p class="lede">The tray stands at the rim, the rope at rest.</p>
        <div class="eq">${eq}</div>
        <p class="muted">One ring for one jar. The count that holds is the one the crossbeam carved.</p>`;
    }
    return `
      <h2>The cold-well</h2>
      <p class="lede">A tray of jars hangs low in the mouth. A counter-hook hangs high, already carrying iron.</p>
      <p>Carved into the crossbeam:</p>
      <div class="eq">${eq}</div>
      <p>${C.ask}</p>
      <div class="gate-in">
        <input type="number" id="cwX" min="${C.min}" max="${C.max}" step="1" value="${this.lastX ?? ''}" placeholder="rings">
        <button class="btn primary" id="cwSet">Hang the rings and crank</button>
      </div>
      <p class="muted tiny">The jars on the tray and the rings on the hook are there to be counted from the rim.</p>
      ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${C.architect.depth}. Runaway direction and speed are the sign and size of (x + ${C.fixed}) − ${C.load}, computed live; nothing is scripted.</p></div>` : ''}`;
  }
}
