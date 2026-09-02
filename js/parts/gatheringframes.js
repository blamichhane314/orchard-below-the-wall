// gatheringframes.js — the Gathering Frames press-yard, minimal-card rung of
// design/parts/early-gathering-frames.md. A basket of figs, a gridded tray, a
// setting-aside bowl, a press-beam: division with remainder worn as fruit.
// Set aside what the tray cannot take, then tip. An exact bed seats the beam;
// too few set aside overflows the rail and bruises on the grass; too many
// leaves countable hollows and the beam refuses — motion, never a message.
//
// DEVIATION (deliberate, per integration brief): the design ideal is chip-free
// AND panel-free. This build keeps that spirit in the world — no player-facing
// chip ever, every count taken by looking — but commits the set-aside through
// one small card, and folds the full yard (many baskets, rack, gauge-bar,
// screw finale) down to one station. enc.gatheringFrames is the authority,
// not the design doc's larger pressYard block. The design's recovery loop
// stays in miniature: bruises are permanent; the basket restocks one windfall
// fig per interval, only while nobody is near enough to watch the wind work.
//
// PERCEPTUAL CONTRACT (Law 4): figs in the basket = live stock; hollows in
// the tray = rows × cols, built by the loops the physics counts with; truth =
// stock − rows·cols, derived at tip time per _truth_note, stored nowhere.
// Overflow = truth − setAside bruises; hollows = setAside − truth empty pits.

import * as THREE from '../../vendor/three/three.module.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// rig numbers (local metres; group origin = yard centre at ground level)
const CELL = 0.24, FIG_R = 0.055;
const TX = 0.2, TZ = 0;                                  // table/tray centre
const TRAY_Y = 0.64, CELL_Y = TRAY_Y + FIG_R;            // tray floor; a seated fig
const BEAM_REST = 1.62, BEAM_SEAT = CELL_Y + FIG_R + 0.045, BEAM_TOUCH = BEAM_SEAT + 0.035;
const PITCH = 0.055;                                     // screw drop per radian of turn
const BK = { x: -1.45, z: 0.35, y: 0.835 };              // basket centre; fig-layer height
const PIV = { x: -1.16, y: 0.77 };                       // tip pivot: the basket's east rim base
const BOWL = { x: -0.72, z: 0.75, y: 0.445 };
const LEAN = 0.16, TIP = -1.15;                          // anticipation lean; pour angle
const ASIDE_GAP = 0.12, POUR_GAP = 0.09;                 // one-by-one, countable in flight
const WF_S = 36, WF_FAR = 12;                            // windfall: one fig / 36 s, unwatched
const BRUISE = new THREE.Color('#3a2130');

/** countable single-layer packing: centre, ring of 6, ring of 12 (caps at 19). */
const ringSlot = (i, r1, r2) => {
  if (i === 0) return [0, 0];
  const inner = i <= 6, j = inner ? i - 1 : i - 7, rr = inner ? r1 : r2;
  const a = (j / (inner ? 6 : 12)) * Math.PI * 2 + (inner ? 0.52 : 0.26);
  return [Math.cos(a) * rr, Math.sin(a) * rr];
};

export default class GatheringFrames {
  /** @param ctx { scene, world, enc, log, PH } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH }) {
    this.log = log; this.PH = PH;
    this.P = world.palette;
    this.C = enc.gatheringFrames;
    this.E = world.entities.find((e) => e.id === 'gathering-frames');
    if (!this.C || !this.E) throw new Error('gathering-frames needs enc.gatheringFrames and the world entity');
    if (this.C.figs > 19) console.warn('[gathering-frames] figs > 19 breaks the countable single layer');

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: this.E.at.x, z: this.E.at.z, reach: this.E.reach ?? 8 };

    this.phase = 'idle'; this.anim = null;
    this.figs = []; this.flights = []; this.wobs = []; this.blooms = [];
    this.tilt = 0; this.beamY = BEAM_REST; this.spin = 0; this.beamTilt = { x: 0, z: 0 };
    this.tries = 0; this.solved = false; this.bruiseK = 0; this.lastAside = null;
    this.viewedAt = 0; this.thinkT0 = 0; this.pulse = 0; this.wfT = 0;

    this._build(scene);

    // Enter in the set-aside field commits — main.js's Enter delegation covers
    // the shared cards only, so the part listens for its own input
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'gfAside') { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ---------- build ----------
  _build(scene) {
    const { P, C, E } = this;
    const r = this.r = rng(2117);
    const g = new THREE.Group();
    g.position.set(E.at.x, 0, E.at.z);
    this.g = g;

    const woodM = mat('#6b5a44'), postM = mat(P.trunk), railM = mat('#5f5040');
    const wickerM = mat(jitter('#8a6d3f', r), { side: THREE.DoubleSide });
    const Cy = (...a) => new THREE.CylinderGeometry(...a);
    const Bx = (...a) => new THREE.BoxGeometry(...a);
    /** shadowed mesh at (x,y,z); shadow=false for glow/thin dressing */
    const M = (geo, material, x, y, z, parent = g, shadow = true) => {
      const o = new THREE.Mesh(geo, material);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = shadow;
      parent.add(o);
      return o;
    };

    // — the press table: low and heavy, bearing the tray
    M(Bx(1.9, 0.08, 1.15), woodM, TX, 0.56, TZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) M(Bx(0.1, 0.52, 0.1), postM, TX + sx * 0.85, 0.26, TZ + sz * 0.47);

    // — the gridded tray: rows × cols hollows, walls visible, generated by the
    //   numbers the tip computes with — never hand-counted
    const ix = C.cols * CELL, iz = C.rows * CELL;
    M(Bx(ix + 0.12, 0.04, iz + 0.12), mat('#75634b'), TX, 0.62, TZ);
    for (let c = 0; c <= C.cols; c++) M(Bx(0.024, 0.1, iz + 0.05), railM, TX - ix / 2 + c * CELL, 0.69, TZ);
    for (let w = 0; w <= C.rows; w++) M(Bx(ix + 0.05, 0.1, 0.024), railM, TX, 0.69, TZ - iz / 2 + w * CELL);

    // — press frame: posts, crossbeam, nut; the beam hangs from its screw
    for (const sx of [-1, 1]) M(Bx(0.15, 2.14, 0.15), postM, TX + sx * 1.35, 1.07, TZ);
    M(Bx(3.1, 0.16, 0.2), woodM, TX, 2.14, TZ);
    M(Bx(0.24, 0.2, 0.24), railM, TX, 2.32, TZ);
    const beamG = new THREE.Group(); beamG.position.set(TX, BEAM_REST, TZ);
    M(Bx(1.06, 0.09, 0.82), mat('#5a4a38'), 0, 0, 0, beamG);
    const spinG = new THREE.Group();
    M(Cy(0.042, 0.042, 1.75, 8), mat('#4a453f', { roughness: 0.55, metalness: 0.3 }), 0, 0.845, 0, spinG);
    M(Bx(0.56, 0.05, 0.05), woodM, 0, 1.66, 0, spinG);
    beamG.add(spinG); g.add(beamG); this.beamG = beamG; this.spinG = spinG;

    // — basket stand, and the basket pivoted at its east rim base so a
    //   negative tilt tips the mouth toward the tray
    M(Cy(0.2, 0.24, 0.08, 8), mat(P.stone), BK.x, 0.04, BK.z);
    M(Cy(0.055, 0.075, 0.66, 7), postM, BK.x, 0.4, BK.z);
    M(Cy(0.33, 0.28, 0.06, 9), woodM, BK.x, 0.72, BK.z);
    const bG = new THREE.Group(); bG.position.set(PIV.x, PIV.y, BK.z);
    M(Cy(0.28, 0.28, 0.03, 10), wickerM, -0.29, -0.005, 0, bG);
    M(Cy(0.33, 0.29, 0.09, 10, 1, true), wickerM, -0.29, 0.055, 0, bG);
    M(new THREE.TorusGeometry(0.315, 0.014, 5, 12), woodM, -0.29, 0.1, 0, bG, false).rotation.x = Math.PI / 2;
    g.add(bG); this.bG = bG;

    // — the setting-aside bowl on its stump, shallow enough to count into
    M(Cy(0.13, 0.17, 0.36, 8), postM, BOWL.x, 0.18, BOWL.z);
    M(Cy(0.19, 0.19, 0.03, 9), mat('#9c7a52'), BOWL.x, 0.385, BOWL.z);
    M(Cy(0.24, 0.19, 0.11, 9, 1, true), mat('#9c7a52', { side: THREE.DoubleSide }), BOWL.x, 0.45, BOWL.z);

    // — the figs: live stock, wine-dark like the tree's own fruit; one
    //   material apiece so a bruise can bloom on it alone. COUNT = enc.figs
    this.figGeo = new THREE.SphereGeometry(FIG_R, 8, 6);
    for (let i = 0; i < C.figs; i++) this._makeFig(i);

    // — lamp under the crossbeam: the counts must be readable in one look
    M(Bx(0.5, 0.05, 0.05), postM, -0.88, 1.9, TZ);
    M(new THREE.SphereGeometry(0.06, 8, 6), mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.3 }), -0.62, 1.83, TZ, g, false);
    const lampL = new THREE.PointLight(new THREE.Color(P.lamp), 0.8, 5.5, 1.8);
    lampL.position.set(-0.6, 1.78, TZ); g.add(lampL);

    this.pulseRing = M(new THREE.TorusGeometry(0.6, 0.045, 6, 24), glow(P.gold, 0), TX, 0.615, TZ, g, false);
    this.pulseRing.rotation.x = Math.PI / 2;

    // the whole yard is one E-target (prompt/label/reach come from the entity)
    g.userData.act = {
      part: 'gathering-frames',
      prompt: E.prompt ?? 'Work the press-yard',                        // PLACEHOLDER (owner-authored, world3.json)
      label: E.label ?? 'The press-yard: baskets, and a gridded tray',  // PLACEHOLDER
      reach: E.reach ?? 8,
    };
    scene.add(g); this.solid.push(g); this.interactables.push(g);

    // fat invisible gaze proxy — standalone, so the label-occlusion pass never
    // sees it; the rim glow lands on the visible rig
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.5, 2.5),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    proxy.position.set(E.at.x + 0.05, 1.25, E.at.z + 0.2);
    proxy.userData.act = g.userData.act; proxy.userData.glowRoot = g;
    scene.add(proxy); this.interactables.push(proxy);

    // colliders: the 2D map — table, press posts, basket stand, bowl stump
    this.colliders.push(
      { type: 'circle', x: E.at.x + TX, z: E.at.z + TZ, r: 1.12 },
      { type: 'circle', x: E.at.x + TX - 1.35, z: E.at.z + TZ, r: 0.16 },
      { type: 'circle', x: E.at.x + TX + 1.35, z: E.at.z + TZ, r: 0.16 },
      { type: 'circle', x: E.at.x + BK.x, z: E.at.z + BK.z, r: 0.34 },
      { type: 'circle', x: E.at.x + BOWL.x, z: E.at.z + BOWL.z, r: 0.18 },
    );
  }

  _makeFig(slot) {
    const [ox, oz] = ringSlot(slot, 0.115, 0.215);
    const m = new THREE.Mesh(this.figGeo,
      mat(jitter('#7d4560', this.r), { emissive: new THREE.Color('#8a4a68'), emissiveIntensity: 0.22 }));
    m.scale.set(0.95, 1.08, 0.95); m.castShadow = true;
    const f = { m, slot, home: { x: BK.x + ox, y: BK.y, z: BK.z + oz }, state: 'basket' };
    m.position.set(f.home.x, f.home.y, f.home.z);
    this.g.add(m); this.figs.push(f);
    return f;
  }

  /** fill order: row by row from the near rail, west to east. */
  _cellPos(i) {
    const c = i % this.C.cols, w = (i / this.C.cols) | 0;
    return { x: TX - (this.C.cols * CELL) / 2 + (c + 0.5) * CELL, y: CELL_Y, z: TZ - (this.C.rows * CELL) / 2 + (w + 0.5) * CELL };
  }

  _stock() { return this.figs.filter((f) => f.state === 'basket').length; }

  _fly(f, to, T, land, arc) {
    const p = f.m.position;
    f.state = 'fly';
    this.flights.push({
      f, t: 0, T, land, ax: p.x, ay: p.y, az: p.z, bx: to.x, by: to.y, bz: to.z,
      cx: (p.x + to.x) / 2, cy: Math.max(p.y, to.y) + arc, cz: (p.z + to.z) / 2,
    });
  }

  // ---------- interaction ----------
  onInteract(act, PH) {
    if (this.phase === 'done') { this._startGather(); return; }   // E again: reset; bruises stay as history
    if (this.phase !== 'idle') return;                            // mid-motion: the yard is answering — watch
    if (!this.viewedAt) {
      this.viewedAt = this.thinkT0 = performance.now();   // think-clock: first read of the yard
      this.log.push('frames.read', { figs: this._stock(), rows: this.C.rows, cols: this.C.cols });
    }
    PH.openPanel('p:gathering-frames');
    document.getElementById('gfAside')?.focus();
  }

  onPanel(ev) {
    if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#gfTip')) this._commit();
  }

  _commit() {
    if (this.phase !== 'idle') return;
    const el = document.getElementById('gfAside');
    if (!el) return;
    const v = Math.round(parseFloat(el.value));
    if (!Number.isFinite(v)) { el.focus(); return; }
    const stock = this._stock(), cells = this.C.rows * this.C.cols;
    const aside = clamp(v, this.C.setAside.min, Math.min(this.C.setAside.max, stock));
    el.value = aside;
    this.lastAside = aside; this.tries++;
    const truth = stock - cells;                       // signed truth, derived NOW (Law 4)
    const over = Math.max(0, stock - aside - cells), holl = Math.max(0, cells - (stock - aside));
    this.log.push('frames.tip', {
      setAside: aside, truth, outcome: over ? 'overflow' : holl ? 'hollows' : 'exact',
      overflow: over, hollows: holl, ms: Math.round(performance.now() - this.thinkT0),
    });
    // the card steps aside at the tip itself — beyond dismissLater, because
    // the whole pour IS the response and it deserves an unobstructed watch
    this.PH.dismissPanel();
    const inBasket = this.figs.filter((f) => f.state === 'basket');
    this.anim = { t: 0, next: 0, over, holl, last: 0, hop: inBasket.slice().sort((a, b) => b.slot - a.slot).slice(0, aside), pour: null };
    this.phase = aside > 0 ? 'aside' : 'lean';
  }

  _startGather() {
    this.phase = 'gather';
    const back = this.figs.filter((f) => f.state === 'cell' || f.state === 'bowl');
    this.anim = { t: 0, k: 0, pend: back, fromY: this.beamY, beamT: this.beamY < BEAM_REST - 0.01 ? 0.7 : 0 };
  }

  _rest() {
    this.phase = 'idle'; this.anim = null;
    this.thinkT0 = performance.now();   // retry think-clock runs from the settle
  }

  /** move the beam; the screw turns by the honest travel */
  _setBeam(v) { this.spin += (this.beamY - v) / PITCH; this.beamY = v; }

  // ---------- per-frame ----------
  update(dt, u) {
    // fig flights: one eased arc each; landings claim their seat
    if (this.flights.length) {
      for (const fl of this.flights) {
        fl.t += dt;
        const s = smooth(clamp(fl.t / fl.T, 0, 1)), q = 1 - s, qq = q * q, qs = 2 * q * s, ss = s * s;
        fl.f.m.position.set(qq * fl.ax + qs * fl.cx + ss * fl.bx, qq * fl.ay + qs * fl.cy + ss * fl.by, qq * fl.az + qs * fl.cz + ss * fl.bz);
        if (fl.t >= fl.T) {
          fl.f.m.position.set(fl.bx, fl.by, fl.bz);
          fl.f.state = fl.land;
          if (fl.land === 'bruised') this.blooms.push({ f: fl.f, t: 0 });                   // the price begins
          else if (fl.land !== 'basket') this.wobs.push({ m: fl.f.m, y0: fl.by, t: 0 });    // knuckle-roll, still
        }
      }
      this.flights = this.flights.filter((fl) => fl.t < fl.T);
    }
    for (const w of this.wobs) { w.t += dt; w.m.position.y = w.y0 + 0.02 * Math.sin(w.t * 24) * Math.exp(-9 * w.t); }
    this.wobs = this.wobs.filter((w) => { if (w.t < 0.5) return true; w.m.position.y = w.y0; return false; });

    // bruises bloom dark and flatten where they lie; they are never cleaned up
    for (const b of this.blooms) {
      b.t += dt;
      const k = smooth(clamp(b.t / 0.8, 0, 1));
      b.f.m.material.color.lerp(BRUISE, Math.min(1, dt * 3));
      b.f.m.material.emissiveIntensity = 0.22 * (1 - k);
      b.f.m.scale.set(0.95 + 0.28 * k, 1.08 - 0.53 * k, 0.95 + 0.28 * k);
      b.f.m.position.y = 0.05 - 0.019 * k;
    }
    this.blooms = this.blooms.filter((b) => b.t < 0.8);

    // the basket eases toward its phase pose; unlaunched figs ride the tilt
    const tiltTarget = this.phase === 'lean' ? LEAN : this.phase === 'pour' ? TIP : 0;
    this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 5.5);
    this.bG.rotation.z = this.tilt;
    const cs = Math.cos(this.tilt), sn = Math.sin(this.tilt);
    for (const f of this.figs) {
      if (f.state !== 'basket') continue;
      const dx = f.home.x - PIV.x, dy = f.home.y - PIV.y;
      f.m.position.set(PIV.x + dx * cs - dy * sn, PIV.y + dx * sn + dy * cs, f.home.z);
    }

    const a = this.anim;
    if (this.phase === 'aside') {
      // the chosen figs hop to the bowl one by one — the set-aside is counted in flight
      a.t += dt;
      while (a.next < a.hop.length && a.t >= a.next * ASIDE_GAP) {
        const [ox, oz] = ringSlot(a.next, 0.11, 0.16);
        this._fly(a.hop[a.next++], { x: BOWL.x + ox, y: BOWL.y, z: BOWL.z + oz }, 0.38, 'bowl', 0.34);
      }
      if (a.next >= a.hop.length && !this.flights.length && a.t >= a.hop.length * ASIDE_GAP + 0.5) { this.phase = 'lean'; a.t = 0; }
    } else if (this.phase === 'lean') {
      // anticipation: a lean away, held a quarter-beat at the lip
      a.t += dt;
      if (a.t >= 0.45) {
        this.phase = 'pour'; a.t = 0; a.next = 0;
        a.pour = this.figs.filter((f) => f.state === 'basket').sort((p, q) => p.slot - q.slot);
      }
    } else if (this.phase === 'pour') {
      // the basket tips; figs stream out one per cell, row by row. The excess
      // is always last out — it crests the east rail and the loss is WATCHED
      a.t += dt;
      const cells = this.C.rows * this.C.cols;
      while (a.next < a.pour.length && a.t >= 0.24 + a.next * POUR_GAP) {
        const i = a.next++;
        if (i < cells) this._fly(a.pour[i], this._cellPos(i), 0.42, 'cell', 0.5);
        else {
          const k = this.bruiseK++;
          this._fly(a.pour[i], { x: 1.82 + (k % 3) * 0.34 + (this.r() - 0.5) * 0.1, y: 0.05, z: -0.45 + ((k / 3) | 0) * 0.36 + (this.r() - 0.5) * 0.1 }, 0.72, 'bruised', 0.6);
        }
        a.last = a.t;
      }
      if (a.next >= a.pour.length && !this.flights.length && a.t >= a.last + 0.55) {
        this.phase = a.holl > 0 ? 'refuse' : 'press';
        a.t = 0; a.logged = false;
        if (a.holl > 0) {   // where the bed is empty — the beam will dip exactly toward it
          let mx = 0, mz = 0;
          for (let i = cells - a.holl; i < cells; i++) { const p = this._cellPos(i); mx += p.x - TX; mz += p.z - TZ; }
          const L = Math.hypot(mx, mz) || 1;
          a.dip = { x: mx / L, z: mz / L };
        }
      }
    } else if (this.phase === 'press') {
      // an even bed: the screw walks the beam down, slow, and it seats
      a.t += dt;
      if (a.t < 2.3) this._setBeam(BEAM_REST + (BEAM_SEAT - BEAM_REST) * smooth(a.t / 2.3));
      else {
        this.beamY = BEAM_SEAT + 0.013 * Math.sin((a.t - 2.3) * 17) * Math.exp(-6 * (a.t - 2.3));
        if (!a.logged) {
          a.logged = true;
          const clean = a.over === 0;
          if (clean) { this.solved = true; this.pulse = 1; }   // the success beat is the world's
          this.log.push('frames.press', { seated: true, bruised: a.over, hollows: 0, tries: this.tries,
            ...(clean ? { totalMs: Math.round(performance.now() - this.viewedAt) } : {}) });
        }
        if (a.t >= 2.9) { this.beamY = BEAM_SEAT; this.phase = 'done'; this.anim = null; }
      }
    } else if (this.phase === 'refuse') {
      // hollows in the bed: the beam comes down, meets fruit unevenly, dips
      // into the empty side, shudders, lifts back. The hollows ARE the error
      a.t += dt;
      if (a.t < 1.3) this._setBeam(BEAM_REST + (BEAM_TOUCH - BEAM_REST) * smooth(a.t / 1.3));
      else if (a.t < 2.2) {
        const k = smooth(clamp((a.t - 1.3) / 0.5, 0, 1));
        const sh = 0.008 * Math.sin(a.t * 46) * Math.max(0, 1 - (a.t - 1.3) / 0.7);
        this.beamTilt.x = 0.055 * k * a.dip.z + sh; this.beamTilt.z = -0.055 * k * a.dip.x + sh * 0.7;
        this.beamY = BEAM_TOUCH - 0.02 * k;
        if (!a.logged && a.t >= 1.8) {
          a.logged = true;
          this.log.push('frames.press', { seated: false, bruised: 0, hollows: a.holl, tries: this.tries });
        }
      } else {
        const k = smooth(clamp((a.t - 2.2) / 1.1, 0, 1));
        this.beamTilt.x = 0.055 * (1 - k) * a.dip.z; this.beamTilt.z = -0.055 * (1 - k) * a.dip.x;
        this._setBeam(BEAM_TOUCH - 0.02 + (BEAM_REST - BEAM_TOUCH + 0.02) * k);
        if (a.t >= 3.3) { this.beamTilt.x = this.beamTilt.z = 0; this.beamY = BEAM_REST; this.phase = 'done'; this.anim = null; }
      }
    } else if (this.phase === 'gather') {
      // reset, watched: beam up if it was down, then everything unbruised
      // flies home — quick, still one by one. Bruises lie where they fell
      a.t += dt;
      if (a.beamT) this._setBeam(a.fromY + (BEAM_REST - a.fromY) * smooth(clamp(a.t / a.beamT, 0, 1)));
      while (a.pend.length && a.t >= a.beamT + a.k * 0.05) { a.k++; const f = a.pend.shift(); this._fly(f, f.home, 0.36, 'basket', 0.45); }
      if (!a.pend.length && !this.flights.length && a.t >= a.beamT + 0.4) this._rest();
    }

    this.beamG.position.y = this.beamY;
    this.beamG.rotation.x = this.beamTilt.x; this.beamG.rotation.z = this.beamTilt.z;
    this.spinG.rotation.y = this.spin;

    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 1.1);   // one soft gold breath around the tray
      this.pulseRing.material.opacity = this.pulse * 0.7;
      const k = 1 + (1 - this.pulse) * 0.05;
      this.pulseRing.scale.set(k, k, 1);
    }

    // the wind's work: while short of the authored stock, one windfall fig per
    // interval, materialized only while nobody is near enough to watch fruit
    // appear — leaving and returning changes only what the wind has done
    if (this.phase === 'idle' || this.phase === 'done') {
      const active = this.figs.filter((f) => f.state !== 'bruised');
      if (active.length < this.C.figs) {
        this.wfT = Math.min(WF_S, this.wfT + dt);
        const p = u && u.controls && u.controls.pos;
        if (this.wfT >= WF_S && p && Math.hypot(p.x - this.E.at.x, p.z - this.E.at.z) > WF_FAR) {
          const used = new Set(active.map((f) => f.slot));
          let s = 0; while (used.has(s)) s++;
          this._makeFig(s); this.wfT = 0;
        }
      } else this.wfT = 0;
    }
  }

  // ---------- chips ----------
  labels(L, architectOn) {
    // chip-free ideal, honored: no player-facing chip, ever. Architect view
    // alone hangs the live derivation, counted over the fruit still in play
    if (!architectOn) return;
    const stock = this.figs.filter((f) => f.state !== 'bruised').length;
    const cells = this.C.rows * this.C.cols;
    L.set('gf-arch', {
      tex: `${stock} - ${this.C.rows} \\cdot ${this.C.cols} = ${stock - cells}`,
      x: this.E.at.x + TX, y: 3.75, z: this.E.at.z + TZ, kind: 'architect', dy: 0,
    });
  }

  // ---------- card ----------
  // PLACEHOLDER strings throughout (owner-authored voice, Law 2). No count
  // appears here as a numeral — figs and hollows are counted by LOOKING (the
  // chip-free ideal, kept); the card exists only to take the set-aside.
  panel(st) {
    const C = this.C;
    const lede = this.solved
      ? 'The beam has sat flush once already. The yard keeps what it is given.'
      : 'The press takes an even bed — one fig to a hollow, none over, none short.';
    return `
      <h2>The gathering frames</h2>
      <p class="lede">${lede}</p>
      <p>${C.ask}</p>
      <div class="gate-in">
        <input type="number" id="gfAside" min="${C.setAside.min}" max="${C.setAside.max}" step="1" value="${this.lastAside ?? ''}" placeholder="figs">
        <button class="btn primary" id="gfTip">Set them aside, and tip</button>
      </div>
      <p class="muted tiny">The figs in the basket and the hollows in the tray are there to be counted before anything tips.</p>
      ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${C.architect.depth}. truth = stock − rows·cols, derived at tip time; bruises or hollows = |setAside − truth|, exactly; the beam seats iff no hollow remains. Nothing scripted.</p></div>` : ''}`;
  }
}
