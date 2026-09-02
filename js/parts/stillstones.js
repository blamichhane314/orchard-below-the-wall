// stillstones.js — the ring of carvings in the still place.
// design/MEMORY_CARVING_DESIGN.md §5: every carving the player has earned, from
// every world, stands here as one low stone. Reading a stone IS the review: it
// restores the carving's strength and counts it. Nothing here gates anything;
// this place only remembers.
//
// The bag (js/bag.js, localStorage-backed) is the memory of record. This part
// reads it and never writes to it except through bag.review, which is what
// reading a stone means. Decay v0 clouds a faded chip down to dots; the card
// itself never withholds, because opening the card has already restored the
// carving. Decay degrades assistance, never permission.
//
// PERCEPTUAL CONTRACT: one stone per bag entry, no more and no fewer, and the
// ring order is the order they were earned. Nothing about a stone is stored
// twice: its chip, its card, and its collider all read the same entry.

import * as THREE from '../../vendor/three/three.module.js';
import { bag } from '../bag.js';
const WNAMES = { 'orchard-clearing-3d': 'the orchard', 'vale-factor': 'the vale', 'wood-ways': 'the ways' };


const RING_R = 6.5;      // the ring the player walks inside of
const INNER_R = 4.0;     // overflow past 24: a second, closer ring
const RING_MAX = 24;
const CHIP_Y = 1.4;      // clear of a ~0.9 m tablet by half a metre
const NEAR_M = 12;       // chips only for the stones you are standing among
const CLOUD = 0.35;      // below this strength the carving reads as dots
const CLOUDED = '\\cdot\\cdot\\cdot';
const LEAN = 0.2;        // radians: the face tilts up toward the reader
const PULSE_UP = 0.18, PULSE_T = 1.0;   // rise, then settle, within a second

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const smooth = (t) => t * t * (3 - 2 * t);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default class StillStones {
  /** @param ctx { scene, world, enc, log, PH, game, dyn } — see parts/_contract.md */
  constructor(ctx) {
    this.ctx = ctx;
    this.PH = ctx.PH;
    this.log = ctx.log;

    this.colliders = [];
    this.solid = [];
    this.interactables = [];
    this.panelAnchor = null;

    this.stones = [];        // { id, entry, x, z, faceMat, pulse }
    this.byId = new Map();
    this.card = null;
    this._pp = { x: 0, z: 0 };   // last known player position, for the chip gate

    let entries = [];
    try { entries = (bag.list() || []).slice(); } catch { entries = []; }

    if (!entries.length) {
      // an empty bag is not an error state and does not say so: one blank
      // tablet stands in the middle, facing the way the player comes in
      this._tablet(ctx, {
        x: 0, z: 0, faceY: Math.PI, carved: false, entry: null,
        act: { part: 'still-stones', kind: 'empty', prompt: 'Read the stone', label: 'An uncarved stone' },
      });
    } else {
      const outer = Math.min(entries.length, RING_MAX);
      const inner = entries.length - outer;
      entries.forEach((entry, i) => {
        const onOuter = i < outer;
        const R = onOuter ? RING_R : INNER_R;
        const k = onOuter ? i : i - outer;
        const n = onOuter ? outer : inner;
        // start at the point nearest the spawn (south, z negative) and walk
        // clockwise seen from above: south, west, north, east
        const a = (k / n) * Math.PI * 2;
        const x = -Math.sin(a) * R, z = -Math.cos(a) * R;
        this._tablet(ctx, {
          x, z, faceY: Math.atan2(-x, -z), carved: true, entry,   // every face turns in to the centre
          act: {
            part: 'still-stones', kind: 'read', id: entry.id,
            prompt: 'Read the stone', label: 'A carved stone',    // PLACEHOLDER (owner-authored)
          },
        });
      });
    }

    this.log.push('still.enter', { count: entries.length });
  }

  /** One low leaning tablet: a sunk base, a tilted face, a gold top edge. */
  _tablet(ctx, o) {
    const P = ctx.world.palette;
    const y = ctx.dyn && typeof ctx.dyn.groundH === 'function' ? ctx.dyn.groundH(o.x, o.z) : 0;

    const g = new THREE.Group();
    g.position.set(o.x, y, o.z);
    g.rotation.y = o.faceY;

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.36), mat('#7c7768'));
    base.position.y = 0.07;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // the face pivots at its foot, so the lean never lifts it off the base
    const faceG = new THREE.Group();
    faceG.position.set(0, 0.11, -0.02);
    faceG.rotation.x = -LEAN;
    const faceMat = mat('#8a8578', { emissive: new THREE.Color(P.gold), emissiveIntensity: 0 });
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.1), faceMat);
    face.position.y = 0.4;
    face.castShadow = true; face.receiveShadow = true;
    faceG.add(face);
    if (o.carved) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.05, 0.115),
        mat('#c8a24a', { emissive: new THREE.Color('#c8a24a'), emissiveIntensity: 0.3 }));
      edge.position.y = 0.795;
      faceG.add(edge);
    }
    g.add(faceG);

    ctx.scene.add(g);
    this.solid.push(g);
    this.colliders.push({ type: 'circle', x: o.x, z: o.z, r: 0.4 });

    // a fat invisible gaze proxy, standalone so the occlusion pass never sees
    // it; the rim outline lands on the tablet itself
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.7, 1.1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.set(o.x, y + 0.85, o.z);
    proxy.userData.act = o.act;
    proxy.userData.glowRoot = g;
    ctx.scene.add(proxy);
    this.interactables.push(proxy);

    const st = { id: o.act.id ?? 'empty', entry: o.entry, x: o.x, y, z: o.z, group: g, faceMat, pulse: -1 };
    this.stones.push(st);
    this.byId.set(st.id, st);
    return st;
  }

  // ---------- reading a stone is the review ----------
  onInteract(act, PH) {
    const H = PH || this.PH;
    if (act.kind === 'empty') {
      this.card = 'empty';
      this.panelAnchor = { x: 0, z: 0, reach: 4.5 };
      H.openPanel('p:still-stones');
      return;
    }
    if (act.kind !== 'read') return;
    const st = this.byId.get(act.id);
    this.card = act.id;
    this.panelAnchor = st ? { x: st.x, z: st.z, reach: 4.5 } : null;
    H.openPanel('p:still-stones');
    let fresh = null;
    try { fresh = bag.review(act.id); } catch { fresh = null; }
    if (fresh && st) st.entry = fresh;
    this.log.push('still.review', { id: act.id });
    if (st) st.pulse = 0;        // one warm breath across the face, then gone
    if (typeof H.refresh === 'function') H.refresh();   // the card reads the carving AFTER the read
  }

  // ---------- per-frame: the pulse, and where the player is standing ----------
  update(dt, u) {
    const p = this._player(u);
    if (p) { this._pp.x = p.x; this._pp.z = p.z; }
    for (const st of this.stones) {
      if (st.pulse < 0) continue;
      st.pulse += dt;
      const t = st.pulse;
      const k = t < PULSE_UP
        ? smooth(t / PULSE_UP)
        : 1 - smooth(Math.min(1, (t - PULSE_UP) / (PULSE_T - PULSE_UP)));
      st.faceMat.emissiveIntensity = 0.42 * k;
      if (t >= PULSE_T) { st.faceMat.emissiveIntensity = 0; st.pulse = -1; }
    }
  }

  _player(u) {
    const g = this.ctx.game;
    if (g && typeof g.playerPos === 'function') {
      try { const p = g.playerPos(); if (p) return p; } catch { /* priming call */ }
    }
    return u && u.controls ? u.controls.pos : null;
  }

  // ---------- chips: the carving, or dots if it has faded ----------
  labels(L, architectOn) {
    const p = this._pp;
    for (const st of this.stones) {
      if (!st.entry) continue;                                    // an uncarved stone says nothing
      if (Math.hypot(p.x - st.x, p.z - st.z) > NEAR_M) continue;   // only the stones you stand among
      let s = 1;
      try { s = bag.strength(st.entry); } catch { s = 1; }
      L.set('sst-' + st.id, {
        tex: s >= CLOUD ? st.entry.tex : CLOUDED,
        x: st.x, y: st.y + CHIP_Y, z: st.z, kind: 'plain', dy: 0,
      });
    }
    if (architectOn) {
      L.set('sst-arch', {
        tex: '\\texttt{review\\ surface\\ (decay\\ v0)}',
        x: 0, y: 2.2, z: 0, kind: 'architect', dy: 0,
      });
    }
  }

  // ---------- the card ----------
  // PLACEHOLDER prose throughout (owner-authored voice). The card never
  // withholds the note: opening it restored the carving, so there is nothing
  // left to withhold.
  panel(st) {
    const K = this.PH.K;
    const s = this.byId.get(this.card);
    if (!s) return '';
    if (!s.entry) {          // the uncarved tablet is the stone with nothing behind it
      return `
        <h2>An uncarved stone</h2>
        <p class="lede">Nothing is carved yet. What you answer rightly in the worlds is written here.</p>`;
    }
    const e = s.entry;
    const n = e.reviews || 0;
    return `
      <h2>A carving</h2>
      <div class="eq">${K(e.tex, true)}</div>
      <p>${esc(e.note)}</p>
      <p class="muted tiny">from ${esc(WNAMES[e.world] || e.world)} · read ${n} ${n === 1 ? 'time' : 'times'}</p>`;
  }
}
