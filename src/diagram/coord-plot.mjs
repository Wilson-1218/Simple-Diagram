/**
 * Headless coord-plot geometry + SVG helpers (mirrors editor paintCoordPlot).
 * Used by documentToSvg so formal paper export matches the canvas.
 */

import { svgTextInner } from "./math-text.mjs";

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function positiveOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Shared unitPx, or per-axis overrides when xUnitPx / yUnitPx are set. */
export function coordAxisScales(plot) {
  const unit = num(plot && plot.unitPx, 40);
  const base = unit > 0 ? unit : 40;
  const xu = plot && plot.xUnitPx != null ? Number(plot.xUnitPx) : base;
  const yu = plot && plot.yUnitPx != null ? Number(plot.yUnitPx) : base;
  return {
    unitPx: base,
    xUnitPx: xu > 0 ? xu : base,
    yUnitPx: yu > 0 ? yu : base,
  };
}

/** World mapping: x = ox + u * xUnitPx, y = oy - v * yUnitPx. */
export function coordWorldFromAxis(plot, u, v) {
  const s = coordAxisScales(plot);
  return { x: plot.ox + u * s.xUnitPx, y: plot.oy - v * s.yUnitPx };
}

/**
 * Custom ticks: number array, or objects {pos|x|y, label?}.
 * Returns null when the field is omitted (caller keeps default integer ticks).
 * @param {unknown} raw
 * @returns {null | Array<{ pos: number, label?: string }>}
 */
export function normalizeCoordTicks(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const t of raw) {
    if (t != null && typeof t === "object" && !Array.isArray(t)) {
      const pos = Number(
        t.pos != null ? t.pos : t.x != null ? t.x : t.y != null ? t.y : NaN
      );
      if (!Number.isFinite(pos)) continue;
      const item = { pos };
      if (t.label != null && String(t.label) !== "") item.label = String(t.label);
      out.push(item);
    } else {
      const n = Number(t);
      if (Number.isFinite(n)) out.push({ pos: n });
    }
  }
  return out;
}

export function coordTickText(tick) {
  if (!tick) return "";
  if (tick.label != null && String(tick.label) !== "") return String(tick.label);
  const p = Number(tick.pos);
  if (!Number.isFinite(p)) return "";
  if (Math.abs(p - Math.round(p)) < 1e-8) return String(Math.round(p));
  return String(Math.round(p * 1e6) / 1e6);
}

/**
 * Origin letter O is already drawn. Skip a tick label that would print "0"
 * on top of it. Custom text other than "0" still draws. showOrigin:false
 * still draws "0". The tick mark itself is unchanged.
 * @param {object|null|undefined} plot
 * @param {number} pos
 * @param {string} text
 */
export function coordOriginZeroLabelSuppressed(plot, pos, text) {
  if (!plot || plot.showOrigin === false) return false;
  if (!(Math.abs(Number(pos)) < 1e-9)) return false;
  return String(text) === "0";
}

/**
 * Math positions whose tick labels the axis actually paints.
 * Explicit ticks count even when showTickLabels is false, except a "0"
 * suppressed beside O. Default integer ticks count only while both
 * showTicks and showTickLabels are on (they already omit 0).
 * @param {object|null|undefined} plot
 * @param {"x"|"y"} axis
 * @returns {number[]}
 */
export function coordDisplayedTickPositions(plot, axis) {
  if (!plot || (axis !== "x" && axis !== "y")) return [];
  const explicit = normalizeCoordTicks(axis === "x" ? plot.xTicks : plot.yTicks);
  if (explicit) {
    const out = [];
    for (const t of explicit) {
      const text = coordTickText(t);
      if (!text) continue;
      if (coordOriginZeroLabelSuppressed(plot, t.pos, text)) continue;
      out.push(Number(t.pos));
    }
    return out;
  }
  if (plot.showTicks === false || plot.showTickLabels === false) return [];
  const min = Number(axis === "x" ? plot.xmin : plot.ymin);
  const max = Number(axis === "x" ? plot.xmax : plot.ymax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const step = axis === "x" ? plot.xStep : plot.yStep;
  return coordIntegerTicks(min, max, step);
}

/** True when a displayed tick label already sits within 1e-3 of `math`. */
export function coordAxisShowsTickLabel(plot, axis, math) {
  const m = Number(math);
  if (!Number.isFinite(m)) return false;
  return coordDisplayedTickPositions(plot, axis).some((pos) => Math.abs(pos - m) < 1e-3);
}

/**
 * When tick labels are on, extend axes past xmax/ymax so the last digit
 * does not collide with the arrow / axis name. Returns px overhangs.
 * Explicit xTicks/yTicks also count (they draw even if showTickLabels is false).
 * @param {object} plot
 * @returns {{ pos: number, neg: number }}
 */
export function coordAxisOverhangPx(plot) {
  const unitPx = num(plot && plot.unitPx, 40);
  const showDefault = plot && plot.showTicks !== false && plot.showTickLabels !== false;
  const explicit = !!(plot && (Array.isArray(plot.xTicks) || Array.isArray(plot.yTicks)));
  if (!showDefault && !explicit) return { pos: 0, neg: 0 };
  // ~0.6·unitPx ≈ 24px at unitPx=40; clamp to 24–28
  const pos = Math.max(24, Math.min(28, unitPx * 0.6));
  const neg = 12; // small negative overhang 10–14px
  return { pos, neg };
}

export function coordPlotBounds(plot) {
  const scales = coordAxisScales(plot);
  const oh = coordAxisOverhangPx(plot);
  const pad = scales.unitPx * 0.55 + Math.max(oh.pos, oh.neg);
  const corners = [
    coordWorldFromAxis(plot, plot.xmin, plot.ymin),
    coordWorldFromAxis(plot, plot.xmax, plot.ymin),
    coordWorldFromAxis(plot, plot.xmin, plot.ymax),
    coordWorldFromAxis(plot, plot.xmax, plot.ymax),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  // Axis overhang: +x right, +y up (world −y), −x left, −y down
  minX -= oh.neg;
  maxX += oh.pos;
  minY -= oh.pos; // +y arrow goes up → smaller world y
  maxY += oh.neg;
  for (const curve of plot.curves || []) {
    let lab = null;
    try {
      lab = curveLabelWorld(plot, curve);
    } catch {
      lab = null;
    }
    if (!lab) continue;
    const fs = 14;
    const tw = Math.max(14, String(lab.text || "").length * fs * 0.56);
    minX = Math.min(minX, lab.x - tw / 2);
    maxX = Math.max(maxX, lab.x + tw / 2);
    minY = Math.min(minY, lab.y - fs * 0.7);
    maxY = Math.max(maxY, lab.y + fs * 0.5);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function addCoordPlotBounds(plot, add) {
  const b = coordPlotBounds(plot);
  add(b.minX, b.minY);
  add(b.maxX, b.maxY);
}

/** Integer (or stepped) ticks in [min, max], skipping 0. step defaults to 1. */
export function coordIntegerTicks(min, max, step) {
  const stepN = positiveOr(step, 1);
  const out = [];
  const k0 = Math.ceil((min - 1e-9) / stepN);
  const k1 = Math.floor((max + 1e-9) / stepN);
  for (let k = k0; k <= k1; k++) {
    let v = k * stepN;
    if (Math.abs(v) < 1e-8) continue;
    if (Math.abs(v - Math.round(v)) < 1e-8) v = Math.round(v);
    else v = Math.round(v * 1e9) / 1e9;
    out.push(v);
  }
  return out;
}

function coordNearZero(u) {
  return Math.abs(u) < 1e-9;
}

function coordLogBase(params) {
  const b = params && params.base;
  if (b === "e" || b === "E") return Math.E;
  const n = Number(b);
  if (Number.isFinite(n) && n > 0 && n !== 1) return n;
  return 10;
}

function coordCircleRadius(params) {
  const p = params || {};
  if (Number.isFinite(Number(p.r)) && Number(p.r) > 0) return Number(p.r);
  if (Number.isFinite(Number(p.r2)) && Number(p.r2) > 0) return Math.sqrt(Number(p.r2));
  return 1;
}

function coordIsDeg(plot) {
  return !!(plot && plot.xAngleUnit === "deg");
}

/** [uMin, uMax] or null when the curve has no domain. */
export function coordCurveDomain(curve) {
  const d = curve && curve.domain;
  if (!Array.isArray(d) || d.length < 2) return null;
  const a = Number(d[0]);
  const b = Number(d[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

export function coordCurveStyle(curve) {
  const s = curve && curve.style;
  if (s === "dashed" || s === "dotted" || s === "solid") return s;
  return "solid";
}

/** Paper / light-canvas ink. Never a fallback white. */
export const COORD_CURVE_INK_PAPER = "#111111";
/** Dark-canvas ink when the curve has no explicit color. */
export const COORD_CURVE_INK_DARK = "#e6e8eb";

/**
 * Stroke for a curve. Missing color is paper black (or a light stroke on
 * a dark canvas). A missing label or a single curve must not become white.
 * @param {object} curve
 * @param {"paper"|"dark"|undefined} theme
 */
export function coordCurveInk(curve, theme) {
  const raw = curve && curve.color != null ? String(curve.color).trim() : "";
  if (raw) return raw;
  if (curve && curve.role === "solution") return theme === "dark" ? "#f87171" : "#dc2626";
  return theme === "dark" ? COORD_CURVE_INK_DARK : COORD_CURVE_INK_PAPER;
}

export function coordEvalY(curve, x, plot) {
  const p = curve.params || {};
  const type = curve.type || "none";
  if (type === "line") return (p.m ?? 1) * x + (p.c ?? 0);
  if (type === "quad") return (p.a ?? 1) * x * x + (p.b ?? 0) * x + (p.c ?? 0);
  if (type === "log" || type === "log10") {
    if (x <= 0) return NaN;
    const base = type === "log10" ? 10 : coordLogBase(p);
    const denom = Math.log(base);
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-15) return NaN;
    return (p.a ?? 1) * (Math.log(x) / denom);
  }
  if (type === "ln") {
    if (x <= 0) return NaN;
    return (p.a ?? 1) * Math.log(x);
  }
  if (type === "exp") {
    const a = p.a ?? 1;
    const b = p.b ?? Math.E;
    if (!(b > 0)) return NaN;
    return a * Math.pow(b, x);
  }
  if (type === "sin" || type === "cos" || type === "tan") {
    const A = p.A ?? 1;
    const B = p.B ?? 1;
    const C = p.C ?? 0;
    const D = p.D ?? 0;
    let arg = B * x + C;
    if (coordIsDeg(plot)) arg *= Math.PI / 180;
    if (type === "tan") {
      const c = Math.cos(arg);
      if (Math.abs(c) < 1e-3) return NaN;
      return A * Math.tan(arg) + D;
    }
    if (type === "sin") return A * Math.sin(arg) + D;
    return A * Math.cos(arg) + D;
  }
  return NaN;
}

function coordFmtNum(n) {
  if (!Number.isFinite(n)) return "?";
  if (Math.abs(n) < 1e-12) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return (Math.round(n * 1000) / 1000).toString();
}

function coordFmtBase(base) {
  if (base === Math.E || base === "e" || base === "E") return "e";
  const n = Number(base);
  if (Number.isFinite(n)) return coordFmtNum(n);
  return String(base);
}

function coordSignedJoin(hasPrev, coef, body) {
  if (!hasPrev) return (coef < 0 ? "−" : "") + body;
  return (coef < 0 ? " − " : " + ") + body;
}

/** Visible curve-label string (custom text, or the algebraic/numeric formula). */
export function coordCurveLabelText(curve, plot) {
  const lab = curve && curve.label;
  if (!lab || !lab.show) return "";
  const custom =
    lab.customText != null && String(lab.customText) !== ""
      ? String(lab.customText)
      : lab.text != null
        ? String(lab.text)
        : "";
  if (lab.kind === "formula") return coordCurveFormulaText(curve, lab.formulaMode, plot);
  if (lab.kind === "custom" || custom.trim() !== "") return custom.trim();
  return coordCurveFormulaText(curve, lab.formulaMode, plot);
}

function coordCurveFormulaText(curve, mode, optPlot) {
  const p = curve.params || {};
  const type = curve.type || "line";
  const alg = mode !== "numeric";
  if (type === "vline") {
    if (alg) return "x = k";
    return "x = " + coordFmtNum(p.x ?? 0);
  }
  if (type === "line") {
    if (alg) return "y = mx+c";
    const m = p.m ?? 1;
    const c = p.c ?? 0;
    let s = "y = ";
    if (Math.abs(m) < 1e-12) s += (c < 0 ? "−" : "") + coordFmtNum(Math.abs(c));
    else {
      if (Math.abs(m - 1) < 1e-12) s += "x";
      else if (Math.abs(m + 1) < 1e-12) s += "−x";
      else s += (m < 0 ? "−" : "") + coordFmtNum(Math.abs(m)) + "x";
      if (Math.abs(c) >= 1e-12) s += coordSignedJoin(true, c, coordFmtNum(Math.abs(c)));
    }
    return s;
  }
  if (type === "quad") {
    if (alg) return "y = ax²+bx+c";
    const a = p.a ?? 1;
    const b = p.b ?? 0;
    const c = p.c ?? 0;
    const parts = [];
    if (Math.abs(a) >= 1e-12) {
      if (Math.abs(a - 1) < 1e-12) parts.push("x²");
      else if (Math.abs(a + 1) < 1e-12) parts.push("−x²");
      else parts.push((a < 0 ? "−" : "") + coordFmtNum(Math.abs(a)) + "x²");
    }
    if (Math.abs(b) >= 1e-12) {
      const abs = Math.abs(b);
      const body = abs === 1 ? "x" : coordFmtNum(abs) + "x";
      parts.push(coordSignedJoin(parts.length > 0, b, body));
    }
    if (Math.abs(c) >= 1e-12 || !parts.length) {
      parts.push(coordSignedJoin(parts.length > 0, c, coordFmtNum(Math.abs(c))));
    }
    return "y = " + parts.join("");
  }
  if (type === "log" || type === "log10") {
    if (alg) return "y = a·log_b(x)";
    const a = p.a ?? 1;
    const base = type === "log10" ? 10 : coordLogBase(p);
    const bs = coordFmtBase(base);
    let head = "y = ";
    if (Math.abs(a - 1) < 1e-12) head += "log";
    else if (Math.abs(a + 1) < 1e-12) head += "−log";
    else head += coordFmtNum(a) + "log";
    return head + (bs === "10" ? "₁₀" : "₍" + bs + "₎") + "(x)";
  }
  if (type === "ln") {
    if (alg) return "y = a·ln(x)";
    const a = p.a ?? 1;
    if (Math.abs(a - 1) < 1e-12) return "y = ln(x)";
    if (Math.abs(a + 1) < 1e-12) return "y = −ln(x)";
    return "y = " + coordFmtNum(a) + "ln(x)";
  }
  if (type === "exp") {
    if (alg) return "y = a·bˣ";
    const a = p.a ?? 1;
    const b = p.b ?? Math.E;
    const bs = b === Math.E ? "e" : coordFmtNum(b);
    let head = "y = ";
    if (Math.abs(a - 1) < 1e-12) head += "";
    else if (Math.abs(a + 1) < 1e-12) head += "−";
    else head += coordFmtNum(a) + "·";
    return head + bs + "ˣ";
  }
  if (type === "circle") {
    const form =
      p.circleForm === "center" ? "center" : p.circleForm === "standard" ? "standard" : "general";
    if (alg) {
      if (form === "center") return "centre (h,k), r";
      if (form === "standard") return "(x−h)²+(y−k)²=r²";
      return "x²+y²+Dx+Ey+F=0";
    }
    const h = p.h ?? 0;
    const k = p.k ?? 0;
    const r = coordCircleRadius(p);
    const r2 = Number.isFinite(Number(p.r2)) ? Number(p.r2) : r * r;
    if (form === "center") {
      return "centre (" + coordFmtNum(h) + "," + coordFmtNum(k) + "), r=" + coordFmtNum(r);
    }
    if (form === "standard") {
      const hx = Math.abs(h) < 1e-12 ? "x" : "x" + (h < 0 ? "+" : "−") + coordFmtNum(Math.abs(h));
      const ky = Math.abs(k) < 1e-12 ? "y" : "y" + (k < 0 ? "+" : "−") + coordFmtNum(Math.abs(k));
      return "(" + hx + ")²+(" + ky + ")²=" + coordFmtNum(Math.abs(r2));
    }
    const D = Number.isFinite(Number(p.D)) ? Number(p.D) : -2 * h;
    const E = Number.isFinite(Number(p.E)) ? Number(p.E) : -2 * k;
    const F = Number.isFinite(Number(p.F)) ? Number(p.F) : h * h + k * k - r2;
    let s = "x²+y²";
    if (Math.abs(D) >= 1e-12) s += coordSignedJoin(true, D, coordFmtNum(Math.abs(D)) + "x");
    if (Math.abs(E) >= 1e-12) s += coordSignedJoin(true, E, coordFmtNum(Math.abs(E)) + "y");
    if (Math.abs(F) >= 1e-12) s += coordSignedJoin(true, F, coordFmtNum(Math.abs(F)));
    return s + " = 0";
  }
  if (type === "sin" || type === "cos" || type === "tan") {
    const fn = type;
    const A = p.A ?? 1;
    const B = p.B ?? 1;
    const C = p.C ?? 0;
    const D = p.D ?? 0;
    const deg = !!optPlot && optPlot.xAngleUnit === "deg";
    if (alg) {
      if (type === "tan") return deg ? "y = A tan((Bx)°)" : "y = A tan(Bx)";
      return deg ? "y = A " + fn + "((Bx+C)°)+D" : "y = A " + fn + "(Bx+C)+D";
    }
    let s = "y = ";
    const absA = Math.abs(A);
    if (A < 0) s += "−";
    if (absA !== 1) s += coordFmtNum(absA);
    s += fn + "(";
    let arg = "";
    if (Math.abs(B - 1) < 1e-12) arg += "x";
    else if (Math.abs(B + 1) < 1e-12) arg += "−x";
    else arg += (B < 0 ? "−" : "") + coordFmtNum(Math.abs(B)) + "x";
    if (type !== "tan" && Math.abs(C) >= 1e-12) {
      arg += coordSignedJoin(true, C, coordFmtNum(Math.abs(C)));
    }
    s += deg ? "(" + arg + ")°" : arg;
    s += ")";
    if (type !== "tan" && Math.abs(D) >= 1e-12) {
      s += coordSignedJoin(true, D, coordFmtNum(Math.abs(D)));
    }
    return s;
  }
  return "";
}

export function coordSampleOneCurve(plot, curve) {
  const type = curve.type || "none";
  if (!type || type === "none") return [];
  const pts = [];
  const dom = coordCurveDomain(curve);
  if (type === "circle") {
    const p = curve.params || {};
    const h = p.h ?? 0;
    const k = p.k ?? 0;
    const r = coordCircleRadius(p);
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const u = h + r * Math.cos(ang);
      const v = k + r * Math.sin(ang);
      const outsideDom = dom && (u < dom[0] - 1e-9 || u > dom[1] + 1e-9);
      if (outsideDom || u < plot.xmin || u > plot.xmax || v < plot.ymin || v > plot.ymax) {
        pts.push(null);
      } else {
        pts.push(coordWorldFromAxis(plot, u, v));
      }
    }
    return pts;
  }
  if (type === "vline") {
    const x = Number((curve.params || {}).x);
    if (!Number.isFinite(x)) return pts;
    if (dom && (x < dom[0] - 1e-9 || x > dom[1] + 1e-9)) return pts;
    if (x < plot.xmin - 1e-9 || x > plot.xmax + 1e-9) return pts;
    return [coordWorldFromAxis(plot, x, plot.ymin), coordWorldFromAxis(plot, x, plot.ymax)];
  }
  const needsPosX = type === "log" || type === "log10" || type === "ln";
  const isTrig = type === "sin" || type === "cos" || type === "tan";
  const n = isTrig ? 280 : 160;
  let x0 = plot.xmin;
  let x1 = plot.xmax;
  if (dom) {
    x0 = Math.max(x0, dom[0]);
    x1 = Math.min(x1, dom[1]);
  }
  if (needsPosX) x0 = Math.max(x0, 1e-4);
  if (x1 <= x0) return pts;
  let prevV = null;
  for (let i = 0; i <= n; i++) {
    const u = x0 + ((x1 - x0) * i) / n;
    const v = coordEvalY(curve, u, plot);
    if (!Number.isFinite(v) || v < plot.ymin || v > plot.ymax) {
      pts.push(null);
      prevV = null;
      continue;
    }
    if (type === "tan" && prevV != null && Math.abs(v - prevV) > (plot.ymax - plot.ymin) * 0.85) {
      pts.push(null);
    }
    pts.push(coordWorldFromAxis(plot, u, v));
    prevV = v;
  }
  return pts;
}

function curveFrameAt(pts, idx) {
  const i0 = Math.max(0, idx - 1);
  const i1 = Math.min(pts.length - 1, idx + 1);
  let tx = pts[i1].x - pts[i0].x;
  let ty = pts[i1].y - pts[i0].y;
  const len = Math.hypot(tx, ty) || 1;
  tx /= len;
  ty /= len;
  let nx = -ty;
  let ny = tx;
  if (ny > 0 || (Math.abs(ny) < 1e-9 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

function otherCurveSamples(plot, curve) {
  const out = [];
  for (const other of plot.curves || []) {
    if (!other || other === curve) continue;
    if (other.id && curve.id && other.id === curve.id) continue;
    for (const p of coordSampleOneCurve(plot, other)) {
      if (p) out.push(p);
    }
  }
  return out;
}

/**
 * Only a real number is an explicit fraction along the curve.
 * Omitted t, a blank, and "auto" must not inherit the historical 0.55 default.
 */
export function curveLabelTExplicit(t) {
  if (t == null || t === "") return false;
  if (typeof t === "string" && t.trim().toLowerCase() === "auto") return false;
  return Number.isFinite(Number(t));
}

function labelInkBox(text, x, y) {
  const fs = 14;
  const w = Math.max(14, String(text || "").length * fs * 0.56);
  const h = fs;
  return { x0: x - w / 2, y0: y - h * 0.62, x1: x + w / 2, y1: y + h * 0.48 };
}

function distPointToBox(px, py, box) {
  const dx = Math.max(box.x0 - px, 0, px - box.x1);
  const dy = Math.max(box.y0 - py, 0, py - box.y1);
  return Math.hypot(dx, dy);
}

function distBoxToHLine(box, y) {
  if (y >= box.y0 && y <= box.y1) return 0;
  return Math.min(Math.abs(box.y0 - y), Math.abs(box.y1 - y));
}

function distBoxToVLine(box, x) {
  if (x >= box.x0 && x <= box.x1) return 0;
  return Math.min(Math.abs(box.x0 - x), Math.abs(box.x1 - x));
}

/**
 * Label anchor.
 * An explicit numeric label.t keeps the historical normal offset at that fraction.
 * Omitted t and t:"auto" sample the visible window, then step along the normal
 * until the label box clears the x-axis (|v|≈0), the y-axis (|u|≈0), every
 * curve, and curve intersections. A stored default of 0.55 is not invented here.
 */
export function curveLabelWorld(plot, curve) {
  const text = coordCurveLabelText(curve, plot);
  if (!text) return null;
  const lab = curve.label || {};
  const pts = coordSampleOneCurve(plot, curve).filter(Boolean);
  const explicitT = curveLabelTExplicit(lab.t);
  const nn = Number.isFinite(Number(lab.n)) ? Number(lab.n) : 0.55;
  const scales = coordAxisScales(plot);
  const unit = scales.unitPx;
  if (!pts.length) {
    const fb = coordWorldFromAxis(
      plot,
      ((plot.xmin ?? 0) + (plot.xmax ?? 0)) * 0.55,
      ((plot.ymin ?? 0) + (plot.ymax ?? 0)) * 0.5
    );
    return { text, x: fb.x, y: fb.y - nn * unit };
  }
  const off = nn * unit;
  if (!explicitT) {
    const others = otherCurveSamples(plot, curve);
    const all = pts.concat(others);
    const hitTol = Math.max(8, unit * 0.22);
    const hits = [];
    if (others.length) {
      for (const p of pts) {
        let near = null;
        let best = hitTol;
        for (const q of others) {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d <= best) {
            best = d;
            near = q;
          }
        }
        if (near) hits.push({ x: (p.x + near.x) / 2, y: (p.y + near.y) / 2 });
      }
    }
    const gap = Math.max(6, unit * 0.16);
    let best = null;
    let bestScore = -Infinity;
    let fallback = null;
    let fallbackScore = -Infinity;
    const scalesNow = coordAxisScales(plot);
    for (let i = 2; i < pts.length - 2; i += Math.max(1, Math.round(pts.length / 28))) {
      const fr = curveFrameAt(pts, i);
      for (const sign of [1, -1]) {
        for (const grow of [1, 1.45, 1.9, 2.5, 3.2]) {
          const dist = Math.abs(off) * grow;
          const x = pts[i].x + fr.nx * dist * sign;
          const y = pts[i].y + fr.ny * dist * sign;
          const box = labelInkBox(text, x, y);
          const axisX = distBoxToHLine(box, plot.oy);
          const axisY = distBoxToVLine(box, plot.ox);
          const axis = Math.min(axisX, axisY);
          let curveClear = Infinity;
          for (const q of all) curveClear = Math.min(curveClear, distPointToBox(q.x, q.y, box));
          let hitClear = Infinity;
          for (const h of hits) hitClear = Math.min(hitClear, distPointToBox(h.x, h.y, box));
          const uv = {
            u: (x - plot.ox) / scalesNow.xUnitPx,
            v: (plot.oy - y) / scalesNow.yUnitPx,
          };
          const inside =
            uv.u >= plot.xmin - 0.35 &&
            uv.u <= plot.xmax + 0.35 &&
            uv.v >= plot.ymin - 0.35 &&
            uv.v <= plot.ymax + 0.35;
          const clear = Math.min(axis, curveClear, hitClear);
          const score = clear - grow * 4 + (inside ? 8 : 0);
          if (score > fallbackScore) {
            fallbackScore = score;
            fallback = { x, y };
          }
          if (axis < gap || curveClear < gap || hitClear < gap) continue;
          if (Math.abs(uv.u) < 0.2 || Math.abs(uv.v) < 0.2) continue;
          if (score > bestScore) {
            bestScore = score;
            best = { x, y };
          }
        }
      }
    }
    const pick = best || fallback || pts[Math.round(0.5 * (pts.length - 1))];
    return { text, x: pick.x, y: pick.y };
  }
  const tt = Math.min(1, Math.max(0, Number(lab.t)));
  const idx = Math.min(pts.length - 1, Math.round(tt * (pts.length - 1)));
  const p = pts[idx];
  const fr = curveFrameAt(pts, idx);
  return { text, x: p.x + fr.nx * off, y: p.y + fr.ny * off };
}

function curveDataAttrs(el) {
  if (!el || typeof el !== "object") return "";
  const parts = [];
  if (el.id != null && String(el.id) !== "") parts.push(`data-id="${escapeXml(el.id)}"`);
  if (el.role === "solution") parts.push('data-role="solution"');
  const step = Number(el.solutionStep);
  if (Number.isInteger(step) && step > 0) parts.push(`data-step="${step}"`);
  return parts.length ? " " + parts.join(" ") : "";
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgOpenArrow(tipX, tipY, ang, size, lw) {
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.82;
  const x1 = tipX + Math.cos(a1) * size;
  const y1 = tipY + Math.sin(a1) * size;
  const x2 = tipX + Math.cos(a2) * size;
  const y2 = tipY + Math.sin(a2) * size;
  return `<path d="M${tipX.toFixed(2)},${tipY.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} M${tipX.toFixed(2)},${tipY.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" fill="none" />\n`;
}

function curveDashAttr(style, lw) {
  const w = Number(lw) || 1.2;
  if (style === "dashed") {
    return ` stroke-dasharray="${(w * 4).toFixed(2)} ${(w * 2.6).toFixed(2)}" stroke-linecap="butt"`;
  }
  if (style === "dotted") {
    return ` stroke-dasharray="${(w * 0.55).toFixed(2)} ${(w * 1.5).toFixed(2)}" stroke-linecap="butt"`;
  }
  return ` stroke-linecap="round"`;
}

/**
 * SVG markup for one coord plot in the same userUnit space as documentToSvg's toS.
 * @param {object} plot
 * @param {(x:number,y:number)=>{x:number,y:number}} toS
 * @param {{ stroke?: number, fontPx?: number, markStroke?: number }} inkish
 */
export function svgCoordPlot(plot, toS, inkish = {}) {
  if (!plot) return "";
  const lw = (inkish.stroke != null ? inkish.stroke : 1.2).toFixed(2);
  const fontPx = (inkish.fontPx != null ? inkish.fontPx : 12).toFixed(1);
  const scales = coordAxisScales(plot);
  const ox = num(plot.ox, 0);
  const oy = num(plot.oy, 0);
  const xmin = num(plot.xmin, -2);
  const xmax = num(plot.xmax, 6);
  const ymin = num(plot.ymin, -2);
  const ymax = num(plot.ymax, 6);

  const o = toS(ox, oy);
  const oh = coordAxisOverhangPx(plot);
  const xNeg = toS(ox + xmin * scales.xUnitPx - oh.neg, oy);
  const xPos = toS(ox + xmax * scales.xUnitPx + oh.pos, oy);
  const yNeg = toS(ox, oy - ymin * scales.yUnitPx + oh.neg);
  const yPos = toS(ox, oy - ymax * scales.yUnitPx - oh.pos);

  let body = "";
  body += `<line x1="${xNeg.x.toFixed(2)}" y1="${xNeg.y.toFixed(2)}" x2="${xPos.x.toFixed(2)}" y2="${xPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
  body += `<line x1="${yNeg.x.toFixed(2)}" y1="${yNeg.y.toFixed(2)}" x2="${yPos.x.toFixed(2)}" y2="${yPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;

  const arrow = Math.max(7, Number(lw) * 3.2);
  body += svgOpenArrow(
    xPos.x,
    xPos.y,
    Math.atan2(xPos.y - o.y, xPos.x - o.x),
    arrow,
    lw
  );
  body += svgOpenArrow(
    yPos.x,
    yPos.y,
    Math.atan2(yPos.y - o.y, yPos.x - o.x),
    arrow,
    lw
  );

  const tickLen = Math.max(4, Number(lw) * 2.2);
  const showDefault = plot.showTicks !== false && plot.showTickLabels !== false;
  const fam =
    'font-family="STIX Two Text, Times New Roman, serif" font-style="italic"';
  const famUpright =
    'font-family="STIX Two Text, Times New Roman, serif" font-style="normal"';
  const fsNum = Number(fontPx);
  const halo = Math.max(3.5, fsNum * 0.28).toFixed(2);
  const haloAttrs = `fill="#111" stroke="#ffffff" stroke-width="${halo}" stroke-linejoin="round" paint-order="stroke fill"`;

  const fontAttrFor = (rich) => (rich.math ? famUpright : fam);

  const xExplicit = normalizeCoordTicks(plot.xTicks);
  const yExplicit = normalizeCoordTicks(plot.yTicks);

  if (xExplicit) {
    for (const t of xExplicit) {
      const p = toS(ox + t.pos * scales.xUnitPx, oy);
      body += `<line x1="${p.x.toFixed(2)}" y1="${(p.y - tickLen).toFixed(2)}" x2="${p.x.toFixed(2)}" y2="${(p.y + tickLen).toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      const label = coordTickText(t);
      if (label && !coordOriginZeroLabelSuppressed(plot, t.pos, label)) {
        const rich = svgTextInner(label, true);
        body += `<text x="${p.x.toFixed(2)}" y="${(p.y + tickLen + 1).toFixed(2)}" ${haloAttrs} ${fontAttrFor(rich)} font-size="${fontPx}" text-anchor="middle" dominant-baseline="hanging">${rich.inner}</text>\n`;
      }
    }
  } else if (showDefault) {
    for (const u of coordIntegerTicks(xmin, xmax, plot.xStep)) {
      const p = toS(ox + u * scales.xUnitPx, oy);
      body += `<line x1="${p.x.toFixed(2)}" y1="${(p.y - tickLen).toFixed(2)}" x2="${p.x.toFixed(2)}" y2="${(p.y + tickLen).toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      if (!coordNearZero(u)) {
        body += `<text x="${p.x.toFixed(2)}" y="${(p.y + tickLen + 1).toFixed(2)}" ${haloAttrs} ${fam} font-size="${fontPx}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(String(u))}</text>\n`;
      }
    }
  }
  if (yExplicit) {
    for (const t of yExplicit) {
      const p = toS(ox, oy - t.pos * scales.yUnitPx);
      body += `<line x1="${(p.x - tickLen).toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${(p.x + tickLen).toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      const label = coordTickText(t);
      if (label && !coordOriginZeroLabelSuppressed(plot, t.pos, label)) {
        const rich = svgTextInner(label, true);
        body += `<text x="${(p.x - tickLen - 2).toFixed(2)}" y="${p.y.toFixed(2)}" ${haloAttrs} ${fontAttrFor(rich)} font-size="${fontPx}" text-anchor="end" dominant-baseline="middle">${rich.inner}</text>\n`;
      }
    }
  } else if (showDefault) {
    for (const v of coordIntegerTicks(ymin, ymax, plot.yStep)) {
      const p = toS(ox, oy - v * scales.yUnitPx);
      body += `<line x1="${(p.x - tickLen).toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${(p.x + tickLen).toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      if (!coordNearZero(v)) {
        body += `<text x="${(p.x - tickLen - 2).toFixed(2)}" y="${p.y.toFixed(2)}" ${haloAttrs} ${fam} font-size="${fontPx}" text-anchor="end" dominant-baseline="middle">${escapeXml(String(v))}</text>\n`;
      }
    }
  }

  if (plot.showOrigin !== false) {
    body += `<text x="${(o.x - 4).toFixed(2)}" y="${(o.y + 3).toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="end" dominant-baseline="hanging">O</text>\n`;
  }

  const lx = String(plot.axisLabelX != null ? plot.axisLabelX : "x").trim();
  const ly = String(plot.axisLabelY != null ? plot.axisLabelY : "y").trim();
  if (lx) {
    const rich = svgTextInner(lx, true);
    body += `<text x="${(xPos.x + 4).toFixed(2)}" y="${(xPos.y + 2).toFixed(2)}" fill="#111" ${fontAttrFor(rich)} font-size="${fontPx}" text-anchor="start" dominant-baseline="hanging">${rich.inner}</text>\n`;
  }
  if (ly) {
    const rich = svgTextInner(ly, true);
    body += `<text x="${(yPos.x + 4).toFixed(2)}" y="${(yPos.y - 2).toFixed(2)}" fill="#111" ${fontAttrFor(rich)} font-size="${fontPx}" text-anchor="start" dominant-baseline="auto">${rich.inner}</text>\n`;
  }

  const curves = Array.isArray(plot.curves) ? plot.curves : [];
  const samplePlot = {
    ...plot,
    ox,
    oy,
    unitPx: scales.unitPx,
    xUnitPx: scales.xUnitPx,
    yUnitPx: scales.yUnitPx,
    xmin,
    xmax,
    ymin,
    ymax,
  };
  for (const curve of curves) {
    let d = "";
    let pen = false;
    for (const pt of coordSampleOneCurve(samplePlot, curve)) {
      if (!pt) {
        pen = false;
        continue;
      }
      const s = toS(pt.x, pt.y);
      if (!pen) {
        d += `M${s.x.toFixed(2)},${s.y.toFixed(2)}`;
        pen = true;
      } else d += `L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
    }
    if (d) {
      const dash = curveDashAttr(coordCurveStyle(curve), lw);
      const stroke = escapeXml(coordCurveInk(curve, "paper"));
      body += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${lw}" stroke-linejoin="round"${dash}${curveDataAttrs(curve)} />\n`;
    }
  }
  for (const curve of curves) {
    const lab = curveLabelWorld(samplePlot, curve);
    if (!lab) continue;
    const sp = toS(lab.x, lab.y);
    const rich = svgTextInner(lab.text, true);
    const fs = Number(fontPx);
    const labHalo = Math.max(3.5, fs * 0.28).toFixed(2);
    const labInk = escapeXml(coordCurveInk(curve, "paper"));
    body += `<text x="${sp.x.toFixed(2)}" y="${sp.y.toFixed(2)}" fill="${labInk}" stroke="#ffffff" stroke-width="${labHalo}" stroke-linejoin="round" paint-order="stroke fill" ${fontAttrFor(rich)} font-size="${fontPx}" text-anchor="middle" dominant-baseline="middle"${curveDataAttrs(curve)}>${rich.inner}</text>\n`;
  }
  return body;
}
