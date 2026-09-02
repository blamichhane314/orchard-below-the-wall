// atmo.js — day and night, and the road between them. One parameter t runs
// 0 (day) to 1 (night); everything the light touches — sky colors, fog, the
// hemisphere and ambient fill, the key light, exposure — lerps along it, so
// the flip is a crossfade, never a snap. The key light is ONE directional
// serving as sun by day and moon by night: its intensity dips through the
// middle of the transition so shadows dissolve and re-form instead of
// swinging across the ground.
//
// Stars are a seeded field on the upper sky shell (two clouds: many faint,
// a few bright, loosely gathered along a tilted band), fog-exempt, fading in
// only past the midpoint so they never show in daylight.

import * as THREE from '../vendor/three/three.module.js';

const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const C = (hex) => new THREE.Color(hex);

const DAY = {
  skyTop: C('#a8bda6'), skyBottom: C('#dfe6d6'),
  fog: C('#dfe6d6'), fogNear: 22, fogFar: 95,
  hemiSky: null /* palette sky, set in ctor */, hemiGround: C('#4a5640'), hemiI: 1.1,
  ambC: C('#44503a'), ambI: 0.85,
  keyC: C('#fff2da'), keyI: 1.75, keyPos: new THREE.Vector3(14, 22, 12),
  exposure: 1.14,
};
// a BRIGHT moonlit night: components must stay readable — the darkness lives
// in the palette (cool blues) and the sky, not in hiding the world
const NIGHT = {
  skyTop: C('#131c31'), skyBottom: C('#303c58'),
  fog: C('#242e40'), fogNear: 18, fogFar: 88,
  hemiSky: C('#56679c'), hemiGround: C('#3a4430'), hemiI: 1.0,
  ambC: C('#46516e'), ambI: 0.95,
  keyC: C('#bccce8'), keyI: 1.05, keyPos: new THREE.Vector3(-28, 44, -18),
  fillI: 0.55,   // shadowless counter-fill from the SE so moon-shadow sides stay readable
  exposure: 1.14,
};
DAY.fillI = 0;

export class Atmosphere {
  /** @param h handles from buildWorld: { skyMat, hemi, amb, sun } */
  constructor(scene, renderer, h, palette, log) {
    this.scene = scene; this.renderer = renderer; this.h = h; this.log = log;
    DAY.hemiSky = C(palette.sky);
    this.t = 0; this.target = 0;

    // the whole night sky rides one anchor so it can follow the walker in
    // worlds whose pockets sit far from the origin
    this.anchor = new THREE.Group();
    scene.add(this.anchor);

    // ---- stars: two clouds on the upper shell, banded ----
    const mkCloud = (count, size, color, seed) => {
      const r = rng(seed);
      const pos = new Float32Array(count * 3);
      const band = new THREE.Vector3(0.45, 1, 0.25).normalize();  // the sky-band's pole
      for (let i = 0; i < count; i++) {
        let v;
        do {
          v = new THREE.Vector3(r() * 2 - 1, r(), r() * 2 - 1).normalize();
          // 45% of stars re-rolled toward the band: gathered, not striped
        } while (v.y < 0.06 || (r() < 0.45 && Math.abs(v.dot(band)) > 0.35 + r() * 0.2));
        pos.set([v.x * 168, v.y * 168, v.z * 168], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        color, size, sizeAttenuation: false, transparent: true, opacity: 0,
        depthWrite: false, fog: false,
      });
      const p = new THREE.Points(g, m);
      p.renderOrder = -1;   // behind everything, in front of the sky dome
      this.anchor.add(p);
      return m;
    };
    this.starMats = [
      mkCloud(620, 1.6, C('#dfe6f5'), 90210),
      mkCloud(70, 3.0, C('#fff2d8'), 31337),
    ];

    // ---- the milky way: a dense faint river along the same band, and a soft
    // dust glow riding it — thousands of stars too small to name ----
    const POLE = new THREE.Vector3(0.8, 0.35, 0.3).normalize();   // low pole ⇒ the river arches near the zenith
    const e1 = new THREE.Vector3(1, 0, 0).cross(POLE).normalize();
    const e2 = new THREE.Vector3().crossVectors(POLE, e1).normalize();
    const gauss = (r) => (r() + r() + r() - 1.5) * 0.816;
    const mkBand = (count, size, color, seed, sigma, radius) => {
      const r = rng(seed);
      const pos = new Float32Array(count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        let tries = 0;
        do {
          const u = r() * Math.PI * 2;
          v.copy(e1).multiplyScalar(Math.cos(u)).addScaledVector(e2, Math.sin(u))
            .addScaledVector(POLE, gauss(r) * sigma).normalize();
        } while (v.y < -0.05 && ++tries < 20);
        pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        color, size, sizeAttenuation: false, transparent: true, opacity: 0,
        depthWrite: false, fog: false,
      });
      const p = new THREE.Points(g, m);
      p.renderOrder = -1;
      this.anchor.add(p);
      return m;
    };
    this.galMats = [
      mkBand(1500, 1.0, C('#c2cee6'), 777001, 0.16, 166),
      mkBand(600, 1.5, C('#dfe6f5'), 777002, 0.10, 165),
      mkBand(150, 2.2, C('#efe2c8'), 777003, 0.07, 164),
    ];
    this.dust = [];
    {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const cx = cv.getContext('2d');
      const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
      const dustTex = new THREE.CanvasTexture(cv);
      const r = rng(424242);
      for (let i = 0; i < 26; i++) {
        const u = (i / 26) * Math.PI * 2 + r() * 0.2;
        const v = new THREE.Vector3().copy(e1).multiplyScalar(Math.cos(u)).addScaledVector(e2, Math.sin(u))
          .addScaledVector(POLE, gauss(r) * 0.05).normalize();
        if (v.y < 0.05) continue;
        const m = new THREE.SpriteMaterial({ map: dustTex, color: C('#94a6cc'), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
        const s = new THREE.Sprite(m);
        s.position.copy(v).multiplyScalar(150);
        s.scale.setScalar(30 + r() * 26);
        s.renderOrder = -1;
        this.anchor.add(s);
        this.dust.push(m);
      }
    }

    // ---- the moon: a small lit disc that owns the night's key direction ----
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: C('#dde6f2'), transparent: true, opacity: 0, fog: false })
    );
    this.moon.position.copy(NIGHT.keyPos).normalize().multiplyScalar(172);
    this.anchor.add(this.moon);

    // shadowless counter-fill opposite the moon: the faces the moon can't
    // reach must stay readable — modeled in cool blue, never black
    this.fill = new THREE.DirectionalLight(C('#33425f'), 0);
    this.fill.position.set(26, 18, 24);
    scene.add(this.fill);

    this.apply();
  }

  get night() { return this.target === 1; }

  setNight(on) {
    if (this.target === (on ? 1 : 0)) return;
    this.target = on ? 1 : 0;
    this.log.push('world.night', { on: !!on });
    try { localStorage.setItem('lw.night', on ? '1' : '0'); } catch {}
  }
  toggle() { this.setNight(!this.night); }

  /** Restore a remembered mode without the crossfade (boot only). */
  restore() {
    try {
      if (localStorage.getItem('lw.night') === '1') { this.target = 1; this.t = 1; this.apply(); }
    } catch {}
  }

  update(dt, camera) {
    if (camera) this.anchor.position.set(camera.position.x, 0, camera.position.z);
    if (this.t === this.target) return;
    const dir = Math.sign(this.target - this.t);
    this.t = Math.max(0, Math.min(1, this.t + dir * dt / 1.6));
    this.apply();
  }

  apply() {
    const t = this.t * this.t * (3 - 2 * this.t);   // smoothstep the whole fade
    const { skyMat, hemi, amb, sun } = this.h;

    skyMat.uniforms.top.value.lerpColors(DAY.skyTop, NIGHT.skyTop, t);
    skyMat.uniforms.bottom.value.lerpColors(DAY.skyBottom, NIGHT.skyBottom, t);

    this.scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, t);
    this.scene.fog.near = DAY.fogNear + (NIGHT.fogNear - DAY.fogNear) * t;
    this.scene.fog.far = DAY.fogFar + (NIGHT.fogFar - DAY.fogFar) * t;

    hemi.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, t);
    hemi.groundColor.lerpColors(DAY.hemiGround, NIGHT.hemiGround, t);
    hemi.intensity = DAY.hemiI + (NIGHT.hemiI - DAY.hemiI) * t;

    amb.color.lerpColors(DAY.ambC, NIGHT.ambC, t);
    amb.intensity = DAY.ambI + (NIGHT.ambI - DAY.ambI) * t;

    // the key light: sun handing off to moon, dimming through the handoff so
    // shadows dissolve and re-form rather than sweeping the ground
    sun.color.lerpColors(DAY.keyC, NIGHT.keyC, t);
    sun.position.lerpVectors(DAY.keyPos, NIGHT.keyPos, t);
    const handoff = 0.3 + 0.7 * Math.abs(2 * t - 1);
    sun.intensity = (DAY.keyI + (NIGHT.keyI - DAY.keyI) * t) * handoff;

    this.renderer.toneMappingExposure = DAY.exposure + (NIGHT.exposure - DAY.exposure) * t;
    this.fill.intensity = NIGHT.fillI * t;

    const starT = Math.max(0, Math.min(1, (t - 0.45) / 0.55));
    this.starMats[0].opacity = 0.85 * starT;
    this.starMats[1].opacity = 0.95 * starT;
    this.moon.material.opacity = starT;
    const galT = Math.max(0, Math.min(1, (t - 0.5) / 0.5));
    this.galMats[0].opacity = 0.5 * galT;
    this.galMats[1].opacity = 0.65 * galT;
    this.galMats[2].opacity = 0.8 * galT;
    for (const m of this.dust) m.opacity = 0.05 * galT;
  }
}
