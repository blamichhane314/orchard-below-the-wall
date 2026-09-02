// bridge.js — the serialized form, first instance. An ancient rope-and-plank
// bridge whose gaps each ask one small question; the answer is ENACTED: the
// player chooses a number and the avatar leaps exactly that many plank-lengths.
// Mathematics decides the outcome; animation delivers the feel. (Owner's rule:
// this is how most actions here will work — commit a parameter, watch it play.)
//
// Laws in force: a wrong number falls visibly into the gap, never a scolding
// string (Law 3); the price is time — you surface at the plank you leapt from,
// never the bridge start (Law 8); every gap, leap, choice, and hesitation is
// logged with timings (Law 7) — ten quick gaps are ten samples of one skill.

import * as THREE from '../vendor/three/three.module.js';

const matS = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

export class Bridge {
  constructor(scene, world, enc, log) {
    this.scene = scene; this.log = log;
    this.P = world.palette;
    this.B = world.bridge;
    this.gaps = enc.bridge.gaps;
    this.arch = enc.bridge.architect;
    this.waterY = world.ravine.waterY;

    this.entered = false;
    this.busy = null;            // {phase:'jump'|'fall'|'sunk', ...}
    this.lastSafeSlot = 0;
    this.gapShownAt = new Map(); // gap index -> first-seen ms (fluency timing)
    this.splashes = [];
    this.ropeDrop = -1;

    // slot bookkeeping. THE PERCEPTUAL CONTRACT: the answer n IS the number of
    // missing planks the player can count — never an off-by-one between what
    // is seen and what is said. A leap "of n" clears n holes (travels n+1 slots).
    this.holes = new Set();
    for (const g of this.gaps) for (let s = g.slot + 1; s <= g.slot + g.n; s++) this.holes.add(s);
    this.gapByBrink = new Map(this.gaps.map((g, i) => [g.slot, { ...g, i }]));

    this.endX = this.B.startX + this.B.slots * this.B.slotLen;
    this.colliders = [];
    this._build(world);
  }

  slotCenter(i) { return this.B.startX + (i + 0.5) * this.B.slotLen; }
  slotAt(x) { return Math.floor((x - this.B.startX) / this.B.slotLen); }

  _build(world) {
    const { B, P } = this;
    const g = new THREE.Group();
    const zL = B.z - B.width / 2, zR = B.z + B.width / 2;

    // planks — every slot that is not a hole
    const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < B.slots; i++) {
      if (this.holes.has(i)) continue;
      const r = rng(i * 733);
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(B.slotLen * 0.86, 0.055, B.width),
        matS(r() < 0.3 ? '#5d6242' : (r() < 0.5 ? '#6b5a44' : '#75634b'))
      );
      plank.position.set(this.slotCenter(i), 0.035, B.z);
      plank.rotation.y = (r() - 0.5) * 0.07;
      plank.rotation.x = (r() - 0.5) * 0.02;
      plank.castShadow = true; plank.receiveShadow = true;
      g.add(plank);

      // snapped stub-ends drooping into adjacent holes: the break is SEEN
      for (const side of [-1, 1]) {
        if (!this.holes.has(i + side)) continue;
        const stub = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.04, B.width * (0.5 + r() * 0.3)),
          matS('#4f4536')
        );
        stub.position.set(this.slotCenter(i) + side * (B.slotLen * 0.48), 0.01, B.z + (r() - 0.5) * 0.3);
        stub.rotation.z = -side * (0.18 + r() * 0.15);
        stub.rotation.y = (r() - 0.5) * 0.2;
        stub.castShadow = true;
        g.add(stub);
      }
    }

    // posts + lanterns at both ends
    for (const [px, lantern] of [[B.startX + 0.12, true], [this.endX - 0.12, false]]) {
      for (const pz of [zL, zR]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.35, 7), matS('#5a4a38'));
        post.position.set(px, 0.62, pz); post.castShadow = true;
        g.add(post);
        if (lantern) {
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6),
            matS(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.2 }));
          lamp.position.set(px, 1.42, pz);
          g.add(lamp);
          const pl = new THREE.PointLight(new THREE.Color(P.lamp), 0.85, 5.5, 1.8);
          pl.position.copy(lamp.position);
          g.add(pl);
        }
      }
    }

    // rope rails (sagging) + under-ropes
    const ropeM = matS('#6b5a44');
    for (const pz of [zL, zR]) {
      for (const [h0, sag, r] of [[1.02, 0.26, 0.02], [0.02, 0.1, 0.016]]) {
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 1 / 26) {
          pts.push(new THREE.Vector3(
            B.startX + t * (this.endX - B.startX),
            h0 - sag * (1 - (2 * t - 1) ** 2),
            pz
          ));
        }
        const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 5), ropeM);
        rope.castShadow = true;
        g.add(rope);
      }
    }

    // the entry rope — untied with E, then the bridge is open
    const ropePts = [];
    for (let t = 0; t <= 1.0001; t += 0.1) {
      ropePts.push(new THREE.Vector3(B.startX + 0.28, 0.86 - 0.14 * (1 - (2 * t - 1) ** 2), zL + t * B.width));
    }
    this.ropeMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts), 16, 0.024, 5), matS('#8a6d3f'));
    this.ropeMesh.userData.act = { entity: 'bridge-rope' };
    g.add(this.ropeMesh);
    // a fat invisible proxy so a 2.4cm rope isn't the E-target
    this.ropeProxy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, B.width + 0.3),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.ropeProxy.position.set(B.startX + 0.28, 0.75, B.z);
    this.ropeProxy.userData.act = { entity: 'bridge-rope' };
    g.add(this.ropeProxy);

    this.scene.add(g);
    this.group = g;

    // colliders: bank walls (crossing only by deck), deck edge rails, entry rope
    const R = world.ravine, bd = world.bounds;
    for (const bx of [R.x0, R.x1]) {
      this.colliders.push({ type: 'aabb', minX: bx - 0.12, maxX: bx + 0.12, minZ: bd.zMin - 1, maxZ: zL - 0.02 });
      this.colliders.push({ type: 'aabb', minX: bx - 0.12, maxX: bx + 0.12, minZ: zR + 0.02, maxZ: bd.zMax + 1 });
    }
    this.colliders.push({ type: 'aabb', minX: B.startX, maxX: this.endX, minZ: zR + 0.1, maxZ: zR + 0.3 });
    this.colliders.push({ type: 'aabb', minX: B.startX, maxX: this.endX, minZ: zL - 0.3, maxZ: zL - 0.1 });
    this.colliders.push({ type: 'aabb', minX: B.startX + 0.18, maxX: B.startX + 0.38, minZ: zL, maxZ: zR, active: () => !this.entered });
  }

  untie() {
    if (this.entered) return;
    this.entered = true;
    this.ropeDrop = 0;
    this.log.push('bridge.entered', {});
  }

  onDeck(pos) {
    return pos.x > this.B.startX - 0.2 && pos.x < this.endX + 0.2 && Math.abs(pos.z - this.B.z) < 0.72;
  }

  /** The gap the player is poised at, if any: on its brink plank, facing east. */
  brinkInfo(controls) {
    if (this.busy) return null;
    const pos = controls.pos;
    if (!this.onDeck(pos) || controls.forward().x < 0.45) return null;
    const s = this.slotAt(pos.x);
    if (this.holes.has(s)) return null;
    const gap = this.gapByBrink.get(s);
    if (!gap) return null;
    // near the leading edge of the brink plank
    const into = pos.x - (this.B.startX + s * this.B.slotLen);
    if (into < this.B.slotLen * 0.25) return null;
    if (!this.gapShownAt.has(gap.i)) {
      this.gapShownAt.set(gap.i, performance.now());
      this.log.push('bridge.gap.shown', { gap: gap.i, expr: gap.exprTex, n: gap.n });
    }
    return gap;
  }

  tryLeap(k, controls) {
    const gap = this.brinkInfo(controls);
    if (!gap || this.busy) return false;
    const from = this.slotAt(controls.pos.x);
    const travel = k + 1;                 // clearing k missing planks = k+1 slots
    const target = from + travel;
    const lands = target < this.B.slots && !this.holes.has(target) && target >= 0;
    const shown = this.gapShownAt.get(gap.i);
    this.log.push('bridge.leap', {
      gap: gap.i, expr: gap.exprTex, n: gap.n, chose: k,
      outcome: lands ? 'land' : 'fall',
      ms: shown ? Math.round(performance.now() - shown) : null,
    });
    controls.vel.set(0, 0);
    controls.keys.clear();
    this.busy = {
      phase: 'crouch', t: 0,
      T: 0.42 + 0.09 * travel,
      H: 0.5 + 0.09 * travel,
      x0: controls.pos.x, x1: this.slotCenter(target),
      z0: controls.pos.z,
      lands, from,
    };
    return true;
  }

  _splash(x, z) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 24), glow('#cfe0d6', 0.75));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, this.waterY + 0.04, z);
    this.scene.add(ring);
    this.splashes.push({ ring, t: 0 });
  }

  update(dt, controls, camera) {
    // entry rope drops away
    if (this.ropeDrop >= 0 && this.ropeDrop < 1) {
      this.ropeDrop = Math.min(1, this.ropeDrop + dt * 1.6);
      this.ropeMesh.position.y = -1.4 * this.ropeDrop * this.ropeDrop;
      this.ropeMesh.material.opacity = 1 - this.ropeDrop;
      this.ropeMesh.material.transparent = true;
      if (this.ropeDrop >= 1) { this.group.remove(this.ropeMesh); this.group.remove(this.ropeProxy); }
    }

    // splash rings
    for (const s of this.splashes) {
      s.t += dt;
      const k = 1 + s.t * 6;
      s.ring.scale.set(k, k, 1);
      s.ring.material.opacity = Math.max(0, 0.75 - s.t * 1.4);
      if (s.t > 0.6) this.scene.remove(s.ring);
    }
    this.splashes = this.splashes.filter((s) => s.t <= 0.6);

    const pos = controls.pos;

    if (!this.busy) {
      // footing is strict: over a hole with no plank within a toe-hold means
      // falling NOW — a gap is never something you can stand on, and the first
      // step past a snapped edge answers any confusion about that
      if (this.onDeck(pos)) {
        const s = this.slotAt(pos.x);
        if (!this.holes.has(s) && s >= 0 && s < this.B.slots) this.lastSafeSlot = s;
        else if (this.holes.has(s)) {
          const frac = (pos.x - this.B.startX) / this.B.slotLen - s;
          const toe = 0.10 / this.B.slotLen;
          const edgeHold =
            (frac < toe && !this.holes.has(s - 1)) ||
            (frac > 1 - toe && !this.holes.has(s + 1));
          if (!edgeHold) {
            this.log.push('bridge.walkin', { slot: s });
            controls.vel.set(0, 0); controls.keys.clear();
            this.busy = { phase: 'fall', t: 0, x: pos.x, z: pos.z, y: controls.eye, splashed: false };
          }
        }
      }
      return;
    }

    // animations own the camera while they run: a breath down, the leap
    // (eased, not slid), and a settle on landing — weight without physics
    const b = this.busy;
    if (b.phase === 'crouch') {
      b.t += dt;
      const t = Math.min(1, b.t / 0.09);
      camera.position.set(b.x0, controls.eye - 0.07 * Math.sin(t * Math.PI * 0.5), b.z0);
      if (t >= 1) { this.busy = { ...b, phase: 'jump', t: 0 }; }
    } else if (b.phase === 'jump') {
      b.t += dt;
      const t = Math.min(1, b.t / b.T);
      const s = t * t * (3 - 2 * t);            // smoothstep: launch and arrive softly
      const x = b.x0 + (b.x1 - b.x0) * s;
      const z = b.z0 + (this.B.z - b.z0) * s;
      const y = controls.eye - 0.07 * (1 - Math.min(1, t * 6)) + 4 * b.H * t * (1 - t);
      camera.position.set(x, y, z);
      if (t >= 1) {
        if (b.lands) {
          controls.pos.set(b.x1, controls.eye, this.B.z);
          this.busy = { phase: 'settle', t: 0, x: b.x1 };
        } else {
          this.busy = { phase: 'fall', t: 0, x: b.x1, z: this.B.z, y: controls.eye, splashed: false };
        }
      }
    } else if (b.phase === 'settle') {
      b.t += dt;
      const t = Math.min(1, b.t / 0.16);
      camera.position.set(b.x, controls.eye - 0.06 * Math.sin(t * Math.PI), this.B.z);
      if (t >= 1) { camera.position.set(b.x, controls.eye, this.B.z); this.busy = null; }
    } else if (b.phase === 'fall') {
      b.t += dt;
      const y = b.y - (b.y - (this.waterY + 0.3)) * (b.t / 0.55) ** 2;
      camera.position.set(b.x, Math.max(y, this.waterY + 0.3), b.z);
      if (b.t >= 0.55) {
        if (!b.splashed) { b.splashed = true; this._splash(b.x, b.z); }
        this.busy = { phase: 'sunk', t: 0, x: b.x, z: b.z };
      }
    } else if (b.phase === 'sunk') {
      b.t += dt;
      if (b.t >= 0.55) {
        const rx = this.slotCenter(this.lastSafeSlot);
        controls.pos.set(rx, controls.eye, this.B.z);
        controls.vel.set(0, 0);
        camera.position.set(rx, controls.eye, this.B.z);
        this.log.push('bridge.resurface', { slot: this.lastSafeSlot });
        this.busy = null;
      }
    }
  }

  /** KaTeX chips: each gap wears its question over the missing span. */
  labels(L, architectOn) {
    this.gaps.forEach((g, i) => {
      const cx = this.B.startX + (g.slot + g.n / 2 + 1) * this.B.slotLen;   // centred over the n missing planks
      L.set('bg' + i, { tex: g.exprTex, x: cx, y: 0.78, z: this.B.z, kind: 'plain', dy: 0 });
    });
    if (architectOn) {
      L.set('bg-arch', {
        tex: `\\texttt{${this.arch.concept.replace(/ /g, '\\ ')}}`,
        x: (this.B.startX + this.endX) / 2, y: 2.6, z: this.B.z, kind: 'architect', dy: 0,
      });
    }
  }
}
