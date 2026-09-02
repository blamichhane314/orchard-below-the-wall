// milllaunder.js — the Mill Launder, the mill yard's first working object.
// Core rung of design/parts/mid-mill-launder.md: set six collars to the carved
// linear rule y = a0 + a1·x, then pull the sluice; a charge of water runs the
// channel span by span and STOPS beside the first wrong post. The water's
// stopping point is the whole verdict — no post is ever named in text (Law 3).
//
// PERCEPTUAL CONTRACT (Law 4): post targets, the tank outlet's height (one
// honest step above post 0), the trough's carved demand, the post numerals and
// every tick a collar can be counted against are ALL generated from
// enc.millLaunder — a0, a1, posts, collar.min/max — the same numbers the flow
// computation reads at pull time. Nothing is stored; the data is the rule.
//
// Deviations from the design doc (per build brief): the dual typed/nudged grip
// idiom is simplified to a per-post card (one number input, Set); no water
// wheel — success fills a waiting trough instead; no trial cup; spans are
// pre-hung and ride their collars; cistern refill shortened to ~2.4 s (the
// walk back is short here); collars lock only while water is live or once the
// launder runs for good (the solved state persists).

import * as THREE from '../../vendor/three/three.module.js';

const mat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, metalness: 0, ...o });
const glow = (c, op = 0.9) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
const bg = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cg = (r0, r1, h, s = 9) => new THREE.CylinderGeometry(r0, r1, h, s);
const put = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
};
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => performance.now();

// siting (metres, world frame): the launder runs west→east along z = LZ,
// tank and headstone at the west end, trough at the east. One collar unit
// = SCALE metres of height, so the correct launder descends in even,
// countable steps. Tick 0 is the plinth line at each post's base.
const SCALE = 0.18, PL = 0.05, LZ = 4.2;
const X0 = 52.55, DX = 0.8;              // post 0 x, post pitch
const OUT_X = X0 - DX;                   // tank outlet joint: one span west of post 0
const TX = 51.3, HX = 51.3, HZ = 3.35;   // tank centre; headstone
const TRX = X0 + 5 * DX + 0.65;          // trough centre (east of the last post)
const WOOD = '#6b5a44', WOOD2 = '#5f5040', IRON = '#4a453f';
const WBED = '#20302c', WFILM = '#2c4440', WGLOW = '#16282a';   // the race's water language

export default class MillLaunder {
  /** @param ctx { scene, world, enc, log, PH } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH }) {
    this.log = log; this.PH = PH; this.P = world.palette;
    this.C = enc.millLaunder;
    this.E = world.entities.find((e) => e.id === 'mill-launder');
    if (!this.C || !this.E) throw new Error('mill-launder needs enc.millLaunder and the world entity');
    this.N = this.C.posts;

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: (OUT_X + TRX) / 2, z: LZ, reach: this.E.reach ?? 8 };

    // collars start slipped: derived scatter, guaranteed wrong at every post
    // (offset 5+3i is never ≡ 0 mod the tick count) — never a stored layout
    const M = this.C.collar.max - this.C.collar.min + 1;
    this.set = []; this.units = [];
    for (let i = 0; i < this.N; i++) {
      const s = this.C.collar.min + ((this._tgt(i) - this.C.collar.min + 5 + 3 * i) % M);
      this.set.push(s); this.units.push(s);
    }

    this.phase = 'idle'; this.t = 0; this.run = null; this.sp = null;
    this.cAnims = new Map();               // post -> collar slide in progress
    this.fill = new Array(this.N + 1).fill(0);   // per-span wet fraction (+ spout)
    this.gauge = 1; this.gateK = 0;
    this.focusPost = null; this.cardT0 = 0;
    this.readAt = 0; this.charges = 0; this.done = false; this.pulse = 0;
    this.patchA = 0; this.patchS = 0; this.fx = []; this.tt = 0;
    this.J = [];                            // live joint points, west→east

    this._build(scene);
    this._layout();

    // Enter in the collar field commits (main.js's Enter delegation covers the
    // shared cards only, not part panels)
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'mlVal') { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  _px(i) { return X0 + i * DX; }
  /** what post i wants — derived every time it is asked, stored nowhere */
  _tgt(i) { return this.C.a0 + this.C.a1 * i; }

  // ---------- build ----------
  _build(scene) {
    const { P, C } = this;
    const g = new THREE.Group(); this.g = g;
    const stoneM = mat(P.stone), stoneL = mat(P.stoneLit), woodM = mat(WOOD), wood2M = mat(WOOD2);
    const filmM = mat(WFILM, { flatShading: false, emissive: new THREE.Color(WGLOW), emissiveIntensity: 0.55 });

    // — flume from the race's direction (visual rhyme with its curbed channel:
    //   same dark bed, same glinting film; the spring arrives already gathered)
    {
      const A = { x: 49.1, y: 2.96, z: 5.85 }, B = { x: TX, y: 2.87, z: 4.62 };
      const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz);
      const fg = new THREE.Group();
      fg.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      fg.rotation.set(0, Math.atan2(-dz, dx), (B.y - A.y) / len);
      put(fg, bg(len, 0.06, 0.34), mat(WBED), 0, 0, 0);
      for (const s of [-1, 1]) put(fg, bg(len, 0.14, 0.03), stoneM, 0, 0.07, s * 0.155);
      put(fg, bg(len - 0.06, 0.02, 0.24), filmM, 0, 0.055, 0);
      g.add(fg);
      for (const f of [0.3, 0.72]) {
        const tx = A.x + dx * f, tz = A.z + dz * f;
        put(g, bg(0.12, 2.86, 0.12), wood2M, tx, 1.43, tz);
        this.colliders.push({ type: 'circle', x: tx, z: tz, r: 0.12 });
      }
    }

    // — the holding tank on its legs, gauge slot, spout, sluice gate + lever
    const tkg = new THREE.Group(); this.tankG = tkg;
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      put(tkg, bg(0.1, 2.0, 0.1), wood2M, TX + lx, 1.0, LZ + lz);
    }
    put(tkg, bg(0.82, 0.88, 0.82), woodM, TX, 2.44, LZ);
    put(tkg, bg(0.9, 0.06, 0.9), wood2M, TX, 2.9, LZ);
    put(tkg, bg(0.08, 0.86, 0.03), mat('#3a352c'), TX, 2.44, LZ - 0.42);   // gauge slot
    this.gaugeM = put(tkg, bg(0.05, 1, 0.02), glow('#7fc0b2', 0.9), TX, 2.44, LZ - 0.46);
    // spout stub carrying the outlet joint — its lip is one honest step above
    // post 0: (a0 − a1)·SCALE, derived from the same rule the posts obey
    const outY = PL + (C.a0 - C.a1) * SCALE;
    put(tkg, bg(0.42, 0.06, 0.3), mat(WBED), TX + 0.55, outY - 0.03, LZ);
    for (const s of [-1, 1]) put(tkg, bg(0.42, 0.12, 0.03), woodM, TX + 0.55, outY + 0.02, LZ + s * 0.14);
    this.gate = put(tkg, bg(0.05, 0.34, 0.32), mat(IRON, { roughness: 0.6, metalness: 0.25 }), TX + 0.44, outY + 0.05, LZ);
    this.lever = put(tkg, bg(0.05, 0.62, 0.05), wood2M, TX + 0.44, 3.02, LZ, 0, 0, 0.5);
    g.add(tkg);
    this.colliders.push({ type: 'aabb', minX: TX - 0.42, maxX: TX + 0.42, minZ: LZ - 0.42, maxZ: LZ + 0.42 });

    // — the headstone: the rule rides it as a chip; the stone just stands
    put(g, bg(0.8, 0.26, 0.5), stoneM, HX, 0.13, HZ);
    put(g, bg(0.6, 1.28, 0.2), stoneL, HX, 0.86, HZ, -0.07);
    this.colliders.push({ type: 'aabb', minX: HX - 0.4, maxX: HX + 0.4, minZ: HZ - 0.28, maxZ: HZ + 0.28 });

    // — posts, ticks, collars. Ticks run collar.min..max at SCALE pitch, every
    //   fifth cut wider — the count IS the carving, one per settable value
    const postH = PL + C.collar.max * SCALE + 0.22;
    const tickM = mat(P.vellum), tickWide = mat(P.parchment);
    const collarM = mat(IRON, { roughness: 0.55, metalness: 0.3 });
    const lipM = mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.4 });
    this.postG = []; this.collarG = []; this.flash = [];
    for (let i = 0; i < this.N; i++) {
      const px = this._px(i);
      const pg = new THREE.Group();
      put(pg, bg(0.3, PL, 0.3), stoneM, px, PL / 2, LZ);                       // plinth: tick 0's line
      put(pg, bg(0.13, postH, 0.13), wood2M, px, PL + postH / 2, LZ);
      for (let k = C.collar.min; k <= C.collar.max; k++) {
        const wide = k % 5 === 0;
        put(pg, bg(wide ? 0.2 : 0.13, 0.016, 0.03), wide ? tickWide : tickM, px, PL + k * SCALE, LZ - 0.075);
      }
      const cgp = new THREE.Group();                                           // the collar: lip at its number
      put(cgp, bg(0.22, 0.2, 0.22), collarM, 0, -0.1, 0);
      put(cgp, bg(0.27, 0.028, 0.27), lipM, 0, -0.014, 0);
      cgp.position.set(px, PL + this.units[i] * SCALE, LZ);
      pg.add(cgp); this.collarG.push(cgp);
      const fl = put(pg, bg(0.34, 0.03, 0.03), glow(P.gold, 0), px, PL, LZ - 0.09);   // tick flash bar
      fl.castShadow = fl.receiveShadow = false;
      this.flash.push({ m: fl, a: 0 });
      g.add(pg); this.postG.push(pg);
      this.colliders.push({ type: 'circle', x: px, z: LZ, r: 0.15 });
    }

    // — spans: unit-length channel sections re-stretched between live joints
    //   every frame (index N is the fixed spout stub past the last post)
    this.stripM = mat(WFILM, { flatShading: false, emissive: new THREE.Color(WGLOW), emissiveIntensity: 0.55 });
    this.spanG = []; this.strips = [];
    for (let i = 0; i <= this.N; i++) {
      const sg = new THREE.Group();
      put(sg, bg(1, 0.05, 0.34), woodM, 0, 0.025, 0);
      for (const s of [-1, 1]) put(sg, bg(1, 0.13, 0.028), wood2M, 0, 0.085, s * 0.155);
      const strip = put(sg, bg(1, 0.028, 0.26), this.stripM, 0, 0.068, 0);
      strip.castShadow = strip.receiveShadow = false;
      this.strips.push(strip);
      sg.position.z = LZ;
      g.add(sg); this.spanG.push(sg);
      if (i < this.N) {
        // body-height spans block the walk; overhead ones are walked under
        const xa = i === 0 ? OUT_X : this._px(i - 1), xb = this._px(i);
        this.colliders.push({
          type: 'aabb', minX: xa, maxX: xb, minZ: LZ - 0.2, maxZ: LZ + 0.2,
          active: () => Math.min(this.J[i].y, this.J[i + 1].y) < 1.5,
        });
      }
    }

    // — the slug: the charge's bright leading water, riding the live span
    this.slug = put(g, bg(0.34, 0.05, 0.24), glow('#bfe4da', 0.95), 0, -2, LZ);
    this.slug.castShadow = this.slug.receiveShadow = false;
    this.slug.visible = false;

    // — trough at the east end, waiting dry: an open stone mouth (no caps —
    //   the rising water must be seen from the rim)
    put(g, new THREE.CylinderGeometry(0.5, 0.56, 0.34, 12, 1, true), mat(P.stone, { side: THREE.DoubleSide }), TRX, 0.17, LZ);
    put(g, new THREE.TorusGeometry(0.52, 0.05, 6, 16), stoneL, TRX, 0.34, LZ, Math.PI / 2);
    put(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12, 1, true), mat('#2f2a22', { side: THREE.DoubleSide }), TRX, 0.18, LZ);
    this.troughW = put(g, cg(0.41, 0.41, 0.03, 12), filmM, TRX, 0.07, LZ);
    this.troughW.castShadow = this.troughW.receiveShadow = false;
    this.pulseRing = put(g, new THREE.TorusGeometry(0.52, 0.045, 6, 20), glow(P.gold, 0), TRX, 0.36, LZ, Math.PI / 2);
    this.pulseRing.castShadow = this.pulseRing.receiveShadow = false;
    this.colliders.push({ type: 'circle', x: TRX, z: LZ, r: 0.54 });

    // — spill kit: falling stream, ground patch, splash rings (fx)
    this.spillS = put(g, bg(0.07, 1, 0.07), glow('#a9d6cb', 0.85), 0, -2, 0);
    this.pourS = put(g, bg(0.06, 1, 0.06), glow('#a9d6cb', 0.85), 0, -2, 0);
    this.patch = put(g, new THREE.CircleGeometry(0.55, 14), glow('#1e2c26', 0), 0, 0.02, 0, -Math.PI / 2);
    for (const m of [this.spillS, this.pourS, this.patch]) { m.castShadow = m.receiveShadow = false; m.visible = false; }

    scene.add(g);
    this.solid.push(g);

    // — fat gaze proxies, standalone so the label-occlusion pass never sees
    //   them; the rim outline lands on the visible rig via glowRoot.
    //   PLACEHOLDER prompt/label strings throughout — owner authors.
    const proxy = (w, h, d, x, y, z, act, root) => {
      const m = new THREE.Mesh(bg(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(x, y, z);
      m.userData.act = { part: 'mill-launder', ...act };
      m.userData.glowRoot = root;
      scene.add(m); this.interactables.push(m);
    };
    for (let i = 0; i < this.N; i++) {
      proxy(0.62, 2.7, 1.0, this._px(i), 1.35, LZ,
        { post: i, prompt: 'Set the collar', label: 'A slipped collar on its ticks', reach: 7 }, this.postG[i]);
    }
    proxy(1.3, 3.1, 1.3, TX, 1.55, LZ,
      { sluice: true, prompt: 'Pull the sluice', label: 'The sluice, and a charge of water', reach: 7.5 }, this.tankG);
  }

  // ---------- geometry follows the numbers, every frame ----------
  _layout() {
    const J = this.J;
    J[0] = { x: OUT_X, y: PL + (this.C.a0 - this.C.a1) * SCALE };   // the outlet keeps the rule's own step
    for (let i = 0; i < this.N; i++) J[i + 1] = { x: this._px(i), y: PL + this.units[i] * SCALE };
    J[this.N + 1] = { x: J[this.N].x + 0.5, y: J[this.N].y - 0.1 };  // spout tip over the trough
    for (let i = 0; i <= this.N; i++) {
      const A = J[i], B = J[i + 1], sg = this.spanG[i];
      sg.position.x = (A.x + B.x) / 2; sg.position.y = (A.y + B.y) / 2;
      sg.rotation.z = Math.atan2(B.y - A.y, B.x - A.x);
      sg.scale.x = Math.hypot(B.x - A.x, B.y - A.y);
      const f = Math.max(this.fill[i], 1e-4);
      this.strips[i].scale.x = f;
      this.strips[i].position.x = f / 2 - 0.5;       // water advances from the west end
    }
    for (let i = 0; i < this.N; i++) this.collarG[i].position.y = PL + this.units[i] * SCALE;
  }

  // ---------- interaction ----------
  onInteract(act, PH) {
    if (act.post !== undefined) {
      // collars stay editable between charges (and while the tank refills);
      // they lock while water is live and once the launder runs for good
      if (this.phase !== 'idle' && this.phase !== 'refill') return;
      this.focusPost = act.post;
      this.cardT0 = now();
      PH.openPanel('p:mill-launder');
      const el = document.getElementById('mlVal');
      if (el) { el.focus(); el.select(); }
      return;
    }
    if (act.sluice) {
      if (this.phase !== 'idle' || this.cAnims.size || this.gauge < 0.99) return;   // mid-slide or dry: no charge
      this._pull();
    }
  }

  onPanel(ev) {
    if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#mlSet')) this._commit();
  }

  _commit() {
    const i = this.focusPost;
    if (i === null || (this.phase !== 'idle' && this.phase !== 'refill')) return;
    const el = document.getElementById('mlVal');
    if (!el) return;
    const v = Math.round(parseFloat(el.value));
    if (!Number.isFinite(v)) { el.focus(); return; }
    const to = clamp(v, this.C.collar.min, this.C.collar.max);
    el.value = to; el.blur();
    const from = this.set[i];
    this.set[i] = to;
    this.log.push('launder.collar', { post: i, set: to, ms: Math.round(now() - this.cardT0) });
    // eased ride, longer for a longer travel; ticks flash as the lip passes
    this.cAnims.set(i, { from, to, t: 0, T: 0.3 + 0.055 * Math.abs(to - from), prev: from });
    this.PH.dismissLater('p:mill-launder', 200);     // step aside; watch the collar ride
  }

  _pull() {
    this.charges++;
    const settings = this.set.slice();
    // the verdict, computed at pull time from the same numbers the collars
    // stand at: the first post whose collar misses the rule stops the water
    let stop = 'end';
    for (let i = 0; i < this.N; i++) if (settings[i] !== this._tgt(i)) { stop = i; break; }
    // per-span crossing time from the TRUE live drop — steeper falls run faster
    const T = [];
    for (let i = 0; i <= this.N; i++) {
      const drop = this.J[i].y - this.J[i + 1].y;
      const v = clamp(2.3 * Math.sqrt(Math.max(drop, 0)), 0.55, 3.4);
      T.push(Math.hypot(this.J[i + 1].x - this.J[i].x, drop) / v);
    }
    this.run = { k: 0, t: 0, T, stop, settings, t0: now() };
    this.phase = 'pull'; this.t = 0;
  }

  _halt(kind, at) {
    this.log.push('launder.charge', {
      stoppedAt: at, settings: this.run.settings, ms: Math.round(now() - this.run.t0),
    });
    if (kind === 'spill') {
      if (this.patchA > 0) {                          // an older stain still drying: it stays, and dries
        const old = new THREE.Mesh(this.patch.geometry, glow('#1e2c26', this.patchA));
        old.rotation.x = -Math.PI / 2;
        old.position.copy(this.patch.position); old.scale.copy(this.patch.scale);
        const a0 = this.patchA;
        this._fxAdd(old, a0 / 0.05, (m, k) => { m.material.opacity = a0 * (1 - k); });
      }
      this.sp = { x: this.J[at + 1].x, y: this.J[at + 1].y };
      this.patch.position.set(this.sp.x + 0.08, 0.02, LZ - 0.34);
      this.patch.visible = true; this.patchA = 0; this.patchS = 0.1;
      this.phase = 'spill'; this.t = 0;
    } else {
      this.phase = 'pour'; this.t = 0;
    }
  }

  _fxAdd(mesh, life, tick) { this.g.add(mesh); this.fx.push({ m: mesh, t: 0, life, tick }); }

  _splashRing(x, z) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.17, 16), glow('#cfe6df', 0.7));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, z);
    this._fxAdd(r, 0.55, (m, k) => { m.scale.setScalar(1 + 3.4 * k); m.material.opacity = 0.7 * (1 - k); });
  }

  // ---------- per-frame ----------
  update(dt, u) {
    this.tt += dt;
    if (!this.readAt && u) {
      const dx = u.controls.pos.x - this.panelAnchor.x, dz = u.controls.pos.z - LZ;
      if (dx * dx + dz * dz < 169) {                  // first sight of the yard starts the clock
        this.readAt = now();
        this.log.push('launder.read', { rule: this.C.ruleTex });
      }
    }

    // collar rides: eased slide, a flash at every tick the lip passes, then a
    // wooden knock at the seat and a damped settle — never a teleport
    for (const [i, a] of this.cAnims) {
      a.t += dt;
      const k = Math.min(1, a.t / a.T);
      let v = a.from + (a.to - a.from) * smooth(k);
      if (k < 1) {
        const lo = Math.min(a.prev, v), hi = Math.max(a.prev, v);
        for (let tk = Math.ceil(lo); tk <= Math.floor(hi); tk++) {
          if (tk === a.from || tk === a.to) continue; // departure is no click; arrival is the knock
          const f = this.flash[i];
          f.a = 1; f.m.position.y = PL + tk * SCALE;  // the passed tick flashes — the click, seen
        }
        a.prev = v;
      } else {
        const s = a.t - a.T;
        if (!a.knocked) {                             // the knock: the seated tick lights once
          a.knocked = true;
          const f = this.flash[i];
          f.a = 1; f.m.position.y = PL + a.to * SCALE;
        }
        v = a.to + 0.09 * Math.sin(s * 19) * Math.exp(-9 * s);
        if (s >= 0.4) { this.units[i] = a.to; this.cAnims.delete(i); continue; }
      }
      this.units[i] = v;
    }
    for (const f of this.flash) {
      if (f.a <= 0) continue;
      f.a = Math.max(0, f.a - dt * 3.2);
      f.m.material.opacity = f.a * 0.9;
    }

    this._layout();

    // transient fx
    for (const f of this.fx) { f.t += dt; f.t >= f.life ? this.g.remove(f.m) : f.tick(f.m, f.t / f.life); }
    this.fx = this.fx.filter((f) => f.t < f.life);

    const R = this.run;
    if (this.phase === 'pull') {                      // anticipation: gate up, lever over, a beat
      this.t += dt;
      this.gateK = smooth(Math.min(1, this.t / 0.45));
      if (this.t >= 0.72) { this.phase = 'charge'; this.t = 0; this.slug.visible = true; }
    } else if (this.phase === 'charge') {
      R.t += dt;
      const f = Math.min(1, R.t / R.T[R.k]);
      this.fill[R.k] = f;
      const A = this.J[R.k], B = this.J[R.k + 1];
      this.slug.position.set(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f + 0.085, LZ);
      this.slug.rotation.z = this.spanG[R.k].rotation.z;
      R.rip = Math.max(0, (R.rip ?? 0) - dt * 5);     // the lip-ripple at an honest joint, decaying
      this.slug.scale.y = 1 + 0.9 * R.rip;
      this.gauge = Math.max(0.12, this.gauge - dt * 0.22);
      if (f >= 1) {
        if (R.k === R.stop) { this.slug.visible = false; this._halt('spill', R.k); }
        else if (R.k === this.N) { this.slug.visible = false; this._halt('pour', 'end'); }
        else { R.k++; R.t = 0; R.rip = 1; }           // on it goes
      }
    } else if (this.phase === 'spill') {
      // the water leaves the channel beside the guilty post: a falling stream,
      // a blooming dark patch, splash rings — then quiet. No words, ever.
      this.t += dt;
      const h = this.sp.y * smooth(Math.min(1, this.t / 0.3));
      this.spillS.visible = true;
      this.spillS.scale.y = Math.max(h, 0.01);
      this.spillS.position.set(this.sp.x + 0.08, this.sp.y - h / 2, LZ - 0.26);
      this.patchA = Math.min(0.8, this.patchA + dt * 0.9);
      this.patchS = Math.min(1, this.patchS + dt * 0.55);
      if ((this.t > 0.32 && this.t - dt <= 0.32) || (this.t > 0.95 && this.t - dt <= 0.95)) {
        this._splashRing(this.sp.x + 0.08, LZ - 0.34);
      }
      this.gauge = Math.max(0.12, this.gauge - dt * 0.22);
      if (this.t >= 2.0) { this.phase = 'drain'; this.t = 0; }
    } else if (this.phase === 'drain') {              // the launder empties; collars keep their word
      this.t += dt;
      const k = 1 - smooth(Math.min(1, this.t / 0.9));
      for (let i = 0; i <= this.N; i++) if (this.fill[i] > 0) this.fill[i] = Math.min(this.fill[i], k);
      const h = this.sp.y * k;
      this.spillS.scale.y = Math.max(h, 0.01);
      this.spillS.position.y = h / 2;
      if (this.t >= 0.9) { this.spillS.visible = false; this.phase = 'refill'; this.t = 0; }
    } else if (this.phase === 'refill') {             // the spring regathers, watched on the gauge
      this.t += dt;
      this.gauge = Math.min(1, this.gauge + dt / 2.4);
      this.gateK = Math.max(0, this.gateK - dt * 2.2);
      if (this.gauge >= 1) { this.phase = 'idle'; this.run = null; }
    } else if (this.phase === 'pour') {               // every collar held: the trough takes the charge
      this.t += dt;
      const tipX = this.J[this.N + 1].x + 0.04, tipY = this.J[this.N + 1].y;
      const wy = 0.07 + 0.19 * smooth(Math.min(1, this.t / 2.2));
      this.troughW.position.y = wy;
      this.pourS.visible = true;
      const h = Math.max(0.02, tipY - wy);
      this.pourS.scale.y = h;
      this.pourS.position.set(tipX, wy + h / 2, LZ);
      if (this.t > 0.25 && this.t - dt <= 0.25) this._splashRing(TRX, LZ);
      if (this.t >= 2.2 && !this.done) {
        this.done = true;
        this.log.push('launder.done', { charges: this.charges, totalMs: Math.round(now() - this.readAt) });
        this.phase = 'done';                          // the launder stays wet, the trough stays full
        this.pulse = 1;
      }
    } else if (this.phase === 'done') {
      // the standing solved-state: a walkable staircase of running water —
      // the spring keeps the gauge full, the strips shimmer, the pour holds
      this.gauge = Math.min(1, this.gauge + dt * 0.5);
      this.stripM.emissiveIntensity = 0.55 + 0.12 * Math.sin(this.tt * 2.6);
    }

    if (this.pulse > 0) {                             // one gold breath on the trough rim
      this.pulse = Math.max(0, this.pulse - dt * 0.9);
      this.pulseRing.material.opacity = this.pulse * 0.65;
      const s = 1 + (1 - this.pulse) * 0.12;
      this.pulseRing.scale.set(s, s, 1);
    }

    // patch dries slowly — failure priced in time, never erased instantly
    if (this.patchA > 0 && this.phase !== 'spill') {
      this.patchA = Math.max(0, this.patchA - dt * 0.05);
      if (this.patchA === 0) this.patch.visible = false;
    }
    if (this.patch.visible) {
      this.patch.material.opacity = this.patchA;
      this.patch.scale.setScalar(Math.max(this.patchS, 0.01));
    }

    // gauge column (bottom-anchored), gate plate, lever
    this.gaugeM.scale.y = Math.max(this.gauge * 0.82, 0.01);
    this.gaugeM.position.y = 2.02 + (this.gauge * 0.82) / 2;
    this.gate.position.y = PL + (this.C.a0 - this.C.a1) * SCALE + 0.05 + 0.24 * this.gateK;
    this.lever.rotation.z = 0.5 - 1.0 * this.gateK;
  }

  // ---------- chips: the stone speaks, the posts are bound to its x ----------
  labels(L, architectOn) {
    L.set('ml-rule', { tex: this.C.ruleTex, x: HX, y: 1.92, z: HZ, kind: 'rule', dy: 0 });
    const topY = PL + this.C.collar.max * SCALE + 0.22;
    for (let i = 0; i < this.N; i++) {
      L.set('ml-x' + i, { tex: `x = ${i}`, x: this._px(i), y: topY + 0.4, z: LZ, kind: 'plain', dy: 0 });
    }
    // the trough carries its demand — the rule evaluated at the last post,
    // derived from the same coefficients, so the world cannot disagree
    L.set('ml-y', { tex: `y = ${this._tgt(this.N - 1)}`, x: TRX, y: 0.95, z: LZ, kind: 'plain', dy: 0 });
    if (architectOn && this.C.architect) {
      L.set('ml-arch', {
        tex: `\\texttt{${this.C.architect.concept.replace(/ /g, '\\ ')}}`,
        x: (OUT_X + TRX) / 2, y: 3.6, z: LZ, kind: 'architect', dy: 0,
      });
    }
  }

  // ---------- the per-post card: an index chip, one number, Set ----------
  // PLACEHOLDER strings (owner-authored voice, Law 2); the chip is BUILT from
  // the post's index at render time, never typed as a literal.
  panel() {
    const i = this.focusPost;
    if (i === null) return '';
    const K = this.PH.K;
    return `
      <h2>The launder post</h2>
      <div class="eq">${K(`x = ${i}`, true)}</div>
      <div class="gate-in">
        <input type="number" id="mlVal" min="${this.C.collar.min}" max="${this.C.collar.max}" step="1" value="${this.set[i]}">
        <button class="btn primary" id="mlSet">Seat the collar</button>
      </div>
      <p class="muted tiny">The collar's height on the carved ticks is its number.</p>`;
  }
}
