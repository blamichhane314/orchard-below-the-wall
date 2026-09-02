// braidedwood.js — the Braided Wood: the trajectory unit in FOREST form
// (design/PATHS_ARTICLE.md). East of the ravine, three trails leave a
// trailhead, braid apart and together, and converge on a library deep in the
// wood. Trails are worn ground, not corridors: NO walls, no gates — trees
// shape the ways but stay see-through. Walking a trail IS choosing it: a
// mouth's trigger zone logs the choice; the misconception trails carry their
// own revision (an a=1 probe, two a=1 drills) and visibly bend home to rejoin
// the trailhead; the true trail splits into two good ways that reconverge at
// the library.
//
// PERCEPTUAL CONTRACT (Law 4): all truth derives at runtime from
// enc.mountainPassage — a pair is right iff p·q = a·c AND p + q = b, order-
// free; no answer is stored. Marker chips, asks, the connection chips
// (1·6 vs 2·6) and the factored chip are built from that data at render time;
// trail geometry, zones and planting come from the tables below — the same
// tables the headless verifier walks.
//
// Deviations: none of substance. Each return leg crosses its own rejoin zone,
// then merges back into its trail's mouth; zone logging is state-gated
// (hub → out → hub) so braided trails may cross without false logs.

import * as THREE from '../../vendor/three/three.module.js';

const mat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, metalness: 0, ...o });
const glow = (c, op = 0.9, fog = true) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, fog });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** squared distance from point (px,pz) to segment a-b (2D, ground plane) */
function d2seg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 ? clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1) : 0;
  const qx = ax + t * dx - px, qz = az + t * dz - pz;
  return qx * qx + qz * qz;
}
/** distance from a point to a polyline (array of [x,z]) */
function dPoly(px, pz, pts) {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++)
    m = Math.min(m, d2seg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return Math.sqrt(m);
}

// ---------- geometry tables (exported: the headless verifier walks these) ----
// The ravine (x −9.5..−1.5) runs north through the region, so the whole unit
// lives EAST of the water, x −0.5..10, z 12..38 — the swap loop hikes along
// the bank. A worn spur leaves the main path near (2.5, 9.5), threads the two
// old trees at (0.5, 16.5) and (7.7, 16.5), and opens on the HUB clearing.
// Every trail is a polyline of [x,z] ground points; strips, zones, planting
// clearance and the verifier all read the SAME tables. Centerlines keep
// ≥1.5 m from every trunk (player radius 0.32; checked headlessly).
export const HUB = { x: 4.3, z: 18.0, r: 2.9 };
export const TRAILS = {
  spur:      [[2.5, 9.5], [1.0, 11.3], [2.0, 13.8], [3.4, 15.9], [4.3, 17.6]],
  // TRUE trail: north mouth, straight-ish to the split at (4.5, 26.8)
  true:      [[4.8, 19.9], [4.3, 22.3], [4.3, 24.6], [4.5, 26.8]],
  // its two good ways, reconverging at the library forecourt
  laneGroup: [[4.5, 26.8], [2.6, 28.6], [1.7, 30.6], [2.9, 32.4], [4.6, 32.9]],
  laneBox:   [[4.5, 26.8], [6.5, 28.4], [7.4, 30.4], [6.2, 32.4], [4.6, 32.9]],
  // IGNORES-A trail: east mouth to the probe clearing, then a west arc home
  igOut:     [[6.3, 18.8], [7.7, 20.3], [8.0, 23.2]],
  igBack:    [[8.0, 23.2], [6.6, 25.2], [6.0, 22.9], [5.8, 20.9], [5.2, 19.4]],
  // SWAP trail: west mouth along the ravine bank, two drills, then back south
  swOut:     [[2.4, 18.9], [0.9, 20.4], [1.3, 21.9], [1.5, 23.2], [1.1, 24.6], [1.6, 25.8]],
  swBack:    [[1.6, 25.8], [2.5, 25.4], [2.6, 23.2], [2.5, 21.2], [2.4, 19.4]],
};
// trigger zones — rects on the trails. kind 'fork' fires only from hub state;
// kind 'rejoin' only when out. tag names the trail; forks carry the marker.
// Each return leg crosses its OWN rejoin zone before rejoining its mouth.
export const ZONES = [
  { id: 'f-true', kind: 'fork',   tag: 'true',       minX: 3.7, maxX: 5.0, minZ: 20.1, maxZ: 21.8 },
  { id: 'f-ig',   kind: 'fork',   tag: 'ignores-a',  minX: 6.3, maxX: 8.1, minZ: 18.9, maxZ: 20.5 },
  { id: 'f-sw',   kind: 'fork',   tag: 'swap-roles', minX: 0.4, maxX: 2.1, minZ: 19.3, maxZ: 21.0 },
  { id: 'r-ig',   kind: 'rejoin', tag: 'ignores-a',  minX: 5.5, maxX: 6.6, minZ: 21.0, maxZ: 22.7 },
  { id: 'r-sw',   kind: 'rejoin', tag: 'swap-roles', minX: 1.9, maxX: 3.2, minZ: 22.4, maxZ: 24.4 },
];
// small clearings kept free of planting: [x, z, radius]
export const CLEARINGS = [
  [HUB.x, HUB.z, 3.0], [8.0, 23.4, 2.2],            // hub, probe
  [0.9, 22.1, 2.0], [1.6, 25.7, 2.0],               // the two drills
  [4.5, 27.0, 2.3], [4.6, 32.5, 2.5],               // the split, the forecourt
];
export const DEBOUNCE_S = 3;                        // zone re-fire guard (seconds)

// station siting (world metres); stones stand ≥1 m OFF their trail's line
const SITE = {
  head:   { x: 5.4, z: 16.9, ry: 4.5 },             // headstone faces the arriving spur
  // way-markers in enc marker order; mouths keyed by tag for architect chips
  markers: [{ x: 3.6, z: 20.3 }, { x: 8.2, z: 19.0 }, { x: 1.35, z: 18.35 }],
  mouths: { 'true': [4.6, 20.8], 'ignores-a': [7.0, 19.5], 'swap-roles': [1.6, 19.7] },
  probe:  { x: 9.0, z: 24.2, ry: 4.0 },             // NE edge of the probe clearing
  drills: [{ x: 0.1, z: 22.4, ry: 1.55 }, { x: 0.6, z: 26.6, ry: 2.5 }],
  // the split's two method slabs: one beside the grouping lane, one beside the box lane
  slabs:  [{ x: 3.0, z: 26.4, ry: 0.7, lane: 'west' }, { x: 5.94, z: 26.2, ry: -0.7, lane: 'east' }],
  lib: { x: 4.6, z: 35.5, w: 5.6, d: 4.6, h: 5.2, doorW: 1.5, doorH: 2.6 },
};
// the carved trail map, in face coords (u right, v up, metres on the stone):
// three ways braid from a start dot to a goal dot; two branches bend back in,
// the third forks and reconverges. Architect chips ride branch midpoints.
const MAP = {
  start: [0, -0.72], goal: [0, 0.66],
  ways: [
    { tag: 'true',       pts: [[0, -0.72], [0.3, -0.4], [0.34, 0.0], [0.16, 0.22], [0.34, 0.38], [0.16, 0.52], [0, 0.66]] },
    { tag: 'true-b',     pts: [[0.16, 0.22], [0.02, 0.38], [0.16, 0.52]] },   // the second good way
    { tag: 'ignores-a',  pts: [[0, -0.72], [-0.06, -0.3], [-0.2, -0.02], [-0.34, -0.3], [-0.12, -0.6], [0, -0.72]] },
    { tag: 'swap-roles', pts: [[0, -0.72], [-0.3, -0.44], [-0.44, -0.06], [-0.5, -0.42], [-0.2, -0.66], [0, -0.72]] },
  ],
  chipAt: { 'true': [0.34, 0.0], 'ignores-a': [-0.2, -0.02], 'swap-roles': [-0.44, -0.06] },
};
// PLACEHOLDER strings, owner-replaceable — every player-facing word lives here
const S = {
  headPrompt: 'Read the trail-stone', headLabel: 'A trailhead, where ways part into the wood',
  markPrompt: 'Read the way-stone', markLabel: 'A low way-stone, carved with a pair',
  probePrompt: 'Read the carved stone', probeLabel: 'A carved stone in a small clearing',
  drillPrompt: 'Read the carved stone', drillLabel: 'A practice stone beside the trail',
  slabPrompt: 'Read the slab', slabLabel: 'A stone slab, carved with a working',
  scrollPrompt: 'Take up the scroll', scrollLabel: 'A scroll on its stand, deep in the wood',
  headH2: 'The trailhead', probeH2: 'The clearing stone', drillH2: 'A practice stone', doneH2: 'The library in the wood',
  headLede: 'A stone at a parting of ways. Three trails leave this clearing, and a map is cut into the face — every way is walked, none is barred.',
  headFoot: 'Each mouth wears its own pair of numbers. Walking a trail is choosing it.',
  probeLede: 'A smaller asking, cut fresh over an older one.', drillLede: 'The same kind of asking, cut plain.',
  ask: (P, Su) => `Two numbers. Multiplied they make ${P}, added they make ${Su}.`,
  set: 'Set the pair', wrong: 'The stone keeps its face. Count again.',
  probeRight: 'The cut brightens — and the trail ahead bends for home.', drillRight: 'The cut brightens. The trail runs on.',
  doneLede: 'Shelves of stone and a stand at the door — the wood kept count of your ways, and every one of them ended here.',
  doneFoot: 'Two workings hang by the door. Both of them are this scroll.',
};

export default class BraidedWood {
  /** @param ctx { scene, world, enc, log, PH } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH }) {
    this.log = log; this.PH = PH; this.P = world.palette;
    this.C = enc.mountainPassage;
    this.E = world.entities.find((e) => e.id === 'braided-wood');
    if (!this.C || !this.E) throw new Error('braided-wood needs enc.mountainPassage and the world entity');

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: SITE.head.x, z: SITE.head.z, reach: this.E.reach ?? 8 };

    // truth, derived order-free — the SAME check serves quadratic, probe, drills
    this.ok = (q, p1, p2) => p1 * p2 === q.a * q.c && p1 + p2 === q.b;
    this.markers = this.C.markers.map((m) => ({ p: m.pair[0], q: m.pair[1], tag: m.tag }));

    // passage state hub ⇄ out; all timing on the part's own clock (verifiable)
    this.time = 0; this.state = 'hub'; this.chosen = null;
    this.seen = false; this.seenT = 0; this.choiceT0 = 0;
    this.forks = 0; this.rejoins = 0; this.zoneLast = {};
    this.card = 'head'; this.cardT0 = 0; this.tried = {};   // per-card last try
    this.probeDone = false; this.drillDone = [false, false];
    this.beatT = -1;              // >0 while the connection chips stand
    this.done = false; this.methodLast = {}; this.pulses = [];
    this._build(scene); this._plant(scene);
    // Enter commits in either pair field (main.js delegates only shared cards)
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && (e.target.id === 'bwP' || e.target.id === 'bwQ')) { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ---------- build ----------
  /** a standing stone: base + tilted face slab + fat gaze proxy + collider */
  _stone(scene, o) {
    const r = rng(o.seed), g = new THREE.Group();
    g.position.set(o.x, 0, o.z); g.rotation.y = o.ry ?? 0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.34, 0.22, 0.5), mat(jitter(this.P.stone, r)));
    base.position.y = 0.11; base.castShadow = base.receiveShadow = true; g.add(base);
    const face = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 0.3), mat(jitter(this.P.stoneLit, r)));
    face.position.y = 0.18 + o.h / 2; face.rotation.x = -0.05; face.castShadow = face.receiveShadow = true; g.add(face);
    g.userData.act = { part: 'braided-wood', reach: 7, ...o.act };
    scene.add(g); this.solid.push(g); this.interactables.push(g);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, o.w + 0.5), o.h + 1.1, 1.1), glow('#000', 0));
    proxy.position.set(o.x, (o.h + 1.1) / 2, o.z);
    proxy.userData.act = g.userData.act; proxy.userData.glowRoot = g;
    scene.add(proxy); this.interactables.push(proxy);
    this.colliders.push({ type: 'circle', x: o.x, z: o.z, r: o.w > 1 ? 0.5 : 0.34 });
    return { g, face, topY: 0.18 + o.h };
  }

  /** gold glow bar on a stone face — the pulse the world answers E with */
  _pulseBar(host, w, y) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.05), glow(this.P.gold, 0));
    bar.position.set(0, y, 0.17); host.add(bar);
    return bar;
  }

  _build(scene) {
    const P = this.P;
    // — headstone with the carved trail map on its face
    const hs = this._stone(scene, {
      x: SITE.head.x, z: SITE.head.z, ry: SITE.head.ry, w: 1.5, h: 2.0, seed: 9011,
      act: { kind: 'head', prompt: S.headPrompt, label: S.headLabel, reach: this.E.reach ?? 8 },
    });
    this.headTop = hs.topY; this.headPulse = this._pulseBar(hs.face, 1.2, 0.86);
    const mapG = new THREE.Group();                    // face-local: z out of the stone
    mapG.position.set(0, 0.06, 0.16);                  // the face is already centred at mid-height
    const lineM = mat(P.vellum, { emissive: new THREE.Color(P.vellum), emissiveIntensity: 0.12 });
    for (const way of MAP.ways) for (let i = 0; i + 1 < way.pts.length; i++) {
      const [u0, v0] = way.pts[i], [u1, v1] = way.pts[i + 1];
      const seg = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(u1 - u0, v1 - v0), 0.028, 0.02), lineM);
      seg.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0.01);
      seg.rotation.z = Math.atan2(v1 - v0, u1 - u0);
      mapG.add(seg);
    }
    for (const [pt, col, rr] of [[MAP.start, P.stone, 0.045], [MAP.goal, P.gold, 0.06]]) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.03, 8),
        mat(col, col === P.gold ? { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.5 } : {}));
      dot.rotation.x = Math.PI / 2; dot.position.set(pt[0], pt[1], 0.012); mapG.add(dot);
    }
    hs.face.add(mapG);
    this.mapChipAt = {}; mapG.updateWorldMatrix(true, false);   // map tag-chip anchors, 0.5 m proud of the face
    for (const [tag, [u, v]] of Object.entries(MAP.chipAt))
      this.mapChipAt[tag] = mapG.localToWorld(new THREE.Vector3(u, v, 0.5));

    // — the three way-marker stones, each wearing its pair chip
    this.markStones = this.markers.map((m, i) => {
      const st = SITE.markers[i];
      const s = this._stone(scene, {
        x: st.x, z: st.z, ry: rng(31 + i)() * 6.28, w: 0.62, h: 1.5, seed: 700 + i * 97,
        act: { kind: 'marker', i, prompt: S.markPrompt, label: S.markLabel },
      });
      return { ...s, pulse: this._pulseBar(s.face, 0.45, 0.3), m, x: st.x, z: st.z };
    });

    // — probe stone (ignores-a clearing) and the two drill stones (swap trail)
    const pr = this._stone(scene, {
      x: SITE.probe.x, z: SITE.probe.z, ry: SITE.probe.ry, w: 1.1, h: 1.55, seed: 4111,
      act: { kind: 'probe', prompt: S.probePrompt, label: S.probeLabel },
    });
    this.probeS = { ...pr, pulse: this._pulseBar(pr.face, 0.8, 0.5) };
    this.drillS = SITE.drills.map((d, i) => {
      const s = this._stone(scene, {
        x: d.x, z: d.z, ry: d.ry, w: 0.95, h: 1.4, seed: 5300 + i * 131,
        act: { kind: 'drill', i, prompt: S.drillPrompt, label: S.drillLabel },
      });
      return { ...s, pulse: this._pulseBar(s.face, 0.7, 0.45), x: d.x, z: d.z };
    });

    // — the split's method slabs, one per enc method, angled to their lanes
    this.slabS = this.C.methods.map((meth, i) => {
      const st = SITE.slabs[i];
      const s = this._stone(scene, {
        x: st.x, z: st.z, ry: st.ry, w: 1.35, h: 1.2, seed: 6100 + i * 77,
        act: { kind: 'slab', i, lane: st.lane, prompt: S.slabPrompt, label: S.slabLabel },
      });
      return { ...s, pulse: this._pulseBar(s.face, 1.0, 0.32), meth, lane: st.lane, x: st.x, z: st.z };
    });

    this._library(scene);
  }

  /** the library: house recipe scaled up, doorway open to the south, two warm
   *  lamps whose glow (fog-free halos + PointLights) reads from the trailhead */
  _library(scene) {
    const { lib: H } = SITE, P = this.P;
    const g = new THREE.Group(); g.position.set(H.x, 0, H.z);
    const wallM = mat('#7d7768'), wallM2 = mat('#8a8578'), t = 0.26;
    const box = (w, h, d, x, y, z, m = wallM, coll = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b);
      if (coll) this.colliders.push({ type: 'aabb', minX: H.x + x - w / 2, maxX: H.x + x + w / 2, minZ: H.z + z - d / 2, maxZ: H.z + z + d / 2 });
      return b;
    };
    const frontZ = -H.d / 2, sideW = (H.w - H.doorW) / 2;
    box(sideW, H.h, t, -(H.doorW + sideW) / 2, H.h / 2, frontZ);            // front L
    box(sideW, H.h, t, (H.doorW + sideW) / 2, H.h / 2, frontZ, wallM2);     // front R
    box(H.doorW + 0.2, H.h - H.doorH, t, 0, H.doorH + (H.h - H.doorH) / 2, frontZ, wallM, false); // over door: 2D map law
    box(H.w, H.h, t, 0, H.h / 2, H.d / 2, wallM2);                          // back
    box(t, H.h, H.d, -H.w / 2, H.h / 2, 0, wallM2);                         // sides
    box(t, H.h, H.d, H.w / 2, H.h / 2, 0, wallM);
    const shp = new THREE.Shape();                                          // roof prism
    shp.moveTo(-H.d / 2 - 0.55, 0); shp.lineTo(H.d / 2 + 0.55, 0); shp.lineTo(0, 1.7); shp.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: H.w + 1.1, bevelEnabled: false }), mat(P.brick));
    roof.rotation.y = Math.PI / 2; roof.position.set(-(H.w + 1.1) / 2, H.h, 0); roof.castShadow = true; g.add(roof);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(H.w - 0.3, 0.07, H.d - 0.3), mat(P.vellum, { flatShading: false }));
    floor.position.y = 0.035; floor.receiveShadow = true; g.add(floor);
    for (const sx of [-1.6, 1.6]) {                                         // shelves against the back wall
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 0.4), mat('#5f5040'));
      sh.position.set(sx, 1.25, H.d / 2 - 0.42); sh.castShadow = sh.receiveShadow = true; g.add(sh);
      this.colliders.push({ type: 'aabb', minX: H.x + sx - 0.85, maxX: H.x + sx + 0.85, minZ: H.z + H.d / 2 - 0.62, maxZ: H.z + H.d / 2 - 0.22 });
    }
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.02, 7), wallM2);   // scroll stand in the doorway
    ped.position.set(0, 0.51, frontZ + 1.15); ped.castShadow = true; g.add(ped);
    this.colliders.push({ type: 'circle', x: H.x, z: H.z + frontZ + 1.15, r: 0.4 });
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8), mat(P.parchment, { emissive: new THREE.Color(P.parchment), emissiveIntensity: 0.14 }));
    scroll.rotation.z = Math.PI / 2 - 0.1; scroll.position.set(0, 1.09, frontZ + 1.15);
    scroll.userData.act = { part: 'braided-wood', kind: 'scroll', prompt: S.scrollPrompt, label: S.scrollLabel, reach: 7 };
    g.add(scroll); this.interactables.push(scroll);
    this.scrollAt = { x: H.x, y: 1.09, z: H.z + frontZ + 1.15 };
    const sp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 1.0), glow('#000', 0));
    sp.position.set(H.x, 1.1, H.z + frontZ + 1.15);
    sp.userData.act = scroll.userData.act; sp.userData.glowRoot = scroll;
    scene.add(sp); this.interactables.push(sp);
    // the beacon: warm lamps flank the door; halos fog-free so the glow
    // carries to the trailhead through the trees, day and night
    this.lamps = [];
    for (const sx of [-1, 1]) {
      const ax = sx * (H.doorW / 2 + 0.55);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), mat('#453f38'));
      arm.position.set(ax, 2.75, frontZ - 0.16); g.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.5 }));
      bulb.position.set(ax, 2.55, frontZ - 0.22); g.add(bulb);
      const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), glow(P.lamp, 0.3, false));
      halo.position.copy(bulb.position); g.add(halo);
      const li = new THREE.PointLight(new THREE.Color(P.lamp), 2.1, 17, 1.7);
      li.position.set(H.x + ax, 2.55, H.z + frontZ - 0.5); scene.add(li);
      this.lamps.push({ halo, li, base: 2.1, seed: sx * 1.7 + 3 });
    }
    const inner = new THREE.PointLight(new THREE.Color(P.lamp), 1.1, 9, 1.6);   // the doorway's own warmth
    inner.position.set(H.x, 2.4, H.z); scene.add(inner);
    scene.add(g); this.solid.push(g); this.libG = g;
  }

  /** planting + worn strips. A real wood: trees fill the interior between the
   *  braid lanes (kept ≥1.55 m off every centerline; the ≥1.5 walked clearance
   *  is verified), clearings stay open, and one deliberately narrow sight-lane
   *  runs hub→library so the lamp-glow is glimpsed between trunks. */
  _plant(scene) {
    const P = this.P, r = rng(20260819);
    const H = SITE.lib;
    const lines = Object.values(TRAILS);
    const sight = [[HUB.x, HUB.z + 0.2], [H.x, H.z - H.d / 2 - 0.2]];   // trailhead → door glow lane
    const stones = [SITE.head, ...SITE.markers, SITE.probe, ...SITE.drills, ...SITE.slabs];
    const glb = [[4.05, 11.5], [0.51, 16.5], [7.65, 16.5]];   // global rows keep their ground
    this.trees = []; this.bushes = [];
    for (let i = 0; i < 9000 && this.trees.length < 95; i++) {   // east of the water: the wood itself
      const x = -0.3 + r() * 10.1, z = 12.3 + r() * 25.2;
      if (lines.some((pl) => dPoly(x, z, pl) < 1.55) || dPoly(x, z, sight) < 1.15) continue;
      if (CLEARINGS.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr * 0.8)) continue;
      if (x > H.x - H.w / 2 - 1.2 && x < H.x + H.w / 2 + 1.2 && z > H.z - H.d / 2 - 1.4 && z < H.z + H.d / 2 + 1.2) continue;
      if (stones.some((s) => Math.hypot(x - s.x, z - s.z) < 1.3)) continue;
      if (this.trees.some((t) => Math.hypot(x - t.x, z - t.z) < 1.2)) continue;
      if (glb.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < 1.25)) continue;
      const s = Math.min(0.8 + r() * 0.4, z > 30 ? 1.15 : 1.2);   // shadow near-plane clips tall canopies deep north
      this.trees.push({ x, z, s, seed: Math.round(x * 977 + z * 131) });
    }
    for (let i = 0; i < 300 && this.trees.length < 64; i++) {    // west of the ravine: backdrop only
      const x = -15.9 + r() * 5.6, z = 12 + r() * 26;
      if (this.trees.some((t) => Math.hypot(x - t.x, z - t.z) < 2.3)) continue;
      this.trees.push({ x, z, s: 0.9 + r() * 0.35, seed: Math.round(x * 977 + z * 131) });
    }
    // understory: collider-free, see-through clumps on the verges — never blocking
    for (let i = 0; i < 2200 && this.bushes.length < 46; i++) {
      const x = -0.3 + r() * 10.1, z = 12.3 + r() * 25.2;
      const dTrail = Math.min(...lines.map((pl) => dPoly(x, z, pl)));
      if (dTrail < 1.5 || dTrail > 6.0) continue;                // off the walked line, near the ways
      if (dPoly(x, z, sight) < 1.5) continue;
      if (CLEARINGS.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr - 0.4)) continue;
      if (x > H.x - H.w / 2 - 0.8 && x < H.x + H.w / 2 + 0.8 && z > H.z - H.d / 2 - 1.0 && z < H.z + H.d / 2 + 0.8) continue;
      if (stones.some((s) => Math.hypot(x - s.x, z - s.z) < 1.2)) continue;
      if (this.bushes.some((b) => Math.hypot(x - b.x, z - b.z) < 1.05)) continue;
      if (this.trees.some((t) => Math.hypot(x - t.x, z - t.z) < 0.85)) continue;
      if (glb.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < 1.0)) continue;
      this.bushes.push({ x, z, s: 0.55 + r() * 0.5, seed: Math.round(x * 613 + z * 227) });
    }
    const forestG = new THREE.Group();
    for (const t of this.trees) {
      const tr = rng(t.seed), g = new THREE.Group();
      const h = (3.3 + tr() * 2.4) * t.s, w = (1.4 + tr() * 0.8) * t.s;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * t.s, 0.16 * t.s, h * 0.66, 7), mat(jitter(P.trunk, tr)));
      trunk.position.y = h * 0.33; trunk.castShadow = true; g.add(trunk);
      for (const [bx, by, bz, rx, ry2, rz, c] of [
        [0.12 * w, h * 0.72, 0, w * 0.82, h * 0.30, w * 0.72, '#2a4535'],
        [-0.25 * w, h * 0.80, 0.1 * w, w * 0.62, h * 0.24, w * 0.55, P.canopyMid],
        [0.05 * w, h * 0.94, -0.08 * w, w * 0.5, h * 0.20, w * 0.45, '#3d6349'],
      ]) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(jitter(c, tr)));
        m.scale.set(rx, ry2, rz); m.position.set(bx, by, bz);
        m.userData.foliage = 1; m.castShadow = m.receiveShadow = true; g.add(m);
      }
      g.position.set(t.x, 0, t.z); g.rotation.y = tr() * 6.28; forestG.add(g);
      this.colliders.push({ type: 'circle', x: t.x, z: t.z, r: 0.3 });
    }
    for (const b of this.bushes) {                    // 1–2 low blobs, no trunk, no collider
      const br = rng(b.seed);
      for (let k = 0, n = 1 + (br() < 0.5 ? 1 : 0); k < n; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(jitter(k ? '#2a4535' : this.P.canopyNear, br)));
        const rr = (0.45 + br() * 0.35) * b.s;
        m.scale.set(rr * 1.35, rr * 0.75, rr * 1.15);
        m.position.set(b.x + (br() - 0.5) * 0.7, rr * 0.55, b.z + (br() - 0.5) * 0.7);
        m.rotation.y = br() * 6.28; m.userData.foliage = 1;
        m.castShadow = m.receiveShadow = true; forestG.add(m);
      }
    }
    scene.add(forestG); this.solid.push(forestG);

    // — worn strips: sparse groundLit plates marking (not paving) the ways
    const spots = [];
    for (const pl of lines) for (let i = 0; i + 1 < pl.length; i++) {
      const [ax, az] = pl[i], [bx, bz] = pl[i + 1];
      const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      for (let d = 0.35; d < L; d += 0.62) {           // overlapping plates: a continuous worn line
        if (r() > 0.9) continue;
        spots.push({ x: ax + (bx - ax) * (d / L) + (r() - 0.5) * 0.22, z: az + (bz - az) * (d / L) + (r() - 0.5) * 0.22,
          yaw: yaw + (r() - 0.5) * 0.3, l: 1.15 + r() * 0.4, w: 0.55 + r() * 0.25 });
      }
    }
    for (const [cx, cz] of CLEARINGS)   // a few broad wears in each clearing
      for (let k = 0; k < 4; k++)
        spots.push({ x: cx + (r() - 0.5) * 2.0, z: cz + (r() - 0.5) * 2.0, yaw: r() * 3.14, l: 1.2 + r(), w: 0.8 + r() * 0.5 });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.016, 1), mat(P.groundLit, { flatShading: false }), spots.length);
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
    spots.forEach((sp, i) => {
      e.set(0, sp.yaw, 0); q.setFromEuler(e); v.set(sp.l, 1, sp.w);
      M4.compose(new THREE.Vector3(sp.x, 0.012 + (i % 3) * 0.002, sp.z), q, v);
      inst.setMatrixAt(i, M4); inst.setColorAt(i, jitter(P.groundLit, r));
    });
    inst.receiveShadow = true; scene.add(inst);
  }

  // ---------- passage state machine ----------
  _ms(t0) { return Math.round((this.time - t0) * 1000); }
  /** zone crossing, debounced on the part's own clock (verifier-drivable) */
  _zoneHit(zn) {
    if (this.time - (this.zoneLast[zn.id] ?? -1e9) < DEBOUNCE_S) return;
    this.zoneLast[zn.id] = this.time;
    if (zn.kind === 'fork') {
      const m = this.markers.find((k) => k.tag === zn.tag);
      this.log.push('passage.fork', { chose: m ? `${m.p},${m.q}` : zn.tag, tag: zn.tag, ms: this._ms(this.choiceT0), nth: this.rejoins });
      this.state = 'out'; this.chosen = zn.tag; this.forks++;
    } else {
      this.log.push('passage.rejoin', { from: this.chosen, via: zn.tag, ms: this._ms(this.choiceT0) });
      this.state = 'hub'; this.rejoins++; this.choiceT0 = this.time;
    }
  }

  update(dt, u) {
    this.time += dt;
    if (this.beatT > 0) this.beatT -= dt;
    for (let i = this.pulses.length - 1; i >= 0; i--) {   // E-pulses: rise fast, settle slow
      const p = this.pulses[i]; p.t += dt;
      const k = p.t < 0.14 ? p.t / 0.14 : Math.max(0, 1 - (p.t - 0.14) / 1.1);
      p.bar.material.opacity = 0.85 * k;
      if (p.t > 1.3) { p.bar.material.opacity = 0; this.pulses.splice(i, 1); }
    }
    for (const l of this.lamps) {                          // the beacon breathes
      const b = 1 + 0.05 * Math.sin(this.time * 6.7 + l.seed * 3.1) + 0.03 * Math.sin(this.time * 15.3 + l.seed);
      l.li.intensity = l.base * b;
      l.halo.material.opacity = 0.3 * b;
      l.halo.scale.setScalar(1 + 0.08 * Math.sin(this.time * 2.3 + l.seed));
    }
    if (!u || !u.controls) return;                         // priming call: no player yet
    const p = u.controls.pos, dHub = Math.hypot(p.x - HUB.x, p.z - HUB.z);
    this._pp = { x: p.x, z: p.z };   // labels() gates station chips on this
    if (!this.seen && dHub < 4.0) { this.seen = true; this.seenT = this.choiceT0 = this.time; this.log.push('passage.seen', {}); }
    if (!this.seen) return;
    for (const zn of ZONES) {
      if (p.x < zn.minX || p.x > zn.maxX || p.z < zn.minZ || p.z > zn.maxZ) continue;
      if (zn.kind === 'fork' ? this.state === 'hub' : this.state === 'out') this._zoneHit(zn);
    }
    if (this.state === 'out' && dHub < 1.6) {   // roamed home zone-free: the clearing itself rejoins
      this.log.push('passage.rejoin', { from: this.chosen, via: 'trailhead', ms: this._ms(this.choiceT0) });
      this.state = 'hub'; this.rejoins++; this.choiceT0 = this.time;
    }
  }

  _pulse(bar) { this.pulses.push({ bar, t: 0 }); }
  // ---------- interaction ----------
  onInteract(act, PH) {
    const A = { x: HUB.x, z: HUB.z };
    if (act.kind === 'head') {
      this.card = 'head'; A.x = SITE.head.x; A.z = SITE.head.z;
      this._pulse(this.headPulse);
      this.log.push('passage.read', { station: 'headstone' });
      this.PH.openPanel('p:braided-wood');
    } else if (act.kind === 'marker') {
      const ms = this.markStones[act.i];
      this._pulse(ms.pulse);
      this.log.push('passage.marker', { tag: ms.m.tag, pair: `${ms.m.p},${ms.m.q}` });
      return;                                    // no card: the stone answers
    } else if (act.kind === 'probe' || act.kind === 'drill') {
      const at = act.kind === 'probe' ? SITE.probe : SITE.drills[act.i];
      this.card = act.kind === 'probe' ? 'probe' : 'drill' + act.i;
      A.x = at.x; A.z = at.z; this.cardT0 = this.time;
      this.log.push('passage.read', { station: this.card });
      this.PH.openPanel('p:braided-wood');
      setTimeout(() => document.getElementById('bwP')?.focus(), 0);
    } else if (act.kind === 'slab') {
      const sl = this.slabS[act.i];
      if (this.time - (this.methodLast[act.i] ?? -1e9) > 1.5) {
        this.methodLast[act.i] = this.time;
        this.log.push('passage.method', { lane: sl.lane, id: sl.meth.id });
      }
      this._pulse(sl.pulse);
      return;
    } else if (act.kind === 'scroll') {
      this.card = 'done'; A.x = this.scrollAt.x; A.z = this.scrollAt.z;
      if (!this.done) { this.done = true; this.log.push('passage.done', { forks: this.forks, totalMs: this._ms(this.seenT) }); }
      this.PH.openPanel('p:braided-wood');
      this.PH.dismissLater('p:braided-wood', 9000);
    }
    this.panelAnchor = { x: A.x, z: A.z, reach: 8 };
  }

  /** which quadratic the open card is asking (probe or a drill), else null */
  _q() {
    if (this.card === 'probe') return this.probeDone ? null : this.C.probe;
    if (this.card.startsWith('drill')) { const i = +this.card.slice(5); return this.drillDone[i] ? null : this.C.aOneDrills[i]; }
    return null;
  }

  _commit() {
    const q = this._q();
    if (!q) return;
    const elP = document.getElementById('bwP'), elQ = document.getElementById('bwQ');
    if (!elP || !elQ) return;
    const p1 = Math.round(parseFloat(elP.value)), p2 = Math.round(parseFloat(elQ.value));
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) { (Number.isFinite(p1) ? elQ : elP).focus(); return; }
    const ok = this.ok(q, p1, p2);                 // order-free, derived, never stored
    const ms = this._ms(this.cardT0);
    if (this.card === 'probe') {
      this.log.push('passage.probe', { p: p1, q: p2, ok, ms });
      if (ok) {
        this.probeDone = true; this.beatT = 14;    // the CONNECTION beat: chips stand a while
        this.log.push('passage.connection', {});
        this._pulse(this.probeS.pulse);
        this.PH.refresh(); this.PH.dismissLater('p:braided-wood', 1600);
        return;
      }
    } else {
      const i = +this.card.slice(5);
      this.log.push('passage.drill', { i, p: p1, q: p2, ok, ms });
      if (ok) {
        this.drillDone[i] = true; this._pulse(this.drillS[i].pulse);
        this.PH.refresh(); this.PH.dismissLater('p:braided-wood', 1200);
        return;
      }
    }
    this.tried[this.card] = [p1, p2];              // wrong: the card stays, refocused
    this.cardT0 = this.time; this.PH.refresh();
    setTimeout(() => { const el = document.getElementById('bwP'); if (el) { el.focus(); el.select?.(); } }, 0);
  }

  onPanel(ev) { if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#bwSet')) this._commit(); }

  // ---------- cards (PLACEHOLDER voice throughout; asks built from data) ----
  panel(st) {
    const K = this.PH.K, C = this.C;
    if (this.card === 'head') {
      return `<h2>${S.headH2}</h2><p class="lede">${S.headLede}</p>
        <div class="eq">${K(C.quadratic.tex, true)}</div><p class="muted">${S.headFoot}</p>
        ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${K(C.architect.depth)}. Fork zones on each mouth log the choice; a pair is judged by p·q = a·c and p + q = b at runtime, order-free.</p></div>` : ''}`;
    }
    if (this.card === 'done') {
      return `<h2>${S.doneH2}</h2><p class="lede">${S.doneLede}</p>
        <div class="eq">${K(`${C.quadratic.tex} = ${C.factoredTex}`, true)}</div>
        <p class="muted">${S.doneFoot}</p>`;
    }
    const q = this.card === 'probe' ? C.probe : C.aOneDrills[+this.card.slice(5)];
    const solved = !this._q(), tried = this.tried[this.card], solvedTxt = this.card === 'probe' ? S.probeRight : S.drillRight;
    return `<h2>${this.card === 'probe' ? S.probeH2 : S.drillH2}</h2>
      <p class="lede">${this.card === 'probe' ? S.probeLede : S.drillLede}</p>
      <div class="eq">${K(q.tex, true)}</div>
      <p>${S.ask(q.a * q.c, q.b)}</p>
      <div class="gate-in">
        <input type="number" id="bwP" step="1" value="${tried ? tried[0] : ''}" placeholder="one" ${solved ? 'disabled' : ''}>
        <input type="number" id="bwQ" step="1" value="${tried ? tried[1] : ''}" placeholder="the other" ${solved ? 'disabled' : ''}>
        <button class="btn primary" id="bwSet" ${solved ? 'disabled' : ''}>${S.set}</button>
      </div>
      ${tried && !solved ? `<p class="gate-no">${S.wrong}</p>` : ''}
      ${solved ? `<p class="gate-ok">${solvedTxt}</p>` : ''}
      ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${this.card === 'probe' ? 'ignores-a revision: an a = 1 probe — success means only the a ≠ 1 step was missing, so the content is a connection, not a re-teaching.' : 'swap-roles revision: a = 1 drills re-grounding multiply-to-c, add-to-b before a ≠ 1.'} Truth derived order-free at commit.</p></div>` : ''}`;
  }

  // ---------- chips (numerals + x only; tags live under architect) ----------
  /** station chips stay local: the wood is ~25 m deep, so 9.5 m (not 14) keeps each asking to its own clearing */
  _near(x, z) { return this._pp && Math.hypot(this._pp.x - x, this._pp.z - z) < 9.5; }

  labels(L, architectOn) {
    const C = this.C, hd = SITE.head;
    L.set('bw-q', { tex: C.quadratic.tex, x: hd.x, y: this.headTop + 0.42, z: hd.z, kind: 'rule', dy: 0 });
    this.markStones.forEach((s, i) =>                    // each mouth wears its pair
      L.set('bw-m' + i, { tex: `${s.m.p},\\ ${s.m.q}`, x: s.x, y: s.topY + 0.42, z: s.z, kind: 'plain', dy: 0 }));
    if (!this.probeDone && this._near(SITE.probe.x, SITE.probe.z))
      L.set('bw-pr', { tex: C.probe.tex, x: SITE.probe.x, y: this.probeS.topY + 0.44, z: SITE.probe.z, kind: 'rule', dy: 0 });
    this.drillS.forEach((s, i) => { if (!this.drillDone[i] && this._near(s.x, s.z))
      L.set('bw-d' + i, { tex: C.aOneDrills[i].tex, x: s.x, y: s.topY + 0.44, z: s.z, kind: 'rule', dy: 0 }); });
    this.slabS.forEach((s, i) => { if (this._near(s.x, s.z))   // the two good ways, carved
      L.set('bw-s' + i, { tex: s.meth.tex, x: s.x, y: s.topY + 0.44, z: s.z, kind: 'plain', dy: 0 }); });
    if (this.beatT > 0) {                                // the connection beat, side by side
      const px = SITE.probe.x, pz = SITE.probe.z, py = this.probeS.topY + 0.52;
      L.set('bw-c0', { tex: C.probe.tex, x: px - 1.15, y: py, z: pz, kind: 'plain', dy: 0 });
      L.set('bw-c1', { tex: C.quadratic.tex, x: px + 1.15, y: py, z: pz, kind: 'plain', dy: 0 });
      L.set('bw-c2', { tex: `${C.probe.a} \\cdot ${C.probe.c} \\ \\to\\ ${C.quadratic.a} \\cdot ${C.quadratic.c}`, x: px, y: py + 0.72, z: pz, kind: 'rule', dy: 0 });
    }
    if (this.done)                                       // the library wears the answer
      L.set('bw-f', { tex: C.factoredTex, x: SITE.lib.x, y: 3.65, z: SITE.lib.z - SITE.lib.d / 2 - 0.55, kind: 'plain', dy: 0 });
    if (!architectOn) return;
    this.markers.forEach((m, i) => {                     // tags over each trail mouth…
      const [mx, mz] = SITE.mouths[m.tag];
      L.set('bw-am' + i, { tex: `\\texttt{${m.tag}}`, x: mx, y: 2.7, z: mz, kind: 'architect', dy: 0 });
      const c = this.mapChipAt[m.tag];                   // …and on the carved map's branches
      L.set('bw-ac' + i, { tex: `\\texttt{${m.tag}}`, x: c.x, y: c.y, z: c.z, kind: 'architect', dy: 0 });
    });
    this.slabS.forEach((s, i) =>
      L.set('bw-as' + i, { tex: `\\texttt{${s.meth.id}}`, x: s.x, y: s.topY + 0.85, z: s.z, kind: 'architect', dy: 0 }));
  }
}
