/**
 * Length-mark geometry helpers (exam-diagram styles).
 * Screen-space: endpoints already mapped; offPx = offset from segment midline.
 *
 * style: "text" | "dim" | "arcs"
 * orient: "tilt" | "horizontal"
 */

/** @param {unknown} s */
export function normalizeLengthStyle(s) {
  if (s === "dim" || s === 2 || s === "2") return "dim";
  if (s === "arcs" || s === 3 || s === "3") return "arcs";
  return "text";
}

/** @param {unknown} o */
export function normalizeLengthOrient(o) {
  if (o === "horizontal" || o === "h" || o === "fixed") return "horizontal";
  return "tilt";
}

/** Keep text readable while parallel to the edge. */
export function readableEdgeAngle(dx, dy) {
  let ang = Math.atan2(dy, dx);
  if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
  return ang;
}

/**
 * @param {{ x: number, y: number }} a screen pt
 * @param {{ x: number, y: number }} b screen pt
 * @param {1|-1} side
 * @param {number} offPx
 */
export function lengthOffsetFrame(a, b, side, offPx) {
  const s = side === -1 ? -1 : 1;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const nx = -dy * s;
  const ny = dx * s;
  const p0 = { x: a.x + nx * offPx, y: a.y + ny * offPx };
  const p1 = { x: b.x + nx * offPx, y: b.y + ny * offPx };
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  return { dx, dy, nx, ny, len, p0, p1, mx, my, angle: readableEdgeAngle(dx, dy) };
}

/**
 * Approximate text width for gap (serif italic ~0.55em).
 * @param {string} text
 * @param {number} fontPx
 */
export function approxTextWidth(text, fontPx) {
  const t = String(text || "");
  let w = 0;
  for (const ch of t) {
    w += /[ijlI1|.,:;'!]/.test(ch) ? 0.35 : /[mwMW]/.test(ch) ? 0.85 : 0.55;
  }
  return Math.max(fontPx * 0.6, w * fontPx);
}

/**
 * Build dim-style geometry (extension ticks + arrow line + gap).
 * @param {ReturnType<typeof lengthOffsetFrame>} frame
 * @param {number} fontPx
 * @param {string} text
 * @param {number} [scale=1]
 */
export function dimMarkParts(frame, fontPx, text, scale = 1) {
  const tick = Math.max(6, 8 * scale);
  const arrow = Math.max(5, 7 * scale);
  const pad = Math.max(4, fontPx * 0.35);
  const gap = approxTextWidth(text, fontPx) + pad * 2;
  const halfGap = gap / 2;
  const { p0, p1, dx, dy, mx, my } = frame;
  const along0 = { x: p0.x + dx * arrow, y: p0.y + dy * arrow };
  const along1 = { x: p1.x - dx * arrow, y: p1.y - dy * arrow };
  // Mid gap along the dim line
  const g0 = { x: mx - dx * halfGap, y: my - dy * halfGap };
  const g1 = { x: mx + dx * halfGap, y: my + dy * halfGap };
  // Extension ticks perpendicular to dim direction at ends
  const px = -dy;
  const py = dx;
  const tick0 = {
    x0: p0.x - px * tick,
    y0: p0.y - py * tick,
    x1: p0.x + px * tick,
    y1: p0.y + py * tick,
  };
  const tick1 = {
    x0: p1.x - px * tick,
    y0: p1.y - py * tick,
    x1: p1.x + px * tick,
    y1: p1.y + py * tick,
  };
  return {
    tick0,
    tick1,
    // line segments with gap (arrow tip → gap edge)
    lineA: { x0: along0.x, y0: along0.y, x1: g0.x, y1: g0.y },
    lineB: { x0: g1.x, y0: g1.y, x1: along1.x, y1: along1.y },
    arrow0: { tip: p0, dir: { x: -dx, y: -dy }, size: arrow },
    arrow1: { tip: p1, dir: { x: dx, y: dy }, size: arrow },
    label: { x: mx, y: my },
    gap,
  };
}

/**
 * Build arc-bracket style (two outward bows + gap).
 * @param {ReturnType<typeof lengthOffsetFrame>} frame
 * @param {number} fontPx
 * @param {string} text
 * @param {number} [scale=1]
 */
export function arcsMarkParts(frame, fontPx, text, scale = 1) {
  const pad = Math.max(4, fontPx * 0.35);
  const gap = approxTextWidth(text, fontPx) + pad * 2;
  const halfGap = gap / 2;
  const bulge = Math.max(8, 11 * scale);
  const { p0, p1, dx, dy, nx, ny, mx, my } = frame;
  const g0 = { x: mx - dx * halfGap, y: my - dy * halfGap };
  const g1 = { x: mx + dx * halfGap, y: my + dy * halfGap };
  // Midpoints of each half, pushed outward
  const mA = {
    x: (p0.x + g0.x) / 2 + nx * bulge,
    y: (p0.y + g0.y) / 2 + ny * bulge,
  };
  const mB = {
    x: (g1.x + p1.x) / 2 + nx * bulge,
    y: (g1.y + p1.y) / 2 + ny * bulge,
  };
  return {
    // quadratic: start → control → end
    arcA: { x0: p0.x, y0: p0.y, cx: mA.x, cy: mA.y, x1: g0.x, y1: g0.y },
    arcB: { x0: g1.x, y0: g1.y, cx: mB.x, cy: mB.y, x1: p1.x, y1: p1.y },
    label: { x: mx, y: my },
    gap,
  };
}
