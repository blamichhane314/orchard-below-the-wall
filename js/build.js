// build.js — the orchard, built from numbers. No modelled assets: every mesh
// is a primitive or a low-poly solid, flat-shaded, in the fixed palette.
// "Not super detailed" is a style; "not cheap" is the execution bar — it is
// bought here with light (soft shadows, hemisphere fill, warm key), air
// (fog, hazed distance), and motion (canopy sway, drifting motes), none of
// which need an asset pipeline.

import * as THREE from '../vendor/three/three.module.js';

const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...opts });

function jitter(hex, r, dh = 0.012, ds = 0.05, dl = 0.05) {
  const c = new THREE.Color(hex);
  c.offsetHSL((r() - 0.5) * dh, (r() - 0.5) * ds, (r() - 0.5) * dl);
  return c;
}

function tree(P, seed, s = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const h = (3.3 + r() * 2.4) * s, w = (1.4 + r() * 0.8) * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.16 * s, h * 0.66, 7), mat(jitter(P.trunk, r)));
  trunk.position.y = h * 0.33; trunk.castShadow = true;
  g.add(trunk);
  const canopy = new THREE.Group();
  const blobs = [
    [0.12 * w, h * 0.72, 0, w * 0.82, h * 0.30, w * 0.72, '#2a4535'],
    [-0.25 * w, h * 0.80, 0.1 * w, w * 0.62, h * 0.24, w * 0.55, P.canopyMid],
    [0.05 * w, h * 0.94, -0.08 * w, w * 0.5, h * 0.20, w * 0.45, '#3d6349'],
  ];
  for (const [x, y, z, rx, ry, rz, c] of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(jitter(c, r)));
    m.scale.set(rx, ry, rz); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    canopy.add(m);
  }
  g.add(canopy);
  return { group: g, canopy, seed: r() * 20 };
}

export function buildWorld(scene, world, enc) {
  const P = world.palette;
  const dyn = { canopies: [], motes: null, t: 0 };
  const colliders = [];
  const solid = [];        // occluders for label sync
  const interact = [];     // raycast targets, each with userData.act

  // ---------- sky, light, air ----------
  scene.fog = new THREE.Fog(new THREE.Color(P.mist), 22, 95);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(P.skyHigh) }, bottom: { value: new THREE.Color(P.mist) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.18, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    })
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(new THREE.Color(P.sky), new THREE.Color('#4a5640'), 1.1);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(new THREE.Color('#44503a'), 0.85);   // floors the darkness of downward facets
  scene.add(amb);
  const sun = new THREE.DirectionalLight('#fff2da', 1.75);
  sun.position.set(14, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 68;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -44;   // north coverage both modes: 'bottom' faces north for the day sun (at +z), 'top' for the night moon (at -z)
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sunTarget = new THREE.Object3D(); sunTarget.position.set(18, 0, 0);
  scene.add(sunTarget); sun.target = sunTarget;
  scene.add(sun);

  dyn.atmo = { skyMat: sky.material, hemi, amb, sun };   // handles for day/night crossfade

  // ---------- ground, ravine, path ----------
  // two banks with a water-cut between them — the bridge is the only way over
  const R = world.ravine;
  for (const [x0, x1] of [[-190, R.x0], [R.x1, 190]]) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 340, 1, 1), mat(P.ground, { flatShading: false }));
    bank.rotation.x = -Math.PI / 2;
    bank.position.set((x0 + x1) / 2, 0, 0);
    bank.receiveShadow = true;
    scene.add(bank);
  }
  for (const [wx, flip] of [[R.x0, 1], [R.x1, -1]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 340), mat('#3e3428'));
    wall.position.set(wx + flip * 0.16, -1.3, 0);
    wall.receiveShadow = true;
    scene.add(wall);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, 340, 1, 1),
    mat('#2c4440', { flatShading: false, emissive: new THREE.Color('#16282a'), emissiveIntensity: 0.5 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set((R.x0 + R.x1) / 2, R.waterY, 0);
  scene.add(water);

  for (const [px0, px1] of [[-16.5, R.x0 - 0.1], [R.x1 + 0.1, 61.5]]) {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, 1.7, 1, 1), mat(P.groundLit, { flatShading: false }));
    path.rotation.x = -Math.PI / 2; path.position.set((px0 + px1) / 2, 0.012, 0.35);
    path.receiveShadow = true;
    scene.add(path);
  }

  // grass tufts
  {
    const r = rng(4242);
    const geo = new THREE.ConeGeometry(0.045, 0.3, 5);
    geo.translate(0, 0.15, 0);
    const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const count = 1100;
    const inst = new THREE.InstancedMesh(geo, m, count);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const x = -17 + r() * 78, z = -16 + r() * 54;
      if (x > world.ravine.x0 - 0.6 && x < world.ravine.x1 + 0.6) { M.makeScale(0, 0, 0); inst.setMatrixAt(i, M); continue; }
      if (Math.abs(z - 0.35) < 1.0 && x > -16 && x < 61.5 && r() < 0.85) { // sparse on the path
        M.makeScale(0, 0, 0); inst.setMatrixAt(i, M); continue;
      }
      e.set((r() - 0.5) * 0.2, r() * Math.PI, (r() - 0.5) * 0.2); q.setFromEuler(e);
      sc.setScalar(0.7 + r() * 1.3);
      M.compose(new THREE.Vector3(x, 0, z), q, sc);
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, jitter(r() < 0.3 ? P.groundLit : '#54683c', r, 0.02, 0.1, 0.1));
    }
    inst.receiveShadow = true;
    scene.add(inst);
  }

  // pollen motes
  {
    const r = rng(777);
    const n = 70, pos = new Float32Array(n * 3), seed = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 2 + r() * 34; pos[i * 3 + 1] = 0.4 + r() * 3.4; pos[i * 3 + 2] = -3 + r() * 23;
      seed.push(r() * 10);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      color: new THREE.Color(P.parchment), size: 0.05, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false,
    }));
    scene.add(pts);
    dyn.motes = { pts, seed, base: pos.slice() };
  }

  // ---------- forest ----------
  for (const row of world.forest) {
    for (const x of row.xs) {
      const t = tree(P, Math.round(x * 977 + row.z * 131), row.s);
      t.group.position.set(x + (rng(x * 7 + row.z)() - 0.5) * 1.2, 0, row.z);
      scene.add(t.group);
      solid.push(t.group);
      dyn.canopies.push(t);
      colliders.push({ type: 'circle', x: t.group.position.x, z: t.group.position.z, r: 0.3 });
    }
  }

  // ---------- entities ----------
  const ent = (id) => world.entities.find((e) => e.id === id);

  // standing stone
  {
    const e = ent('standing-stone');
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.46, 2.6, 6), mat(P.stone));
    s.position.y = 1.3; s.rotation.y = 0.4; s.castShadow = true;
    g.add(s);
    for (let i = 0; i < 4; i++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.05),
        mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.35 }));
      groove.position.set(0.06, 0.75 + i * 0.44, 0.34);
      groove.rotation.z = 0.06;
      g.add(groove);
    }
    g.position.set(e.at.x, 0, e.at.z);
    g.userData.act = { entity: 'standing-stone' };
    scene.add(g); solid.push(g); interact.push(g);
    colliders.push({ type: 'circle', x: e.at.x, z: e.at.z, r: 0.55 });
  }

  // way-stones (three, each individually pickable)
  {
    const e = ent('way-stones');
    dyn.waystones = [];
    const offs = [[-0.85, 0.15, -0.14], [0, -0.2, 0], [0.85, 0.15, 0.14]];
    enc.waystones.rules.forEach((rule, i) => {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 1.12, 5), mat(P.stone));
      s.position.y = 0.56; s.rotation.y = i * 0.8; s.castShadow = true;
      g.add(s);
      const x = e.at.x + offs[i][0], z = e.at.z + offs[i][2] - 0.15;
      g.position.set(x, 0, z);
      g.rotation.z = offs[i][1] * 0.12;
      g.userData.act = { waystone: i };
      scene.add(g); solid.push(g); interact.push(g);
      colliders.push({ type: 'circle', x, z, r: 0.34 });
      dyn.waystones.push({ group: g, stoneMesh: s, top: { x, y: 1.32, z }, rule, beam: null, fade: 0 });
    });
  }

  // counting-gate fence + seesaw
  {
    const e = ent('counting-gate');
    const fx = e.at.x;
    const fence = new THREE.Group();
    const railM = mat('#6b5a44'), postM = mat('#5a4a38');
    const gapLo = -0.45, gapHi = 1.15;
    for (let z = world.bounds.zMin + 0.2; z <= world.bounds.zMax; z += 1.35) {
      if (z > gapLo - 0.35 && z < gapHi + 0.35) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.15, 0.13), postM);
      post.position.set(fx, 0.57, z); post.castShadow = true;
      fence.add(post);
    }
    for (const [zA, zB] of [[world.bounds.zMin, gapLo], [gapHi, world.bounds.zMax]]) {
      for (const ry of [0.42, 0.86]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, zB - zA), railM);
        rail.position.set(fx, ry, (zA + zB) / 2); rail.castShadow = true;
        fence.add(rail);
      }
    }
    scene.add(fence); solid.push(fence);
    colliders.push({ type: 'aabb', minX: fx - 0.15, maxX: fx + 0.15, minZ: world.bounds.zMin, maxZ: gapLo });
    colliders.push({ type: 'aabb', minX: fx - 0.15, maxX: fx + 0.15, minZ: gapHi, maxZ: world.bounds.zMax });

    // the seesaw gate in the gap
    const g = new THREE.Group();
    const postA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.14), postM);
    postA.position.y = 0.85; postA.castShadow = true;
    g.add(postA);
    const beamG = new THREE.Group(); beamG.position.y = 1.62;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.9), mat('#7a6448'));
    beam.castShadow = true;
    beamG.add(beam);
    const baskets = [];
    for (const side of [-1, 1]) {
      const bg = new THREE.Group();
      bg.position.set(0, 0, side * 0.8);
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), postM);
      line.position.y = -0.25; bg.add(line);
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.16, 8, 1, true), mat('#6b5a44', { side: THREE.DoubleSide }));
      basket.position.y = -0.55; bg.add(basket);
      const pebbleG = new THREE.Group(); pebbleG.position.y = -0.5;
      bg.add(pebbleG);
      beamG.add(bg);
      baskets.push({ group: bg, pebbles: pebbleG });
    }
    g.add(beamG);
    g.position.set(fx, 0, (gapLo + gapHi) / 2);   // beam spans the gap along z
    g.userData.act = { entity: 'counting-gate' };
    scene.add(g); solid.push(g); interact.push(g);
    dyn.gate = { group: g, beamG, baskets, targetTilt: 0.34, tilt: 0.34, open: false, lift: 0 };
    colliders.push({ type: 'aabb', minX: fx - 0.3, maxX: fx + 0.3, minZ: gapLo, maxZ: gapHi, active: () => !dyn.gate.open });
  }

  // rock
  {
    const e = ent('rock');
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mat(P.stoneLit));
    m.scale.y = 0.55; m.position.set(e.at.x, 0.12, e.at.z);
    m.castShadow = true;
    m.userData.act = { entity: 'rock' };
    scene.add(m); interact.push(m);
    dyn.rock = m;
  }

  // fig tree + fig
  {
    const e = ent('fig-tree');
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 3.4, 7), mat('#4b3f31'));
    trunk.position.y = 1.7; trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Group();
    const r = rng(999);
    for (const [x, y, z, rx, ry, rz, c] of [
      [0.2, 3.9, 0, 2.0, 1.0, 1.7, '#2a4535'],
      [0.9, 4.4, 0.2, 1.7, 0.85, 1.4, P.canopyMid],
      [-0.5, 4.55, -0.1, 1.2, 0.65, 1.05, '#3d6349'],
    ]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(jitter(c, r)));
      m.scale.set(rx, ry, rz); m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      canopy.add(m);
    }
    g.add(canopy);
    g.position.set(e.at.x, 0, e.at.z);
    g.rotation.z = -0.07;
    scene.add(g); solid.push(g);
    dyn.canopies.push({ group: g, canopy, seed: 3.3 });
    colliders.push({ type: 'circle', x: e.at.x, z: e.at.z, r: 0.4 });

    const fig = ent('fig');
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      mat('#7d4560', { emissive: new THREE.Color('#8a4a68'), emissiveIntensity: 0.6 }));
    fm.scale.set(0.8, 1.05, 0.8);
    fm.position.set(fig.at.x, fig.at.y, fig.at.z);
    fm.castShadow = true;
    scene.add(fm);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.5), mat('#4b3f31'));
    stem.position.set(fig.at.x, fig.at.y + 0.38, fig.at.z);
    scene.add(stem);
    dyn.fig = { mesh: fm, stem, dropT: -1 };
  }

  // house + door + lintel + interior
  {
    const H = world.house;
    const g = new THREE.Group();
    const wallM = mat('#7d7768'), wallM2 = mat('#8a8578');
    const t = 0.24;
    const frontZ = H.z + H.d / 2;
    const addBox = (w, h, d, x, y, z, m = wallM, both = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true;
      g.add(b);
      if (both) colliders.push({ type: 'aabb', minX: H.x + x - w / 2, maxX: H.x + x + w / 2, minZ: H.z + z - d / 2, maxZ: H.z + z + d / 2 });
      return b;
    };
    const sideW = (H.w - H.doorW) / 2;
    addBox(sideW, H.h, t, -(H.doorW + sideW) / 2, H.h / 2, H.d / 2);                       // front left
    addBox(sideW, H.h, t, (H.doorW + sideW) / 2, H.h / 2, H.d / 2, wallM2);               // front right
    // above the door: visual only — the collision map is 2D and a collider here
    // would fill the doorway at every height (the invisible-wall bug)
    addBox(H.doorW + 0.2, H.h - H.doorH, t, 0, H.doorH + (H.h - H.doorH) / 2, H.d / 2, wallM, false);
    addBox(H.w, H.h, t, 0, H.h / 2, -H.d / 2, wallM2);                                    // back
    addBox(t, H.h, H.d, -H.w / 2, H.h / 2, 0, wallM2);                                    // left
    addBox(t, H.h, H.d, H.w / 2, H.h / 2, 0, wallM);                                      // right
    // roof: shallow prism
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-H.d / 2 - 0.5, 0); roofShape.lineTo(H.d / 2 + 0.5, 0); roofShape.lineTo(0, 1.35); roofShape.closePath();
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roofShape, { depth: H.w + 1.0, bevelEnabled: false }),
      mat(P.brick)
    );
    roof.rotation.y = Math.PI / 2;
    roof.position.set(-(H.w + 1.0) / 2, H.h, 0);
    roof.castShadow = true;
    g.add(roof);
    // interior floor + pedestal + scroll
    const floor = new THREE.Mesh(new THREE.BoxGeometry(H.w - 0.3, 0.06, H.d - 0.3), mat(P.vellum, { flatShading: false }));
    floor.position.y = 0.03; floor.receiveShadow = true;
    g.add(floor);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 7), wallM2);
    ped.position.set(0, 0.5, -0.9); ped.castShadow = true;
    g.add(ped);
    colliders.push({ type: 'circle', x: H.x, z: H.z - 0.9, r: 0.45 });
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 8),
      mat(P.parchment, { emissive: new THREE.Color(P.parchment), emissiveIntensity: 0.08 }));
    scroll.rotation.z = Math.PI / 2 - 0.12; scroll.position.set(0, 1.07, -0.9);
    scroll.userData.act = { entity: 'scroll' };
    g.add(scroll); interact.push(scroll);
    dyn.scroll = scroll;

    g.position.set(H.x, 0, H.z);
    scene.add(g); solid.push(g);

    // the door, hinged at its left jamb
    const hinge = new THREE.Group();
    hinge.position.set(H.x - H.doorW / 2, 0, frontZ);
    const door = new THREE.Mesh(new THREE.BoxGeometry(H.doorW, H.doorH, 0.09), mat('#3a2f26'));
    door.position.set(H.doorW / 2, H.doorH / 2, 0);
    door.castShadow = true;
    hinge.add(door);
    hinge.userData.act = { entity: 'door' };   // any child (door, knob) resolves to this
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(P.gold, { emissive: new THREE.Color(P.gold), emissiveIntensity: 0.4 }));
    knob.position.set(H.doorW - 0.16, H.doorH * 0.48, 0.08);
    hinge.add(knob);
    scene.add(hinge); interact.push(hinge); solid.push(hinge);
    dyn.door = { hinge, open: false, ang: 0 };
    colliders.push({ type: 'aabb', minX: H.x - H.doorW / 2, maxX: H.x + H.doorW / 2, minZ: frontZ - 0.12, maxZ: frontZ + 0.12, active: () => !dyn.door.open });

    // lintel number line 0..6 above the door (for the roots station)
    const lin = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 0.06), mat(P.vellum));
    strip.position.set(0, 0, 0);
    lin.add(strip);
    for (let v = 0; v <= 6; v++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.07), mat(P.ink));
      tick.position.set(-1.8 + v * 0.6, 0, 0.01);
      lin.add(tick);
    }
    lin.position.set(H.x, H.doorH + 0.55, frontZ + 0.09);
    scene.add(lin);
    dyn.lintel = { group: lin, x0: H.x - 1.8, y: H.doorH + 0.55, z: frontZ + 0.09, perUnit: 0.6, marks: [], curve: null, glints: [] };

    // a warm lamp by the door + the interior light that wakes when it opens
    const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
      mat(P.lamp, { emissive: new THREE.Color(P.lamp), emissiveIntensity: 1.4 }));
    lampG.position.set(H.x + H.doorW / 2 + 0.42, 2.1, frontZ + 0.12);
    scene.add(lampG);
    const lampL = new THREE.PointLight(new THREE.Color(P.lamp), 1.6, 7, 1.8);
    lampL.position.copy(lampG.position).add(new THREE.Vector3(0, 0, 0.3));
    scene.add(lampL);
    const inner = new THREE.PointLight(new THREE.Color(P.lamp), 0.0, 10, 1.6);
    inner.position.set(H.x, 2.3, H.z - 0.4);
    scene.add(inner);
    dyn.interiorLight = inner;
  }

  return { colliders, solid, interact, dyn };
}

// shared scenery vocabulary — the vale builder (buildvale.js) speaks the same
// visual language with the same brushes
export { rng, mat, jitter, tree };
