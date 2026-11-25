/**
 * Linear-programming feasible region: parse inequalities to half-planes
 * A u + B v <= C, then Sutherland–Hodgman clip against an axis-aligned window.
 *
 * Choices:
 * - Strict < / > clip as the closed half-plane. Only the boundary stroke is dashed.
 * - Coefficients are not rescaled: terms are moved to the left, then >= / > flip sign.
 * - Fractions (3/2 and (3/2)) and an optional * are coefficients, not division by a variable.
 * - A boundary on the axis lines x=0 or y=0 is not emitted as a curve.
 * - Vertical boundaries (B ≈ 0) are curve type "vline" with params.x; others are y = mx + c.
 * - An explicit object style wins over the strict/non-strict default.
 * - Coefficient objects win over expr when both are present.
 */

const REL_EPS = 1e-9;

function scaleOf(a, b, c) {
  return Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
}

function near(v, a, b, c) {
  return Math.abs(v) <= REL_EPS * scaleOf(a, b, c);
}

function normalizeSource(s) {
  return String(s)
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[\u00d7\u22c5\u00b7]/g, "*")
    .replace(/\s+/g, "");
}

function findRelation(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (depth <= 0) {
      const two = s.slice(i, i + 2);
      if (two === "<=" || two === ">=") {
        return { index: i, len: 2, op: two, strict: false };
      }
      if (ch === "≤") return { index: i, len: 1, op: "<=", strict: false };
      if (ch === "≥") return { index: i, len: 1, op: ">=", strict: false };
      if (ch === "<") return { index: i, len: 1, op: "<", strict: true };
      if (ch === ">") return { index: i, len: 1, op: ">", strict: true };
    }
  }
  return null;
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

/** Decimal or fraction, optionally wrapped in parentheses. */
function readNumber(s, i) {
  let paren = false;
  if (s[i] === "(") {
    paren = true;
    i += 1;
  }
  let sign = 1;
  if (paren && (s[i] === "+" || s[i] === "-")) {
    if (s[i] === "-") sign = -1;
    i += 1;
  }
  const start = i;
  if (!isDigit(s[i]) && s[i] !== ".") return null;
  while (isDigit(s[i])) i += 1;
  if (s[i] === ".") {
    i += 1;
    if (!isDigit(s[i])) return null;
    while (isDigit(s[i])) i += 1;
  }
  let value = Number(s.slice(start, i));
  if (!Number.isFinite(value)) return null;
  if (s[i] === "/") {
    i += 1;
    const ds = i;
    if (!isDigit(s[i]) && s[i] !== ".") return null;
    while (isDigit(s[i])) i += 1;
    if (s[i] === ".") {
      i += 1;
      if (!isDigit(s[i])) return null;
      while (isDigit(s[i])) i += 1;
    }
    const den = Number(s.slice(ds, i));
    if (!Number.isFinite(den) || den === 0) return null;
    value /= den;
  }
  value *= sign;
  if (paren) {
    if (s[i] !== ")") return null;
    i += 1;
  }
  return { value, index: i };
}

/** a*x + b*y + k. Null when the side is not linear in x and y. */
function parseLinear(src) {
  if (src == null) return null;
  const s = String(src);
  if (!s) return { a: 0, b: 0, k: 0 };
  let i = 0;
  let a = 0;
  let b = 0;
  let k = 0;
  let first = true;
  while (i < s.length) {
    let sign = 1;
    if (s[i] === "+") {
      i += 1;
    } else if (s[i] === "-") {
      sign = -1;
      i += 1;
    } else if (!first) {
      return null;
    }
    if (i >= s.length) return null;
    let coef = null;
    if (s[i] === "(" || isDigit(s[i]) || s[i] === ".") {
      const num = readNumber(s, i);
      if (!num) return null;
      coef = num.value;
      i = num.index;
      if (s[i] === "*") i += 1;
    }
    const v = s[i];
    if (v === "x" || v === "X") {
      a += sign * (coef == null ? 1 : coef);
      i += 1;
    } else if (v === "y" || v === "Y") {
      b += sign * (coef == null ? 1 : coef);
      i += 1;
    } else if (coef != null) {
      k += sign * coef;
    } else {
      return null;
    }
    first = false;
  }
  return { a, b, k };
}

function normalizeRelation(a, b, c, op, strict) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  if (op === ">=" || op === ">") {
    a = -a;
    b = -b;
    c = -c;
  }
  return { a, b, c, strict: !!strict };
}

function metaOf(raw) {
  const style =
    raw && (raw.style === "solid" || raw.style === "dashed" || raw.style === "dotted")
      ? raw.style
      : undefined;
  const label =
    raw && raw.label != null && String(raw.label) !== "" ? String(raw.label) : undefined;
  return { style, label, drawLine: !!(raw && raw.drawLine === true) };
}

function parseStringInequality(text) {
  const s = normalizeSource(text);
  if (!s) return null;
  const rel = findRelation(s);
  if (!rel) return null;
  const left = parseLinear(s.slice(0, rel.index));
  const right = parseLinear(s.slice(rel.index + rel.len));
  if (!left || !right) return null;
  const moved = normalizeRelation(
    left.a - right.a,
    left.b - right.b,
    -(left.k - right.k),
    rel.op,
    rel.strict
  );
  if (!moved) return null;
  return { ...moved, style: undefined, label: undefined, drawLine: false };
}

/**
 * One inequality → closed half-plane A u + B v <= C.
 * @param {unknown} raw  string, or {a,b,op,c} / {expr}
 * @returns {null | { a:number, b:number, c:number, strict:boolean, style?:string, label?:string, drawLine:boolean }}
 */
export function parseInequality(raw) {
  if (typeof raw === "string") return parseStringInequality(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const meta = metaOf(raw);
  const hasCoef = raw.a != null || raw.b != null || raw.c != null || raw.op != null;
  if (hasCoef) {
    const op = String(raw.op == null ? "" : raw.op)
      .trim()
      .replace("≤", "<=")
      .replace("≥", ">=");
    const known = op === "<=" || op === ">=" || op === "<" || op === ">";
    if (!known) return null;
    const moved = normalizeRelation(
      Number(raw.a == null ? 0 : raw.a),
      Number(raw.b == null ? 0 : raw.b),
      Number(raw.c == null ? 0 : raw.c),
      op,
      op === "<" || op === ">"
    );
    if (!moved) return null;
    return { ...moved, ...meta };
  }
  if (raw.expr != null) {
    const parsed = parseStringInequality(String(raw.expr));
    if (!parsed) return null;
    return {
      ...parsed,
      style: meta.style || parsed.style,
      label: meta.label || parsed.label,
      drawLine: meta.drawLine,
    };
  }
  return null;
}

/** True when the boundary line is the axis x=0 or y=0. */
export function isAxisBoundary(a, b, c) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return false;
  if (near(a, a, b, c) && near(b, a, b, c)) return false;
  if (near(b, a, b, c) && near(c, a, b, c) && !near(a, a, b, c)) return true;
  if (near(a, a, b, c) && near(c, a, b, c) && !near(b, a, b, c)) return true;
  return false;
}

function classifyPlane(plane) {
  const { a, b, c } = plane;
  if (near(a, a, b, c) && near(b, a, b, c)) return c >= -REL_EPS * scaleOf(a, b, c) ? "all" : "empty";
  return "half";
}

function insideHalf(u, v, a, b, c) {
  const eps = 1e-8 * scaleOf(a, b, c);
  return a * u + b * v <= c + eps;
}

function intersectEdge(s, e, a, b, c) {
  const du = e.u - s.u;
  const dv = e.v - s.v;
  const denom = a * du + b * dv;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-15) return null;
  let t = (c - (a * s.u + b * s.v)) / denom;
  if (!Number.isFinite(t)) return null;
  // Snap only a float overshoot. A far miss is not this edge.
  if (t < -1e-7 || t > 1 + 1e-7) return null;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { u: s.u + t * du, v: s.v + t * dv };
}

function clipPolygonByHalfPlane(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const s = poly[i];
    const e = poly[(i + 1) % poly.length];
    const sin = insideHalf(s.u, s.v, a, b, c);
    const ein = insideHalf(e.u, e.v, a, b, c);
    if (ein) {
      if (!sin) {
        const hit = intersectEdge(s, e, a, b, c);
        if (hit) out.push(hit);
      }
      out.push(e);
    } else if (sin) {
      const hit = intersectEdge(s, e, a, b, c);
      if (hit) out.push(hit);
    }
  }
  return out;
}

function dedupeRing(pts) {
  const out = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.u - p.u, prev.v - p.v) <= 1e-8) continue;
    out.push({ u: p.u, v: p.v });
  }
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.u - b.u, a.v - b.v) <= 1e-8) out.pop();
  }
  return out;
}

/**
 * Signed area and area centroid of a simple polygon (math coords).
 * @param {Array<{u:number,v:number}>} pts
 */
export function polygonAreaAndCentroid(pts) {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = pts[i].u * pts[j].v - pts[j].u * pts[i].v;
    twice += cross;
    cx += (pts[i].u + pts[j].u) * cross;
    cy += (pts[i].v + pts[j].v) * cross;
  }
  const area = twice / 2;
  if (!(Math.abs(area) > 1e-6)) return { area, centroid: null };
  return { area, centroid: { u: cx / (3 * twice), v: cy / (3 * twice) } };
}

/**
 * Clip the rectangle against half-planes, in order.
 * @param {{ uMin:number, uMax:number, vMin:number, vMax:number }} bounds
 * @param {Array<{ a:number, b:number, c:number }>} planes
 * @returns {Array<{u:number,v:number}>}
 */
export function clipHalfPlanes(bounds, planes) {
  let poly = [
    { u: bounds.uMin, v: bounds.vMin },
    { u: bounds.uMax, v: bounds.vMin },
    { u: bounds.uMax, v: bounds.vMax },
    { u: bounds.uMin, v: bounds.vMax },
  ];
  for (const plane of planes) {
    if (classifyPlane(plane) === "empty") return [];
    if (classifyPlane(plane) !== "half") continue;
    poly = clipPolygonByHalfPlane(poly, plane.a, plane.b, plane.c);
    if (poly.length < 3) return [];
  }
  poly = dedupeRing(poly);
  if (poly.length < 3) return [];
  const metrics = polygonAreaAndCentroid(poly);
  if (!metrics.centroid) return [];
  return poly;
}

function boundaryStroke(plane) {
  if (plane.style === "solid" || plane.style === "dashed" || plane.style === "dotted") {
    return plane.style;
  }
  return plane.strict ? "dashed" : "solid";
}

function boundaryCurve(plane) {
  const { a, b, c } = plane;
  let type;
  let params;
  if (near(b, a, b, c)) {
    type = "vline";
    params = { x: c / a };
  } else {
    type = "line";
    params = { m: -a / b, c: c / b };
  }
  return {
    type,
    params,
    style: boundaryStroke(plane),
    label: plane.label,
  };
}

function boundariesOf(planes, drawBoundaries) {
  const out = [];
  for (const plane of planes) {
    if (classifyPlane(plane) !== "half") continue;
    if (isAxisBoundary(plane.a, plane.b, plane.c)) continue;
    if (!(drawBoundaries || plane.drawLine === true)) continue;
    out.push(boundaryCurve(plane));
  }
  return out;
}

/**
 * @param {{ uMin:number, uMax:number, vMin:number, vMax:number }} bounds
 * @param {Array<object>} planes  parsed inequalities
 * @param {{ drawBoundaries?: boolean }} [opts]
 */
export function solveFeasibleRegion(bounds, planes, opts = {}) {
  const drawBoundaries = opts.drawBoundaries === true;
  const boundaries = boundariesOf(planes, drawBoundaries);
  const vertices = clipHalfPlanes(bounds, planes);
  if (vertices.length < 3) {
    return { vertices: [], centroid: null, area: 0, boundaries, empty: true };
  }
  const metrics = polygonAreaAndCentroid(vertices);
  if (!metrics.centroid || !(Math.abs(metrics.area) > 1e-6)) {
    return { vertices: [], centroid: null, area: metrics.area, boundaries, empty: true };
  }
  return {
    vertices,
    centroid: metrics.centroid,
    area: metrics.area,
    boundaries,
    empty: false,
  };
}
