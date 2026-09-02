// stations.js — the content components, at first-course level, with the
// world doing the talking (Law 3): a picked way-stone draws its rule's honest
// light-path and you SEE whether it bends; a mis-set counting gate tips by the
// true difference of its sides; door slots are laid against the lintel curve
// so wrong numbers visibly miss where the curve rests.

import * as THREE from '../vendor/three/three.module.js';

const glowMat = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

function tubeFromPoints(pts, radius, material) {
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 2), radius, 6, false), material);
}

export class Stations {
  constructor(scene, world, enc, dyn, log) {
    this.scene = scene; this.world = world; this.enc = enc; this.dyn = dyn; this.log = log;
    this.P = world.palette;
    this.gateSolved = false;
    this.doorSolved = false;
    this.gateX = null;          // last count set on the gate
    this.doorPicks = null;      // last pair set in the door slots
    this._syncGatePebbles(this._gateCount ?? 0);
  }

  // ---------- way-stones ----------
  ruleY(rule, x) { const [a2, a1, a0] = rule.c; return a2 * x * x + a1 * x + a0; }

  pickWaystone(i) {
    const ws = this.dyn.waystones[i];
    const rule = this.enc.waystones.rules[i];
    const bends = rule.c[0] !== 0;
    this.log.push('waystone.pick', { index: i, rule: rule.tex, bends });

    if (ws.beam) { this.scene.remove(ws.beam); ws.beam = null; }
    // the rule's honest light-path, drawn from the stone along the way (+x),
    // vertically to scale — a straight rule is SEEN to be straight
    const pts = [];
    const S = 0.34;
    for (let x = 0; x <= 6.4; x += 0.22) {
      const y = this.ruleY(rule, x) * S;
      if (y < 0.05 || y > 4.6) continue;
      pts.push(new THREE.Vector3(ws.top.x + 0.2 + x, y + 0.15, ws.top.z));
    }
    if (pts.length > 2) {
      ws.beam = tubeFromPoints(pts, 0.024, glowMat(this.P.gold, 0.9));
      this.scene.add(ws.beam);
    }
    ws.fade = bends ? 0 : 3.0;   // the bending rule's path stays; straight ones fade out
    if (bends) {
      ws.stoneMesh.material.emissive = new THREE.Color(this.P.gold);
      ws.stoneMesh.material.emissiveIntensity = 0.3;
    }
  }

  // ---------- counting gate ----------
  setGateCount(x) {
    const G = this.enc.countingGate;
    const lhs = G.lhs.times * x + G.lhs.plus;
    const ok = lhs === G.rhs;
    this.gateX = x;
    this._gateCount = x;
    this._syncGatePebbles(x);
    this.dyn.gate.targetTilt = ok ? 0 : Math.max(-0.42, Math.min(0.42, (G.rhs - lhs) * 0.055));
    this.log.push('countgate.set', { x, lhs, rhs: G.rhs, ok });
    if (ok && !this.gateSolved) {
      this.gateSolved = true;
      this.log.push('countgate.open', {});
    }
    return { lhs, ok };
  }

  _syncGatePebbles(x) {
    const G = this.enc.countingGate;
    const counts = [G.lhs.times * (x ?? 0) + G.lhs.plus, G.rhs];   // [near basket, far basket]
    this.dyn.gate.baskets.forEach((b, bi) => {
      while (b.pebbles.children.length) b.pebbles.remove(b.pebbles.children[0]);
      const n = counts[bi];
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5),
          new THREE.MeshStandardMaterial({ color: this.P.stoneLit, flatShading: true, roughness: 1 }));
        const a = i * 2.4, rr = 0.02 + 0.05 * Math.sqrt(i % 7);
        p.position.set(Math.cos(a) * rr, 0.05 + Math.floor(i / 7) * 0.075, Math.sin(a) * rr);
        b.pebbles.add(p);
      }
    });
  }

  // ---------- door roots ----------
  // No lintel drawing for now (owner's call: it wasn't earning its place).
  // The door's answer is the door: it opens, or iron refuses.
  setDoorRoots(r1, r2) {
    const D = this.enc.doorRoots;
    const picks = [r1, r2].sort((a, b) => a - b);
    const truth = [...D.answers].sort((a, b) => a - b);
    const ok = picks[0] === truth[0] && picks[1] === truth[1];
    this.doorPicks = picks;
    this.log.push('door.attempt', { picks: picks.join('|'), ok });
    if (ok && !this.doorSolved) {
      this.doorSolved = true;
      this.dyn.door.open = true;
      this.log.push('door.open', {});
    }
    return ok;
  }

  takeRock() {
    if (this.dyn.rock) { this.scene.remove(this.dyn.rock); this.dyn.rock = null; }
  }

  dropFig() {
    if (this.dyn.fig.dropT < 0) {
      this.dyn.fig.dropT = 0;
      this.scene.remove(this.dyn.fig.stem);
    }
  }

  update(dt) {
    const d = this.dyn;

    // canopy sway
    d.t += dt;
    for (const c of d.canopies) {
      c.canopy.rotation.z = Math.sin(d.t * 0.55 + c.seed) * 0.012;
      c.canopy.rotation.x = Math.cos(d.t * 0.42 + c.seed * 1.7) * 0.008;
    }

    // pollen drift
    if (d.motes) {
      const pos = d.motes.pts.geometry.attributes.position;
      for (let i = 0; i < d.motes.seed.length; i++) {
        const s = d.motes.seed[i];
        pos.array[i * 3]     = d.motes.base[i * 3]     + Math.sin(d.t * 0.21 + s) * 0.6;
        pos.array[i * 3 + 1] = d.motes.base[i * 3 + 1] + Math.sin(d.t * 0.33 + s * 2.1) * 0.25;
        pos.array[i * 3 + 2] = d.motes.base[i * 3 + 2] + Math.cos(d.t * 0.17 + s) * 0.5;
      }
      pos.needsUpdate = true;
    }

    // seesaw settles toward the honest difference; pans hang level
    const g = d.gate;
    g.tilt += (g.targetTilt - g.tilt) * Math.min(1, dt * 3.2);
    g.beamG.rotation.x = g.tilt;
    for (const b of g.baskets) b.group.rotation.x = -g.tilt;
    if (this.gateSolved && !g.open) {
      g.lift = Math.min(1.9, g.lift + dt * 1.5);
      g.group.position.y = g.lift;
      if (g.lift >= 1.88) g.open = true;
    }

    // door swings once solved
    const dr = d.door;
    if (dr.open && dr.ang > -1.85) {
      dr.ang = Math.max(-1.85, dr.ang - dt * 1.7);
      dr.hinge.rotation.y = dr.ang;
      d.interiorLight.intensity = Math.min(2.4, d.interiorLight.intensity + dt * 2.2);
    }

    // straight way-stone beams fade; the bending one stays
    for (const ws of d.waystones) {
      if (ws.beam && ws.fade > 0) {
        ws.fade -= dt;
        ws.beam.material.opacity = Math.max(0, Math.min(0.9, ws.fade / 1.2));
        if (ws.fade <= 0) { this.scene.remove(ws.beam); ws.beam = null; }
      }
    }

    // the fig falls honestly-ish (quadratic ease), then rests
    const f = d.fig;
    if (f.dropT >= 0 && f.dropT < 1) {
      f.dropT = Math.min(1, f.dropT + dt / 0.75);
      const t = f.dropT;
      f.mesh.position.y = 4.4 - (4.4 - 0.14) * t * t;
      f.mesh.position.x += dt * 0.35;
      f.mesh.rotation.z -= dt * 2.2;
    }
  }
}
