// The Ways — trailhead + three way-worlds (design/BRAID_TRAIL_DESIGN.md as
// amended: each way is its own visual world; only the chosen path is ever in
// view; wrong ways lead home to the trailhead — a=1 factoring is assumed known
// and appears only as revision; the true way ends by SOLVING, which passes
// the level). Cards use plain math-instruction register; the original problem
// is shown with every step, on cards and on world chips both.
import * as THREE from '../../vendor/three/three.module.js';
import { SHIFTS } from '../buildwood.js';

const WAYS = {
  'ignores-a': { off: 0,    P: 6,  S: 7, pocket: 'birch' },
  'swap':      { off: -300, P: 7,  S: 6, pocket: 'pine' },
  'true':      { off: 300,  P: 12, S: 7, pocket: 'rise' },
};
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), flatShading: true, roughness: 1, ...o });
const INVIS = new THREE.MeshBasicMaterial({ visible: false });

export default class WoodWay {
  constructor(ctx) {
    this.ctx = ctx; this.enc = ctx.enc; this.log = ctx.log; this.PH = ctx.PH; this.game = ctx.game;
    this.C = ctx.enc.way;
    this.colliders = []; this.solid = []; this.interactables = [];
    this.time = 0; this.state = 'hub'; this.way = null; this.nth = 0; this.choiceT0 = 0;
    this.carried = null; this.sigmaShown = false; this.swapTries = 0;
    this.parcelTries = 0; this.parcelDead = false; this._slide = -1;
    this.merged = false; this._merge = -1;
    this.probeDone = false; this.probeTried = 0; this.drill = -1; this.drillDone = [false, false];
    this.pdrill = [false, false]; this.pineRepaired = false;
    this.connected = false; this.passed = false; this.lastClaim = null;
    this.card = null; this.tag = null; this._zoneLast = {}; this.pulses = [];
    this._fold = -1;
    // the training grove: items, their pairs (derived, never stored), progress
    this.TR = (ctx.enc.training && ctx.enc.training.items) || [];
    this.trPair = this.TR.map((d) => { for (let p = 1; p <= d.c; p++) if (d.c % p === 0 && p + d.c / p === d.b) return [p, d.c / p]; return null; });
    this.tSolved = this.TR.map(() => false); this.tTries = this.TR.map(() => 0);
    this._derive();
    this._build(ctx.scene);
  }

  // factors and roots of ax^2+bx+c, found at runtime, never stored
  _derive() {
    const { a, b, c } = this.C.item;
    outer: for (let A = 1; A <= a; A++) {
      if (a % A) continue;
      const Cc = a / A;
      for (let B = -12; B <= 12; B++) {
        if (!B || c % B) continue;
        const D = c / B;
        if (A * D + B * Cc === b) { this.factors = [[A, B], [Cc, D]]; break outer; }
      }
    }
    const [[A, B], [Cc, D]] = this.factors;
    this.roots = [-B / A, -D / Cc];
    const f = ([m, k]) => `(${m > 1 ? m : ''}x ${k >= 0 ? '+' : '-'} ${Math.abs(k)})`;
    this.factoredTex = f(this.factors[0]) + f(this.factors[1]);
  }

  _ms() { return Math.round((this.time - this.choiceT0) * 1000); }
  _h(x, z) { return this.ctx.dyn.groundH ? this.ctx.dyn.groundH(x, z) : 0; }

  _stone(scene, x, z, w, h, act, tint) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.15, .3, .8), mat('#767162'));
    base.position.y = .15; base.castShadow = true; g.add(base);
    const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, .34), mat(tint || '#8a8578'));
    face.position.y = .3 + h / 2; face.castShadow = true; g.add(face);
    g.position.set(x, this._h(x, z), z);
    scene.add(g);
    this.solid.push(g);
    this.colliders.push({ type: 'circle', x, z, r: Math.max(.5, w * .55) });
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, h + 2.2, 2.4), INVIS);
    proxy.position.set(x, this._h(x, z) + 1.1, z);
    proxy.userData.act = { part: 'wood-way', ...act };
    proxy.userData.glowRoot = g;
    scene.add(proxy);
    this.interactables.push(proxy);
    return { g, face, x, z };
  }

  _pulse(m) { this.pulses.push({ m: m.material, t: 0 }); m.material.emissive = new THREE.Color('#e8c877'); }

  _lamps(scene, coords) {
    const out = [];
    for (const [x, z] of coords) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#3a3526' }));
      l.position.set(x, this._h(x, z) + 1.15, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.1, 6), mat('#5a4a38'));
      post.position.set(x, this._h(x, z) + .55, z);
      scene.add(l); scene.add(post);
      out.push(l);
    }
    return out;
  }
  _light(lamps) { for (const l of lamps) l.material.color = new THREE.Color('#e8c877'); }

  _ring(scene, x, z) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .08, 8, 24), mat('#c8a24a', { emissive: new THREE.Color('#4a3a12'), emissiveIntensity: .6 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, this._h(x, z) + .06, z);
    scene.add(ring);
    return ring;
  }

  _arch(scene, x, z) {
    const g = new THREE.Group();
    for (const dx of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.4, 3.1, .4), mat('#8a8578'));
      post.position.set(dx, 1.55, 0); post.castShadow = true; g.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.8, .45, .5), mat('#a49d8c'));
    lintel.position.y = 3.2; lintel.castShadow = true; g.add(lintel);
    g.position.set(x, this._h(x, z), z);
    g.rotation.y = .35;
    scene.add(g); this.solid.push(g);
    for (const dx of [-1.5, 1.5]) this.colliders.push({ type: 'circle', x: x + dx * Math.cos(.35), z: z - dx * Math.sin(.35), r: .35 });
    // the bar lifts only when the carried pair's middles re-add to the true middle
    this.colliders.push({ type: 'aabb', minX: x - 1.6, maxX: x + 1.6, minZ: z - .4, maxZ: z + .4,
      active: () => !(this.carried && this.carried[0] + this.carried[1] === this.C.item.b) });
  }

  _slabs(scene, x, z) {
    const mk = (dx) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.6, .3), mat('#a49d8c'));
      s.position.set(dx, .95, 0); s.castShadow = true;
      return s;
    };
    const g = new THREE.Group();
    const L = mk(-1.05), R = mk(1.05);
    g.add(L); g.add(R);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, .3, 1), mat('#767162'));
    base.position.y = .15; g.add(base);
    g.position.set(x, this._h(x, z), z);
    scene.add(g); this.solid.push(g);
    this.colliders.push({ type: 'circle', x, z, r: 1.1 });
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.6, 2.6), INVIS);
    proxy.position.set(x, this._h(x, z) + 1.4, z);
    proxy.userData.glowRoot = g;
    scene.add(proxy); this.interactables.push(proxy);
    return { g, L, R, proxy, x, z };
  }

  _build(scene) {
    // ---------- trailhead ----------
    this.itemS = this._stone(scene, 0, -6, 1.7, 1.5, { kind: 'item', prompt: 'Read the stone', label: 'A stone bearing the problem' });
    { const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 2.4, 6), mat('#6b5a40'));
      pole.position.y = 1.2; pole.castShadow = true; g.add(pole);
      for (let i = 0; i < 3; i++) {
        const bd = new THREE.Mesh(new THREE.BoxGeometry(.95, .2, .05), mat('#8a7452'));
        bd.position.set(.32, 1.35 + i * .34, 0); bd.rotation.y = -.4 + i * .4;
        g.add(bd);
      }
      g.position.set(3.2, this._h(3.2, 6), 6);
      scene.add(g); this.solid.push(g);
      this.colliders.push({ type: 'circle', x: 3.2, z: 6, r: .3 });
    }
    this.mouths = [
      { tag: 'ignores-a', x: 10, z: 15.5, tex: '\\cdot\\!\\to 6 \\quad +\\!\\to 7', glow: '#f2f0d0' },
      { tag: 'true', x: 0, z: 17.5, tex: '\\cdot\\!\\to 12 \\quad +\\!\\to 7', glow: '#d8e0c2' },
      { tag: 'swap', x: -10, z: 15.5, tex: '\\cdot\\!\\to 7 \\quad +\\!\\to 6', glow: '#ccd8cc' },
    ];
    for (const m of this.mouths) {
      this._stone(scene, m.x + 1.9, m.z - 1.2, .9, 1.1, { kind: 'mouth', tag: m.tag, prompt: 'Read the way-mark', label: 'A way-mark beside a mouth' });
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2),
        new THREE.MeshBasicMaterial({ color: m.glow, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      slab.position.set(m.x, this._h(m.x, m.z + 1) + 2, m.z + 1.2);
      scene.add(slab);
    }

    // ---------- per-way stations ----------
    for (const [tag, W] of Object.entries(WAYS)) {
      this._stone(scene, W.off + 2.6, 317.5, 1.6, 1.35, { kind: 'search', tag, prompt: 'Work the table', label: 'A search table' }, '#a49d8c');
      this._arch(scene, W.off - 3, 333);
    }
    // birch: the refusing slabs + the probe + home
    this.slabsIg = this._slabs(scene, 2.4, 351);
    this.slabsIg.proxy.userData.act = { part: 'wood-way', kind: 'group', tag: 'ignores-a', prompt: 'Work the slabs', label: 'Two slabs, each holding a share' };
    this.probeS = this._stone(scene, 0, 359.5, 1.25, 1.5, { kind: 'probe', prompt: 'Read the stone', label: 'A smaller problem' }, '#a49d8c');
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.6 + (i % 3) * .3, 0), mat('#33553f'));
      b.position.set(-4 + i, this._h(-4 + i, 363) + .5, 362.6 + (i % 2) * .8);
      b.scale.y = .8; b.castShadow = true;
      scene.add(b); this.solid.push(b);
    }
    this.colliders.push({ type: 'aabb', minX: -5, maxX: 6, minZ: 362, maxZ: 364 });
    this.ringIg = this._ring(scene, 7.5, 354.5);
    this.lampsIg = this._lamps(scene, [[2.2, 358.5], [4.6, 357.2], [6.6, 355.8]]);
    // pine: two revision stones (a = 1 is known ground) + home BEFORE the shut arch
    this.pDrillS = [
      this._stone(scene, -304.5, 325, 1.2, 1.3, { kind: 'pdrill', i: 0, prompt: 'Read the stone', label: 'A practice stone' }, '#a49d8c'),
      this._stone(scene, -297, 327.5, 1.2, 1.3, { kind: 'pdrill', i: 1, prompt: 'Read the stone', label: 'A practice stone' }, '#a49d8c'),
    ];
    this.ringSw = this._ring(scene, -292.5, 326.5);
    this.lampsSw = this._lamps(scene, [[-298.5, 327.5], [-295.5, 327]]);
    // rise: the merging slabs + the summit solve + home
    this.slabsTr = this._slabs(scene, 302.4, 351);
    this.slabsTr.proxy.userData.act = { part: 'wood-way', kind: 'group', tag: 'true', prompt: 'Work the slabs', label: 'Two slabs, each holding a share' };
    this.solveS = this._stone(scene, 300, 359.5, 1.5, 1.7, { kind: 'solve', prompt: 'Read the summit stone', label: 'The summit stone' }, '#b0a893');
    this.ringTr = this._ring(scene, 307.5, 354.5);
    this.lampsTr = this._lamps(scene, [[302.2, 358.5], [304.6, 357.2], [306.6, 355.8]]);

    // ---------- the training grove: portal stone, three bar-stations, way back ----------
    this._stone(scene, -3.5, 5, 1.1, 1.3, { kind: 'train', prompt: 'Step aside and practice', label: 'A practice stone: the grove' }, '#b0a893');
    const mkBar = (x, z, target, color) => {
      const unit = 1.5 / target, baseY = this._h(x, z);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(.16, 2.3, .16), mat('#5a5548'));
      pillar.position.set(x, baseY + 1.15, z); scene.add(pillar); this.solid.push(pillar);
      const ind = new THREE.Mesh(new THREE.BoxGeometry(.34, 1, .34), mat(color, { emissive: new THREE.Color(color), emissiveIntensity: .25 }));
      ind.scale.y = .001; ind.position.set(x, baseY, z); scene.add(ind);
      const notch = new THREE.Mesh(new THREE.BoxGeometry(.52, .05, .52), mat('#e8c877', { emissive: new THREE.Color('#7a5c1e'), emissiveIntensity: .5 }));
      notch.position.set(x, baseY + target * unit, z); scene.add(notch);
      return { ind, unit, baseY, set(v) { const h = Math.max(.001, Math.min((v > 0 ? v : 0) * this.unit, 2.2)); this.ind.scale.y = h; this.ind.position.y = this.baseY + h / 2; } };
    };
    this.tst = [];
    const TPOS = [[-6, -306], [0, -310], [6, -306]];
    for (let i = 0; i < this.TR.length && i < TPOS.length; i++) {
      const [x, z] = TPOS[i];
      const st = this._stone(scene, x, z, 1.35, 1.4, { kind: 'tstat', i, prompt: 'Practice here', label: 'A practice stone' }, '#a49d8c');
      const pb = mkBar(x - 1.35, z + .2, this.TR[i].c, '#7f9c55');
      const sb = mkBar(x + 1.35, z + .2, this.TR[i].b, '#c8a24a');
      this.tst.push({ st, pb, sb, x, z });
    }
    this.ringTrn = this._ring(scene, 9, -296);

    this.ZONES = [
      { id: 't-home', kind: 'thome', minX: 7.7, maxX: 10.3, minZ: -297.3, maxZ: -294.7 },
      { id: 'f-ig', kind: 'fork', tag: 'ignores-a', minX: 8.2, maxX: 11.8, minZ: 14.6, maxZ: 17.6 },
      { id: 'f-tr', kind: 'fork', tag: 'true', minX: -2.1, maxX: 2.1, minZ: 15.6, maxZ: 19.4 },
      { id: 'f-sw', kind: 'fork', tag: 'swap', minX: -11.8, maxX: -8.2, minZ: 14.6, maxZ: 17.6 },
      { id: 'a-ig', kind: 'arch', minX: -6, maxX: 0, minZ: 330.5, maxZ: 335 },
      { id: 'a-sw', kind: 'arch', minX: -306, maxX: -300, minZ: 330.5, maxZ: 335 },
      { id: 'a-tr', kind: 'arch', minX: 294, maxX: 300, minZ: 330.5, maxZ: 335 },
      { id: 'h-ig', kind: 'home', minX: 6.2, maxX: 8.8, minZ: 353.2, maxZ: 355.8 },
      { id: 'h-sw', kind: 'home', minX: -293.8, maxX: -291.2, minZ: 325.2, maxZ: 327.8 },
      { id: 'h-tr', kind: 'home', minX: 306.2, maxX: 308.8, minZ: 353.2, maxZ: 355.8 },
    ];
  }

  onInteract(act) {
    const PH = this.PH;
    if (act.kind === 'item') { this.card = 'item'; PH.openPanel('p:wood-way'); this.log.push('wood.way.read', { stone: 'item' }); return; }
    if (act.kind === 'mouth') { this.card = 'mouth:' + act.tag; PH.openPanel('p:wood-way'); this.log.push('wood.way.read', { stone: 'mark', tag: act.tag }); return; }
    if (act.kind === 'search') { this.card = 'search'; this.tag = act.tag; PH.openPanel('p:wood-way'); return; }
    if (act.kind === 'probe') { this.card = this.drill >= 0 && !this.probeDone ? 'drill' : 'probe'; PH.openPanel('p:wood-way'); return; }
    if (act.kind === 'pdrill') { this.card = 'pdrill:' + act.i; PH.openPanel('p:wood-way'); return; }
    if (act.kind === 'solve') { this.card = 'solve'; this.lastClaim = null; PH.openPanel('p:wood-way'); return; }
    if (act.kind === 'train') {
      this.log.push('wood.train.enter', { nth: this.nth });
      this.ctx.dyn.wood.setPocket('train');
      this.game.teleport(0, -288, 0, 1.2, -300);
      return;
    }
    if (act.kind === 'tstat') { this.card = 'tstat:' + act.i; this.lastClaim = null; PH.openPanel('p:wood-way'); return; }
    if (act.kind === 'group') {
      if (!this.carried) return;
      if (act.tag === 'ignores-a' && !this.parcelDead) {
        this._slide = 0;
        this.log.push('wood.way.group', { tag: act.tag, tries: this.parcelTries + 1, ms: this._ms() });
      } else if (act.tag === 'true' && !this.merged) {
        // the first kind of taking-in-common is the player's act, not a show
        this.card = 'group'; PH.openPanel('p:wood-way');
      }
    }
  }

  _resetWay() {
    this.way = null; this.carried = null; this.sigmaShown = false; this.swapTries = 0;
    this.parcelTries = 0; this.parcelDead = false; this._fold = -1; this._slide = -1; this._merge = -1;
  }

  _zoneHit(zn) {
    if (zn.kind === 'fork') {
      // a mouth is a choice however the walker got home — ring, warp, or stray
      if (this.state === 'out') {
        this.log.push('wood.way.rejoin', { from: this.way, via: 'trailhead', ms: this._ms() });
        this.nth += 1; this._resetWay();
      }
      const W = WAYS[zn.tag];
      this.state = 'out'; this.way = zn.tag; this._outAt = this.time;
      this.log.push('wood.way.fork', { tag: zn.tag, nth: this.nth, ms: this._ms() });
      this.ctx.dyn.wood.setPocket(W.pocket);
      this.game.teleport(W.off, 296, W.off, 1.2, 306);
      this.choiceT0 = this.time;
      if (this.PH.trace) this.PH.trace(`\\cdot\\!\\to ${W.P} \\quad +\\!\\to ${W.S}`);
    } else if (zn.kind === 'home' && this.state === 'out') {
      this.state = 'hub'; this.nth += 1;
      this.log.push('wood.way.rejoin', { from: this.way, ms: this._ms(), connected: this.connected, passed: this.passed });
      this.ctx.dyn.wood.setPocket('trailhead');
      this.game.teleport(0, 7, 0, 1.2, 16);
      this.choiceT0 = this.time;
      this._resetWay();
      if (this.PH.trace) this.PH.trace(null);
    } else if (zn.kind === 'thome') {
      this.log.push('wood.train.exit', { solved: this.tSolved.filter(Boolean).length });
      this.ctx.dyn.wood.setPocket('trailhead');
      this.game.teleport(-3.5, 3, 0, 1.2, 14);
    } else if (zn.kind === 'arch' && this.carried && !this.sigmaShown) {
      this.sigmaShown = true; this._fold = 0;
      const [p, q] = this.carried;
      this.log.push('wood.way.sigma', { p, q, folds: p + q === this.C.item.b, ms: this._ms() });
      const bb = this.C.item.b;
      if (this.PH.trace) this.PH.trace(p + q === bb ? `${bb}x = ${p}x + ${q}x` : `${p}x + ${q}x = ${p + q}x \\neq ${bb}x`);
    }
  }

  update(dt, u) {
    this.time += dt;
    if (this.ctx.dyn.wood) this.ctx.dyn.wood.update(dt, u && u.camera);
    for (const p of this.pulses) { p.t += dt; p.m.emissiveIntensity = Math.max(0, 1.2 - p.t * 1.4); }
    this.pulses = this.pulses.filter((p) => p.t < 1);
    if (this._fold >= 0) this._fold += dt;
    if (this._slide >= 0) {         // birch: approach, then spring back — parcels refuse
      this._slide += dt;
      const t = this._slide;
      const s = t < .6 ? t / .6 : t < 1.1 ? Math.max(0, 1 - (t - .6) / .5 * 1.1) : 0;
      const off = 1.05 - s * .62;
      this.slabsIg.L.position.x = -off; this.slabsIg.R.position.x = off;
      if (t >= 1.1) {
        this._slide = -1;
        this.slabsIg.L.position.x = -1.05; this.slabsIg.R.position.x = 1.05;
        this.parcelTries += 1;
        if (this.parcelTries >= 3 && !this.parcelDead) {
          this.parcelDead = true;
          this.log.push('wood.way.parcels', { left: '2x+1', right: 'x+1', verdict: 'refuse', ms: this._ms() });
          this._pulse(this.probeS.face);
          if (this.PH.trace) this.PH.trace('(2x{+}1) \\neq (x{+}1)');
        }
      }
    }
    if (this._merge >= 0) {         // rise: the slabs join and STAY — the common factor comes out
      this._merge += dt;
      const t = Math.min(1, this._merge / .9);
      const e = t * t * (3 - 2 * t);
      const off = 1.05 - e * .62;
      this.slabsTr.L.position.x = -off; this.slabsTr.R.position.x = off;
      if (this._merge >= .9 && !this.merged) {
        this.merged = true; this._merge = -1;
        this.log.push('wood.way.merge', { factored: this.factoredTex, ms: this._ms() });
        this._pulse(this.solveS.face);
        if (this.PH.trace) this.PH.trace(this.factoredTex);
      }
    }
    if (!u || !u.controls) return;
    const p = u.controls.pos;
    // back at the trailhead by any road (dev warp included) while still "out":
    // close the old way quietly so the mouths always answer
    if (this.state === 'out' && Math.abs(p.x) < 60 && p.z < 60 && p.z > -40 && this.time - (this._outAt ?? 0) > 2) {
      this.state = 'hub';
      this.log.push('wood.way.rejoin', { from: this.way, via: 'stray', ms: this._ms() });
      this.ctx.dyn.wood.setPocket('trailhead');
      this._resetWay();
      if (this.PH.trace) this.PH.trace(null);
    }
    for (const zn of this.ZONES) {
      if (p.x < zn.minX || p.x > zn.maxX || p.z < zn.minZ || p.z > zn.maxZ) continue;
      const last = this._zoneLast[zn.id] ?? -9;
      if (this.time - last < 1.5) continue;
      this._zoneLast[zn.id] = this.time;
      this._zoneHit(zn);
    }
  }

  // ---------- cards (plain math-instruction register; problem always shown) ----------
  panel(st) {
    const K = this.PH.K, C = this.C;
    const PROB = `<p class="muted">The problem:</p><div class="eq">${K(C.item.tex, true)}</div>`;
    if (this.card === 'item') {
      return `<h2>The problem</h2><div class="eq">${K(C.item.tex, true)}</div>
        <p class="lede">Three ways part beyond this stone. Choose one by walking into its mouth.</p>
        ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">Trajectory wood entry; a=1 factoring assumed known. Wrong ways return here; the true way ends by solving.</p></div>` : ''}`;
    }
    if (this.card && this.card.startsWith('mouth:')) {
      const m = this.mouths.find((x) => x.tag === this.card.slice(6));
      return `<h2>A way-mark</h2>${PROB}
        <p class="lede">This way's rule for the two numbers:</p><div class="eq">${K(m.tex, true)}</div>
        ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">tag: ${m.tag}. Styles differentiate identity, never correctness.</p></div>` : ''}`;
    }
    if (this.card === 'search') {
      const W = WAYS[this.tag], done = !!this.carried;
      const force = this.tag === 'swap' && this.swapTries >= 2 && !done;
      return `<h2>The search</h2>${PROB}
        <p class="lede">Find two numbers that multiply to give ${W.P} and add to give ${W.S}.</p>
        <div class="gate-in"><input id="wp" type="text" inputmode="numeric" placeholder="•" size="3" autofocus>
        <span> and </span><input id="wq" type="text" inputmode="numeric" placeholder="•" size="3">
        <button id="wset" class="btn primary">Check</button></div>
        ${this.lastClaim ? `<p class="muted">${this.lastClaim}</p>` : ''}
        ${force ? `<div class="gate-in"><button id="wforce" class="btn">Continue with 1 and 7</button></div>` : ''}
        ${done ? `<p class="muted">Found: ${this.carried[0]} and ${this.carried[1]}. Carry them to the arch.</p>` : ''}`;
    }
    if (this.card === 'probe') {
      return `<h2>A smaller problem</h2>
        <p class="muted">The problem this way began from:</p><div class="eq">${K(C.item.tex, true)}</div>
        <p class="lede">First, this one:</p><div class="eq">${K(C.probe.tex, true)}</div>
        <p class="lede">Find two numbers that multiply to give ${C.probe.c} and add to give ${C.probe.b}.</p>
        <div class="gate-in"><input id="wp" type="text" inputmode="numeric" placeholder="•" size="3" autofocus>
        <span> and </span><input id="wq" type="text" inputmode="numeric" placeholder="•" size="3">
        <button id="wset" class="btn primary">Check</button></div>
        ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">ignores-a repair: success ⇒ the connection (1·6 = a·c) in chips — a generalization, never a re-teaching.</p></div>` : ''}`;
    }
    if (this.card === 'drill' || (this.card && this.card.startsWith('pdrill:'))) {
      const i = this.card === 'drill' ? this.drill : +this.card.slice(7);
      const d = C.drills[i];
      return `<h2>Practice</h2>
        <p class="muted">The problem this way began from:</p><div class="eq">${K(C.item.tex, true)}</div>
        <p class="lede">Practice:</p><div class="eq">${K(d.tex, true)}</div>
        <p class="lede">Find two numbers that multiply to give ${d.c} and add to give ${d.b}.</p>
        <div class="gate-in"><input id="wp" type="text" inputmode="numeric" placeholder="•" size="3" autofocus>
        <span> and </span><input id="wq" type="text" inputmode="numeric" placeholder="•" size="3">
        <button id="wset" class="btn primary">Check</button></div>`;
    }
    if (this.card && this.card.startsWith('tstat:')) {
      const i = +this.card.slice(6), d = this.TR[i];
      const done = this.tSolved[i], pr = this.trPair[i];
      return `<h2>Practice</h2><div class="eq">${K(d.tex, true)}</div>
        <p class="lede">Find two numbers that multiply to give ${d.c} and add to give ${d.b}. The two bars beside the stone follow what you type — each meets its gold mark when its condition holds.</p>
        <div class="gate-in"><input id="wp" type="text" inputmode="numeric" placeholder="•" size="3" autofocus>
        <span> and </span><input id="wq" type="text" inputmode="numeric" placeholder="•" size="3">
        <button id="wset" class="btn primary">Check</button></div>
        ${this.lastClaim ? `<p class="muted">${this.lastClaim}</p>` : ''}
        ${done ? `<p class="muted">${K(`x^{2} + ${d.b}x + ${d.c} = (x + ${pr[0]})(x + ${pr[1]})`)} — and beside the stone, both forms valued at x = 0, 1, 2 agree.</p>` : ''}`;
    }
    if (this.card === 'group') {
      const [p, q] = this.carried ?? [3, 4];
      return `<h2>The groups</h2>
        <p class="muted">The problem:</p><div class="eq">${K(this.C.item.tex, true)}</div>
        <p class="lede">The split in hand:</p><div class="eq">${K(`2x^{2} + ${p}x \\;+\\; ${q}x + 6`, true)}</div>
        <p class="lede">Take out what each group shares. From ${K(`2x^{2} + ${p}x`)} take out <input id="wg1" type="text" size="2" autofocus>, and from ${K(`${q}x + 6`)} take out <input id="wg2" type="text" size="2">.</p>
        <div class="gate-in"><button id="wset" class="btn primary">Check</button></div>
        ${this.lastClaim ? `<p class="muted">${this.lastClaim}</p>` : ''}`;
    }
    if (this.card === 'bridgeIg' || this.card === 'bridgeSw') {
      return `<h2>Back to the problem</h2><div class="eq">${K(C.item.tex, true)}</div>
        <p class="lede">Now, for this one: the two numbers must multiply to give <input id="wp" type="text" inputmode="numeric" size="3" autofocus> and add to give <input id="wq" type="text" inputmode="numeric" size="3">.</p>
        <div class="gate-in"><button id="wset" class="btn primary">Check</button></div>
        ${this.lastClaim ? `<p class="muted">${this.lastClaim}</p>` : ''}`;
    }
    if (this.card === 'solve') {
      return `<h2>The summit</h2>
        <p class="muted">Solve:</p><div class="eq">${K(C.item.tex + ' = 0', true)}</div>
        ${this.merged ? `<p class="lede">It factors as:</p><div class="eq">${K(this.factoredTex + ' = 0', true)}</div>` : `<p class="muted">The slabs below hold the factoring — work them first if you need it.</p>`}
        <p class="lede">Enter the two values of x. Fractions like -3/2 are fine.</p>
        <div class="gate-in"><input id="wp" type="text" placeholder="x" size="5" autofocus>
        <span> and </span><input id="wq" type="text" placeholder="x" size="5">
        <button id="wset" class="btn primary">Check</button></div>
        ${this.lastClaim ? `<p class="muted">${this.lastClaim}</p>` : ''}
        ${this.passed ? `<p class="muted">Both values land the whole line on 0. The way home stands lit.</p>` : ''}`;
    }
    return '';
  }

  _num(s) {
    if (typeof s !== 'string') return NaN;
    const m = s.trim().replace('−', '-').match(/^(-?\d+(?:\.\d+)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?))?$/);
    if (!m) return NaN;
    const a = parseFloat(m[1]);
    return m[2] ? a / parseFloat(m[2]) : a;
  }

  onPanel(ev) {
    if (ev.type === 'keydown' && ev.key === 'Enter') { const b = document.getElementById('wset'); if (b) b.click(); return; }
    if (ev.type === 'input' && this.card && this.card.startsWith('tstat:')) {
      // the bars follow the typing — the two constraints are watched, not told
      const i = +this.card.slice(6), t = this.tst[i];
      const p = parseFloat(document.getElementById('wp')?.value), q = parseFloat(document.getElementById('wq')?.value);
      if (t) { t.pb.set((p || 0) * (q || 0)); t.sb.set((p || 0) + (q || 0)); }
      return;
    }
    if (ev.type !== 'click' || !ev.target) return;
    const PH = this.PH;
    if (ev.target.id === 'wforce') {
      this.carried = [1, 7];
      this.log.push('wood.way.search', { tag: 'swap', p: 1, q: 7, ok: false, forced: true, ms: this._ms() });
      if (this.PH.trace) this.PH.trace('1,\\ 7');
      this.lastClaim = null;
      PH.dismissLater('p:wood-way', 900);
      PH.refresh();
      return;
    }
    if (ev.target.id !== 'wset') return;
    const vp = document.getElementById('wp')?.value, vq = document.getElementById('wq')?.value;
    if (this.card === 'solve') {
      const r1 = this._num(vp), r2 = this._num(vq);
      if (!Number.isFinite(r1) || !Number.isFinite(r2)) return;
      const { a, b, c } = this.C.item;
      const f = (x) => a * x * x + b * x + c;
      const okSet = (x, y) => Math.abs(x - y) < 1e-9;
      const ok = (okSet(r1, this.roots[0]) && okSet(r2, this.roots[1])) || (okSet(r1, this.roots[1]) && okSet(r2, this.roots[0]));
      this.log.push('wood.way.solveTry', { r1, r2, ok, ms: this._ms() });
      if (ok) {
        this.passed = true;
        this.log.push('wood.way.pass', { nth: this.nth, ms: this._ms() });
        if (this.PH.trace) this.PH.trace(`x = ${this.roots[0]} \\quad x = -\\tfrac{3}{2}`);
        this.log.push('wood.level.complete', { events: this.log.events.length });
        this._pulse(this.solveS.face);
        this._light(this.lampsTr);
        this.ringTr.material.emissiveIntensity = 1.4;
        this.lastClaim = null;
        PH.dismissLater('p:wood-way', 1400);
      } else {
        const fmt = (v, val) => `at x = ${v}: the line makes ${Number.isInteger(val) ? val : val.toFixed(2)}`;
        this.lastClaim = `${fmt(vp, f(r1))} · ${fmt(vq, f(r2))}`;
      }
      PH.refresh();
      return;
    }
    if (this.card === 'group') {
      const g1 = (document.getElementById('wg1')?.value || '').trim().toLowerCase().replace(/\s+/g, '');
      const g2 = (document.getElementById('wg2')?.value || '').trim();
      const ok = (g1 === 'x' || g1 === '1x') && g2 === '2';
      this.log.push('wood.way.common', { g1, g2, ok, ms: this._ms() });
      if (ok) { this.lastClaim = null; this._merge = 0; PH.dismissLater('p:wood-way', 900); }
      else this.lastClaim = 'What steps out must divide every term of its group.';
      PH.refresh();
      return;
    }
    const p = Math.round(parseFloat(vp)), q = Math.round(parseFloat(vq));
    if (!Number.isFinite(p) || !Number.isFinite(q)) return;
    if (this.card && this.card.startsWith('tstat:')) {
      const i = +this.card.slice(6), d = this.TR[i], t = this.tst[i];
      const ok = p * q === d.c && p + q === d.b;
      this.tTries[i] += 1;
      this.log.push('wood.train.try', { i, p, q, ok, tries: this.tTries[i], ms: this._ms() });
      if (t) { t.pb.set(p * q); t.sb.set(p + q); }
      if (ok) {
        this.tSolved[i] = true; this.lastClaim = null;
        if (t) this._pulse(t.st.face);
        this.log.push('wood.train.solve', { i, tries: this.tTries[i] });
      } else this.lastClaim = `${p} × ${q} = ${p * q} · ${p} + ${q} = ${p + q}`;
      PH.refresh();
      return;
    }
    if (this.card === 'bridgeIg' || this.card === 'bridgeSw') {
      const { a, b, c } = this.C.item;
      const ok = p === a * c && q === b;
      this.log.push('wood.way.bridge', { way: this.card === 'bridgeIg' ? 'ignores-a' : 'swap', m: p, s: q, ok, ms: this._ms() });
      if (ok) {
        this.lastClaim = null;
        if (this.PH.trace) this.PH.trace('\\cdot\\!\\to 12 \\quad +\\!\\to 7');
        if (this.card === 'bridgeIg') { this._light(this.lampsIg); this.ringIg.material.emissiveIntensity = 1.4; }
        else { this.pineRepaired = true; this._light(this.lampsSw); this.ringSw.material.emissiveIntensity = 1.4; }
        PH.dismissLater('p:wood-way', 1100);
      } else this.lastClaim = `${p} and ${q}`;
      PH.refresh();
      return;
    }
    if (this.card === 'search') {
      const W = WAYS[this.tag];
      const ok = p * q === W.P && p + q === W.S;
      this.log.push('wood.way.search', { tag: this.tag, p, q, ok, ms: this._ms() });
      if (ok) {
        this.carried = [Math.min(p, q), Math.max(p, q)];
        this.lastClaim = null;
        if (this.PH.trace) this.PH.trace(`${this.carried[0]},\\ ${this.carried[1]}`);
        const stone = this.interactables.find((o) => o.userData.act.kind === 'search' && o.userData.act.tag === this.tag);
        if (stone) this._pulse(stone.userData.glowRoot.children[1]);
        PH.dismissLater('p:wood-way', 900);
      } else {
        if (this.tag === 'swap') this.swapTries += 1;
        this.lastClaim = `${p} × ${q} = ${p * q} · ${p} + ${q} = ${p + q}`;
      }
      PH.refresh();
      return;
    }
    if (this.card && this.card.startsWith('pdrill:')) {
      const i = +this.card.slice(7), d = this.C.drills[i];
      const ok = p * q === d.c && p + q === d.b;
      this.log.push('wood.way.drill', { way: 'swap', n: i, p, q, ok, ms: this._ms() });
      if (ok) {
        this.pdrill[i] = true;
        this._pulse(this.pDrillS[i].face);
        if (this.pdrill[0] && this.pdrill[1] && !this.pineRepaired) {
          this.log.push('wood.way.repair', { way: 'swap' });
          this.card = 'bridgeSw'; this.lastClaim = null;
          PH.refresh();
          return;
        }
        PH.dismissLater('p:wood-way', 900);
      }
      PH.refresh();
      return;
    }
    const item = this.card === 'drill' ? this.C.drills[this.drill] : this.C.probe;
    const ok = p * q === item.c && p + q === item.b;
    this.log.push(this.card === 'drill' ? 'wood.way.drill' : 'wood.way.probe', { way: 'ignores-a', n: this.drill, p, q, ok, ms: this._ms() });
    if (this.card === 'drill') {
      if (ok) {
        this.drillDone[this.drill] = true;
        this.drill += 1;
        if (this.drill >= this.C.drills.length) { this.drill = -1; this.card = 'probe'; }
        PH.refresh();
      }
      return;
    }
    if (ok) {
      this.probeDone = true; this.connected = true;
      this.log.push('wood.way.connection', { inoc: '1*6' });
      if (this.PH.trace) this.PH.trace('1 \\cdot 6 = a \\cdot c');
      this._pulse(this.probeS.face);
      // the repair is only done once it carries back to the original problem
      this.card = 'bridgeIg'; this.lastClaim = null;
      PH.refresh();
    } else {
      this.probeTried += 1;
      if (this.probeTried >= 2 && this.drill < 0) { this.drill = 0; this.card = 'drill'; }
      PH.refresh();
    }
  }

  // ---------- chips: the problem travels with its options, everywhere ----------
  labels(L, architect) {
    const K = (id, tex, x, y, z, kind) => L.set(id, { tex, x, y, z, kind: kind || 'rule', dy: 0 });
    const near = (x, z, d) => { const p = this.game.playerPos(); return Math.hypot(p.x - x, p.z - z) < d; };
    if (near(0, -6, 12)) K('ww-item', this.C.item.tex, 0, this._h(0, -6) + 2.2, -6);
    if (near(0, 16, 17)) K('ww-prob', this.C.item.tex, 0, this._h(0, 15) + 4.3, 14.6);
    for (const m of this.mouths) if (near(m.x, m.z, 13)) K('ww-m-' + m.tag, m.tex, m.x, this._h(m.x, m.z) + 2.6, m.z - .6);
    if (this.state === 'out' && this.way) {
      const W = WAYS[this.way], o = W.off;
      if (near(o + 2.6, 317.5, 11)) {
        K('ww-prob-s', this.C.item.tex, o + 2.6, this._h(o + 2.6, 317.5) + 3.2, 317.5);
        if (!this.carried) K('ww-t1', `\\cdot\\!\\to ${W.P} \\quad +\\!\\to ${W.S}`, o + 2.6, this._h(o + 2.6, 317.5) + 2.3, 317.5);
        else K('ww-c1', `${this.carried[0]},\\ ${this.carried[1]}`, o + 2.6, this._h(o + 2.6, 317.5) + 2.5, 317.5);
      }
      if (near(o - 3, 333, 14)) {
        K('ww-prob-a', this.C.item.tex, o - 3, this._h(o - 3, 333) + 4.8, 333);
        if (this._fold >= 0 && this._fold < 7 && this.carried) {
          const [p, q] = this.carried, s = p + q, b = this.C.item.b;
          const step = this._fold < 1.6 ? `${b}x` : this._fold < 3.6 ? `${p}x + ${q}x` : (s === b ? `${b}x` : `${s}x \\neq ${b}x`);
          K('ww-sig', step, o - 3, this._h(o - 3, 333) + 3.9, 333);
        }
      }
      if (this.way === 'ignores-a') {
        if ((this._slide >= 0 || this.parcelDead) && near(2.4, 351, 12)) {
          K('ww-pl', 'x(2x+1)', 1.2, this._h(2.4, 351) + 2.4, 351);
          K('ww-pr', '6(x+1)', 3.6, this._h(2.4, 351) + 2.4, 351);
          K('ww-prob-g', this.C.item.tex, 2.4, this._h(2.4, 351) + 3.3, 351);
        }
        if (this.connected && near(0, 359.5, 13)) {
          K('ww-y', '\\cdot\\!\\to 6 \\quad +\\!\\to 7', -1.4, this._h(0, 359.5) + 2.6, 359.5);
          K('ww-t', '\\cdot\\!\\to 12 \\quad +\\!\\to 7', 1.6, this._h(0, 359.5) + 2.6, 359.5);
          K('ww-i', this.C.inocTex, 0, this._h(0, 359.5) + 3.3, 359.5);
        }
        if (!this.connected && near(0, 359.5, 13)) K('ww-prob-p', this.C.item.tex, 0, this._h(0, 359.5) + 3.3, 359.5);
      }
      if (this.way === 'swap' && near(-301, 326, 13)) K('ww-prob-d', this.C.item.tex, -300.8, this._h(-300.8, 326) + 3.1, 326);
      if (this.way === 'true') {
        if (near(302.4, 351, 12)) {
          K('ww-prob-m', this.C.item.tex, 302.4, this._h(302.4, 351) + 3.3, 351);
          if (this.merged) K('ww-fact', this.factoredTex, 302.4, this._h(302.4, 351) + 2.5, 351);
        }
        if (near(300, 359.5, 13)) K('ww-solve', this.C.item.tex + ' = 0', 300, this._h(300, 359.5) + 3.2, 359.5);
      }
    }
    // the training grove: each stone carries its item; a solved stone shows the
    // factored form with the three honest numbers valuing both forms
    for (let i = 0; i < this.tst.length; i++) {
      const t = this.tst[i], d = this.TR[i];
      if (!near(t.x, t.z, 12)) continue;
      K('tt-' + i, d.tex, t.x, this._h(t.x, t.z) + 2.5, t.z);
      if (this.tSolved[i]) {
        const [p, q] = this.trPair[i];
        K('tf-' + i, `(x + ${p})(x + ${q})`, t.x, this._h(t.x, t.z) + 3.1, t.z);
        for (let x = 0; x <= 2; x++) {
          const val = x * x + d.b * x + d.c;
          K(`ta-${i}-${x}`, `x{=}${x}\\!:\\ ${val} = ${x + p}\\cdot${x + q}`, t.x - 2.2 + x * 2.2, this._h(t.x, t.z) + 1.9, t.z + 1.3);
        }
      }
    }
    if (architect) K('ww-a1', '\\texttt{ways:\\ ig/swap/true}', 0, this._h(0, 15) + 5.4, 14.6, 'architect');
  }
}
