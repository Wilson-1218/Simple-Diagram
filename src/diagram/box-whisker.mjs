/**
 * Box-and-whisker plot helpers (dedicated op — not assembled from rects/segments).
 * Horizontal (default) or vertical; axis tick positions are caller-supplied only.
 */

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
  const cap = Math.max(2, num(raw.cap, boxHeight * 0.35));
  const outliers = finiteNums(raw.outliers);
  const ticks = finiteNums(raw.ticks);
  const showAxis =
    raw.showAxis != null ? !!raw.showAxis : ticks.length > 0;

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
 * }}
 */
export function boxWhiskerParts(bw) {
  const h = bw.boxHeight;
  const half = h / 2;
  const cap = bw.cap;
  const tickLen = Math.max(3, h * 0.22);

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
    const caps = [
      { x1: x - cap, y1: bw.min, x2: x + cap, y2: bw.min },
      { x1: x - cap, y1: bw.max, x2: x + cap, y2: bw.max },
    ];
    const outliers = bw.outliers.map((v) => ({ x, y: v }));
    let axis = null;
    const tickMarks = [];
    if (bw.showAxis && bw.ticks.length) {
      const axisX =
        bw.axisX != null ? bw.axisX : x + half + Math.max(10, h * 0.35);
      const ys = bw.ticks.slice().sort((a, b) => a - b);
      axis = { x1: axisX, y1: ys[0], x2: axisX, y2: ys[ys.length - 1] };
      for (const ty of bw.ticks) {
        tickMarks.push({
          x1: axisX - tickLen / 2,
          y1: ty,
          x2: axisX + tickLen / 2,
          y2: ty,
        });
      }
    }
    return { box, median, whiskers, caps, outliers, axis, tickMarks };
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
  const caps = [
    { x1: bw.min, y1: y - cap, x2: bw.min, y2: y + cap },
    { x1: bw.max, y1: y - cap, x2: bw.max, y2: y + cap },
  ];
  const outliers = bw.outliers.map((v) => ({ x: v, y }));
  let axis = null;
  const tickMarks = [];
  if (bw.showAxis && bw.ticks.length) {
    const axisY =
      bw.axisY != null ? bw.axisY : y + half + Math.max(10, h * 0.35);
    const xs = bw.ticks.slice().sort((a, b) => a - b);
    axis = { x1: xs[0], y1: axisY, x2: xs[xs.length - 1], y2: axisY };
    for (const tx of bw.ticks) {
      tickMarks.push({
        x1: tx,
        y1: axisY - tickLen / 2,
        x2: tx,
        y2: axisY + tickLen / 2,
      });
    }
  }
  return { box, median, whiskers, caps, outliers, axis, tickMarks };
}

/** Expand world bounds to cover a box-whisker. */
export function addBoxWhiskerBounds(bw, add) {
  const p = boxWhiskerParts(bw);
  add(p.box.x, p.box.y);
  add(p.box.x + p.box.w, p.box.y + p.box.h);
  for (const s of [...p.whiskers, ...p.caps, p.median, ...p.tickMarks]) {
    add(s.x1, s.y1);
    add(s.x2, s.y2);
  }
  if (p.axis) {
    add(p.axis.x1, p.axis.y1);
    add(p.axis.x2, p.axis.y2);
  }
  for (const o of p.outliers) add(o.x, o.y);
}
