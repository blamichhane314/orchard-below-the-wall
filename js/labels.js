// labels.js — the risky seam, on the real engine. Same contract as every
// prior renderer: KaTeX re-renders only when the TeX changes; per-frame work
// is one transform write; registration is positional while type size stays
// clamped legible. New here: anchors live in the engine's scene, so a label
// can be OCCLUDED — a chip whose anchor is hidden behind geometry dims rather
// than pretending to float in front of the world.

import * as THREE from '../vendor/three/three.module.js';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ray = new THREE.Raycaster();

export class MathLabels {
  constructor(el, camera) {
    this.el = el;
    this.camera = camera;
    this.items = new Map();
  }

  set(id, { tex, x, y, z, kind = 'plain', dx = 0, dy = 0, html = null }) {
    let it = this.items.get(id);
    if (!it) {
      const node = document.createElement('div');
      node.className = 'wlabel wlabel-' + kind;
      this.el.appendChild(node);
      it = { node, tex: null, html: null, kind: null };
      this.items.set(id, it);
    }
    if (it.kind !== kind) { it.node.className = 'wlabel wlabel-' + kind; it.kind = kind; }
    if (html !== null) {
      if (it.html !== html) { it.node.innerHTML = html; it.html = html; it.tex = null; }
    } else if (it.tex !== tex) {
      it.node.innerHTML = window.katex.renderToString(tex, {
        throwOnError: false, displayMode: false, output: 'html',
      });
      it.tex = tex; it.html = null;
    }
    it.wx = x; it.wy = y; it.wz = z; it.dx = dx; it.dy = dy; it.live = true;
    return it;
  }

  beginFrame() { for (const it of this.items.values()) it.live = false; }
  endFrame() {
    for (const [id, it] of this.items) {
      if (!it.live) { it.node.remove(); this.items.delete(id); }
    }
  }

  /** @param occluders  meshes that may legitimately hide a reading */
  sync(w, h, occluders = []) {
    const camPos = this.camera.getWorldPosition(_dir.set(0, 0, 0)).clone();
    for (const it of this.items.values()) {
      _v.set(it.wx, it.wy, it.wz);
      const dist = _v.distanceTo(camPos);
      _v.project(this.camera);
      const behind = _v.z > 1;
      const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
      const vis = !behind && sx > -180 && sx < w + 180 && sy > -90 && sy < h + 90;
      it.node.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) continue;

      let occ = false;
      if (occluders.length) {
        _dir.set(it.wx, it.wy, it.wz).sub(camPos).normalize();
        _ray.set(camPos, _dir);
        // a blocker must stand MEANINGFULLY in front (walls, trees) — a chip
        // grazing the shoulder of its own object is not hidden by it
        _ray.far = Math.max(0.1, dist - 1.2);
        occ = _ray.intersectObjects(occluders, true).length > 0;
      }
      // player-facing chips vanish behind walls and beyond earshot; only
      // architect view keeps its deliberate dim through-wall reading
      const arch = it.kind === 'architect';
      const cull = (occ || dist > 32) && !arch;
      it.node.classList.toggle('cull', cull);
      it.node.classList.toggle('occ', !cull && occ && arch);

      const s = Math.max(0.72, Math.min(1.3, 5.2 / Math.max(1e-3, dist)));
      it.node.style.transform =
        `translate(-50%,-50%) translate(${(sx + it.dx).toFixed(2)}px, ${(sy + it.dy).toFixed(2)}px) scale(${s.toFixed(3)})`;
    }
  }

  clear() { for (const it of this.items.values()) it.node.remove(); this.items.clear(); }
}
