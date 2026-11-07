/**
 * Dedicated bar-chart (column) plot — categories, values, axes, horizontal grid,
 * vertical y-axis title. Optional hatch fill on bars (see hatch.mjs).
 *
 * World coords: +y down. Chart origin (x,y) is the bottom-left corner of the
 * data area (where category axis meets value axis).
 */

import { hatchStrokesInRect, normalizeFillPattern } from "./hatch.mjs";

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function strList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? ""));
}

function numList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ requireId?: boolean }} [opts]
 */
export function normalizeBarChart(raw, opts = {}) {
  if (!raw || typeof raw !== "object") {
    throw new Error("barChart: must be an object");
  }
  const categories = strList(raw.categories != null ? raw.categories : raw.labels);
  const values = numList(raw.values != null ? raw.values : raw.heights);
  if (!categories.length) throw new Error("barChart: categories required");
  if (values.length !== categories.length) {
    throw new Error("barChart: values length must match categories");
  }
  for (const v of values) {
    if (v < 0) throw new Error("barChart: values must be ≥ 0");
  }

  const x = num(raw.x, NaN);
  const y = num(raw.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("barChart: x,y (axis origin, bottom-left of plot) required");
  }
  const plotW = Math.max(20, num(raw.plotW != null ? raw.plotW : raw.width, 280));
  const plotH = Math.max(20, num(raw.plotH != null ? raw.plotH : raw.height, 180));

  let yMin = num(raw.yMin, 0);
  let yMax = num(raw.yMax, NaN);
  if (!Number.isFinite(yMax)) {
    const peak = Math.max(0, ...values);
    yMax = peak > 0 ? peak : 1;
  }
  if (!(yMax > yMin)) throw new Error("barChart: yMax must be > yMin");

  let yTicks = numList(raw.yTicks);
  if (!yTicks.length) {
    const step = num(raw.yStep, NaN);
    if (Number.isFinite(step) && step > 0) {
      for (let t = yMin; t <= yMax + 1e-9; t += step) yTicks.push(Number(t.toFixed(8)));
    } else {
      // ~4–6 nice ticks
      const span = yMax - yMin;
      const rough = span / 4;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-9))));
      const norm = rough / mag;
      let nice = mag;
      if (norm >= 5) nice = 5 * mag;
      else if (norm >= 2) nice = 2 * mag;
      for (let t = Math.ceil(yMin / nice - 1e-9) * nice; t <= yMax + 1e-9; t += nice) {
        yTicks.push(Number(t.toFixed(8)));
      }
      if (!yTicks.includes(yMin)) yTicks.unshift(yMin);
      if (!yTicks.includes(yMax) && Math.abs(yTicks[yTicks.length - 1] - yMax) > 1e-6) {
        yTicks.push(yMax);
      }
    }
  }

  const barGap = Math.min(0.7, Math.max(0, num(raw.barGap, 0.28)));
  const barPattern = normalizeFillPattern(
    raw.barPattern != null ? raw.barPattern : raw.pattern != null ? raw.pattern : "hatch"
  );
  const hatchSpacing = Math.max(2, num(raw.hatchSpacing, 7));
  const showGrid = raw.showGrid != null ? !!raw.showGrid : true;
  const showAxes = raw.showAxes != null ? !!raw.showAxes : true;
  const xLabel = raw.xLabel != null ? String(raw.xLabel) : "";
  const yLabel = raw.yLabel != null ? String(raw.yLabel) : "";
  // rotate: −90° along axis (exam English titles); stack: one glyph per line
  const yLabelMode =
    raw.yLabelMode === "stack" || raw.yLabelMode === "vertical" ? "stack" : "rotate";

  /** @type {Record<string, unknown>} */
  const out = {
    x,
    y,
    plotW,
    plotH,
    categories,
    values,
    yMin,
    yMax,
    yTicks,
    barGap,
    barPattern,
    hatchSpacing,
    showGrid,
    showAxes,
    xLabel,
    yLabel,
    yLabelMode,
  };
  if (opts.requireId !== false) {
    if (typeof raw.id !== "string" || !raw.id) {
      throw new Error("barChart: id required");
    }
    out.id = raw.id;
  } else if (typeof raw.id === "string" && raw.id) {
    out.id = raw.id;
  }
  return out;
}

/**
 * Map a data value to world y (y-down): yMin at bottom (chart.y), yMax at top.
 */
export function barValueToWorldY(bc, value) {
  const t = (value - bc.yMin) / (bc.yMax - bc.yMin);
  return bc.y - t * bc.plotH;
}

/**
 * World-space primitives for rendering.
 * @returns {{
 *   frame: {x:number,y:number,w:number,h:number},
 *   bars: {x:number,y:number,w:number,h:number,value:number,label:string}[],
 *   grid: {x1:number,y1:number,x2:number,y2:number}[],
 *   axisX: {x1:number,y1:number,x2:number,y2:number},
 *   axisY: {x1:number,y1:number,x2:number,y2:number},
 *   tickMarks: {x1:number,y1:number,x2:number,y2:number}[],
 *   tickLabels: {x:number,y:number,text:string,anchor:string}[],
 *   catLabels: {x:number,y:number,text:string}[],
 *   xLabel: {x:number,y:number,text:string}|null,
 *   yLabel: {x:number,y:number,text:string,mode:string}|null,
 *   hatch: {x1:number,y1:number,x2:number,y2:number}[],
 * }}
 */
export function barChartParts(bc) {
  const n = bc.categories.length;
  const slot = bc.plotW / n;
  const gap = slot * bc.barGap;
  const barW = Math.max(2, slot - gap);
  const bars = [];
  const hatch = [];
  for (let i = 0; i < n; i++) {
    const val = bc.values[i];
    const bx = bc.x + i * slot + gap / 2;
    const topY = barValueToWorldY(bc, val);
    const bh = bc.y - topY;
    const bar = {
      x: bx,
      y: topY,
      w: barW,
      h: Math.max(0, bh),
      value: val,
      label: bc.categories[i],
    };
    bars.push(bar);
    if (bc.barPattern === "hatch" && bar.h > 1e-6) {
      for (const s of hatchStrokesInRect(bar.x, bar.y, bar.w, bar.h, {
        spacing: bc.hatchSpacing,
      })) {
        hatch.push(s);
      }
    }
  }

  const topY = bc.y - bc.plotH;
  const grid = [];
  const tickMarks = [];
  const tickLabels = [];
  const tickLen = Math.max(3, Math.min(8, bc.plotW * 0.02));
  for (const t of bc.yTicks) {
    if (t < bc.yMin - 1e-9 || t > bc.yMax + 1e-9) continue;
    const wy = barValueToWorldY(bc, t);
    if (bc.showGrid && Math.abs(t - bc.yMin) > 1e-9) {
      grid.push({ x1: bc.x, y1: wy, x2: bc.x + bc.plotW, y2: wy });
    }
    tickMarks.push({
      x1: bc.x - tickLen,
      y1: wy,
      x2: bc.x,
      y2: wy,
    });
    tickLabels.push({
      x: bc.x - tickLen - 2,
      y: wy,
      text: String(t),
      anchor: "end",
    });
  }

  const catLabels = [];
  for (let i = 0; i < n; i++) {
    catLabels.push({
      x: bc.x + i * slot + slot / 2,
      y: bc.y + Math.max(12, bc.plotH * 0.06),
      text: bc.categories[i],
    });
  }

  let xLabel = null;
  if (bc.xLabel) {
    xLabel = {
      x: bc.x + bc.plotW / 2,
      y: bc.y + Math.max(28, bc.plotH * 0.14),
      text: bc.xLabel,
    };
  }
  let yLabel = null;
  if (bc.yLabel) {
    yLabel = {
      x: bc.x - Math.max(36, bc.plotW * 0.12),
      y: topY + bc.plotH / 2,
      text: bc.yLabel,
      mode: bc.yLabelMode,
    };
  }

  return {
    frame: { x: bc.x, y: topY, w: bc.plotW, h: bc.plotH },
    bars,
    grid,
    axisX: { x1: bc.x, y1: bc.y, x2: bc.x + bc.plotW, y2: bc.y },
    axisY: { x1: bc.x, y1: bc.y, x2: bc.x, y2: topY },
    tickMarks,
    tickLabels,
    catLabels,
    xLabel,
    yLabel,
    hatch,
  };
}

/** Expand world bounds to cover a bar chart (incl. labels). */
export function addBarChartBounds(bc, add) {
  const p = barChartParts(bc);
  add(p.frame.x, p.frame.y);
  add(p.frame.x + p.frame.w, p.frame.y + p.frame.h);
  add(p.axisX.x1, p.axisX.y1);
  add(p.axisX.x2, p.axisX.y2);
  add(p.axisY.x1, p.axisY.y1);
  add(p.axisY.x2, p.axisY.y2);
  for (const c of p.catLabels) add(c.x, c.y + 4);
  if (p.xLabel) add(p.xLabel.x, p.xLabel.y + 4);
  if (p.yLabel) {
    add(p.yLabel.x - 8, p.yLabel.y);
    add(p.yLabel.x + 8, p.yLabel.y);
  }
  for (const t of p.tickLabels) add(t.x - 4, t.y);
}
