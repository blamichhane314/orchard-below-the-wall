// counterstones.js — the Counter's Stones. Small cairns of stacked palm-stones
// left by whoever crossed before, gold-flecked, standing just off the path near
// the stations whose answers they quietly mirror. Ambient layer (see
// design/parts/layer-ambient-counters-stones.md): no gate, no fail state,
// nothing announced — a player who never reads them loses nothing; one who
// does arrives at each station already knowing. The world never says so.
//
// PERCEPTUAL CONTRACT: every count is derived AT CONSTRUCT TIME from the same
// data its station computes with — gap widths from enc.bridge.gaps, the gate's
// solving count computed the way the gate computes it, the door's roots from
// enc.doorRoots. No count is written twice: edit a station and its cairn
// follows (Laws 4 and 6). Placement hangs off world3.json geometry the same
// way — bridge exit, gate entity, door entity.

import * as THREE from '../../vendor/three/three.module.js';

// seeded rng, build.js pattern — a left cairn must stand the same way every load
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const jitter = (hex, r) => {
  const c = new THREE.Color(hex);
  c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05);
  return c;
};

const DIP = 0.02;       // settle ripple: how far one stone presses down (m)
const DIP_T = 0.18;     // one stone's press-and-spring (s)
const STAGGER = 0.04;   // top-to-bottom delay between stones (s)
const CHIP_MS = 2500;   // how long the numeral chip stays
const NEAR_M = 3.5;     // noticing radius — the first approach is the event

export default class CounterStones {
  /** @param ctx { scene, world, enc, log, PH } — see parts/_contract.md */
  constructor({ scene, world, enc, log }) {
    this.log = log;
    const P = world.palette;
    this.colliders = [];
    this.solid = [];
    this.cairns = [];   // { x, z, count, srcTex, stones[], topY, chipUntil, firstSeenAt, anim }

    // shared bits: ~20 stones and ~50 flecks total — keep them cheap
    this._fleckGeo = new THREE.OctahedronGeometry(1, 0);
    this._fleckMat = mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.45 });
    this._proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this._flecks = enc.counterStones?.flecks !== false;

    const targets = [];
    const entAt = (id) => world.entities.find((e) => e.id === id)?.at;

    // one cairn per bridge gap, in gap order, clustered on the east bank just
    // past the bridge exit and off the path — n stones for a gap of width n
    const B = world.bridge, gaps = enc.bridge.gaps;
    const exitX = B.startX + B.slots * B.slotLen;
    const step = gaps.length > 1 ? 2.3 / (gaps.length - 1) : 0;
    gaps.forEach((gp, i) => {
      const r = rng(4177 + i * 733);
      this._cairn(scene, P, targets, {
        x: exitX - 0.25 + i * step + (r() - 0.5) * 0.16,
        z: B.z + 1.55 + r() * 0.6,
        count: gp.n, seed: 517 + i * 977,
        srcTex: `\\texttt{gap\\ ${i + 1}}`,
      });
    });

    // the counting gate's solving count, computed the way the gate computes it
    // (never stored). A fractional or non-positive solve can't be a stack of
    // stones — owner data error; the ambient layer just declines to speak.
    const cg = enc.countingGate, gAt = entAt('counting-gate');
    const gx = (cg.rhs - cg.lhs.plus) / cg.lhs.times;
    if (gAt && Number.isInteger(gx) && gx > 0) {
      this._cairn(scene, P, targets, {
        x: gAt.x - 0.8, z: gAt.z + 2.75,
        count: gx, seed: 6011, srcTex: '\\texttt{gate}',
      });
    }

    // the door's two roots, side by side in answer order, before the house
    const dAt = entAt('door');
    if (dAt) enc.doorRoots.answers.forEach((root, k) => {
      this._cairn(scene, P, targets, {
        x: dAt.x - 2.05 + k * 0.55, z: dAt.z + 1.94 - k * 0.06,
        count: root, seed: 7307 + k * 991,
        srcTex: `\\texttt{door\\ root\\ ${k + 1}}`,
      });
    });

    this.interactables = targets;   // contract v2: array for the raycaster
  }

  onInteract(act) { this._touch(act.cairn); }

  /** One cairn: `count` stones stacked with seeded offsets, flecked, collidable. */
  _cairn(scene, P, targets, o) {
    const r = rng(o.seed);
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    const stonesG = new THREE.Group();   // the occluder set — the invisible proxy stays out of it
    g.add(stonesG);
    const stones = [];
    let top = 0;
    for (let j = 0; j < o.count; j++) {
      // radii shrink toward the top: every stone could truly rest on the one
      // below it, which is what separates a left cairn from fallen scree
      const rad = 0.128 - (o.count > 1 ? (j * 0.036) / (o.count - 1) : 0.012) + (r() - 0.5) * 0.012;
      const flat = 0.52 + r() * 0.1;
      const geo = r() < 0.5 ? new THREE.DodecahedronGeometry(rad, 0) : new THREE.IcosahedronGeometry(rad, 0);
      geo.scale(1, flat, 1);                       // flattened palm-stone, not a boulder
      const s = new THREE.Mesh(geo, mat(jitter(P.stoneLit, r)));
      const cy = top + rad * flat;
      const off = 0.05 * (1 - 0.5 * (o.count > 1 ? j / (o.count - 1) : 1));   // truer toward the top
      s.position.set((r() - 0.5) * 2 * off, cy, (r() - 0.5) * 2 * off);
      s.rotation.set((r() - 0.5) * 0.12, r() * Math.PI * 2, (r() - 0.5) * 0.12);
      s.castShadow = true; s.receiveShadow = true;
      // 2–3 tiny gold flecks pressed into the upper faces — the counter's mark
      if (this._flecks) {
        const nf = 2 + (r() < 0.45 ? 1 : 0);
        for (let k = 0; k < nf; k++) {
          const az = r() * Math.PI * 2, el = 0.25 + r() * 0.95;
          const f = new THREE.Mesh(this._fleckGeo, this._fleckMat);
          f.scale.setScalar(0.013 + r() * 0.006);
          f.position.set(
            Math.cos(el) * Math.cos(az) * rad * 0.99,
            Math.sin(el) * rad * flat * 0.99,
            Math.cos(el) * Math.sin(az) * rad * 0.99
          );
          f.rotation.set(r() * 3, r() * 3, r() * 3);
          s.add(f);   // child of its stone: flecks ride the settle dip
        }
      }
      stonesG.add(s);
      stones.push({ mesh: s, baseY: cy });
      top = cy + rad * flat * 0.93;  // sat onto, barely nested — each stone must COUNT by eye
    }

    // a fat invisible proxy so the E-ray has something honest to hit
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.46, top + 0.28, 0.46), this._proxyMat);
    proxy.position.y = (top + 0.28) / 2;
    g.add(proxy);

    // PLACEHOLDER strings, owner-replaceable
    g.userData.act = {
      part: 'counter-stones', cairn: this.cairns.length,
      prompt: 'Count the stones', label: 'A small cairn, deliberately stacked', reach: 5,
    };
    scene.add(g);
    targets.push(g);
    this.solid.push(stonesG);
    this.colliders.push({ type: 'circle', x: o.x, z: o.z, r: 0.22 });
    this.cairns.push({
      x: o.x, z: o.z, count: o.count, srcTex: o.srcTex,
      stones, topY: top, chipUntil: 0, firstSeenAt: 0, anim: null,
    });
  }

  /** E on a cairn: the stack settles — a ripple of dips, top stone first — and
   *  wears its count as a bare numeral for a moment. It never says more. */
  _touch(i) {
    const c = this.cairns[i];
    if (!c) return;
    c.anim = { t: 0 };
    c.chipUntil = performance.now() + CHIP_MS;
    this.log.push('counterstones.touch', {
      cairn: i, count: c.count,
      msSinceFirstSeen: c.firstSeenAt ? Math.round(performance.now() - c.firstSeenAt) : 0,
    });
  }

  update(dt, u) {
    const pos = u.controls.pos;
    this.cairns.forEach((c, i) => {
      // noticing is itself the event: first approach within 3.5 m, once per
      // cairn per session — the ambient layer's research story lives here
      if (!c.firstSeenAt && Math.hypot(pos.x - c.x, pos.z - c.z) < NEAR_M) {
        c.firstSeenAt = performance.now();
        this.log.push('counterstones.near', { cairn: i, count: c.count });
      }
      if (!c.anim) return;
      c.anim.t += dt;
      const n = c.stones.length;
      let done = true;
      for (let j = 0; j < n; j++) {
        const st = c.stones[j];
        const k = (c.anim.t - (n - 1 - j) * STAGGER) / DIP_T;   // top stone leads
        if (k < 1) done = false;
        st.mesh.position.y = st.baseY - (k > 0 && k < 1 ? Math.sin(Math.PI * k) * DIP : 0);
      }
      if (done) {
        for (const st of c.stones) st.mesh.position.y = st.baseY;   // rest exactly
        c.anim = null;
      }
    });
  }

  labels(L, architectOn) {
    const now = performance.now();
    this.cairns.forEach((c, i) => {
      if (now < c.chipUntil) {
        L.set('cst' + i, { tex: String(c.count), x: c.x, y: c.topY + 0.3, z: c.z, kind: 'plain', dy: 0 });
      }
      if (architectOn) {
        L.set('cstA' + i, { tex: c.srcTex, x: c.x, y: c.topY + 0.62, z: c.z, kind: 'architect', dy: 0 });
      }
    });
  }

  panel() { return ''; }   // no card: this part never opens one
}
