// panels.js — the reading surface. Most of a player's time is here, so it is
// long-form typography with mathematics set by the same KaTeX as the world
// chips. Register: first-course (see fmt.js). The advanced machinery appears
// only inside architect blocks.

import * as P4 from './physics.js';
import { n, quadTex, quadBandTex, rangeTex, formulaTex, physicsTex } from './fmt.js';

export const K = (tex, display = false) =>
  window.katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html' });

export function renderPanel(st, world, enc) {
  if (!st.panel) return '';
  if (st.panel === 'toolbox') return toolbox(st, enc);
  if (st.panel === 'readout') return readout(st, enc);
  if (st.panel === 'gate') return gatePanel(st, enc);
  if (st.panel === 'door') return doorPanel(st, enc);
  if (st.panel === 'stone') return stonePanel(st);
  if (st.panel === 'doc') return docPanel(st);
  if (st.panel === 'log') return logview(st);
  return '';
}

function strengthDots(s) {
  const full = Math.round(s * 4);
  return `<span class="dots">${'●'.repeat(full)}${'○'.repeat(4 - full)}</span>`;
}

function hintBlock(st, enc) {
  const ladder = enc.hintLadder;
  const shown = ladder.filter((r) => r.rung <= st.hintRung);
  const next = ladder.find((r) => r.rung === st.hintRung + 1);
  return `
    <div class="hints">
      <h3>If you are stuck</h3>
      ${shown.map((r) => `<p class="hint">${r.text}</p>`).join('') || '<p class="muted">Nothing spent yet.</p>'}
      ${next ? `<button class="btn ghost" data-hint="${next.rung}">Ask further <span class="cost">costs ${next.cost}</span></button>`
             : '<p class="muted">There is nothing further to say.</p>'}
    </div>`;
}

function toolbox(st, enc) {
  const cards = enc.instruments.map((t) => {
    const sel = st.instrument && st.instrument.id === t.id;
    return `
      <button class="tool ${sel ? 'is-sel' : ''}" data-tool="${t.id}">
        <div class="tool-h">
          <span class="tool-n">${t.name}</span>
          <span class="tool-s" title="how firmly this is held">${strengthDots(st.strengths[t.id])}</span>
        </div>
        <p class="tool-b">${t.blurb}</p>
        ${st.architect ? `<div class="arch-inline">${t.architect.concept} · ${t.architect.depth}</div>` : ''}
      </button>`;
  }).join('');
  return `
    <h2>What you carry</h2>
    <p class="lede">Three instruments. Each reads the world in the only way it knows how.</p>
    <div class="tools">${cards}</div>
    <p class="muted tiny">Choosing one casts its sight where you face. <b>R</b> re-casts it from where you stand.</p>
    ${hintBlock(st, enc)}`;
}

function readout(st, enc) {
  const t = st.instrument;
  const params = st.params();
  const A = P4.arc(params);
  const h = st.targetH;
  const S = st.strengths[t.id];
  let body = '';

  if (t.model === 'constant') {
    body = `
      <p>The cord is drawn taut along the ground, to the foot of the fig tree. It reports what it is for:</p>
      <div class="eq">${K(`\\text{distance} = ${n(st.figX)}\\ \\text{m}`, true)}</div>
      <p class="muted">It says nothing about height, and does not pretend to.</p>`;
  } else if (t.model === 'linear') {
    const xc = P4.tangentCrossing(A, h);
    body = `
      <p>Sighted from your hand, held straight:</p>
      <div class="eq">${K(`y = ${n(params.y0, 1)} + ${n(A.b)}\\,x`, true)}</div>
      <p>Setting that equal to the fig's height:</p>
      <div class="eq">${K(`${n(params.y0, 1)} + ${n(A.b)}\\,x = ${n(h, 1)} \\quad\\text{gives}\\quad x = ${n(xc)}`, true)}</div>
      <p class="claim-note">The instrument is certain. Throw, and watch it.</p>`;
  } else if (S < 0.999) {
    const { arcs } = P4.degraded(params, S);
    const aLo = Math.min(...arcs.map((B) => -B.a)), aHi = Math.max(...arcs.map((B) => -B.a));
    const near = intervalFor(params, S, h, 0), far = intervalFor(params, S, h, 1);
    body = `
      <p>The arc comes through, but not sharply — how much the path bends is known only roughly:</p>
      <div class="eq">${K(quadBandTex(A.c, A.b, aLo, aHi), true)}</div>
      ${near && far ? `
      <p>So it passes the height ${K(`y = ${n(h, 1)}`)} somewhere in each of these:</p>
      <div class="eq">${K(`${rangeTex(1, near.lo, near.hi)} \\qquad ${rangeTex(2, far.lo, far.hi)}`, true)}</div>
      <p class="partial-note">A wide reading is still a true one. A firmer hold closes the ranges.</p>` : `
      <p>And at this release, even the most generous of those arcs stays below ${K(`y = ${n(h, 1)}`)}.</p>
      <p class="partial-note">No crossing to report is itself a true reading. Raise the release.</p>`}`;
  } else {
    const xs = P4.crossings(A, h);
    const v = P4.vertex(A);
    const aPos = -A.a, rhs = h - A.c;
    body = `
      <p>The whole path is legible:</p>
      <div class="eq">${K(quadTex(A.c, A.b, aPos), true)}</div>
      ${xs.length === 2 ? `
      <p>Asking where it passes ${K(`y = ${n(h, 1)}`)} tidies to</p>
      <div class="eq">${K(`${n(aPos, 3)}\\,x^{2} - ${n(A.b)}\\,x + ${n(rhs, 1)} = 0`, true)}</div>
      <p>and the formula gives both:</p>
      <div class="eq">${K(`${formulaTex(aPos, A.b, rhs)} \\quad\\text{so}\\quad x_1 = ${n(xs[0])},\\ \\ x_2 = ${n(xs[1])}`, true)}</div>` : `
      <p>It never reaches ${K(`y = ${n(h, 1)}`)} — the path tops out below the line.</p>`}
      <p>Highest point:</p>
      <div class="eq">${K(`\\left(${n(v.x)},\\ ${n(v.y)}\\right)`, true)}</div>`;
  }

  return `
    <h2>${t.name}</h2>
    <p class="lede">${t.blurb}</p>
    ${body}
    <div class="release">
      <h3>Release</h3>
      <label class="row">
        <span>angle</span>
        <input type="range" id="theta" min="5" max="85" step="0.1" value="${(st.theta / P4.DEG).toFixed(1)}">
        <input type="number" id="thetaNum" min="0" max="90" step="0.01" value="${(st.theta / P4.DEG).toFixed(2)}">
        <span class="unit">°</span>
      </label>
      <p class="muted tiny">Type an exact value if you already know it — nothing here requires the instruments.</p>
      <label class="row">
        <span title="spike control: how firmly this instrument is held">hold</span>
        <input type="range" id="strength" min="0" max="1" step="0.01" value="${S}">
        <span class="unit">${n(S)}</span>
      </label>
      <button class="btn primary" id="throw" ${st.flight ? 'disabled' : ''}>Throw the stone</button>
    </div>
    ${st.architect ? architectBlock(st, t, params) : ''}
    ${hintBlock(st, enc)}`;
}

function intervalFor(params, s, h, which) {
  const { arcs } = P4.degraded(params, s);
  const v = arcs.map((A) => P4.crossings(A, h)).filter((x) => x.length === 2).map((x) => x[which]);
  if (!v.length) return null;
  return { lo: Math.min(...v), hi: Math.max(...v) };
}

function architectBlock(st, t, params) {
  const sols = P4.solveAngles(params, st.figX, st.targetH);
  return `
    <div class="architect-block">
      <h3>Architect</h3>
      <dl>
        <dt>concept</dt><dd>${t.architect.concept}</dd>
        <dt>depth</dt><dd>${t.architect.depth}</dd>
        <dt>invokes</dt><dd>${t.architect.invokes.length ? t.architect.invokes.join(' → ') : '—'}</dd>
        <dt>held at</dt><dd>${n(st.strengths[t.id])}</dd>
        <dt>derivation</dt><dd>${K(physicsTex())}</dd>
      </dl>
      <p class="solutions">world is solvable at ${sols.map((a) => n(a / P4.DEG, 2) + '°').join(' and ') || '—'}</p>
    </div>`;
}

function gatePanel(st, enc) {
  const G = enc.countingGate;
  const last = st.stations.gateX;
  const solved = st.stations.gateSolved;
  return `
    <h2>The counting gate</h2>
    <p class="lede">A beam on a post, a basket hung at each end. One side is fixed. The other counts what you set.</p>
    <p>Carved into the post:</p>
    <div class="eq">${K(G.equationTex, true)}</div>
    <p>${G.ask}</p>
    <div class="gate-in">
      <input type="number" id="gateX" min="${G.min}" max="${G.max}" step="1" value="${last ?? ''}" placeholder="count" ${solved ? 'disabled' : ''}>
      <button class="btn primary" id="gateSet" ${solved ? 'disabled' : ''}>Set the count</button>
    </div>
    ${last !== null && !solved ? '<p class="gate-no">The beam tips to the heavier side.</p>' : ''}
    ${solved ? '<p class="gate-ok">Level. The beam lifts, and the way is open.</p>' : ''}
    ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${G.architect.concept} · ${G.architect.depth}. The tilt is the honest sign of lhs − rhs; nothing is scripted.</p></div>` : ''}`;
}

function doorPanel(st, enc) {
  const D = enc.doorRoots;
  const solved = st.stations.doorSolved;
  const picks = st.stations.doorPicks;
  return `
    <h2>The door</h2>
    <p class="lede">No handle. Cut into the lintel, a rule, and under it two slots the width of a number.</p>
    <div class="eq">${K(D.equationTex, true)}</div>
    <p>${D.ask}</p>
    <div class="gate-in">
      <input type="number" id="rootA" min="${D.min}" max="${D.max}" step="1" value="${picks ? picks[0] : ''}" placeholder="first" ${solved ? 'disabled' : ''}>
      <input type="number" id="rootB" min="${D.min}" max="${D.max}" step="1" value="${picks ? picks[1] : ''}" placeholder="second" ${solved ? 'disabled' : ''}>
      <button class="btn primary" id="doorSet" ${solved ? 'disabled' : ''}>Set them in the slots</button>
    </div>
    ${picks && !solved ? '<p class="gate-no">The slots return them.</p>' : ''}
    ${solved ? '<p class="gate-ok">Both slots take. Something in the frame lets go.</p>' : ''}
    <p class="muted tiny">A player who can already solve this needs nothing else from the system to pass.</p>
    ${st.architect ? `<div class="architect-block"><h3>Architect</h3><p class="note">${D.architect.concept} · ${D.architect.depth}. Attempt marks are laid against the curve's true resting points on the lintel — wrong numbers are seen to miss.</p></div>` : ''}`;
}

function stonePanel(st) {
  return `
    <h2>The standing stone</h2>
    <p class="lede">Grooves cut deep, in no alphabet you know. Putting a hand to them, the grooves are warm.</p>
    <p>A way in, to somewhere you can practise without consequence, and come back out where you left.</p>
    <p class="muted">In the built world this is the entry to the training space, reachable from anywhere. The spike does not implement it.</p>
    ${st.architect ? '<div class="architect-block"><h3>Architect</h3><p class="note">Layer 2 portal. Skills earned here enter the bag graded, not binary.</p></div>' : ''}`;
}

function docPanel(st) {
  return `
    <h2>A folded document</h2>
    <p class="lede">Heavy paper, sealed in wax the colour of the lamp by the door.</p>
    <p>This is where the level ends, for now. The way here ran: a way-stone that bends, a beam brought level, an arc read out of the air, a rule at rest in two places.</p>
    <p class="muted">${st.log.events.length} events in this session's log — the whole path, replayable.</p>`;
}

function logview(st) {
  const rows = st.log.events.slice(-60).reverse().map((e) => `
    <tr><td class="t">${(e.t / 1000).toFixed(2)}s</td><td class="ty">${e.type}</td>
    <td class="d">${Object.entries(e).filter(([k]) => !['seq', 'session', 't', 'iso', 'type'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'number' ? (+v).toFixed(3).replace(/\.?0+$/, '') : v}`).join('  ')}</td></tr>`).join('');
  return `
    <h2>Event log</h2>
    <p class="lede">${st.log.events.length} events this session · <code>${st.log.session}</code></p>
    <button class="btn ghost" id="dl">Download JSONL</button>
    <table class="log">${rows}</table>`;
}
