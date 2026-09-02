// physics.js — Law 4: the world is fiction, the mathematics never is.
// Nothing here knows about drawing. Every number the overlays show is produced here.

export const DEG = Math.PI / 180;

/**
 * A throw is a genuine quadratic in horizontal displacement u = x - x0:
 *
 *     y(x) = c + b*u + a*u^2 ,   u = x - x0
 *     c = y0            (release height)
 *     b = tan(theta)    (the tangent at release — this is all a linear tool can see)
 *     a = -g / (2 v^2 cos^2(theta))
 *
 * This is the standard projectile path with no drag. It is derived, not fitted.
 */
export function arc({ x0, y0, v, theta, g }) {
  const c = y0;
  const b = Math.tan(theta);
  const a = -g / (2 * v * v * Math.cos(theta) ** 2);
  return {
    a, b, c, x0, y0, v, theta, g,
    y: (x) => { const u = x - x0; return a * u * u + b * u + c; },
    // The linear instrument's honest reading: the release tangent, extended.
    yTangent: (x) => y0 + b * (x - x0),
  };
}

/** Real roots of y(x) = h. Returns ascending x's, or [] when the height is never reached. */
export function crossings(A, h) {
  const { a, b, c, x0 } = A;
  const disc = b * b - 4 * a * (c - h);
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  const u1 = (-b + r) / (2 * a);
  const u2 = (-b - r) / (2 * a);
  return [x0 + u1, x0 + u2].sort((p, q) => p - q);
}

/** Where the linear model claims it crosses h. Confidently wrong, and honestly so. */
export function tangentCrossing(A, h) {
  if (Math.abs(A.b) < 1e-9) return null;
  return A.x0 + (h - A.y0) / A.b;
}

/** Apex — the vertex of the parabola. */
export function vertex(A) {
  const { a, b, c, x0 } = A;
  const u = -b / (2 * a);
  return { x: x0 + u, y: c - (b * b) / (4 * a) };
}

/** Where the stone lands (y = 0), taking the far root. */
export function landing(A) {
  const xs = crossings(A, 0);
  return xs.length ? xs[xs.length - 1] : null;
}

/**
 * Launch angles that pass exactly through (tx, ty). Solving
 *     k T^2 - dx T + (dy + k) = 0 ,  k = g*dx^2/(2 v^2),  T = tan(theta)
 * gives the familiar low arc and high arc. Used to check the world is solvable,
 * and shown in architect view — never to the player.
 */
export function solveAngles({ x0, y0, v, g }, tx, ty) {
  const dx = tx - x0, dy = ty - y0;
  if (dx <= 0) return [];
  const k = (g * dx * dx) / (2 * v * v);
  const disc = dx * dx - 4 * k * (dy + k);
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  return [(dx - r) / (2 * k), (dx + r) / (2 * k)]
    .map((T) => Math.atan(T))
    .sort((p, q) => p - q);
}

/**
 * Law 5 — a partial instrument reads partially.
 *
 * Competence `s` in [0,1] becomes honest ignorance about how hard things fall:
 * g is known only to within +/- delta, delta = 0.35*(1 - s). At full strength the
 * band collapses to the true arc and the intervals collapse to points. The reading
 * is never made confident and wrong — only wide.
 */
export function degraded(params, s) {
  const delta = 0.35 * (1 - Math.max(0, Math.min(1, s)));
  const gs = delta === 0 ? [params.g] : [
    params.g * (1 - delta), params.g * (1 - delta / 2), params.g,
    params.g * (1 + delta / 2), params.g * (1 + delta),
  ];
  return { delta, arcs: gs.map((g) => arc({ ...params, g })) };
}

/** The far crossing of height h, as an interval under partial competence. */
export function crossingInterval(params, s, h) {
  const { arcs } = degraded(params, s);
  const far = arcs.map((A) => { const xs = crossings(A, h); return xs.length ? xs[xs.length - 1] : null; })
                  .filter((x) => x !== null);
  if (!far.length) return null;
  return { lo: Math.min(...far), hi: Math.max(...far) };
}

/** Position along the true path at time t — used to animate the stone honestly. */
export function at(A, t) {
  const vx = A.v * Math.cos(A.theta);
  const vy = A.v * Math.sin(A.theta);
  return { x: A.x0 + vx * t, y: A.y0 + vy * t - 0.5 * A.g * t * t };
}
