// main.js — the loop and the wiring. Everything that is not the engine is the
// same organism as the earlier spikes: physics.js does the mathematics,
// panels.js does the reading surface, log.js keeps the record (Law 7),
// content/*.json says what exists (Law 6).

import * as THREE from '../vendor/three/three.module.js';
import { buildWorld } from './build.js';
import { buildVale } from './buildvale.js';
import { buildWood } from './buildwood.js';
import { buildStill } from './buildstill.js';
import { FPSControls } from './controls.js';
import { MathLabels } from './labels.js';
import { Stations } from './stations.js';
import { Reading } from './reading.js';
import { Bridge } from './bridge.js';
import { Atmosphere } from './atmo.js';
import { renderPanel, K } from './panels.js';
import { EventLog } from './log.js';
import * as P4 from './physics.js';

const $ = (s) => document.querySelector(s);
const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

// one engine, several worlds: a page names its world (window.__WORLD) or the
// URL does (?w=). world3/encounters.json keep their historical names.
const WNAME = window.__WORLD || new URLSearchParams(location.search).get('w') || 'world3';
const [world, enc] = await Promise.all([
  fetch(`content/${WNAME === 'world3' ? 'world3' : WNAME}.json`).then((r) => r.json()),
  fetch(`content/${WNAME === 'world3' ? 'encounters' : WNAME + '-enc'}.json`).then((r) => r.json()),
]);
const P = world.palette;
const ent = (id) => world.entities.find((e) => e.id === id);
const ORCHARD = !!world.bridge;   // the orchard's fixtures exist only where its data does
const FIG = ent('fig') ?? { at: { x: 0, y: 0, z: 0 }, radius: 0 };

// ---------- engine ----------
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 300);
const log = new EventLog();

const { colliders, solid, interact, dyn } = (world.builder === 'vale' ? buildVale : world.builder === 'wood' ? buildWood : world.builder === 'still' ? buildStill : buildWorld)(scene, world, enc);
const labels = new MathLabels($('#labels'), camera);
let stations = null, reading = null, bridge = null;
if (ORCHARD) {
  // the far west exists only for the Bell Yard enclave — walkers stop here
  colliders.push({ type: 'aabb', minX: -18, maxX: -17.4, minZ: -40, maxZ: 40 });
  stations = new Stations(scene, world, enc, dyn, log);
  reading = new Reading(scene, P);
  bridge = new Bridge(scene, world, enc, log);
  colliders.push(...bridge.colliders);
  solid.push(bridge.group);
  interact.push(bridge.group);
}

const atmo = new Atmosphere(scene, renderer, dyn.atmo, P, log);
atmo.restore();

// ---------- parts registry: each part owns one file in js/parts/ ----------
// (see js/parts/_contract.md). Dynamic imports so a missing or broken part
// skips with a warning instead of killing the world.
// the trace: a whisper of the walker's working memory at the bottom of the
// view (what they last committed). Worlds feed it via PH.trace(tex); the
// Trace HUD button, where a page has one, turns it off and on (persisted).
const traceEl = document.createElement('div');
traceEl.id = 'trace';
document.getElementById('app').appendChild(traceEl);
let traceOn = true;
try { traceOn = localStorage.getItem('lw.trace') !== '0'; } catch {}
let traceFade = -1;
const traceBtn = $('#hud-trace');
if (traceBtn) {
  traceBtn.classList.toggle('is-on', traceOn);
  traceBtn.addEventListener('click', () => {
    traceOn = !traceOn;
    try { localStorage.setItem('lw.trace', traceOn ? '1' : '0'); } catch {}
    traceBtn.classList.toggle('is-on', traceOn);
    log.push('trace.toggle', { on: traceOn });
  });
}
const setTrace = (tex) => {
  if (!tex) { traceEl.innerHTML = ''; traceFade = -1; return; }
  traceEl.innerHTML = K(tex);
  traceFade = 0;
};

const PH = {
  trace: (tex) => setTrace(tex),
  openPanel: (id) => { st.panel = id; refresh(); },
  dismissPanel: (...a) => dismissPanel(...a),
  dismissLater: (...a) => dismissLater(...a),
  refresh: () => refresh(),
  K: (tex, display) => K(tex, display),
  ent: (id) => ent(id),
};
// a narrow game interface for parts that must reach shared state (the bag,
// the player) — everything else stays out of reach on purpose
const game = {
  getStrength: (id) => st.strengths[id],
  setStrength: (id, v) => { st.strengths[id] = Math.max(0, Math.min(1, v)); },
  teleport: (...a) => __lw.teleport(...a),
  playerPos: () => controls.pos,
};
const parts = [];
const partById = (id) => parts.find((p) => p.id === id);
for (const [id, path] of world.parts ?? [
  ['cold-well', './parts/coldwell.js'],
  ['drawbridge', './parts/drawbridge.js'],
  ['counter-stones', './parts/counterstones.js'],
  ['lamp-road', './parts/lamproad.js'],
  ['gathering-frames', './parts/gatheringframes.js'],
  ['mill-launder', './parts/milllaunder.js'],
  ['bell-yard', './parts/bellyard.js'],
  ['braided-wood', './parts/braidedwood.js'],
  ['carvings', './parts/carvings.js'],
]) {
  try {
    const m = await import(path);
    const inst = new m.default({ scene, world, enc, log, PH, game, dyn });
    inst.id = id;
    parts.push(inst);
    colliders.push(...(inst.colliders ?? []));
    solid.push(...(inst.solid ?? []));
    // contract v2: raycast targets are `interactables`; accept a legacy
    // array-valued `interact` too (the name collided with the method)
    const targets = inst.interactables ?? (Array.isArray(inst.interact) ? inst.interact : []);
    interact.push(...targets);
  } catch (err) {
    console.warn('[parts] not loaded:', id, '—', err.message);
  }
}

// every log event flows through the carvings part, which rewards mapped
// successes by carving the stone and writing the player's bag (see
// design/MEMORY_CARVING_DESIGN.md)
{
  const cv = partById('carvings');
  if (cv && cv.onLog) {
    let seen = cv.interactables.length;
    const orig = log.push.bind(log);
    log.push = (t, d) => {
      orig(t, d);
      try {
        cv.onLog(t, d);
        // a carving that appears live joins the raycast and the gaze cone now,
        // not on the next reload
        while (seen < cv.interactables.length) {
          const o = cv.interactables[seen++];
          interact.push(o);
          registerActs(o);
        }
      } catch (e) { console.warn('[carvings]', e.message); }
    };
  }
}

const controls = new FPSControls(camera, renderer.domElement, {
  eye: world.player.eye, speed: world.player.speed, radius: world.player.radius,
});
controls.pos.set(world.player.spawn.x, world.player.eye, world.player.spawn.z);
controls.lookAt(...world.player.spawn.lookAt);
if (dyn.groundH) controls.heightFn = dyn.groundH;   // relief worlds (the wood)

// gaze highlight: a thin rim traced around the silhouette (inverted hull).
// The object's own surfaces are never touched — its facets and shading stay
// at full contrast precisely when the player is looking hardest at it.
const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#d8b96a'), side: THREE.BackSide,
  transparent: true, opacity: 0.45, depthWrite: false, fog: false,
});
let hlRoot = null, hlOutlined = [];
function setHighlight(root) {
  if (root === hlRoot) return;
  for (const o of hlOutlined) o.userData._outline.visible = false;
  hlOutlined = []; hlRoot = root;
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
    if (!o.userData._outline) {
      const shell = new THREE.Mesh(o.geometry, OUTLINE_MAT);
      shell.raycast = () => {};     // never a target, never an occluder
      shell.visible = false;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      shell.userData.r = Math.max(0.04, o.geometry.boundingSphere.radius);
      o.add(shell);
      o.userData._outline = shell;
    }
    o.userData._outline.visible = true;
    hlOutlined.push(o);
  });
}

/** Rim width stays constant on SCREEN: far small things get a proportionally
 *  thicker shell so the contour reads at any range. */
function updateOutlines() {
  for (const o of hlOutlined) {
    const shell = o.userData._outline;
    const d = _gc.setFromMatrixPosition(o.matrixWorld).distanceTo(camera.position);
    shell.scale.setScalar(1 + Math.min(0.16, Math.max(0.035, (d * 0.007) / shell.userData.r)));
  }
}

// stone in flight
const flightStone = new THREE.Mesh(
  new THREE.SphereGeometry(0.13, 10, 8),
  new THREE.MeshStandardMaterial({ color: new THREE.Color(P.stoneLit), flatShading: true, roughness: 0.9 })
);
flightStone.castShadow = true; flightStone.visible = false;
scene.add(flightStone);

// ---------- state ----------
const st = {
  world, enc, log, stations,
  panel: null, near: null,
  rockTaken: false, carrying: false, figDropped: false,
  instrument: null, sight: null,
  theta: 45 * P4.DEG,
  strengths: Object.fromEntries((enc.instruments ?? []).map((t) => [t.id, t.strength])),
  flight: null,
  architect: false,
  hintRung: -1, hintSpend: 0,
  targetH: FIG.at.y,
  figG: { x: FIG.at.x, z: FIG.at.z },
  figX: 0,
  params() {
    return { x0: 0, y0: world.physics.releaseHeight, v: world.physics.releaseSpeed, theta: this.theta, g: world.physics.gravity };
  },
};
window.__lw = {
  st, camera, controls, stations, reading, log, dyn, bridge, parts, atmo,
  teleport(x, z, lookX, lookY, lookZ) {
    controls.pos.set(x, world.player.eye, z);
    if (lookX !== undefined) controls.lookAt(lookX, lookY ?? 1.5, lookZ ?? 0);
  },
  press(key) { window.dispatchEvent(new KeyboardEvent('keydown', { key })); },
};

function castSight() {
  const f = controls.forward(), r = controls.right();
  st.sight = {
    x: controls.pos.x + f.x * 0.5 + r.x * 0.45,
    z: controls.pos.z + f.z * 0.5 + r.z * 0.45,
    fx: f.x, fz: f.z,
  };
  log.push('sight.cast', { x: +st.sight.x.toFixed(2), z: +st.sight.z.toFixed(2) });
}

// ---------- interaction ----------
const ray = new THREE.Raycaster();
const CENTRE = new THREE.Vector2(0, 0);
const GAZE_CONE = 0.34;   // NDC radius: attention is a cone, not a needle
const _gp = new THREE.Vector3(), _gn = new THREE.Vector3(), _gc = new THREE.Vector3();
const _gbox = new THREE.Box3();

// every act-bearing node, gathered once (proxies included, hidden ones skipped
// live), each with its BODY centre as the gaze anchor — looking at the middle
// of a thing must count as looking at it, not at its feet
const actNodes = [];
const registerActs = (root) => root.traverse((o) => {
  if (!o.userData.act) return;
  actNodes.push(o);
  _gbox.setFromObject(o);
  o.userData._gazeAnchor = _gbox.isEmpty()
    ? o.getWorldPosition(new THREE.Vector3())
    : _gbox.getCenter(new THREE.Vector3());
});
for (const root of interact) registerActs(root);

const isUnder = (o, root) => { while (o) { if (o === root) return true; o = o.parent; } return false; };

function actInfo(act) {
  if (act.part) return { prompt: act.prompt ?? '', label: act.label ?? '', reach: act.reach ?? 3 };
  const e = act.entity ? ent(act.entity) : ent('way-stones');
  return { prompt: e.prompt, label: e.label, reach: e.reach ?? 3 };
}

function findNear() {
  // 1) the precise ray — whatever the crosshair actually rests on wins
  ray.setFromCamera(CENTRE, camera);
  ray.far = 9.5;   // interaction is a gaze, not an embrace: whole machines stay in frame
  const hits = ray.intersectObjects(interact, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.act) o = o.parent;
    if (!o) continue;
    const act = o.userData.act;
    if (act.entity === 'rock' && st.rockTaken) continue;
    const e = actInfo(act);
    if (h.distance <= e.reach) return { act, e, point: h.point, dist: h.distance, obj: o };
  }

  // 2) the forgiving cone — the act nearest the view centre, in reach, in sight
  const camPos = camera.getWorldPosition(_gc);
  let best = null;
  for (const node of actNodes) {
    if (!node.visible) continue;
    const act = node.userData.act;
    if (act.entity === 'rock' && st.rockTaken) continue;
    const e = actInfo(act);
    _gp.copy(node.userData._gazeAnchor);
    const d = _gp.distanceTo(camPos);
    if (d > e.reach || d < 0.6) continue;
    _gn.copy(_gp).project(camera);
    if (_gn.z > 1) continue;
    const off = Math.hypot(_gn.x, _gn.y);
    if (off > GAZE_CONE) continue;
    if (!best || off < best.off) best = { act, e, point: _gp.clone(), dist: d, obj: node, off };
  }
  if (best) {
    // no grabbing through walls — but a thing can never occlude itself
    _gn.copy(best.point).sub(camPos).normalize();
    ray.set(camPos, _gn);
    ray.far = best.dist - 0.35;
    const glowRoot = best.obj.userData.glowRoot;
    const blocked = ray.intersectObjects(solid, true)
      .some((h) => !isUnder(h.object, best.obj) && (!glowRoot || !isUnder(h.object, glowRoot)));
    if (blocked) return null;
    return best;
  }
  return null;
}

function interactNow() {
  const nearBy = st.near;
  if (!nearBy) { if (st.carrying) { st.panel = 'toolbox'; refresh(); } return; }
  const a = nearBy.act;
  log.push('entity.interact', { entity: a.entity ?? (a.part ? a.part : `way-stone-${a.waystone}`), x: +controls.pos.x.toFixed(2), z: +controls.pos.z.toFixed(2) });
  if (a.part) {
    const p = partById(a.part);
    const fn = p && (p.onInteract ?? (typeof p.interact === 'function' ? p.interact : null));
    fn?.call(p, a, PH);
    return;
  }
  if (!ORCHARD) { refresh(); return; }   // beyond parts, every act below is the orchard's
  // the standing stone is the training-space portal when the bell yard exists
  if (a.entity === 'standing-stone' && partById('bell-yard')) {
    partById('bell-yard').onInteract?.(a, PH);
    return;
  }
  if (a.waystone !== undefined) { stations.pickWaystone(a.waystone); return; }
  if (a.entity === 'rock') {
    st.rockTaken = true; st.carrying = true;
    stations.takeRock();
    st.panel = 'toolbox';
    log.push('item.taken', { item: 'rock' });
  } else if (a.entity === 'bridge-rope') { bridge.untie(); return; }
  else if (a.entity === 'counting-gate') st.panel = 'gate';
  else if (a.entity === 'door') st.panel = 'door';
  else if (a.entity === 'standing-stone') st.panel = 'stone';
  else if (a.entity === 'scroll') {
    st.panel = 'doc';
    if (!st.done) { st.done = true; log.push('level.complete', { events: log.events.length }); }
  }
  refresh();
}

function throwStone() {
  if (!ORCHARD || !st.carrying || st.flight) return;
  castSight();
  st.flight = { A: P4.arc(st.params()), t: 0, hit: false, ray: { ...st.sight } };
  flightStone.visible = true;
  log.push('throw.start', {
    theta_deg: +(st.theta / P4.DEG).toFixed(2),
    instrument: st.instrument ? st.instrument.id : null,
    strength: st.instrument ? st.strengths[st.instrument.id] : null,
  });
}

// ---------- panel ----------
const panelEl = $('#panel'), panelBody = $('#panel-body');
let lastPanel = null;
function refresh() {
  const changed = st.panel !== lastPanel;
  if (changed) { panelSeq++; st.helpOpen = false; log.push('panel.set', { panel: st.panel, was: lastPanel }); lastPanel = st.panel; }
  if (st.panel && document.pointerLockElement) document.exitPointerLock();
  const html = st.panel && st.panel.startsWith('p:')
    ? (partById(st.panel.slice(2))?.panel?.(st) ?? '')
    : renderPanel(st, world, enc);
  panelEl.classList.toggle('open', !!st.panel);
  if (html) panelBody.innerHTML = html;

  // the card's info toggle: usage help lives in the chrome, never the world.
  // Text is data (enc.help, keyed by panel/part id); no text, no icon.
  const helpKey = st.panel ? (st.panel.startsWith('p:') ? st.panel.slice(2) : st.panel) : null;
  const helpText = helpKey && enc.help ? enc.help[helpKey] : null;
  $('#panel-info').style.display = helpText ? '' : 'none';
  $('#panel-info').classList.toggle('is-on', !!st.helpOpen);
  const helpEl = $('#panel-help');
  helpEl.classList.toggle('open', !!(helpText && st.helpOpen));
  helpEl.textContent = helpText && st.helpOpen ? helpText : '';
  $('#hud-log').classList.toggle('is-on', st.panel === 'log');
  $('#hud-arch').classList.toggle('is-on', st.architect);
  // a fresh ask is ready to type into — no click required
  if (changed) {
    if (st.panel === 'gate') $('#gateX')?.focus();
    if (st.panel === 'door') $('#rootA')?.focus();
  }
}

/** The panel dissolves on its own: on success (after the world has answered),
 *  when the player walks off, or the moment they touch a movement key. */
function dismissPanel() {
  if (!st.panel) return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  st.panel = null;
  refresh();
}
let panelSeq = 0;   // bumped on every panel change so stale timers die quietly
function dismissLater(which, ms) {
  const seq = panelSeq;
  setTimeout(() => { if (st.panel === which && panelSeq === seq) dismissPanel(); }, ms);
}
const PANEL_ANCHOR = { gate: 'counting-gate', door: 'door', stone: 'standing-stone', doc: 'scroll' };

panelBody.addEventListener('click', (ev) => {
  if (st.panel && st.panel.startsWith('p:')) { partById(st.panel.slice(2))?.onPanel?.(ev, PH); return; }
  const tool = ev.target.closest('[data-tool]');
  if (tool) {
    st.instrument = enc.instruments.find((t) => t.id === tool.dataset.tool);
    castSight();
    st.panel = 'readout';
    log.push('instrument.selected', { instrument: st.instrument.id, model: st.instrument.model, strength: st.strengths[st.instrument.id] });
    return refresh();
  }
  const hint = ev.target.closest('[data-hint]');
  if (hint) {
    const r = +hint.dataset.hint;
    st.hintRung = r;
    const rung = enc.hintLadder.find((x) => x.rung === r);
    st.hintSpend += rung.cost;
    log.push('hint.taken', { rung: r, cost: rung.cost, totalSpend: st.hintSpend });
    return refresh();
  }
  if (ev.target.id === 'throw') { throwStone(); return refresh(); }
  if (ev.target.id === 'dl') return log.download();
  if (ev.target.id === 'gateSet') {
    const x = Math.round(parseFloat($('#gateX').value));
    if (Number.isFinite(x)) {
      const { ok } = stations.setGateCount(x);
      if (ok) dismissLater('gate', 850);   // step back into the world; watch the beam lift
    }
    return refresh();
  }
  if (ev.target.id === 'doorSet') {
    const a = Math.round(parseFloat($('#rootA').value)), b = Math.round(parseFloat($('#rootB').value));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      // never fail silently: guide to the empty slot
      const empty = !Number.isFinite(a) ? '#rootA' : '#rootB';
      panelEl.classList.remove('nudge'); void panelEl.offsetWidth;
      panelEl.classList.add('nudge');
      $(empty)?.focus();
      return;
    }
    const ok = stations.setDoorRoots(a, b);
    // step aside either way: the lintel's verdict — swing or marks off the
    // resting points — is the feedback, not this card
    dismissLater('door', ok ? 850 : 1100);
    return refresh();
  }
});

// Enter submits; in the door's first slot it steps to the second.
// Number fields take digits only — no scientific-notation 'e', no signs.
// Part cards get keydown delegated too, so parts need no document listeners.
panelBody.addEventListener('keydown', (ev) => {
  if (ev.target.matches?.('input[type="number"]') && ['e', 'E', '+', '-'].includes(ev.key)) {
    ev.preventDefault();
    return;
  }
  if (st.panel && st.panel.startsWith('p:')) { partById(st.panel.slice(2))?.onPanel?.(ev, PH); return; }
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'gateX') $('#gateSet')?.click();
  else if (ev.target.id === 'rootA') $('#rootB')?.focus();
  else if (ev.target.id === 'rootB') $('#doorSet')?.click();
});

panelBody.addEventListener('input', (ev) => {
  if (st.panel && st.panel.startsWith('p:')) { partById(st.panel.slice(2))?.onPanel?.(ev, PH); return; }
  if (ev.target.id === 'theta' || ev.target.id === 'thetaNum') {
    st.theta = (+ev.target.value) * P4.DEG;
    const other = ev.target.id === 'theta' ? $('#thetaNum') : $('#theta');
    if (other) other.value = (+ev.target.value).toFixed(2);
    log.push('release.set', { theta_deg: +(+ev.target.value).toFixed(2) });
  }
  if (ev.target.id === 'strength' && st.instrument) {
    st.strengths[st.instrument.id] = +ev.target.value;
    log.push('instrument.strength', { instrument: st.instrument.id, strength: +ev.target.value });
    refresh();
  }
});

// ---------- input ----------
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  // touching a movement key dissolves the panel — walking is never cancelled
  const moveKey = ['w', 'a', 's', 'd'].includes(k) ||
    (!isTyping(e) && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k));
  if (st.panel && moveKey) { dismissPanel(); return; }
  if (isTyping(e)) return;
  if (e.key === 'Tab') { e.preventDefault(); toggleArchitect(); return; }
  if (e.key === 'Escape') { dismissPanel(); return; }
  if (k === 'e') { e.preventDefault(); interactNow(); return; }   // the keystroke must never type into a freshly-focused input
  if (k === 'n') { atmo.toggle(); $('#hud-night').classList.toggle('is-on', atmo.night); return; }
  if (k === 'r' && st.carrying && st.instrument) { castSight(); return; }
  if (bridge && /^[1-9]$/.test(e.key) && !st.panel) { bridge.tryLeap(+e.key, controls); return; }
  if (e.key === ' ') { e.preventDefault(); throwStone(); }
});

// click = use what the crosshair rests on (and an exit from any open card)
renderer.domElement.addEventListener('click', () => {
  if (st.panel) { dismissPanel(); return; }
  if (st.near) interactNow();
});
function toggleArchitect() {
  st.architect = !st.architect;
  document.body.classList.toggle('architect-on', st.architect);
  log.push('architect.toggle', { on: st.architect });
  refresh();
}
// ---------- testing warps: jump to a part with its preconditions set ----------
// Dev affordance only — every use is logged so research data can filter
// warped sessions. Each entry stages exactly the state its target needs.
const armReading = (strength) => {
  st.rockTaken = true; st.carrying = true;
  stations.takeRock();
  st.instrument = enc.instruments.find((t) => t.id === 'falling-arc');
  st.strengths['falling-arc'] = strength;
  castSight();
};
const WARPS = world.warps ? world.warps.map((w) => [w.name, () => __lw.teleport(...w.tp)]) : [
  ['spawn (west bank)', () => __lw.teleport(-13.4, 2.1, -9, 1.0, 0.35)],
  ['bridge: first brink', () => { bridge.entered = true; bridge.ropeDrop = 0; __lw.teleport(-8.95, 0.35, -4, 0.7, 0.35); }],
  ['way-stones', () => __lw.teleport(9.7, 3.2, 9.6, 0.7, -0.55)],
  ['counting gate', () => __lw.teleport(12.4, 3.6, 15.2, 1.3, 0.35)],
  ['cold-well', () => __lw.teleport(11.8, 9.0, 11.8, 1.3, 3.8)],
  ['reading: partial hold', () => { __lw.teleport(17.9, 3.8, 22.1, 4.4, 0.62); armReading(0.42); }],
  ['reading: full hold', () => { __lw.teleport(17.9, 3.8, 22.1, 4.4, 0.62); armReading(1.0); }],
  ['door (unsolved)', () => __lw.teleport(31, 7.2, 31, 1.6, 2.3)],
  ['interior (door open)', () => { stations.doorSolved = true; dyn.door.open = true; __lw.teleport(31, 1.2, 31, 1.0, -0.9); }],
  ['cairns (bridge exit)', () => __lw.teleport(0.9, 3.2, 0, 0.35, 2.2)],
  ['drawbridge yard', () => __lw.teleport(44.3, 6.4, 45.3, 0.8, 3.5)],
  ['press-yard', () => __lw.teleport(21.5, 2.4, 21.5, 0.9, 6.8)],
  ['lamp-road (night suits it)', () => __lw.teleport(48.6, 0.35, 52, 1.6, 0.6)],
  ['mill launder', () => __lw.teleport(53.5, 8.4, 53.5, 1.2, 4.2)],
  ['braided wood (trajectory)', () => __lw.teleport(2.5, 8.4, 2.5, 1.6, 11.5)],
  ['bell yard portal (the stone)', () => __lw.teleport(7.6, 2.4, 5.4, 1.3, 0)],
];
{
  const sel = $('#hud-warp');
  sel.innerHTML = '<option value="">⌁ warp</option>' +
    WARPS.map(([name], i) => `<option value="${i}">${name}</option>`).join('');
  sel.addEventListener('change', () => {
    const i = sel.value;
    sel.value = '';
    sel.blur();                          // keys go back to the world immediately
    if (i === '') return;
    log.push('dev.warp', { to: WARPS[+i][0] });
    dismissPanel();
    WARPS[+i][1]();
    refresh();
  });
}

$('#hud-arch').addEventListener('click', toggleArchitect);
$('#hud-night').addEventListener('click', () => { atmo.toggle(); $('#hud-night').classList.toggle('is-on', atmo.night); });
$('#hud-log').addEventListener('click', () => { st.panel = st.panel === 'log' ? null : 'log'; refresh(); });
$('#panel-close').addEventListener('click', () => { st.panel = null; refresh(); });
$('#panel-info').addEventListener('click', () => {
  st.helpOpen = !st.helpOpen;
  if (st.helpOpen) log.push('help.opened', { panel: st.panel });   // who needs help where = research data
  refresh();
});

// (movement keys are allowed to reach the world even while the panel has
// focus — number inputs ignore letters, and W A S D means "I'm leaving")

// ---------- resize ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const lab = $('#labels');
  lab.style.width = w + 'px'; lab.style.height = h + 'px';
}
addEventListener('resize', resize);
resize();

// ---------- loop ----------
let last = performance.now(), lastNearKey = null;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;

  if (!bridge?.busy) controls.update(dt, colliders, world.bounds);
  bridge?.update(dt, controls, camera);
  stations?.update(dt);
  atmo.update(dt, camera);
  $('#hud-night').classList.toggle('is-on', atmo.night);

  // walking away from a station dissolves its card
  if (st.panel && PANEL_ANCHOR[st.panel]) {
    const a = ent(PANEL_ANCHOR[st.panel]);
    if (Math.hypot(a.at.x - controls.pos.x, (a.at.z ?? 0) - controls.pos.z) > (a.reach ?? 3) + 1.4) dismissPanel();
  } else if (st.panel && st.panel.startsWith('p:')) {
    const pa = partById(st.panel.slice(2))?.panelAnchor;
    if (pa && Math.hypot(pa.x - controls.pos.x, pa.z - controls.pos.z) > (pa.reach ?? 3) + 1.4) dismissPanel();
  }

  for (const p of parts) p.update?.(dt, { controls, camera });

  // interaction focus
  const near = bridge?.busy ? null : findNear();
  st.near = near;
  const nearKey = near ? (near.act.entity ?? near.act.part ?? 'ws' + near.act.waystone) : null;
  if (nearKey !== lastNearKey) {
    lastNearKey = nearKey;
    if (near) log.push('entity.near', { entity: nearKey, x: +controls.pos.x.toFixed(2), z: +controls.pos.z.toFixed(2) });
  }
  // the affordance is the thing itself: a soft breathing glow and a bare
  // keycap where your gaze rests — words stay out of the world
  // the trace breathes in, then settles to a whisper
  if (traceOn && traceFade >= 0) {
    traceFade += dt;
    traceEl.style.opacity = traceFade < 0.6 ? (traceFade / 0.6) * 0.5 : Math.max(0.22, 0.5 - (traceFade - 0.6) * 0.05);
  } else traceEl.style.opacity = 0;

  setHighlight(near ? (near.obj.userData.glowRoot ?? near.obj) : null);
  OUTLINE_MAT.opacity = 0.4 + Math.sin(now * 0.004) * 0.12;   // the rim breathes; the object never changes
  updateOutlines();
  const promptEl = $('#prompt');
  const brink = bridge ? bridge.brinkInfo(controls) : null;
  promptEl.classList.toggle('show', !!brink);
  if (brink) promptEl.innerHTML = `<span class="ekey">1–4</span> Leap ${K(brink.exprTex)} <em>the gap asks its width</em>`;

  // the reading follows its cast; the sight line stays where it was placed
  st.figX = Math.hypot(st.figG.x - (st.sight?.x ?? controls.pos.x), st.figG.z - (st.sight?.z ?? controls.pos.z));
  const st3 = st.carrying && st.instrument ? {
    model: st.instrument.model, params: st.params(), h: st.targetH,
    sight: st.sight, strength: st.strengths[st.instrument.id],
    figG: st.figG, architect: st.architect,
  } : { model: null, sight: null };
  reading?.sync(st3);

  // flight
  if (st.flight) {
    st.flight.t += dt;
    const p = P4.at(st.flight.A, st.flight.t);
    const u = p.x - st.flight.A.x0;
    const R = st.flight.ray;
    flightStone.position.set(R.x + R.fx * u, p.y, R.z + R.fz * u);
    if (!st.figDropped && !st.flight.hit) {
      const d = flightStone.position.distanceTo(new THREE.Vector3(FIG.at.x, FIG.at.y, FIG.at.z));
      if (d < FIG.radius + 0.13) {
        st.flight.hit = true; st.figDropped = true;
        stations.dropFig();
        log.push('throw.result', { outcome: 'hit', missBy: +d.toFixed(3), instrument: st.instrument?.id ?? null });
      }
    }
    if (p.y < -0.2) {
      if (!st.flight.hit) {
        const xs = P4.crossings(st.flight.A, FIG.at.y);
        const dx = FIG.at.x - R.x, dz = FIG.at.z - R.z;
        const offPlane = +(dx * -R.fz + dz * R.fx).toFixed(3);
        log.push('throw.result', { outcome: 'miss', crossedTargetHeightAt: xs.map((x) => +x.toFixed(2)).join('|'), offPlaneBy: offPlane, instrument: st.instrument?.id ?? null });
      }
      st.flight = null;
      flightStone.visible = false;
    }
  }

  // labels
  labels.beginFrame();
  reading?.labels(labels, st3);
  bridge?.labels(labels, st.architect);
  for (const p of parts) p.labels?.(labels, st.architect);
  if (near) {
    labels.set('focus-key', {
      html: '<span class="ekey">E</span>',
      x: near.point.x, y: near.point.y + 0.42, z: near.point.z, kind: 'key', dy: 0,
    });
  }
  dyn.waystones.forEach((ws, i) => {
    labels.set('ws' + i, { tex: ws.rule.tex, x: ws.top.x, y: ws.top.y + 0.22, z: ws.top.z, kind: 'rule', dy: 0 });
  });
  if (st.architect) {
    for (const e of world.entities) {
      if (!e.architect) continue;
      labels.set('arch-' + e.id, {
        tex: `\\texttt{${e.architect.concept.replace(/ /g, '\\ ')}}`,
        x: e.at.x, y: (e.at.y ?? 0) + 2.5, z: e.at.z ?? 0, kind: 'architect', dy: 0,
      });
    }
  }
  labels.endFrame();
  labels.sync(innerWidth, innerHeight, solid);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

log.push('session.start', { world: world.meta.id, mode: '3d', x: controls.pos.x, z: controls.pos.z });
refresh();
requestAnimationFrame(frame);
