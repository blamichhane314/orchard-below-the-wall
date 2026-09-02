// buildstill.js — the still place (design/MEMORY_CARVING_DESIGN.md).
// One calm ring at dusk: a worn floor, a darker centre, a low kerb, a ring of
// framing trees, four unlit lanterns, grass. Nothing here does anything. The
// stones themselves are js/parts/stillstones.js; this file is only the quiet.
//
// RESTRAINT IS THE BRIEF. No water, no structures, no text, no motion beyond a
// slow canopy breath. Every element is a primitive, flat-shaded, in the
// still.json palette. If a thing here asks to be looked at, it is wrong.
import * as THREE from '../vendor/three/three.module.js';
import { rng, mat, jitter, tree } from './build.js';

export function buildStill(scene, world, enc) {
  const P = world.palette;
  const dyn = { canopies: [], motes: null, t: 0, waystones: [] };
  const colliders = [];
  const solid = [];
  const interact = [];
  const r = rng(3131);

  // ---------- dusk: grey-violet overhead into a warm parchment horizon ----------
  scene.fog = new THREE.Fog(new THREE.Color('#d6ccb6'), 14, 52);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#8b8ea2') }, bottom: { value: new THREE.Color('#e8dcc0') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.18, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    })
  );
  scene.add(sky);
  // dimmer and cooler than the orchard's noon: the fill carries the place
  const hemi = new THREE.HemisphereLight(new THREE.Color('#b4b0c2'), new THREE.Color('#3d4a36'), 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(new THREE.Color('#4a5044'), 0.62);
  scene.add(amb);
  const sun = new THREE.DirectionalLight('#f4dcb2', 1.05);
  sun.position.set(-17, 6.2, -9);   // low and behind: long shadows drawn across the floor
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 72 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun);
  dyn.atmo = { skyMat: sky.material, hemi, amb, sun };

  // ---------- ground: outer field, worn ring floor, darker centre ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70, 1, 1), mat(P.ground, { flatShading: false }));
  ground.rotateX(-Math.PI / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(9.5, 44), mat(P.groundLit, { flatShading: false }));
  disc.rotateX(-Math.PI / 2);
  disc.position.y = .012;
  disc.receiveShadow = true;
  scene.add(disc);
  // the darker inner circle: the middle of the ring is not walked, so it stays
  // green. The pale band between it and the kerb is the worn part.
  const inner = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), mat('#556a41', { flatShading: false }));
  inner.rotateX(-Math.PI / 2);
  inner.position.y = .024;
  inner.receiveShadow = true;
  scene.add(inner);

  // ---------- framing trees: the ring is closed by them, not by a wall ----------
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * .25;
    const d = 13 + r() * 4;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const t = tree(P, Math.round(x * 977 + z * 131), .9 + r() * .5);
    t.group.position.set(x, 0, z);
    t.group.rotation.y = r() * Math.PI * 2;
    scene.add(t.group);
    colliders.push({ type: 'circle', x, z, r: .45 });
    solid.push(t.group);
    dyn.canopies.push(t);   // one slow breath; the engine owns the sway
  }

  // ---------- kerb: twelve flat stones set into the floor's edge ----------
  // No colliders: they are ankle-high and the player should be able to step
  // over the boundary of this place without being stopped by it.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (r() - .5) * .12;
    const d = 9.5 + (r() - .5) * .3;
    const geo = r() < .5 ? new THREE.DodecahedronGeometry(.3 + r() * .12, 0) : new THREE.IcosahedronGeometry(.32 + r() * .1, 0);
    geo.scale(1, .3 + r() * .08, .78);
    const s = new THREE.Mesh(geo, mat(jitter(P.stone, r)));
    s.position.set(Math.cos(a) * d, .05, Math.sin(a) * d);
    s.rotation.set((r() - .5) * .1, a + (r() - .5) * .3, (r() - .5) * .1);
    s.castShadow = true; s.receiveShadow = true;
    scene.add(s);
    solid.push(s);
  }

  // ---------- four unlit lanterns ----------
  // Dim, warm, and cold: nobody has lit them. They carry no light source and
  // no logic — they only tell the eye that this ring was made, not found.
  const postM = mat(P.trunk), capM = mat('#5a5348');
  const lampM = mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: .22 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * 8.3, z = Math.sin(a) * 8.3;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, 1.95, 6), postM);
    post.position.y = .975; post.castShadow = true; post.receiveShadow = true;
    g.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.16, .16, 6), capM);
    cap.position.y = 2.11; cap.castShadow = true;
    g.add(cap);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.085, 8, 6), lampM);
    bulb.position.y = 1.94;
    g.add(bulb);
    scene.add(g);
    solid.push(g);
    colliders.push({ type: 'circle', x, z, r: .16 });   // a post is a solid thing
  }

  // ---------- grass: sparse on the worn floor, thicker in the field ----------
  {
    const gr = rng(8181);
    const geo = new THREE.ConeGeometry(.045, .3, 5);
    geo.translate(0, .15, 0);
    const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const count = 120;
    const inst = new THREE.InstancedMesh(geo, m, count);
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // area-correct polar sampling: the first 22 push through the floor
      // itself, the rest fill the field out to the trees
      const inField = i >= 22;
      const d0 = inField ? 9.9 : 3.9, d1 = inField ? 16.5 : 9.2;
      const d = Math.sqrt(d0 * d0 + gr() * (d1 * d1 - d0 * d0));
      const a = gr() * Math.PI * 2;
      e.set((gr() - .5) * .2, gr() * Math.PI, (gr() - .5) * .2); q.setFromEuler(e);
      sc.setScalar(inField ? .7 + gr() * 1.2 : .55 + gr() * .5);
      pos.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      M4.compose(pos, q, sc);
      inst.setMatrixAt(i, M4);
      inst.setColorAt(i, jitter(gr() < .3 ? P.groundLit : '#4e6038', gr, .02, .1, .1));
    }
    inst.receiveShadow = true;
    scene.add(inst);
  }

  return { colliders, solid, interact, dyn };
}
