/**
 * Box-and-whisker plot helpers (dedicated op — not assembled from rects/segments).
 * Horizontal (default) or vertical; axis tick positions are caller-supplied only.
 */

import { approxTextWidth } from "./length-mark.mjs";

/** documentToSvg defaults: 54×40mm frame, 8pt labels, pad 24 at scale 2. */
const EXPORT_FRAME_W_MM = 54;
const EXPORT_FRAME_H_MM = 40;
const EXPORT_LABEL_PT = 8;
const PT_TO_MM = 25.4 / 72;
const EXPORT_PAD_BOTH = 24;
const EXPORT_MIN_WORLD = 20;

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function finiteNums(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Normalize ticks: bare numbers stay ticks-only; objects accept
 * `{ pos, label? }` or `{ x|y, label? }` (label drawn outside the mark).
 * @param {unknown} raw
 * @returns {Array<number|{pos:number,label?:string}>}
 */
export function normalizeBoxWhiskerTicks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (t != null && typeof t === "object" && !Array.isArray(t)) {
      const pos = Number(
        t.pos != null ? t.pos : t.x != null ? t.x : t.y != null ? t.y : NaN
      );
      if (!Number.isFinite(pos)) continue;
      if (t.label != null && String(t.label) !== "") {
        out.push({ pos, label: String(t.label) });
      } else {
        out.push(pos);
      }
      continue;
    }
    const n = Number(t);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** @param {number|{pos:number,label?:string}} t */
export function boxWhiskerTickPos(t) {
  return typeof t === "object" && t != null ? Number(t.pos) : Number(t);
}

/** @param {number|{pos:number,label?:string}} t */
export function boxWhiskerTickLabel(t) {
  if (typeof t === "object" && t != null && t.label != null && String(t.label) !== "") {
    return String(t.label);
  }
  return null;
}

/**
 * axisLabel, or the aliases xLabel then yLabel. Blank string means no label.
 * @param {Record<string, unknown>|null|undefined} raw
 */
/**
 * Half-length of an end cap (center to tip).
 * `cap` is that half-length (existing callers).
 * `capHeight` is the full cap. Omit both → full height 0.55 × boxH.
 * @param {Record<string, unknown>} raw
 * @param {number} boxHeight
 */
export function resolveCapHalf(raw, boxHeight) {
  const h = Math.max(4, Number(boxHeight) || 36);
  // showCaps:false wins even when capHeight is positive.
  if (raw && raw.showCaps === false) return 0;
  if (raw && raw.capHeight != null && raw.capHeight !== "" && Number.isFinite(Number(raw.capHeight))) {
    const full = Number(raw.capHeight);
    // 0 is explicit: do not fall back to 0.55 × boxH, and do not keep the 0.5 floor.
    if (!(full > 0)) return 0;
    return Math.max(0.5, full / 2);
  }
  if (raw && raw.cap != null && raw.cap !== "" && Number.isFinite(Number(raw.cap))) {
    return Math.max(2, Number(raw.cap));
  }
  return Math.max(0.5, (0.55 * h) / 2);
}

function readAxisArrows(raw) {
  const v = raw && raw.axisArrows != null ? String(raw.axisArrows).trim().toLowerCase() : "both";
  if (v === "right" || v === "none" || v === "both") return v;
  return "both";
}

function readGuideStyle(raw) {
  const v = raw && raw.guideStyle != null ? String(raw.guideStyle).trim().toLowerCase() : "dashed";
  if (v === "dotted" || v === "solid" || v === "none" || v === "dashed") return v;
  return "dashed";
}

function numberLineEnds(bw) {
  const ticks = (bw.ticks || []).map(boxWhiskerTickPos).filter((n) => Number.isFinite(n));
  const data = [bw.min, bw.max, ...(bw.outliers || []), ...ticks].filter((n) => Number.isFinite(n));
  let lo = Math.min(...data);
  let hi = Math.max(...data);
  if (bw.axisMin != null && Number.isFinite(Number(bw.axisMin))) lo = Number(bw.axisMin);
  if (bw.axisMax != null && Number.isFinite(Number(bw.axisMax))) hi = Number(bw.axisMax);
  if (!(hi > lo)) hi = lo + Math.max(1, bw.boxHeight || 1);
  return { lo, hi };
}

const BOX_ARROW = 8;

function arrowWings(x, y, dx, dy, size = BOX_ARROW) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const bx = x - ux * size;
  const by = y - uy * size;
  const half = size * 0.42;
  return [
    { x1: x, y1: y, x2: bx + px * half, y2: by + py * half },
    { x1: x, y1: y, x2: bx - px * half, y2: by - py * half },
  ];
}

export function readBoxAxisLabel(raw) {
  if (!raw || typeof raw !== "object") return "";
  for (const key of ["axisLabel", "xLabel", "yLabel"]) {
    if (raw[key] == null) continue;
    const s = String(raw[key]).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Normalize / validate a box-whisker record for persist + render.
 * @param {Record<string, unknown>} raw
 * @param {{ requireId?: boolean }} [opts]
 * @returns {object}
 */
export function normalizeBoxWhisker(raw, opts = {}) {
  if (!raw || typeof raw !== "object") {
    throw new Error("boxWhisker: must be an object");
  }
  const orientation =
    raw.orientation === "v" || raw.orientation === "vertical" ? "v" : "h";
  const min = num(raw.min, NaN);
  const q1 = num(raw.q1, NaN);
  const median = num(raw.median, NaN);
  const q3 = num(raw.q3, NaN);
  const max = num(raw.max, NaN);
  for (const [k, v] of [
    ["min", min],
    ["q1", q1],
    ["median", median],
    ["q3", q3],
    ["max", max],
  ]) {
    if (!Number.isFinite(v)) throw new Error(`boxWhisker: ${k} must be finite`);
  }
  if (!(min <= q1 && q1 <= median && median <= q3 && q3 <= max)) {
    throw new Error("boxWhisker: require min≤q1≤median≤q3≤max");
  }
  const boxHeight = Math.max(4, num(raw.boxHeight, 36));
  const cap = resolveCapHalf(raw, boxHeight);
  const outliers = finiteNums(raw.outliers);
  const ticks = normalizeBoxWhiskerTicks(raw.ticks);
  const showAxis =
    raw.showAxis != null ? !!raw.showAxis : ticks.length > 0;
  const axisLabel = readBoxAxisLabel(raw);

  /** @type {Record<string, unknown>} */
  const out = {
    orientation,
    min,
    q1,
    median,
    q3,
    max,
    outliers,
    ticks,
    boxHeight,
    cap,
    showAxis,
  };
  if (axisLabel) out.axisLabel = axisLabel;
  if (raw.axisMin != null && Number.isFinite(Number(raw.axisMin))) out.axisMin = Number(raw.axisMin);
  if (raw.axisMax != null && Number.isFinite(Number(raw.axisMax))) out.axisMax = Number(raw.axisMax);
  if (raw.capHeight != null && Number.isFinite(Number(raw.capHeight))) {
    out.capHeight = Number(raw.capHeight);
  }
  if (raw.showCaps === false) out.showCaps = false;
  const axisArrows = readAxisArrows(raw);
  if (raw.axisArrows != null && raw.axisArrows !== "") out.axisArrows = axisArrows;
  const guideStyle = readGuideStyle(raw);
  if (raw.guideStyle != null && raw.guideStyle !== "") out.guideStyle = guideStyle;
  if (opts.requireId !== false) {
    if (typeof raw.id !== "string" || !raw.id) {
      throw new Error("boxWhisker: id required");
    }
    out.id = raw.id;
  } else if (typeof raw.id === "string" && raw.id) {
    out.id = raw.id;
  }

  if (orientation === "v") {
    const x = num(raw.x, NaN);
    if (!Number.isFinite(x)) throw new Error("boxWhisker: x required for vertical");
    out.x = x;
    if (raw.axisX != null && Number.isFinite(Number(raw.axisX))) {
      out.axisX = Number(raw.axisX);
    }
  } else {
    const y = num(raw.y, NaN);
    if (!Number.isFinite(y)) throw new Error("boxWhisker: y required for horizontal");
    out.y = y;
    if (raw.axisY != null && Number.isFinite(Number(raw.axisY))) {
      out.axisY = Number(raw.axisY);
    }
  }
  return out;
}

/**
 * World-space stroke/fill primitives for rendering.
 * @param {object} bw normalized box-whisker
 * @returns {{
 *   box: {x:number,y:number,w:number,h:number},
 *   median: {x1:number,y1:number,x2:number,y2:number},
 *   whiskers: {x1:number,y1:number,x2:number,y2:number}[],
 *   caps: {x1:number,y1:number,x2:number,y2:number}[],
 *   outliers: {x:number,y:number}[],
 *   axis: {x1:number,y1:number,x2:number,y2:number}|null,
 *   tickMarks: {x1:number,y1:number,x2:number,y2:number}[],
 *   tickLabels: {x:number,y:number,text:string,anchor:string,baseline:string}[],
 *   axisLabel: {x:number,y:number,text:string,anchor:string,baseline:string}|null,
 * }}
 */
function attachBoxAxisLabel(bw, axis) {
  const text = bw.axisLabel != null ? String(bw.axisLabel).trim() : "";
  if (!text) return { axis, axisLabel: null };
  const h = bw.boxHeight;
  const half = h / 2;
  let ax = axis;
  if (!ax) {
    const ends = numberLineEnds(bw);
    if (bw.orientation === "v") {
      const axisX =
        bw.axisX != null ? bw.axisX : bw.x + half + Math.max(10, h * 0.35);
      ax = { x1: axisX, y1: ends.lo, x2: axisX, y2: ends.hi };
    } else {
      const axisY =
        bw.axisY != null ? bw.axisY : bw.y + half + Math.max(10, h * 0.35);
      ax = { x1: ends.lo, y1: axisY, x2: ends.hi, y2: axisY };
    }
  }
  if (bw.orientation === "v") {
    const top = Math.min(ax.y1, ax.y2);
    return {
      axis: ax,
      axisLabel: {
        x: ax.x1,
        y: top - BOX_ARROW - 6,
        text,
        anchor: "middle",
        baseline: "auto",
      },
    };
  }
  const left = Math.min(ax.x1, ax.x2);
  const right = Math.max(ax.x1, ax.x2);
  const y = ax.y1;
  return {
    axis: { x1: left, y1: y, x2: right, y2: y },
    axisLabel: {
      x: right + BOX_ARROW + 6,
      y,
      text,
      anchor: "start",
      baseline: "middle",
    },
  };
}

function axisArrowList(mode, start, end) {
  if (mode === "none") return [];
  const arrows = [];
  if (mode !== "right") arrows.push(...arrowWings(start.x, start.y, start.dx, start.dy));
  arrows.push(...arrowWings(end.x, end.y, end.dx, end.dy));
  return arrows;
}

function pushDownGuide(guides, style, seg) {
  if (style === "none") return;
  guides.push({
    ...seg,
    guideStyle: style,
    dash: style === "dashed" || style === "dotted",
  });
}

function decorateHorizontalAxis(bw, axis, box) {
  if (!axis) return { arrows: [], guides: [] };
  const yAxis = axis.y1;
  const lo = Math.min(axis.x1, axis.x2);
  const hi = Math.max(axis.x1, axis.x2);
  const mode = readAxisArrows(bw);
  const arrows = axisArrowList(
    mode,
    { x: lo, y: yAxis, dx: -1, dy: 0 },
    { x: hi, y: yAxis, dx: 1, dy: 0 }
  );
  const boxTop = Math.min(box.y, box.y + box.h);
  const boxBottom = Math.max(box.y, box.y + box.h);
  const marks = [
    { x: bw.min, y0: bw.y + bw.cap },
    { x: bw.q1, y0: boxBottom },
    { x: bw.median, y0: boxBottom },
    { x: bw.q3, y0: boxBottom },
    { x: bw.max, y0: bw.y + bw.cap },
  ];
  const guides = [];
  const style = readGuideStyle(bw);
  for (const m of marks) {
    const y1 = Math.max(m.y0, boxTop);
    // Only downward (increasing y) to the number line.
    if (yAxis > y1 + 0.5) pushDownGuide(guides, style, { x1: m.x, y1, x2: m.x, y2: yAxis });
  }
  return { arrows, guides };
}

function decorateVerticalAxis(bw, axis, box) {
  if (!axis) return { arrows: [], guides: [] };
  const xAxis = axis.x1;
  const lo = Math.min(axis.y1, axis.y2);
  const hi = Math.max(axis.y1, axis.y2);
  const mode = readAxisArrows(bw);
  const arrows = axisArrowList(
    mode,
    { x: xAxis, y: lo, dx: 0, dy: -1 },
    { x: xAxis, y: hi, dx: 0, dy: 1 }
  );
  const boxLeft = Math.min(box.x, box.x + box.w);
  const boxRight = Math.max(box.x, box.x + box.w);
  const towardRight = xAxis >= (boxLeft + boxRight) / 2;
  const marks = [
    { y: bw.min, x0: towardRight ? bw.x + bw.cap : bw.x - bw.cap },
    { y: bw.q1, x0: towardRight ? boxRight : boxLeft },
    { y: bw.median, x0: towardRight ? boxRight : boxLeft },
    { y: bw.q3, x0: towardRight ? boxRight : boxLeft },
    { y: bw.max, x0: towardRight ? bw.x + bw.cap : bw.x - bw.cap },
  ];
  const guides = [];
  const style = readGuideStyle(bw);
  for (const m of marks) {
    if (towardRight && xAxis > m.x0 + 0.5 && m.x0 >= boxLeft - 1e-6) {
      pushDownGuide(guides, style, { x1: m.x0, y1: m.y, x2: xAxis, y2: m.y });
    } else if (!towardRight && m.x0 > xAxis + 0.5 && m.x0 <= boxRight + 1e-6) {
      pushDownGuide(guides, style, { x1: m.x0, y1: m.y, x2: xAxis, y2: m.y });
    }
  }
  return { arrows, guides };
}

export function boxWhiskerParts(bw) {
  const h = bw.boxHeight;
  const half = h / 2;
  const cap = bw.cap;
  const tickLen = Math.max(3, h * 0.22);
  const labelGap = Math.max(3, tickLen * 0.55);

  if (bw.orientation === "v") {
    const x = bw.x;
    const box = {
      x: x - half,
      y: bw.q1,
      w: h,
      h: bw.q3 - bw.q1,
    };
    const median = { x1: x - half, y1: bw.median, x2: x + half, y2: bw.median };
    const whiskers = [
      { x1: x, y1: bw.min, x2: x, y2: bw.q1 },
      { x1: x, y1: bw.q3, x2: x, y2: bw.max },
    ];
    const caps =
      cap > 0
        ? [
            { x1: x - cap, y1: bw.min, x2: x + cap, y2: bw.min },
            { x1: x - cap, y1: bw.max, x2: x + cap, y2: bw.max },
          ]
        : [];
    const outliers = bw.outliers.map((v) => ({ x, y: v }));
    let axis = null;
    const tickMarks = [];
    const tickLabels = [];
    if (bw.showAxis && bw.ticks.length) {
      const axisX =
        bw.axisX != null ? bw.axisX : x + half + Math.max(10, h * 0.35);
      const ends = numberLineEnds(bw);
      axis = { x1: axisX, y1: ends.lo, x2: axisX, y2: ends.hi };
      for (const t of bw.ticks) {
        const ty = boxWhiskerTickPos(t);
        if (!Number.isFinite(ty)) continue;
        tickMarks.push({
          x1: axisX - tickLen / 2,
          y1: ty,
          x2: axisX + tickLen / 2,
          y2: ty,
        });
        const lab = boxWhiskerTickLabel(t);
        if (lab) {
          // Left of vertical axis
          tickLabels.push({
            x: axisX - tickLen / 2 - labelGap,
            y: ty,
            text: lab,
            anchor: "end",
            baseline: "middle",
          });
        }
      }
    }
    const labeled = attachBoxAxisLabel(bw, axis);
    const deco = decorateVerticalAxis(bw, labeled.axis, box);
    return {
      box,
      median,
      whiskers,
      caps,
      outliers,
      axis: labeled.axis,
      tickMarks,
      tickLabels,
      axisLabel: labeled.axisLabel,
      arrows: deco.arrows,
      guides: deco.guides,
    };
  }

  // Horizontal
  const y = bw.y;
  const box = {
    x: bw.q1,
    y: y - half,
    w: bw.q3 - bw.q1,
    h,
  };
  const median = { x1: bw.median, y1: y - half, x2: bw.median, y2: y + half };
  const whiskers = [
    { x1: bw.min, y1: y, x2: bw.q1, y2: y },
    { x1: bw.q3, y1: y, x2: bw.max, y2: y },
  ];
  const caps =
    cap > 0
      ? [
          { x1: bw.min, y1: y - cap, x2: bw.min, y2: y + cap },
          { x1: bw.max, y1: y - cap, x2: bw.max, y2: y + cap },
        ]
      : [];
  const outliers = bw.outliers.map((v) => ({ x: v, y }));
  let axis = null;
  const tickMarks = [];
  const tickLabels = [];
    if (bw.showAxis && bw.ticks.length) {
    const axisY =
      bw.axisY != null ? bw.axisY : y + half + Math.max(10, h * 0.35);
    const ends = numberLineEnds(bw);
    axis = { x1: ends.lo, y1: axisY, x2: ends.hi, y2: axisY };
    for (const t of bw.ticks) {
      const tx = boxWhiskerTickPos(t);
      if (!Number.isFinite(tx)) continue;
      tickMarks.push({
        x1: tx,
        y1: axisY - tickLen / 2,
        x2: tx,
        y2: axisY + tickLen / 2,
      });
      const lab = boxWhiskerTickLabel(t);
      if (lab) {
        // Below horizontal axis
        tickLabels.push({
          x: tx,
          y: axisY + tickLen / 2 + labelGap,
          text: lab,
          anchor: "middle",
          baseline: "hanging",
        });
      }
    }
  }
  const labeled = attachBoxAxisLabel(bw, axis);
  const deco = decorateHorizontalAxis(bw, labeled.axis, box);
  return {
    box,
    median,
    whiskers,
    caps,
    outliers,
    axis: labeled.axis,
    tickMarks,
    tickLabels,
    axisLabel: labeled.axisLabel,
    arrows: deco.arrows,
    guides: deco.guides,
  };
}

/** World-space font of an export tick (fontForSize 14) at the default frame. */
function boxExportFontWorld(worldW, worldH) {
  const uuPerWorld = Math.max(
    Math.max(1e-6, worldW) / EXPORT_FRAME_W_MM,
    Math.max(1e-6, worldH) / EXPORT_FRAME_H_MM
  );
  return (14 / 16) * EXPORT_LABEL_PT * PT_TO_MM * uuPerWorld;
}

/** Corners of the painted axis label, including halo slack so SVG does not clip it. */
function axisLabelCorners(label, font) {
  const tw = approxTextWidth(label.text, font) * 1.5;
  const th = Math.max(font * 1.45, 8);
  const anchor = label.anchor;
  const baseline = label.baseline;
  let x0;
  let x1;
  if (anchor === "start") {
    x0 = label.x;
    x1 = label.x + tw;
  } else if (anchor === "end") {
    x0 = label.x - tw;
    x1 = label.x;
  } else {
    x0 = label.x - tw / 2;
    x1 = label.x + tw / 2;
  }
  let y0;
  let y1;
  if (baseline === "hanging") {
    y0 = label.y;
    y1 = label.y + th;
  } else if (baseline === "middle") {
    y0 = label.y - th / 2;
    y1 = label.y + th / 2;
  } else {
    y0 = label.y - th;
    y1 = label.y + th * 0.35;
  }
  return { x0, y0, x1, y1 };
}

/** Expand world bounds to cover a box-whisker, including the full axisLabel. */
export function addBoxWhiskerBounds(bw, add) {
  const p = boxWhiskerParts(bw);
  const xs = [];
  const ys = [];
  const push = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    xs.push(x);
    ys.push(y);
  };
  push(p.box.x, p.box.y);
  push(p.box.x + p.box.w, p.box.y + p.box.h);
  for (const s of [...p.whiskers, ...p.caps, p.median, ...p.tickMarks, ...(p.guides || []), ...(p.arrows || [])]) {
    push(s.x1, s.y1);
    push(s.x2, s.y2);
  }
  if (p.axis) {
    push(p.axis.x1, p.axis.y1);
    push(p.axis.x2, p.axis.y2);
  }
  for (const t of p.tickLabels || []) push(t.x, t.y);
  for (const o of p.outliers) push(o.x, o.y);
  if (p.axisLabel && xs.length) {
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    let corners = axisLabelCorners(p.axisLabel, 12);
    for (let i = 0; i < 5; i++) {
      const worldW = Math.max(EXPORT_MIN_WORLD, Math.max(maxX, corners.x1) - Math.min(minX, corners.x0)) + EXPORT_PAD_BOTH;
      const worldH = Math.max(EXPORT_MIN_WORLD, Math.max(maxY, corners.y1) - Math.min(minY, corners.y0)) + EXPORT_PAD_BOTH;
      const span = Math.max(worldW, worldH);
      const factor = span > 420 ? Math.max(1, span / 340) : 1;
      corners = axisLabelCorners(p.axisLabel, boxExportFontWorld(worldW, worldH) * factor);
    }
    push(corners.x0, corners.y0);
    push(corners.x1, corners.y1);
  }
  for (let i = 0; i < xs.length; i++) add(xs[i], ys[i]);
}
