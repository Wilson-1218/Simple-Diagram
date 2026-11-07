/**
 * Parallel slanted hatch strokes for exam-style bar / region fills.
 * Default slant is "/" (bottom-left → top-right in y-down world).
 */

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize fill pattern: "solid" (default) | "hatch". */
export function normalizeFillPattern(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "hatch" || s === "hatched" || s === "stripe" || s === "stripes") {
    return "hatch";
  }
  return "solid";
}

/**
 * Clip an infinite line (point + direction) to an axis-aligned rect.
 * @returns {{x1:number,y1:number,x2:number,y2:number}|null}
 */
export function clipLineToRect(px, py, dx, dy, x, y, w, h) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Parametric: p + t * u; find t entering/leaving AABB via slab method.
  let t0 = -Infinity;
  let t1 = Infinity;
  const xmin = x;
  const xmax = x + w;
  const ymin = y;
  const ymax = y + h;

  const slabs = [
    [ux, px, xmin, xmax],
    [uy, py, ymin, ymax],
  ];
  for (const [u, p, lo, hi] of slabs) {
    if (Math.abs(u) < 1e-12) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let ta = (lo - p) / u;
    let tb = (hi - p) / u;
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 - t0 < 1e-9) return null;
  return {
    x1: px + ux * t0,
    y1: py + uy * t0,
    x2: px + ux * t1,
    y2: py + uy * t1,
  };
}

/**
 * Parallel hatch strokes covering an axis-aligned rectangle.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{ spacing?: number, angle?: number }} [opts]
 * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
 */
export function hatchStrokesInRect(x, y, w, h, opts = {}) {
  const rw = Number(w);
  const rh = Number(h);
  if (!(rw > 1e-6) || !(rh > 1e-6)) return [];
  const spacing = Math.max(2, num(opts.spacing, 8));
  // "/" in y-down: direction (1, -1) → angle −π/4
  const angle = num(opts.angle, -Math.PI / 4);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;

  const corners = [
    [x, y],
    [x + rw, y],
    [x, y + rh],
    [x + rw, y + rh],
  ];
  let minP = Infinity;
  let maxP = -Infinity;
  for (const [cx, cy] of corners) {
    const p = cx * nx + cy * ny;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const start = minP - spacing;
  const end = maxP + spacing;
  const strokes = [];
  for (let p = start; p <= end + 1e-9; p += spacing) {
    // Unit normal → point on the line x·n = p nearest the origin
    const qx = nx * p;
    const qy = ny * p;
    const seg = clipLineToRect(qx, qy, dx, dy, x, y, rw, rh);
    if (seg) strokes.push(seg);
  }
  return strokes;
}

/**
 * Hatch strokes for a polygon (uses axis-aligned bbox; caller clips to shape).
 * @param {{x:number,y:number}[]} pts
 * @param {{ spacing?: number, angle?: number }} [opts]
 */
export function hatchStrokesForPolygon(pts, opts = {}) {
  if (!Array.isArray(pts) || pts.length < 3) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return [];
  return hatchStrokesInRect(minX, minY, maxX - minX, maxY - minY, opts);
}

/**
 * SVG fragment: hatch clipped to a path `d` (already closed).
 * @param {string} pathD
 * @param {{x:number,y:number}[]} worldPts for bbox hatch (world or screen — same space as pathD)
 * @param {string} clipId
 * @param {{ spacing?: number, angle?: number, stroke?: string, strokeWidth?: number|string }} [opts]
 */
export function svgHatchClipped(pathD, worldPts, clipId, opts = {}) {
  const stroke = opts.stroke || "#111";
  const sw =
    opts.strokeWidth != null ? String(opts.strokeWidth) : "1";
  const strokes = hatchStrokesForPolygon(worldPts, opts);
  if (!strokes.length || !pathD) return "";
  let out = `<clipPath id="${clipId}"><path d="${pathD}" /></clipPath>\n`;
  out += `<g clip-path="url(#${clipId})">\n`;
  for (const s of strokes) {
    out += `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="butt" />\n`;
  }
  out += `</g>\n`;
  return out;
}

/**
 * SVG hatch inside an axis-aligned rect (no separate clip needed if strokes already clipped).
 */
export function svgHatchInRect(x, y, w, h, opts = {}) {
  const stroke = opts.stroke || "#111";
  const sw = opts.strokeWidth != null ? String(opts.strokeWidth) : "1";
  const strokes = hatchStrokesInRect(x, y, w, h, opts);
  let out = "";
  for (const s of strokes) {
    out += `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="butt" />\n`;
  }
  return out;
}
