// The Vale — terrain for the factorization method world (a separate space;
// see design/SCRIPT_FACTOR_WORLD.md). Same visual language as the orchard:
// helpers are imported from build.js so the two worlds share one brush box.
// The vale runs south → north (z −66..70), forest-framed, open in the middle;
// chapter parts add their own props on this floor.
import * as THREE from '../vendor/three/three.module.js';
import { rng, mat, jitter, tree } from './build.js';

export function buildVale(scene, world, enc) {
  const P = world.palette;
  const dyn = { canopies: [], motes: null, t: 0, waystones: [] };
  const colliders = [];
  const solid = [];
  const interact = [];

  // ---------- sky, light, air (orchard atmosphere, vale-sized shadows) ----------
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
  const amb = new THREE.AmbientLight(new THREE.Color('#44503a'), 0.85);
  scene.add(amb);
  const sun = new THREE.DirectionalLight('#fff2da', 1.75);
  sun.position.set(14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 78; sun.shadow.camera.bottom = -78;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sunTarget = new THREE.Object3D(); sunTarget.position.set(0, 0, 2);
  scene.add(sunTarget); sun.target = sunTarget;
  scene.add(sun);

  dyn.atmo = { skyMat: sky.material, hemi, amb, sun };

  // ---------- floor, way, plaza ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 240, 1, 1), mat(P.ground, { flatShading: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const way = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 132, 1, 1), mat(P.groundLit, { flatShading: false }));
  way.rotation.x = -Math.PI / 2;
  way.position.set(0, 0.012, 3);
  way.receiveShadow = true;
  scene.add(way);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 28), mat(P.groundLit, { flatShading: false }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.011, -55);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // grass tufts across the vale floor, sparse on the way
  {
    const r = rng(7311);
    const geo = new THREE.ConeGeometry(0.045, 0.3, 5);
    geo.translate(0, 0.15, 0);
    const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const count = 950;
    const inst = new THREE.InstancedMesh(geo, m, count);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const x = -21 + r() * 42, z = -65 + r() * 134;
      if (Math.abs(x) < 1.0 && r() < 0.85) { M.makeScale(0, 0, 0); inst.setMatrixAt(i, M); continue; }
      e.set((r() - 0.5) * 0.2, r() * Math.PI, (r() - 0.5) * 0.2); q.setFromEuler(e);
      sc.setScalar(0.7 + r() * 1.3);
      M.compose(new THREE.Vector3(x, 0, z), q, sc);
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, jitter(r() < 0.3 ? P.groundLit : '#54683c', r, 0.02, 0.1, 0.1));
    }
    inst.receiveShadow = true;
    scene.add(inst);
  }

  // ---------- framing forest (rows come from the world file) ----------
  for (const row of world.forest ?? []) {
    for (const x of row.xs) {
      const t = tree(P, Math.round(x * 977 + row.z * 131), row.s ?? 1);
      t.group.position.set(x, 0, row.z);
      scene.add(t.group);
      dyn.canopies.push(t);
      colliders.push({ type: 'circle', x, z: row.z, r: 0.5 });
      solid.push(t.group);
    }
  }

  return { colliders, solid, interact, dyn };
}
