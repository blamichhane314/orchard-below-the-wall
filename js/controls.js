// controls.js — first-person body: pointer-lock look with pitch, WASD with
// acceleration and damping, and circle-vs-world collision. The feel target is
// "smooth and unremarkable": movement should disappear into the hand.

import * as THREE from '../vendor/three/three.module.js';

export class FPSControls {
  constructor(camera, dom, { eye = 1.6, speed = 4.4, radius = 0.32 } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.eye = eye; this.speed = speed; this.radius = radius;
    this.pos = new THREE.Vector3(0, eye, 0);
    this.vel = new THREE.Vector2(0, 0);       // xz
    this.yaw = 0; this.pitch = 0;
    this.bobPhase = 0; this.bob = 0;
    this.keys = new Set();
    this.locked = false;

    camera.rotation.order = 'YXZ';

    dom.addEventListener('click', () => {
      if (document.pointerLockElement !== dom) {
        // Pointer lock is unavailable in some embeddings (sandboxed panes);
        // swallow the rejection — drag-to-look below covers those.
        const p = dom.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      document.body.classList.toggle('locked', this.locked);
    });
    let dragging = false;
    dom.addEventListener('mousedown', () => { dragging = true; });
    addEventListener('mouseup', () => { dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!this.locked && !(dragging && e.buttons & 1)) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = Math.max(-1.05, Math.min(1.05, this.pitch));
    });
    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }

  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right()   { return { x: -Math.sin(this.yaw - Math.PI / 2), z: -Math.cos(this.yaw - Math.PI / 2) }; }

  lookAt(x, y, z) {
    const dx = x - this.pos.x, dy = y - this.eye, dz = z - this.pos.z;
    this.yaw = Math.atan2(-dx, -dz);
    const dh = Math.hypot(dx, dz);
    this.pitch = Math.max(-1.05, Math.min(1.05, Math.atan2(dy, dh)));
  }

  update(dt, colliders, bounds) {
    const k = this.keys;
    // arrows look — yaw and pitch — for mouseless driving
    if (k.has('arrowleft'))  this.yaw += 1.9 * dt;
    if (k.has('arrowright')) this.yaw -= 1.9 * dt;
    if (k.has('arrowup'))    this.pitch += 1.4 * dt;
    if (k.has('arrowdown'))  this.pitch -= 1.4 * dt;
    this.pitch = Math.max(-1.05, Math.min(1.05, this.pitch));

    let wx = 0, wz = 0;
    const f = this.forward(), r = this.right();
    const fwd = (k.has('w') ? 1 : 0) + (k.has('s') ? -1 : 0);
    const str = (k.has('d') ? 1 : 0) + (k.has('a') ? -1 : 0);
    if (fwd || str) {
      wx = f.x * fwd + r.x * str; wz = f.z * fwd + r.z * str;
      const m = Math.hypot(wx, wz); wx /= m; wz /= m;
    }

    const accel = 26;
    this.vel.x += wx * accel * dt;
    this.vel.y += wz * accel * dt;
    const damp = Math.exp(-((fwd || str) ? 5.2 : 9.5) * dt);
    this.vel.multiplyScalar(damp);
    const sp = this.vel.length();
    if (sp > this.speed) this.vel.multiplyScalar(this.speed / sp);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;

    // collision: push a circle out of circles and boxes
    for (const c of colliders) {
      if (c.active && !c.active()) continue;
      if (c.type === 'circle') {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + this.radius;
        if (d < min && d > 1e-6) {
          this.pos.x = c.x + (dx / d) * min;
          this.pos.z = c.z + (dz / d) * min;
        }
      } else {
        const nx = Math.max(c.minX, Math.min(this.pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(this.pos.z, c.maxZ));
        const dx = this.pos.x - nx, dz = this.pos.z - nz;
        const d = Math.hypot(dx, dz);
        if (d < this.radius) {
          if (d > 1e-6) {
            this.pos.x = nx + (dx / d) * this.radius;
            this.pos.z = nz + (dz / d) * this.radius;
          } else {
            // centre inside the box: eject through the nearest face
            const pushes = [
              { d: this.pos.x - c.minX + this.radius, x: -1, z: 0 },
              { d: c.maxX - this.pos.x + this.radius, x: 1, z: 0 },
              { d: this.pos.z - c.minZ + this.radius, x: 0, z: -1 },
              { d: c.maxZ - this.pos.z + this.radius, x: 0, z: 1 },
            ].sort((a, b) => a.d - b.d)[0];
            this.pos.x += pushes.x * pushes.d;
            this.pos.z += pushes.z * pushes.d;
          }
        }
      }
    }

    this.pos.x = Math.max(bounds.xMin, Math.min(bounds.xMax, this.pos.x));
    this.pos.z = Math.max(bounds.zMin, Math.min(bounds.zMax, this.pos.z));

    // a very small walk bob — presence, not seasickness
    const moving = sp > 0.6;
    this.bobPhase += (moving ? sp * 2.2 : 0) * dt;
    const target = moving ? Math.sin(this.bobPhase) * 0.028 : 0;
    this.bob += (target - this.bob) * Math.min(1, dt * 10);

    // worlds with terrain relief supply a ground-height field; flat worlds don't
    const gy = this.heightFn ? this.heightFn(this.pos.x, this.pos.z) : 0;
    this.camera.position.set(this.pos.x, gy + this.eye + this.bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
