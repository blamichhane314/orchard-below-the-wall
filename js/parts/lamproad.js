// lamproad.js — the Lamp-Road. Core rung of design/parts/early-lamp-road.md:
// the exact-fill pour with overshoot banking. Four iron posts stand along the
// eastern road; between each post and the next runs a countable line of low
// ground flags. A cup of oil is worth `rate` flags of light. The player sets
// cups at a lamp; the flags take the light ONE BY ONE toward the next post.
// An exact fill blooms that post; a short pour leaves the shortfall standing
// dark and countable — the road itself asking the follow-up question; an over
// pour spills past the post and is banked as the next stretch's lit prefix.
// Margin is shown, never scolded (Law 3, Law 5). Walking gates nothing: the
// lamps are the exercise, not a wall (Law 1).
//
// PERCEPTUAL CONTRACT (Law 4): flags per stretch = enc.lampRoad.lamps[i]
// .gapFlags, generated; spacing = gap length / gapFlags, so the LAST flag of
// a stretch lands at the next post's foot (the design's one convention: the
// post stands on its stretch's last flag and the count includes it). At pour
// time, lit = cups × rate and need = gapFlags − alreadyLit — derived, stored
// nowhere. Every countable multiplicity is generated from the numbers the
// light runs on.
//
// Deviations from the design doc (core kept, rest simplified — documented):
// no flask/cask oil economy, no snuff lever or waste pan — a short pour KEEPS
// its light and the dark remainder is the next question; no carved stroke-
// tallies — the ground flags themselves are the tally; a card input stands in
// for the diegetic cup + flint strike; no plaza variant. The last lamp's
// stretch has no fifth post in data, so it runs east to a road-end waymark
// whose stride is borrowed from the road's opening gap — its length is still
// derived from data, never authored. Oil past the road's end is swallowed by
// the holt (the queue simply caps); the banked count is logged by the rule.

import * as THREE from '../../vendor/three/three.module.js';
import { n } from '../fmt.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const rng = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (hex, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05); return c; };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// rig numbers (world metres; the road runs east along z = 0.35)
const POST_Z = 0.9;      // posts on the north shoulder, clear of the walking line
const FLAG_Z = 0.74;     // flag line a hand south of the posts, so the last flag reads AT its post, not under it
const HEAD_Y = 2.0;      // glass centre
const DIM = 0.35, LITI = 1.6;       // point light: unlit courtesy glow vs held flame
const CADENCE = 0.09, LEAD = 0.3;   // one flag per beat, after a breath (anticipation)
const BLOOM_T = 0.95;               // deepen → take (overshoot) → settle

export default class LampRoad {
  /** @param ctx { scene, world, enc, log, PH } — see js/parts/_contract.md */
  constructor({ scene, world, enc, log, PH }) {
    this.log = log; this.PH = PH;
    this.P = world.palette;
    this.C = enc.lampRoad;
    this.E = world.entities.find((e) => e.id === 'lamp-road');
    if (!this.C || !this.E) throw new Error('lamp-road needs enc.lampRoad and the world entity');

    this.colliders = []; this.solid = []; this.interactables = [];
    this.panelAnchor = { x: this.E.at.x, z: this.E.at.z, reach: this.E.reach ?? 8 };

    this.phase = 'idle'; this.anim = null; this.outcome = null;
    this.cur = 0;                 // the frontier stretch: lit lamp behind, dark flags ahead
    this.doneAll = false;
    this.pours = 0; this.lastCups = null;
    this.readAt = []; this.thinkT0 = 0; this.t0Road = 0;
    this.time = 0;

    this._build(scene);

    // Enter in the cups field commits — main.js's Enter delegation covers the
    // shared cards only, not part panels, so the part listens for its own input
    this._onKey = (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'lrCups') { e.preventDefault(); this._commit(); }
    };
    document.addEventListener('keydown', this._onKey);
  }

  // ---------- build ----------
  _build(scene) {
    const { P, C, E } = this;
    const r = rng(5077);
    const g = new THREE.Group();   // flags + waymark ride here; posts stand alone as glow roots
    this.g = g;

    const ironM = mat('#453f38', { roughness: 0.6, metalness: 0.25 });
    const ironDarkM = mat('#332e29', { roughness: 0.65, metalness: 0.2 });
    const Cy = (...a) => new THREE.CylinderGeometry(...a);
    const Bx = (...a) => new THREE.BoxGeometry(...a);
    /** shadowed mesh at (x,y,z); shadow=false for glow/glass/thin dressing */
    const M = (geo, material, x, y, z, parent = g, shadow = true) => {
      const o = new THREE.Mesh(geo, material);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = shadow;
      parent.add(o);
      return o;
    };
    const actFor = (i) => ({
      part: 'lamp-road', lamp: i,
      prompt: E.prompt ?? 'Tend the lamp',                                 // PLACEHOLDER (owner-authored, world3.json)
      label: E.label ?? "A lamp at the road's edge, the first of a line",  // PLACEHOLDER
      reach: E.reach ?? 8,
    });

    // — the posts: one iron lamp per data entry, each its own gaze/glow root
    this.posts = C.lamps.map((L, i) => {
      const pg = new THREE.Group(); pg.position.set(L.x, 0, POST_Z);
      M(Cy(0.11, 0.16, 0.15, 7), ironDarkM, 0, 0.075, 0, pg);            // plinth
      M(Cy(0.03, 0.05, 1.72, 7), ironM, 0, 1.0, 0, pg);                  // shaft
      const collar = M(new THREE.TorusGeometry(0.052, 0.013, 5, 10),     // the measure-mark's carved band
        mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.3 }), 0, 1.5, 0, pg, false);
      collar.rotation.x = Math.PI / 2;
      M(Bx(0.17, 0.035, 0.17), ironM, 0, 1.86, 0, pg);                   // head plate
      for (const [cx, cz] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]])
        M(Bx(0.016, 0.26, 0.016), ironM, cx, HEAD_Y, cz, pg, false);     // cage uprights
      const glassM = mat('#79808a', { roughness: 0.3, metalness: 0.15, emissive: new THREE.Color('#141a22'), emissiveIntensity: 0.4 });
      const glass = M(new THREE.IcosahedronGeometry(0.088, 0), glassM, 0, HEAD_Y, 0, pg, false);
      const cap = M(new THREE.ConeGeometry(0.14, 0.11, 4), ironM, 0, 2.17, 0, pg);
      cap.rotation.y = Math.PI / 4;
      M(new THREE.SphereGeometry(0.02, 6, 5), ironM, 0, 2.25, 0, pg, false);   // finial
      const halo = M(new THREE.IcosahedronGeometry(0.16, 0), glow(P.lamp, 0), 0, HEAD_Y, 0, pg, false);
      const light = new THREE.PointLight(new THREE.Color(P.lamp), DIM, 7, 1.8);
      light.position.set(0, HEAD_Y, 0);
      pg.add(light);
      pg.userData.act = actFor(i);
      scene.add(pg);
      this.solid.push(pg);
      this.interactables.push(pg);

      // fat invisible gaze proxy — standalone so the occlusion pass never sees
      // it; the rim outline lands on the visible post via glowRoot
      const proxy = new THREE.Mesh(Bx(0.85, 2.7, 0.85),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      proxy.position.set(L.x, 1.32, POST_Z);
      proxy.userData.act = pg.userData.act;
      proxy.userData.glowRoot = pg;
      scene.add(proxy);
      this.interactables.push(proxy);

      this.colliders.push({ type: 'circle', x: L.x, z: POST_Z, r: 0.14 });
      return { x: L.x, glass, glassM, halo, light, on: false, baseI: LITI, seed: i * 2.3 + 1 };
    });

    // — road-end waymark: the far anchor of the last stretch. Its stride is
    //   the road's opening stride (gap length / gapFlags of the first gap),
    //   so its distance is derived from data; it stands past the walkable
    //   bound — the light is watched leaving the world, not walked to.
    const Ls = C.lamps;
    const stride0 = (Ls[1].x - Ls[0].x) / Ls[0].gapFlags;
    const endX = Ls[Ls.length - 1].x + Ls[Ls.length - 1].gapFlags * stride0;
    const wg = new THREE.Group(); wg.position.set(endX, 0, POST_Z);
    M(Bx(0.36, 0.3, 0.3), mat(jitter(P.stone, r)), 0, 0.15, 0, wg);
    M(Bx(0.26, 0.24, 0.22), mat(jitter(P.stoneLit, r)), 0, 0.42, 0, wg);
    M(Bx(0.3, 0.06, 0.26), ironDarkM, 0, 0.57, 0, wg);
    const wGlassM = mat('#79808a', { roughness: 0.3, metalness: 0.15, emissive: new THREE.Color('#141a22'), emissiveIntensity: 0.3 });
    const wGlass = M(new THREE.SphereGeometry(0.055, 8, 6), wGlassM, 0, 0.66, 0, wg, false);
    const wHalo = M(new THREE.IcosahedronGeometry(0.11, 0), glow(P.lamp, 0), 0, 0.66, 0, wg, false);
    const wLight = new THREE.PointLight(new THREE.Color(P.lamp), 0, 4.5, 1.8);
    wLight.position.set(0, 0.66, 0);
    wg.add(wLight);
    g.add(wg);
    this.waymark = { x: endX, glass: wGlass, glassM: wGlassM, halo: wHalo, light: wLight, on: false, baseI: 1.1, seed: 9.1 };
    this.recs = [...this.posts, this.waymark];   // every glass the update pass tends

    // — the flags: FLAG COUNT per stretch = gapFlags, generated, never hand-
    //   placed; flag k stands at from + k·spacing, so flag G is AT the far
    //   post. The lit-check and the render walk the SAME indices (Law 4).
    const markerGeo = Bx(0.05, 0.15, 0.026), tickGeo = Bx(0.018, 0.1, 0.012);
    this.S = Ls.map((L, i) => {
      const to = i + 1 < Ls.length ? Ls[i + 1].x : endX;
      const spacing = (to - L.x) / L.gapFlags;
      const flags = [];
      for (let k = 1; k <= L.gapFlags; k++) {
        const mm = mat(jitter('#6b655a', r));
        const m = M(markerGeo, mm, L.x + k * spacing, 0.075, FLAG_Z + (r() - 0.5) * 0.05);
        m.rotation.y = (r() - 0.5) * 0.5;
        const tick = M(tickGeo, glow(P.lamp, 0), L.x + k * spacing, 0.21, FLAG_Z, g, false);
        flags.push({ mm, tick, on: false, pop: 0, flick: 0 });
      }
      return { G: L.gapFlags, lit: 0, flags, post: i + 1 < Ls.length ? this.posts[i + 1] : this.waymark };
    });

    this._setLit(this.posts[0]);   // the first lamp holds an old flame: the road begins inside its light
    scene.add(g);
  }

  /** a lamp holding steady flame (build-time, or a bloom settled) */
  _setLit(rec) {
    rec.on = true;
    rec.glassM.color.set(this.P.lamp);
    rec.glassM.emissive.set(this.P.lamp);
    rec.glassM.emissiveIntensity = 1.1;
    rec.glass.scale.setScalar(1);
    rec.halo.material.opacity = 0.22;
    rec.halo.scale.setScalar(1.25);
    rec.light.intensity = rec.baseI;
  }

  // ---------- truth, derived every time (never stored) ----------
  _need() { const s = this.S[this.cur]; return s.G - s.lit; }   // the countable dark remainder

  // ---------- interaction ----------
  onInteract(act) {
    // one card for the whole road, anchored to the post the player is at
    this.panelAnchor = { x: this.posts[act.lamp ?? 0].x, z: POST_Z, reach: this.E.reach ?? 8 };
    if (!this.doneAll && this.cur < this.S.length && !this.readAt[this.cur]) {
      const now = performance.now();
      this.readAt[this.cur] = now;             // think-clock: first read of this stretch
      if (!this.t0Road) this.t0Road = now;
      this.thinkT0 = now;
      const s = this.S[this.cur];
      this.log.push('lamp.read', { lamp: this.cur + 1, flags: s.G, lit: s.lit, rate: this.C.rate });
    }
    this.PH.openPanel('p:lamp-road');
    if (!this.doneAll && this.phase === 'idle') document.getElementById('lrCups')?.focus();
  }

  onPanel(ev) {
    if (ev.type === 'click' && ev.target && ev.target.closest && ev.target.closest('#lrSet')) this._commit();
  }

  _commit() {
    if (this.doneAll || this.phase !== 'idle') return;   // the road is busy: watch it
    const el = document.getElementById('lrCups');
    if (!el) return;
    const v = Math.round(parseFloat(el.value));
    if (!Number.isFinite(v)) { el.focus(); return; }
    const cups = clamp(v, this.C.cups.min, this.C.cups.max);
    el.value = cups;
    this.lastCups = cups;
    const lit = cups * this.C.rate;    // the whole claim, derived NOW…
    const need = this._need();         // …against the countable dark remainder
    this.outcome = lit === need ? 'exact' : lit < need ? 'short' : 'over';
    this.pours++;
    this.log.push('lamp.pour', {
      lamp: this.cur + 1, cups, lit, need, outcome: this.outcome,
      banked: Math.max(0, lit - need),
      ms: Math.round(performance.now() - this.thinkT0),
    });
    // queue the next `lit` dark flags, walking east across stretch borders —
    // banking IS continuation, and every post the light passes will bloom.
    // Oil past the road's end is swallowed by the holt: the queue just caps.
    const q = [];
    for (let si = this.cur, left = lit; si < this.S.length && left > 0; si++)
      for (let fi = this.S[si].lit; fi < this.S[si].G && left > 0; fi++, left--) q.push({ si, fi });
    if (!q.length) { this._shortRest(); return; }   // a zero pour: the road just waits
    el.blur();
    this.phase = 'pour';
    this.anim = { q, k: 0, t: 0 };
  }

  /** short: the world's answer is the dark remainder — the card stays for the
   *  follow-up question, and the retry think-clock runs from the settle */
  _shortRest() {
    const s = this.S[this.cur];
    if (s.lit > 0) s.flags[s.lit - 1].flick = 0.7;   // the last lit flag stutters once and steadies
    this.phase = 'idle'; this.anim = null;
    this.thinkT0 = performance.now();
    const el = document.getElementById('lrCups');
    if (el) { el.focus(); el.select(); }
  }

  _resolve() {
    this.phase = 'idle'; this.anim = null;
    if (this.outcome === 'short') this._shortRest();
    else this.PH.dismissLater('p:lamp-road', 850);   // success: step aside; walk the lit stretch
  }

  _ignite(si, fi) {
    const s = this.S[si], f = s.flags[fi];
    f.on = true; f.pop = 1;
    f.mm.emissive.set(this.P.lamp);
    s.lit++;
    return fi === s.G - 1;   // the light has reached the flag the post stands on
  }

  // ---------- per-frame ----------
  update(dt) {
    this.time += dt;
    const a = this.anim;

    if (this.phase === 'pour') {
      a.t += dt;
      // one by one — the multiplication is watchable, each flag a knock of light
      while (a.k < a.q.length && a.t >= LEAD + a.k * CADENCE) {
        const { si, fi } = a.q[a.k++];
        if (this._ignite(si, fi)) {
          // the stretch filled: its post takes the flame before any surplus runs on
          const rec = this.S[si].post;
          rec.glassM.color.set(this.P.lamp);
          rec.glassM.emissive.set(this.P.lamp);
          this.cur = si + 1;
          this.log.push('lamp.done', { lamp: si + 1 });
          this.phase = 'bloom';
          this.anim = { t: 0, si, rec, q: a.q, k: a.k };
          break;
        }
      }
      if (this.phase === 'pour' && a.k >= a.q.length && a.t >= LEAD + a.q.length * CADENCE + 0.35) this._resolve();
    } else if (this.phase === 'bloom') {
      a.t += dt;   // the curve itself is applied with the other lamp glass below
      if (a.t >= BLOOM_T) {
        this._setLit(a.rec);
        if (a.si === this.S.length - 1) {
          this.doneAll = true;
          this.log.push('road.done', { totalMs: Math.round(performance.now() - this.t0Road), pours: this.pours });
        }
        if (a.k < a.q.length) {
          // the banked surplus runs on into the next stretch, after a beat
          this.phase = 'pour'; this.anim = { q: a.q, k: a.k, t: LEAD + a.k * CADENCE - 0.14 };
        } else this._resolve();
      }
    }

    // lamp glass: the blooming post runs deepen → take → settle; held flames
    // breathe a little so the road never reads as painted-on light
    for (const rec of this.recs) {
      if (this.phase === 'bloom' && this.anim.rec === rec) {
        const bt = this.anim.t, gm = rec.glassM, peak = rec.baseI + 0.35;
        if (bt < 0.18) {
          // anticipation: the near gloom deepens a shade before the flame takes
          rec.light.intensity = DIM * (1 - 0.55 * (bt / 0.18));
          gm.emissiveIntensity = 0.4 * (1 - bt / 0.18);
        } else if (bt < 0.6) {
          const u = smooth((bt - 0.18) / 0.42);   // the take, overshooting
          rec.light.intensity = 0.16 + peak * u;
          gm.emissiveIntensity = 1.45 * u;
          rec.halo.material.opacity = 0.34 * u;
          rec.halo.scale.setScalar(1 + 0.55 * u);
          rec.glass.scale.setScalar(1 + 0.16 * u);
        } else {
          const u = smooth((bt - 0.6) / (BLOOM_T - 0.6));   // settle, one soft shiver
          rec.light.intensity = (0.16 + peak) + (rec.baseI - (0.16 + peak)) * u;
          gm.emissiveIntensity = 1.45 + (1.1 - 1.45) * u;
          rec.halo.material.opacity = 0.34 + (0.22 - 0.34) * u;
          rec.glass.scale.setScalar(1 + 0.16 * (1 - u) + Math.sin(bt * 34) * (1 - u) * 0.03);
        }
      } else if (rec.on) {
        const b = 1 + 0.05 * Math.sin(this.time * 7.9 + rec.seed * 3.1) + 0.028 * Math.sin(this.time * 17.3 + rec.seed);
        rec.light.intensity = rec.baseI * b;
        rec.glassM.emissiveIntensity = 1.1 * b;
      }
    }

    // flag pops (the knock of light) and the short-pour stutter
    for (const s of this.S) for (const f of s.flags) {
      if (!f.on) continue;
      if (f.pop > 0) f.pop = Math.max(0, f.pop - dt * 2.4);
      let k = 1;
      // one dip and back: the cosine runs exactly half a turn so the stutter
      // ends where it began — no snap when the flick timer runs out
      if (f.flick > 0) { f.flick = Math.max(0, f.flick - dt); k = 0.35 + 0.65 * Math.abs(Math.cos((0.7 - f.flick) * 4.5)); }
      f.mm.emissiveIntensity = (0.8 + 1.3 * f.pop) * k;
      f.tick.material.opacity = (0.26 + 0.66 * f.pop) * k;
      f.tick.scale.y = 1 + 1.1 * f.pop;
    }
  }

  // ---------- chips ----------
  labels(L, architectOn) {
    // the measure-mark rides the frontier lamp while the road is unfinished;
    // once every post holds flame the question is gone, and so is the chip
    if (!this.doneAll && this.cur < this.S.length) {
      L.set('lr-rule', {
        tex: `1 \\text{ cup} = ${n(this.C.rate, 0)} \\text{ flags}`,   // built from data, never a literal
        x: this.posts[this.cur].x, y: 2.75, z: POST_Z, kind: 'rule', dy: 0,
      });
    }
    if (architectOn && this.C.architect) {
      const tex = `\\texttt{${this.C.architect.concept.replace(/ /g, '\\ ')}}`;
      this.posts.forEach((p, i) => L.set('lr-arch' + i, { tex, x: p.x, y: 3.3, z: POST_Z, kind: 'architect', dy: 0 }));
    }
  }

  // ---------- card ----------
  // PLACEHOLDER strings throughout (owner-authored voice, Law 2). The carved
  // line is BUILT from enc.lampRoad at render time — 1 cup = 3 flags shaped,
  // never typed — and the card never states the flag count: the road does,
  // in countable stone.
  panel(st) {
    const C = this.C, K = this.PH.K;
    const eq = K(`1 \\text{ cup} = ${n(C.rate, 0)} \\text{ flags}`, true);
    if (this.doneAll) {
      return `
        <h2>The lamp-road</h2>
        <p class="lede">Every post holds its flame, and the flags run lit into the pines.</p>
        <div class="eq">${eq}</div>
        <p class="muted">The measure held the whole way down the road.</p>`;
    }
    return `
      <h2>The lamp-road</h2>
      <p class="lede">A lamp holds its flame at the road's edge. Between here and the next post, flags stand dark on the ground, waiting their measure of oil.</p>
      <p>Cut into the collar:</p>
      <div class="eq">${eq}</div>
      <p>${C.ask}</p>
      <div class="gate-in">
        <input type="number" id="lrCups" min="${C.cups.min}" max="${C.cups.max}" step="1" value="${this.lastCups ?? ''}" placeholder="cups">
        <button class="btn primary" id="lrSet">Pour the cups</button>
      </div>
      <p class="muted tiny">The flags to the next post are there to be counted from the road — and so is whatever a short pour leaves dark.</p>
      ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${C.architect.concept} · ${C.architect.depth}. lit = cups × ${C.rate} against the countable dark remainder, computed at pour; short leaves the remainder standing, over banks into the next stretch as a lit prefix. Nothing is scripted.</p></div>` : ''}`;
  }
}
