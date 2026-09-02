// fmt.js — one place that decides how mathematics is WRITTEN to the player.
// House register (owner's instruction): first-course level. Numbers, x and y,
// =, ≈, ≤, subscripts, the quadratic formula with numbers substituted. No g,
// no theta, no trig, no set notation. The symbolic machinery appears only in
// architect view.

export const n = (v, d = 2) => v.toFixed(d);

/** y = c + b x - a x^2, all numeric (a passed positive). */
export const quadTex = (c, b, aPos, d = 3) =>
  `y = ${n(c, 1)} + ${n(b, 2)}\\,x - ${n(aPos, d)}\\,x^{2}`;

/** Same rule, bend known only within a range. */
export const quadBandTex = (c, b, aLo, aHi) =>
  `y = ${n(c, 1)} + ${n(b, 2)}\\,x - a\\,x^{2},\\quad ${n(aLo, 3)} \\le a \\le ${n(aHi, 3)}`;

export const rangeTex = (sub, lo, hi, d = 1) =>
  `${n(lo, d)} \\le x_{${sub}} \\le ${n(hi, d)}`;

export const peakBandTex = (lo, hi, h) =>
  `${n(lo, 1)} \\le \\text{peak} \\le ${n(hi, 1)} < ${n(h, 1)}`;

/** The quadratic formula with this reading's numbers in it. Solves
 *  aPos x^2 - b x + (c - h) ... presented tidied: aPos x^2 - b x + rhs = 0. */
export const formulaTex = (aPos, b, rhs) =>
  `x = \\frac{${n(b, 2)} \\pm \\sqrt{\\,${n(b, 2)}^{2} - 4(${n(aPos, 3)})(${n(rhs, 1)})\\,}}{2(${n(aPos, 3)})}`;

/** Architect-only: where the numbers came from. */
export const physicsTex = () =>
  `y = y_0 + x\\tan\\theta \\;-\\; \\tfrac{g}{2v^{2}\\cos^{2}\\theta}\\,x^{2}`;
