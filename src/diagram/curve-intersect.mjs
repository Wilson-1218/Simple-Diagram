/**
 * Intersections of coord-plot curves, and polygons between them.
 *
 * line / vline / quad are solved from the difference polynomial.
 * sin, cos, tan, exp, log, and ln use 400 samples, then bisection and
 * Newton until |f1 − f2| < 1e-7. A tan segment that contains an asymptote
 * is not a root, even when the samples change sign.
 */

import { coordCurveDomain, coordEvalY } from "./coord-plot.mjs";

const ROOT_SAMPLES = 400;
const AREA_STEPS = 80;
const ROOT_TOL = 1e-7;
const U_TIE = 1e-4;

const FN_TYPES = new Set(["line", "quad", "log", "log10", "ln", "exp", "sin", "cos", "tan"]);
const ALG_TYPES = new Set(["line", "quad", "vline"]);

function finiteOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function needsPositiveX(curve) {
  const t = curve && curve.type;
  return t === "log" || t === "log10" || t === "ln";
}

function isFunctionCurve(curve) {
  return !!(curve && FN_TYPES.has(curve.type));
}

/**
 * Plot window ∩ each curve domain ∩ optional [a, b].
 * Logarithms start at 1e-4, matching the curve sampler.
 * @returns {{ u0: number, u1: number } | { error: "bad" | "empty" }}
 */
export function curveSearchDomain(plot, curves, explicit) {
  let u0 = finiteOr(plot && plot.xmin, -2);
  let u1 = finiteOr(plot && plot.xmax, 6);
  if (u0 > u1) {
    const t = u0;
    u0 = u1;
    u1 = t;
  }
  if (explicit != null) {
    const ok =
      Array.isArray(explicit) &&
      explicit.length >= 2 &&
      Number.isFinite(Number(explicit[0])) &&
      Number.isFinite(Number(explicit[1]));
    if (!ok) return { error: "bad" };
    let a = Number(explicit[0]);
    let b = Number(explicit[1]);
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    u0 = Math.max(u0, a);
    u1 = Math.min(u1, b);
  }
  for (const curve of curves || []) {
    const d = coordCurveDomain(curve);
    if (!d) continue;
    u0 = Math.max(u0, d[0]);
    u1 = Math.min(u1, d[1]);
  }
  if ((curves || []).some(needsPositiveX)) u0 = Math.max(u0, 1e-4);
  if (!(u1 > u0 + 1e-12)) return { error: "empty" };
  return { u0, u1 };
}

/** u ascending; if |u1 − u2| ≤ 1e-4, smaller v first. */
export function sortIntersectionRoots(roots) {
  return roots.slice().sort((a, b) => {
    if (Math.abs(a.u - b.u) <= U_TIE) return a.v - b.v;
    return a.u - b.u;
  });
}

function inInterval(u, u0, u1) {
  const tol = 1e-7 * Math.max(1, Math.abs(u0), Math.abs(u1));
  return u >= u0 - tol && u <= u1 + tol;
}

function dedupeRoots(roots) {
  const sorted = sortIntersectionRoots(roots);
  const out = [];
  for (const r of sorted) {
    if (!Number.isFinite(r.u) || !Number.isFinite(r.v)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.u - r.u) <= 1e-5 && Math.abs(prev.v - r.v) <= U_TIE) continue;
    out.push({ u: r.u, v: r.v });
  }
  return out;
}

function tanPhase(curve, u, plot) {
  if (!curve || curve.type !== "tan") return null;
  const p = curve.params || {};
  const B = p.B ?? 1;
  const C = p.C ?? 0;
  let arg = B * u + C;
  if (plot && plot.xAngleUnit === "deg") arg *= Math.PI / 180;
  return arg;
}

/** True when the open interval contains a tan asymptote (odd multiple of π/2). */
function crossesTanAsymptote(curve, u0, u1, plot) {
  const a = tanPhase(curve, u0, plot);
  const b = tanPhase(curve, u1, plot);
  if (a == null || b == null) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  const n0 = a / Math.PI - 0.5;
  const n1 = b / Math.PI - 0.5;
  return Math.floor(n0) !== Math.floor(n1);
}

function evalPair(c1, c2, u, plot) {
  const y1 = coordEvalY(c1, u, plot);
  const y2 = coordEvalY(c2, u, plot);
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  return { y1, y2, g: y1 - y2 };
}

function solvePoly(A, B, C) {
  const scale = Math.max(1, Math.abs(A), Math.abs(B), Math.abs(C));
  const eps = 1e-12 * scale;
  if (Math.abs(A) <= eps) {
    if (Math.abs(B) <= eps) return [];
    return [-C / B];
  }
  const disc = B * B - 4 * A * C;
  if (disc < -1e-10 * scale * scale) return [];
  if (disc <= 1e-10 * scale * scale) return [-B / (2 * A)];
  const s = Math.sqrt(disc);
  const sign = B >= 0 ? 1 : -1;
  const q = -0.5 * (B + sign * s);
  const roots = [];
  if (Math.abs(q) > eps) roots.push(C / q);
  if (Math.abs(A) > eps) roots.push(q / A);
  return roots.filter((u) => Number.isFinite(u));
}

function differencePoly(c1, c2) {
  let A = 0;
  let B = 0;
  let C = 0;
  const acc = (curve, sign) => {
    const p = curve.params || {};
    if (curve.type === "line") {
      B += sign * (p.m ?? 1);
      C += sign * (p.c ?? 0);
    } else {
      A += sign * (p.a ?? 1);
      B += sign * (p.b ?? 0);
      C += sign * (p.c ?? 0);
    }
  };
  acc(c1, 1);
  acc(c2, -1);
  return solvePoly(A, B, C);
}

function polishRoot(u, c1, c2, plot, lo, hi) {
  let x = Math.min(hi, Math.max(lo, u));
  for (let k = 0; k < 10; k++) {
    const ev = evalPair(c1, c2, x, plot);
    if (!ev) return null;
    if (Math.abs(ev.g) < ROOT_TOL) return { u: x, v: (ev.y1 + ev.y2) / 2 };
    const h = 1e-5;
    if (crossesTanAsymptote(c1, x - h, x + h, plot) || crossesTanAsymptote(c2, x - h, x + h, plot)) {
      break;
    }
    const ep = evalPair(c1, c2, x + h, plot);
    const em = evalPair(c1, c2, x - h, plot);
    if (!ep || !em) break;
    const gp = (ep.g - em.g) / (2 * h);
    if (!(Math.abs(gp) > 1e-12)) break;
    const next = x - ev.g / gp;
    if (!(next >= lo && next <= hi)) break;
    if (crossesTanAsymptote(c1, x, next, plot) || crossesTanAsymptote(c2, x, next, plot)) break;
    x = next;
  }
  const ev = evalPair(c1, c2, x, plot);
  if (ev && Math.abs(ev.g) < ROOT_TOL) return { u: x, v: (ev.y1 + ev.y2) / 2 };
  return null;
}

function bisectRoot(a, b, c1, c2, plot) {
  if (crossesTanAsymptote(c1, a, b, plot) || crossesTanAsymptote(c2, a, b, plot)) return null;
  let lo = a;
  let hi = b;
  let elo = evalPair(c1, c2, lo, plot);
  let ehi = evalPair(c1, c2, hi, plot);
  if (!elo || !ehi || elo.g * ehi.g > 0) return null;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const em = evalPair(c1, c2, mid, plot);
    if (!em) return null;
    if (Math.abs(em.g) < ROOT_TOL || hi - lo < 1e-12) {
      return polishRoot(mid, c1, c2, plot, Math.min(a, b), Math.max(a, b)) || {
        u: mid,
        v: (em.y1 + em.y2) / 2,
      };
    }
    if (elo.g * em.g <= 0) {
      hi = mid;
      ehi = em;
    } else {
      lo = mid;
      elo = em;
    }
  }
  const mid = (lo + hi) / 2;
  const em = evalPair(c1, c2, mid, plot);
  if (!em || Math.abs(em.g) >= ROOT_TOL) return null;
  return { u: mid, v: (em.y1 + em.y2) / 2 };
}

function algebraicRoots(c1, c2, plot, u0, u1) {
  const xs = differencePoly(c1, c2);
  const roots = [];
  for (const u of xs) {
    if (!inInterval(u, u0, u1)) continue;
    const polished = polishRoot(u, c1, c2, plot, u0, u1);
    if (polished) roots.push(polished);
  }
  return roots;
}

function numericRoots(c1, c2, plot, u0, u1) {
  const roots = [];
  let prevU = null;
  let prev = null;
  for (let i = 0; i <= ROOT_SAMPLES; i++) {
    const u = u0 + ((u1 - u0) * i) / ROOT_SAMPLES;
    const crossed =
      prevU != null &&
      (crossesTanAsymptote(c1, prevU, u, plot) || crossesTanAsymptote(c2, prevU, u, plot));
    const ev = crossed ? null : evalPair(c1, c2, u, plot);
    if (!ev) {
      prevU = null;
      prev = null;
      continue;
    }
    if (prev && prev.g * ev.g < 0) {
      const hit = bisectRoot(prevU, u, c1, c2, plot);
      if (hit) roots.push(hit);
    } else if (Math.abs(ev.g) < 1e-3) {
      const hit = polishRoot(u, c1, c2, plot, u0, u1);
      if (hit) roots.push(hit);
    }
    prevU = u;
    prev = ev;
  }
  return roots;
}

function vlineRoot(vert, other, plot, u0, u1) {
  if (!isFunctionCurve(other)) return { status: "unsupported", roots: [] };
  const x = Number((vert.params || {}).x ?? 0);
  if (!Number.isFinite(x) || !inInterval(x, u0, u1)) return { status: "ok", roots: [] };
  const y = coordEvalY(other, x, plot);
  if (!Number.isFinite(y)) return { status: "ok", roots: [] };
  return { status: "ok", roots: [{ u: x, v: y }] };
}

/**
 * @returns {{ status: "ok"|"unsupported", roots: Array<{u:number,v:number}> }}
 */
export function intersectCurves(curve1, curve2, plot, u0, u1) {
  if (!(u1 > u0)) return { status: "ok", roots: [] };
  const t1 = curve1 && curve1.type;
  const t2 = curve2 && curve2.type;
  let found;
  if (t1 === "vline" && t2 === "vline") {
    found = { status: "ok", roots: [] };
  } else if (t1 === "vline") {
    found = vlineRoot(curve1, curve2, plot, u0, u1);
  } else if (t2 === "vline") {
    found = vlineRoot(curve2, curve1, plot, u0, u1);
  } else if (!isFunctionCurve(curve1) || !isFunctionCurve(curve2)) {
    found = { status: "unsupported", roots: [] };
  } else if (ALG_TYPES.has(t1) && ALG_TYPES.has(t2)) {
    found = { status: "ok", roots: algebraicRoots(curve1, curve2, plot, u0, u1) };
  } else {
    found = { status: "ok", roots: numericRoots(curve1, curve2, plot, u0, u1) };
  }
  found.roots = dedupeRoots(found.roots).filter((r) => {
    if (!inInterval(r.u, u0, u1)) return false;
    if (t1 === "vline" || t2 === "vline") return true;
    const ev = evalPair(curve1, curve2, r.u, plot);
    return !!(ev && Math.abs(ev.g) < ROOT_TOL);
  });
  return found;
}

/**
 * Closed intervals between consecutive roots.
 * Two roots → leftmost to rightmost. More than two → each adjacent pair
 * whose u's differ by more than 1e-4 (a crossing in between is its own region).
 * @param {Array<{u:number,v:number}>} roots
 * @returns {Array<[number, number]>}
 */
export function adjacentClosedIntervals(roots) {
  const sorted = sortIntersectionRoots(roots);
  const out = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i].u;
    const b = sorted[i + 1].u;
    if (b - a > U_TIE) out.push([a, b]);
  }
  return out;
}

function dedupeRing(pts) {
  const out = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.u - p.u, prev.v - p.v) <= 1e-8) continue;
    out.push(p);
  }
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.u - b.u, a.v - b.v) <= 1e-8) out.pop();
  }
  return out;
}

/**
 * Sample curve1 left→right and curve2 right→left. 80 steps (inside 64–96).
 * A tan asymptote or a non-finite sample splits the polygon.
 * @returns {Array<Array<{u:number,v:number}>>}
 */
export function sampleBetweenRings(curve1, curve2, plot, u0, u1) {
  const steps = AREA_STEPS;
  const rings = [];
  let forward = [];
  let back = [];
  const flush = () => {
    if (forward.length >= 2 && back.length >= 2) {
      const ring = dedupeRing(forward.concat(back.reverse()));
      if (ring.length >= 3) rings.push(ring);
    }
    forward = [];
    back = [];
  };
  let prevU = null;
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    const crossed =
      prevU != null &&
      (crossesTanAsymptote(curve1, prevU, u, plot) || crossesTanAsymptote(curve2, prevU, u, plot));
    if (crossed) flush();
    const ev = crossed ? null : evalPair(curve1, curve2, u, plot);
    if (!ev) {
      flush();
      prevU = null;
      continue;
    }
    forward.push({ u, v: ev.y1 });
    back.push({ u, v: ev.y2 });
    prevU = u;
  }
  flush();
  return rings;
}

export const CURVE_ROOT_SAMPLES = ROOT_SAMPLES;
export const CURVE_AREA_STEPS = AREA_STEPS;
