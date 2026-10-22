/**
 * Length-mark geometry helpers (exam-diagram styles).
 * Screen-space: endpoints already mapped; offPx = offset from segment midline.
 *
 * style: "text" | "dim" | "arcs" | "ends"
 *   arcs = parallel bow beside segment with mid gap (style 3 弧括號)
 *   ends = dual-arc end ticks on the segment (style 4 端點弧)
 * orient: "tilt" | "horizontal"
 * stroke (arcs): "solid" | "dashed" | "dotted"
 */

/** @param {unknown} s */
export function normalizeLengthStyle(s) {
  if (s === "dim" || s === 2 || s === "2") return "dim";
  if (s === "arcs" || s === 3 || s === "3") return "arcs";
  if (s === "ends" || s === "endArcs" || s === 4 || s === "4") return "ends";
  return "text";
}

/** @param {unknown} o */
export function normalizeLengthOrient(o) {
  if (o === "horizontal" || o === "h" || o === "fixed") return "horizontal";
  return "tilt";
}

/** Arc-bracket stroke (style 3). Default dotted to match exam refs. */
export function normalizeLengthStroke(s) {
  if (s === "solid" || s === "dashed" || s === "dotted") return s;
  return "dotted";
}

/** Canvas / SVG dash array for length arc stroke (screen px). */
export function lengthStrokeDash(stroke, scale = 1) {
  const st = normalizeLengthStroke(stroke);
  if (st === "solid") return [];
  if (st === "dashed") return [Math.max(5, 7 * scale), Math.max(4, 5 * scale)];
  // dotted — short dashes like exam ink
  return [Math.max(1.4, 1.8 * scale), Math.max(3.2, 4 * scale)];
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
  const g0 = { x: mx - dx * halfGap, y: my - dy * halfGap };
  const g1 = { x: mx + dx * halfGap, y: my + dy * halfGap };
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
    lineA: { x0: along0.x, y0: along0.y, x1: g0.x, y1: g0.y },
    lineB: { x0: g1.x, y0: g1.y, x1: along1.x, y1: along1.y },
    arrow0: { tip: p0, dir: { x: -dx, y: -dy }, size: arrow },
    arrow1: { tip: p1, dir: { x: dx, y: dy }, size: arrow },
    label: { x: mx, y: my },
    gap,
  };
}

/**
 * Style 3 — parallel arc bracket beside the segment with a mid gap for the value.
 * Prefer `lengthOffsetFrame(a, b, side, off≈16–20)`.
 * @param {ReturnType<typeof lengthOffsetFrame>} frame
 * @param {number} fontPx
 * @param {string} text
 * @param {number} [scale=1]
 */
export function arcsMarkParts(frame, fontPx, text, scale = 1) {
  const pad = Math.max(4, fontPx * 0.35);
  const gap = approxTextWidth(text, fontPx) + pad * 2;
  const halfGap = gap / 2;
  // Gentle outward bow (exam parallel arc)
  const bulge = Math.max(7, 9.5 * scale);
  const { p0, p1, dx, dy, nx, ny, mx, my } = frame;
  const g0 = { x: mx - dx * halfGap, y: my - dy * halfGap };
  const g1 = { x: mx + dx * halfGap, y: my + dy * halfGap };
  const mA = {
    x: (p0.x + g0.x) / 2 + nx * bulge,
    y: (p0.y + g0.y) / 2 + ny * bulge,
  };
  const mB = {
    x: (g1.x + p1.x) / 2 + nx * bulge,
    y: (g1.y + p1.y) / 2 + ny * bulge,
  };
  return {
    arcA: { x0: p0.x, y0: p0.y, cx: mA.x, cy: mA.y, x1: g0.x, y1: g0.y },
    arcB: { x0: g1.x, y0: g1.y, cx: mB.x, cy: mB.y, x1: p1.x, y1: p1.y },
    label: { x: mx, y: my },
    gap,
    bulge,
  };
}

/**
 * One HKDSE-style end mark: two symmetrical arcs meet on the segment and
 * flare toward the label side (curved caret / brace tick).
 * @param {{ x: number, y: number }} tip
 * @param {number} dx unit along segment
 * @param {number} dy
 * @param {number} nx unit normal toward label
 * @param {number} ny
 * @param {number} scale
 */
export function arcsEndMark(tip, dx, dy, nx, ny, scale = 1) {
  const w = Math.max(4.2, 5.2 * scale);
  const h = Math.max(5.2, 6.8 * scale);
  const endL = { x: tip.x - dx * w + nx * h, y: tip.y - dy * w + ny * h };
  const endR = { x: tip.x + dx * w + nx * h, y: tip.y + dy * w + ny * h };
  const cL = {
    x: tip.x - dx * w * 1.05 + nx * h * 0.22,
    y: tip.y - dy * w * 1.05 + ny * h * 0.22,
  };
  const cR = {
    x: tip.x + dx * w * 1.05 + nx * h * 0.22,
    y: tip.y + dy * w * 1.05 + ny * h * 0.22,
  };
  return {
    left: { x0: tip.x, y0: tip.y, cx: cL.x, cy: cL.y, x1: endL.x, y1: endL.y },
    right: { x0: tip.x, y0: tip.y, cx: cR.x, cy: cR.y, x1: endR.x, y1: endR.y },
  };
}

/**
 * Style 4 — end-tick dual arcs on the segment + value just above midline.
 * Prefer `lengthOffsetFrame(a, b, side, 0)`.
 * @param {ReturnType<typeof lengthOffsetFrame>} frame
 * @param {number} fontPx
 * @param {string} [_text]
 * @param {number} [scale=1]
 */
export function endsMarkParts(frame, fontPx, _text, scale = 1) {
  const { p0, p1, dx, dy, nx, ny } = frame;
  const lift = Math.max(fontPx * 0.55, 8 * scale);
  const mx = (p0.x + p1.x) / 2 + nx * lift;
  const my = (p0.y + p1.y) / 2 + ny * lift;
  return {
    mark0: arcsEndMark(p0, dx, dy, nx, ny, scale),
    mark1: arcsEndMark(p1, dx, dy, nx, ny, scale),
    label: { x: mx, y: my },
    lift,
  };
}
