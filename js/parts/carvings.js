// carvings.js — the reward for being right (design/MEMORY_CARVING_DESIGN.md §3).
// One part, registered in every world under the id 'carvings'. main.js forwards
// every log event here after appending it; content/carvings.json says which
// success events carve which stone, and where it stands.
//
// When a mapped success fires, a low leaning tablet comes up out of the ground
// at the station, pulses gold once, and the entry is written to the bag. The
// inscription chip above it reads in full while the memory is strong and
// clouds to dots when it has decayed; reading the carving IS the review and
// restores it. Nothing here is ever a gate: decay clouds assistance and
// nothing else (Law 3 — the world's answer is the feedback, never a scolding).
//
// All player-facing strings are PLACEHOLDERS. Notes and tex come from
// content/carvings.json, which the owner authors.

import * as THREE from '../../vendor/three/three.module.js';
import { bag } from '../bag.js';

const STONE = '#8a8578';
const GOLD = '#c8a24a';
const CLOUDED = '\\cdot\\cdot\\cdot';   // the chip when the memory has faded
const CLEAR = 0.35;      // strength at or above which a carving reads in full
const NEAR = 10;         // m — chips belong to the carving you are standing with
const HOLD = 0.14;       // s — anticipation: the beat before the stone comes up
const RISE = 0.5;        // s — the scale-in itself

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
/** eased with a small overshoot, so the stone arrives and settles, never snaps */
const backOut = (p) => { const c = 1.70158, u = p - 1; return 1 + u * u * ((c + 1) * u + c); };

export default class Carvings {
  /** @param ctx { scene, world, enc, log, PH, game, dyn } — see js/parts/_contract.md */
  constructor(ctx) {
    const { scene, world, log, PH, game, dyn } = ctx || {};
    this.scene = scene; this.log = log; this.PH = PH; this.game = game; this.dyn = dyn;

    const meta = (world && world.meta) || {};
    this.wid = meta.id || '';
    this.wname = meta.name || meta.title || this.wid;   // PLACEHOLDER wording

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = null;

    this.map = null;              // this world's block of content/carvings.json
    this.rendered = new Map();    // id -> carving record
    this.queued = [];             // log events waiting for the next update tick
    this.card = null;             // which carving the open panel is showing

    // the map arrives asynchronously; until it does the part is simply inert,
    // and a world with no block of its own stays inert forever
    fetch('content/carvings.json')
      .then((r) => r.json())
      .then((j) => { this.map = (j && j[this.wid]) || null; this._boot(); })
      .catch(() => { this.map = null; });
  }

  // ---------- the map ----------
  /** every carving already in the bag for THIS world that this world can place */
  _boot() {
    if (!this.map) return;
    for (const e of bag.list()) {
      if (!e || e.world !== this.wid) continue;
      const d = this._byId(e.id);
      if (d) this._carve(d, false);
    }
  }

  _byId(id) {
    for (const k in this.map) {
      const v = this.map[k];
      const list = Array.isArray(v) ? v : [v];
      for (const d of list) if (d && d.id === id) return d;
    }
    return null;
  }

  /** the entry for this event: a bare value, or the one member of an array
   *  whose 'when' condition the event data satisfies (see wood.train.solve) */
  _match(type, data) {
    if (!this.map) return null;
    const v = this.map[type];
    if (!v) return null;
    const list = Array.isArray(v) ? v : [v];
    for (const d of list) {
      if (!d || !d.id) continue;
      if (d.when) {
        if (!data || data[d.when.key] !== d.when.equals) continue;
      }
      return d;
    }
    return null;
  }

  // ---------- the stone ----------
  _carve(d, live) {
    if (!d || !d.at || !d.id || this.rendered.has(d.id)) return null;
    const x = d.at.x, z = d.at.z;
    const y = (this.dyn && typeof this.dyn.groundH === 'function') ? this.dyn.groundH(x, z) : 0;
    const c = { id: d.id, data: d, x, z, y, group: null, stoneM: null, edgeM: null, anim: null, pulse: 0 };
    this._build(c, live);
    this.rendered.set(d.id, c);
    // colliders are collected once, at registry time: only the boot-rendered
    // stones can claim one. A tablet that appears LIVE gets none (see friction).
    if (!live) this.colliders.push({ type: 'circle', x, z, r: 0.4 });
    return c;
  }

  _build(c, live) {
    const g = new THREE.Group();
    g.position.set(c.x, c.y, c.z);

    // one material instance per stone, so a pulse belongs to its own carving
    const stoneM = mat(STONE, { emissive: new THREE.Color(GOLD), emissiveIntensity: 0 });
    const edgeM = mat(GOLD, { emissive: new THREE.Color(GOLD), emissiveIntensity: 0.25, roughness: 0.6 });
    c.stoneM = stoneM; c.edgeM = edgeM;

    const M = (geo, material, x, y, z, parent) => {
      const o = new THREE.Mesh(geo, material);
      o.position.set(x, y, z);
      o.castShadow = true; o.receiveShadow = true;
      parent.add(o);
      return o;
    };

    // base: a slab bedded in the ground, holding the face at its lean
    M(new THREE.BoxGeometry(0.74, 0.13, 0.42), stoneM, 0, 0.065, 0, g);

    // face: the tablet proper, leaning back off the base
    const lean = new THREE.Group();
    lean.position.set(0, 0.11, 0.04);
    lean.rotation.x = -0.22;
    M(new THREE.BoxGeometry(0.6, 0.75, 0.09), stoneM, 0, 0.375, 0, lean);
    M(new THREE.BoxGeometry(0.63, 0.045, 0.11), edgeM, 0, 0.772, 0, lean);   // gold top edge
    g.add(lean);

    this.scene.add(g);
    c.group = g;

    // PLACEHOLDER prompt and label (owner-authored voice)
    const act = {
      part: 'carvings', kind: 'read', id: c.id,
      prompt: 'Read the carving',
      label: 'A carved stone',
      reach: 3.2,
    };
    g.userData.act = act;
    this.interactables.push(g);

    // a fat invisible gaze proxy: a 0.75 m tablet is too small to rest the eye
    // on from walking distance. Standalone, so the label-occlusion pass never
    // sees it; the rim outline lands on the visible stone.
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.7, 1.3),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.set(c.x, c.y + 0.75, c.z);
    proxy.userData.act = act;
    proxy.userData.glowRoot = g;
    this.scene.add(proxy);
    this.interactables.push(proxy);
    c.proxy = proxy;

    if (live) {
      // anticipation, ease, settle — the stone is never simply there
      g.scale.set(0.001, 0.001, 0.001);
      g.position.y = c.y - 0.22;
      c.anim = { t: 0 };
      c.pulse = 1;
    }
  }

  // ---------- per-frame ----------
  update(dt, u) {
    // queued log events go out HERE, never from inside onLog: main forwards
    // every appended event back to us, and onLog ignores carve.* for the same
    // reason. One tick of latency, no recursion.
    if (this.queued.length) {
      const out = this.queued;
      this.queued = [];
      for (const ev of out) {
        try { this.log.push(ev[0], ev[1]); } catch (e) { /* the world keeps running */ }
      }
    }

    const d = Math.min(Math.max(dt || 0, 0), 0.1);
    for (const c of this.rendered.values()) {
      if (c.anim) {
        c.anim.t += d;
        const t = c.anim.t;
        const p = clamp((t - HOLD) / RISE, 0, 1);
        if (p <= 0) {
          c.group.scale.set(0.001, 0.001, 0.001);
        } else if (p < 1) {
          const s = backOut(p);
          c.group.scale.set(s, s, s);
        } else {
          const q = t - HOLD - RISE;   // settle: one small breath, damped to still
          c.group.scale.set(1, 1 + 0.035 * Math.sin(q * 22) * Math.exp(-7 * q), 1);
        }
        c.group.position.y = c.y - 0.22 * (1 - smooth(p));
        if (t >= HOLD + RISE + 0.35) {
          c.anim = null;
          c.group.scale.set(1, 1, 1);
          c.group.position.y = c.y;
        }
      }
      if (c.pulse > 0) {
        c.pulse = Math.max(0, c.pulse - d * 1.1);   // one gold breath, then stone
        c.edgeM.emissiveIntensity = 0.25 + c.pulse * 1.5;
        c.stoneM.emissiveIntensity = c.pulse * 0.3;
      }
    }
  }

  // ---------- the world speaking ----------
  /** main.js hands us every log event AFTER appending it. Our own carve.*
   *  events come back through here; returning at once is what keeps the
   *  wrapper from recursing. */
  onLog(type, data) {
    if (typeof type !== 'string' || type.indexOf('carve.') === 0) return;
    const d = this._match(type, data);
    if (!d) return;
    const known = this.rendered.has(d.id);
    if (!known) this._carve(d, true);
    // idempotent: a stone already standing just has its memory refreshed,
    // silently. Only a NEW carving is worth an event.
    bag.earn({ id: d.id, world: this.wid, tex: d.tex, note: d.note });
    if (!known) this.queued.push(['carve.earned', { id: d.id, world: this.wid }]);
  }

  // ---------- chips ----------
  labels(L, architectOn) {
    if (!this.rendered.size) return;
    const p = (this.game && typeof this.game.playerPos === 'function') ? this.game.playerPos() : null;
    const now = Date.now();
    for (const c of this.rendered.values()) {
      if (p) {
        const dx = p.x - c.x, dz = p.z - c.z;
        if (dx * dx + dz * dz > NEAR * NEAR) continue;   // the near carving only
      }
      const clear = bag.strength(bag.get(c.id), now) >= CLEAR;
      L.set('carve-' + c.id, {
        tex: clear ? c.data.tex : CLOUDED,   // faded: the inscription clouds to dots
        x: c.x, y: c.y + 1.35, z: c.z, kind: 'rule', dy: 0,
      });
    }
  }

  // ---------- card ----------
  // PLACEHOLDER strings throughout. Reading is contemplative: the card is not
  // dismissed on a timer, it goes when the player walks away or presses Escape.
  panel(st) {
    const c = this.card ? this.rendered.get(this.card) : null;
    if (!c) return '';
    const K = this.PH.K;
    const e = bag.get(c.id);
    const clear = bag.strength(e) >= CLEAR;
    const reviews = (e && e.reviews) | 0;
    return `
      <h2>A carving</h2>
      <div class="eq">${K(c.data.tex, true)}</div>
      ${clear
        ? `<p>${c.data.note}</p>`
        : `<p>The carving has clouded. Reading it restores it.</p>`}
      <p class="muted tiny">carved in ${this.wname} · read ${reviews} times</p>`;
  }

  onInteract(act, PH) {
    if (!act || act.kind !== 'read') return;
    const c = this.rendered.get(act.id);
    if (!c) return;
    this.card = act.id;
    this.panelAnchor = { x: c.x, z: c.z, reach: 4.5 };   // walk away and it goes
    PH.openPanel('p:carvings');
    // reading IS the review: strength restored, count up, the clouding lifts
    const e = bag.review(act.id);
    if (e && typeof PH.refresh === 'function') PH.refresh();
    this.queued.push(['carve.review', {
      id: act.id, strength: Math.round(bag.strength(e) * 100) / 100,
    }]);
  }
}
