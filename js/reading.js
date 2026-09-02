// reading.js — the instrument's reading as a PLACED thing in the engine's
// scene. Cast it and it stands in the field: a curve you can walk beside,
// around, and behind, occluded like anything real. The mathematics is
// physics.js, unchanged; the notation is fmt.js, first-course register.
//
// Law 3 — the straight tool's line is drawn to its honest wrong crossing.
// Law 5 — partial hold reads as a ribbon and ranges, never a wrong point.

import * as THREE from '../vendor/three/three.module.js';
import * as P4 from './physics.js';
import { n, quadTex, quadBandTex, rangeTex, peakBandTex, physicsTex } from './fmt.js';

const glow = (color, opacity = 0.9, extra = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, ...extra });

function tubeThrough(pts, r, m, closed = false) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(16, pts.length * 2), r, 6, closed), m);
}

function bothIntervals(params, s, h) {
  const { arcs, delta } = P4.degraded(params, s);
  const near = [], far = [];
  for (const A of arcs) {
    const xs = P4.crossings(A, h);
    if (xs.length === 2) { near.push(xs[0]); far.push(xs[1]); }
  }
  if (!near.length) return null;
  return { delta, arcs,
    near: { lo: Math.min(...near), hi: Math.max(...near) },
    far:  { lo: Math.min(...far),  hi: Math.max(...far)  } };
}

export class Reading {
  constructor(scene, P) {
    this.scene = scene; this.P = P;
    this.group = null; this.key = '';
  }

  clear() {
    if (this.group) { this.scene.remove(this.group); this.group = null; }
    this.key = '';
  }

  _pt(s, u, y) { return new THREE.Vector3(s.x + s.fx * u, y, s.z + s.fz * u); }

  /** Rebuild meshes only when the reading actually changed. */
  sync(st3) {
    const { model, sight } = st3;
    if (!sight || !model) { this.clear(); return; }
    const key = [model, st3.params.theta.toFixed(4), st3.strength.toFixed(3),
      sight.x.toFixed(2), sight.z.toFixed(2), sight.fx.toFixed(3), sight.fz.toFixed(3)].join('|');
    if (key === this.key) return;
    this.clear();
    this.key = key;

    const g = new THREE.Group();
    const P = this.P, s = sight;
    const A = P4.arc(st3.params);
    const h = st3.h;
    const uEnd = (P4.landing(A) ?? 30) + 0.5;

    // the height in question — a dashed rule receding along the cast line
    if (model !== 'constant') {
      const pts = [];
      for (let u = 0.5; u <= uEnd + 4; u += 0.7) pts.push(this._pt(s, u, h));
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      const rule = new THREE.Line(lg, new THREE.LineDashedMaterial({
        color: new THREE.Color(P.ink), dashSize: 0.26, gapSize: 0.2, transparent: true, opacity: 0.55,
      }));
      rule.computeLineDistances();
      g.add(rule);
    }

    if (model === 'constant') {
      const f = st3.figG;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.05)
        pts.push(new THREE.Vector3(s.x + (f.x - s.x) * t, 0.06, s.z + (f.z - s.z) * t));
      g.add(tubeThrough(pts, 0.022, glow(P.gold, 0.9)));
      for (const q of [pts[0], pts[pts.length - 1]]) {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), glow(P.gold, 0.9));
        tick.position.set(q.x, 0.22, q.z);
        g.add(tick);
      }
    } else if (model === 'linear') {
      const pts = [];
      for (let u = 0; u <= uEnd + 6; u += 0.5) pts.push(this._pt(s, u, A.yTangent(st3.params.x0 + u)));
      g.add(tubeThrough(pts, 0.028, glow(P.brick, 0.95)));
      const xc = P4.tangentCrossing(A, h);
      if (xc !== null && xc > 0) this._marker(g, this._pt(s, xc, h), P.brick);
    } else if (st3.strength < 0.999) {
      const iv = bothIntervals(st3.params, st3.strength, h);
      const { arcs } = iv ?? P4.degraded(st3.params, st3.strength);
      const lo = arcs[0], hi = arcs[arcs.length - 1];
      const uRib = Math.min(uEnd + 2, (P4.landing(lo) ?? uEnd) + 0.5);

      // ribbon between the outermost arcs
      const N = Math.max(2, Math.ceil(uRib / 0.3));
      const pos = new Float32Array(N * 2 * 3);
      for (let i = 0; i < N; i++) {
        const u = (i / (N - 1)) * uRib;
        const a = this._pt(s, u, lo.y(st3.params.x0 + u));
        const b = this._pt(s, u, hi.y(st3.params.x0 + u));
        pos.set([a.x, a.y, a.z], i * 3);
        pos.set([b.x, b.y, b.z], (N + i) * 3);
      }
      const idx = [];
      for (let i = 0; i < N - 1; i++) idx.push(i, i + 1, N + i, i + 1, N + i + 1, N + i);
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      rg.setIndex(idx);
      g.add(new THREE.Mesh(rg, glow(P.gold, 0.16, { side: THREE.DoubleSide })));

      for (const B of arcs) {
        const pts = [];
        for (let u = 0; u <= uRib; u += 0.3) pts.push(this._pt(s, u, B.y(st3.params.x0 + u)));
        g.add(tubeThrough(pts, 0.012, glow(P.gold, 0.42)));
      }
      for (const band of iv ? [iv.near, iv.far] : []) {
        const pts = [];
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const u = band.lo + ((band.hi - band.lo) * i) / steps - st3.params.x0;
          pts.push(this._pt(s, u, h));
        }
        g.add(tubeThrough(pts, 0.05, glow(P.brick, 0.75)));
      }
    } else {
      const pts = [];
      for (let u = 0; u <= uEnd; u += 0.25) pts.push(this._pt(s, u, A.y(st3.params.x0 + u)));
      g.add(tubeThrough(pts, 0.03, glow(P.gold, 0.95)));
      for (const x of P4.crossings(A, h)) this._marker(g, this._pt(s, x - st3.params.x0, h), P.brick);
      const v = P4.vertex(A);
      this._marker(g, this._pt(s, v.x - st3.params.x0, v.y), P.ink);
      const dropPts = [];
      for (let y = 0.05; y <= v.y; y += Math.max(0.2, v.y / 12)) dropPts.push(this._pt(s, v.x - st3.params.x0, y));
      const dg = new THREE.BufferGeometry().setFromPoints(dropPts);
      const drop = new THREE.Line(dg, new THREE.LineDashedMaterial({
        color: new THREE.Color(P.ink), dashSize: 0.16, gapSize: 0.13, transparent: true, opacity: 0.45,
      }));
      drop.computeLineDistances();
      g.add(drop);
    }

    this.scene.add(g);
    this.group = g;
  }

  _marker(g, p, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), glow(color, 0.98));
    m.position.copy(p);
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 6, 20), glow(this.P.parchment, 0.9));
    ring.position.copy(p);
    ring.lookAt(p.clone().add(new THREE.Vector3(0, 1, 0)));
    g.add(ring);
  }

  /** Declare the KaTeX chips for the current reading (called every frame). */
  labels(L, st3) {
    const { model, sight } = st3;
    if (!sight || !model) return;
    const s = sight, h = st3.h;
    const A = P4.arc(st3.params);
    const at = (u, y) => this._pt(s, u, y);

    if (model !== 'constant') {
      const q = at(2.2, h);
      L.set('r-rule', { tex: `y = ${n(h, 1)}\\ \\text{m}`, x: q.x, y: h, z: q.z, kind: 'rule', dy: -16 });
    }

    if (model === 'constant') {
      const f = st3.figG;
      const d = Math.hypot(f.x - s.x, f.z - s.z);
      const mid = { x: (s.x + f.x) / 2, z: (s.z + f.z) / 2 };
      L.set('r-cord', { tex: `\\text{distance} = ${n(d)}\\ \\text{m}`, x: mid.x, y: 0.1, z: mid.z, kind: 'plain', dy: -20 });
      return;
    }

    if (model === 'linear') {
      const xc = P4.tangentCrossing(A, h);
      if (xc !== null && xc > 0) {
        const q = at(xc, h);
        L.set('r-lin-x', { tex: `x = ${n(xc)}`, x: q.x, y: h, z: q.z, kind: 'claim', dy: -26 });
      }
      const m = at(2.6, A.yTangent(st3.params.x0 + 2.6));
      L.set('r-lin-m', { tex: `y = ${n(st3.params.y0, 1)} + ${n(A.b)}\\,x`, x: m.x, y: m.y, z: m.z, kind: 'model', dy: -30 });
      return;
    }

    const full = st3.strength >= 0.999;
    const v = P4.vertex(A);
    if (!full) {
      const iv = bothIntervals(st3.params, st3.strength, h);
      const { arcs } = iv ?? P4.degraded(st3.params, st3.strength);
      const aLo = Math.min(...arcs.map((B) => -B.a)), aHi = Math.max(...arcs.map((B) => -B.a));
      if (iv) {
        for (const [key, band, sub] of [['r-q1', iv.near, 1], ['r-q2', iv.far, 2]]) {
          const um = (band.lo + band.hi) / 2 - st3.params.x0;
          const q = at(um, h);
          L.set(key, { tex: rangeTex(sub, band.lo, band.hi), x: q.x, y: h, z: q.z, kind: 'partial', dy: sub === 1 ? -26 : 22 });
        }
      } else {
        const tops = arcs.map((B) => P4.vertex(B).y);
        const q = at(v.x - st3.params.x0, v.y);
        L.set('r-qpeak', { tex: peakBandTex(Math.min(...tops), Math.max(...tops), h), x: q.x, y: q.y, z: q.z, kind: 'partial', dy: -26 });
      }
      const m = at(3.2, Math.max(h + 1.4, v.y + 0.7));
      L.set('r-qm', { tex: quadBandTex(A.c, A.b, aLo, aHi), x: m.x, y: m.y, z: m.z, kind: 'model-partial', dy: 0 });
    } else {
      P4.crossings(A, h).forEach((x, i) => {
        const q = at(x - st3.params.x0, h);
        L.set('r-qx' + i, { tex: `x_{${i + 1}} = ${n(x)}`, x: q.x, y: h, z: q.z, kind: 'solved', dy: i === 0 ? -28 : 26 });
      });
      const qv = at(v.x - st3.params.x0, v.y);
      L.set('r-qv', { tex: `\\left(${n(v.x)},\\ ${n(v.y)}\\right)`, x: qv.x, y: qv.y, z: qv.z, kind: 'solved', dy: -30 });
      const m = at(3.2, Math.max(h + 1.5, v.y + 0.8));
      L.set('r-qm', { tex: quadTex(A.c, A.b, -A.a), x: m.x, y: m.y, z: m.z, kind: 'model', dy: 0 });
    }

    if (st3.architect) {
      const m = at(3.2, Math.max(h + 1.5, v.y + 0.8) - 0.8);
      L.set('r-arch', { tex: physicsTex(), x: m.x, y: m.y, z: m.z, kind: 'architect', dy: 0 });
    }
  }
}
