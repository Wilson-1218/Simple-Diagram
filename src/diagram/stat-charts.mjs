/**
 * Cumulative-frequency (ogive), histogram, and dot-pattern charts.
 * Stored on doc.barCharts with kind "ogive" | "histogram" | "dots"
 * so the 38-key document shape stays put. kind omitted → existing bar chart.
 */

import { hatchStrokesInRect } from "./hatch.mjs";
import { SOLUTION_INK, elementShown } from "./appearance.mjs";

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function svgDataAttrs(el) {
  if (!el || typeof el !== "object") return "";
  const parts = [];
  if (el.id != null && String(el.id) !== "") parts.push(`data-id="${escapeXml(el.id)}"`);
  if (el.role === "solution") parts.push('data-role="solution"');
  const step = Number(el.solutionStep);
  if (Number.isInteger(step) && step > 0) parts.push(`data-step="${step}"`);
  return parts.length ? " " + parts.join(" ") : "";
}

function niceTicks(yMin, yMax, yStep) {
  const step = num(yStep, NaN);
  const ticks = [];
  if (Number.isFinite(step) && step > 0) {
    for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(Number(t.toFixed(8)));
    return ticks;
  }
  const span = yMax - yMin;
  const rough = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-9))));
  const norm = rough / mag;
  let nice = mag;
  if (norm >= 5) nice = 5 * mag;
  else if (norm >= 2) nice = 2 * mag;
  for (let t = Math.ceil(yMin / nice - 1e-9) * nice; t <= yMax + 1e-9; t += nice) {
    ticks.push(Number(t.toFixed(8)));
  }
  if (!ticks.length) ticks.push(yMin, yMax);
  return ticks;
}

function mapX(chart, u) {
  const span = chart.u1 - chart.u0;
  const t = span === 0 ? 0 : (u - chart.u0) / span;
  return chart.x + t * chart.plotW;
}

function mapY(chart, v) {
  const t = (v - chart.yMin) / (chart.yMax - chart.yMin);
  return chart.y - t * chart.plotH;
}

function inkOf(el, fallback) {
  if (el && el.color != null && String(el.color).trim() !== "") return String(el.color).trim();
  if (el && el.role === "solution") return SOLUTION_INK;
  return fallback || "#111111";
}

function positiveStep(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function stampStep(row, source) {
  const step = positiveStep(source && source.solutionStep);
  if (step != null) row.solutionStep = step;
  return row;
}

/**
 * @param {Record<string, unknown>} raw
 */
export function normalizeStatChart(raw) {
  if (!raw || typeof raw !== "object") throw new Error("chart: must be an object");
  const kindRaw = String(raw.kind || "");
  const kind = kindRaw === "cumulative" || kindRaw === "ogive" ? "ogive" : kindRaw;
  if (kind !== "ogive" && kind !== "histogram" && kind !== "dots") {
    throw new Error(`chart: unknown kind ${raw.kind}`);
  }
  const x = num(raw.x, NaN);
  const y = num(raw.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("chart: x,y required");
  const chart = {
    kind,
    x,
    y,
    plotW: Math.max(20, num(raw.plotW != null ? raw.plotW : raw.width, 280)),
    plotH: Math.max(20, num(raw.plotH != null ? raw.plotH : raw.height, 180)),
  };
  if (typeof raw.id === "string" && raw.id) chart.id = raw.id;
  if (raw.role === "solution") chart.role = "solution";
  else if (raw.role === "question") chart.role = "question";
  stampStep(chart, raw);
  if (raw.color != null && String(raw.color).trim() !== "") chart.color = String(raw.color).trim();
  if (kind === "dots") return normalizeDots(chart, raw);
  return kind === "ogive" ? normalizeOgive(chart, raw) : normalizeHistogram(chart, raw);
}

function axisLabels(chart, raw) {
  chart.xLabel = raw.xLabel != null ? String(raw.xLabel) : "";
  chart.yLabel = raw.yLabel != null ? String(raw.yLabel) : "";
  chart.showGrid = raw.showGrid != null ? !!raw.showGrid : true;
  chart.showAxes = raw.showAxes != null ? !!raw.showAxes : true;
}

function normalizeOgive(chart, raw) {
  const boundaries = numList(raw.boundaries != null ? raw.boundaries : raw.x);
  const values = numList(raw.values != null ? raw.values : raw.heights);
  if (boundaries.length < 2) throw new Error("addCumulativeFrequency: boundaries length ≥ 2");
  if (values.length !== boundaries.length) {
    throw new Error("addCumulativeFrequency: values length must match boundaries");
  }
  for (let i = 1; i < boundaries.length; i++) {
    if (!(boundaries[i] > boundaries[i - 1])) {
      throw new Error("addCumulativeFrequency: boundaries must be strictly increasing");
    }
  }
  chart.boundaries = boundaries;
  chart.values = values;
  chart.u0 = boundaries[0];
  chart.u1 = boundaries[boundaries.length - 1];
  chart.yMin = num(raw.yMin, 0);
  const peak = Math.max(chart.yMin, ...values);
  chart.yMax = num(raw.yMax, peak > chart.yMin ? peak : chart.yMin + 1);
  if (!(chart.yMax > chart.yMin)) throw new Error("addCumulativeFrequency: yMax must be > yMin");
  chart.yTicks = niceTicks(chart.yMin, chart.yMax, raw.yStep);
  chart.smooth = raw.smooth === true;
  chart.projections = [];
  if (Array.isArray(raw.projections)) {
    for (const p of raw.projections) {
      if (!p || typeof p !== "object") continue;
      const py = Number(p.y);
      if (!Number.isFinite(py)) continue;
      const row = { y: py };
      if (p.xLabel != null && String(p.xLabel) !== "") row.xLabel = String(p.xLabel);
      if (p.yLabel != null && String(p.yLabel) !== "") row.yLabel = String(p.yLabel);
      if (p.role === "solution") row.role = "solution";
      stampStep(row, p.solutionStep != null ? p : raw);
      chart.projections.push(row);
    }
  }
  axisLabels(chart, raw);
  return chart;
}

function centersToEdges(centers) {
  const n = centers.length;
  if (n === 1) {
    const w = 1;
    return [centers[0] - w / 2, centers[0] + w / 2];
  }
  const edges = new Array(n + 1);
  edges[0] = centers[0] - (centers[1] - centers[0]) / 2;
  for (let i = 1; i < n; i++) edges[i] = (centers[i - 1] + centers[i]) / 2;
  edges[n] = centers[n - 1] + (centers[n - 1] - centers[n - 2]) / 2;
  return edges;
}

function normalizeHistogram(chart, raw) {
  const values = numList(raw.values != null ? raw.values : raw.heights);
  if (!values.length) throw new Error("addHistogram: values required");
  for (const v of values) {
    if (v < 0) throw new Error("addHistogram: values must be ≥ 0");
  }
  let edges = null;
  const stored = numList(raw.edges);
  const boundaries = numList(raw.boundaries);
  const centers = numList(raw.centers);
  if (stored.length === values.length + 1) edges = stored;
  else if (boundaries.length === values.length + 1) edges = boundaries;
  else if (centers.length === values.length) edges = centersToEdges(centers);
  else if (boundaries.length === values.length) edges = centersToEdges(boundaries);
  else throw new Error("addHistogram: boundaries (n+1) or centers (n) must match values");
  for (let i = 1; i < edges.length; i++) {
    if (!(edges[i] > edges[i - 1] - 1e-9)) {
      throw new Error("addHistogram: boundaries must increase");
    }
  }
  chart.edges = edges;
  chart.values = values;
  chart.u0 = edges[0];
  chart.u1 = edges[edges.length - 1];
  chart.yMin = num(raw.yMin, 0);
  const peak = Math.max(chart.yMin, ...values);
  chart.yMax = num(raw.yMax, peak > chart.yMin ? peak : chart.yMin + 1);
  if (!(chart.yMax > chart.yMin)) throw new Error("addHistogram: yMax must be > yMin");
  chart.yTicks = niceTicks(chart.yMin, chart.yMax, raw.yStep);
  const pat = String(raw.barPattern != null ? raw.barPattern : raw.pattern != null ? raw.pattern : "hatch").toLowerCase();
  chart.barPattern = pat === "solid" || pat === "none" ? "solid" : "hatch";
  chart.hatchSpacing = Math.max(2, num(raw.hatchSpacing, 7));
  chart.showFrequencyPolygon = raw.showFrequencyPolygon === true;
  axisLabels(chart, raw);
  return chart;
}

function dotRole(entry) {
  if (!entry) return null;
  if (Array.isArray(entry) && entry[2] === "solution") return "solution";
  if (entry.role === "solution") return "solution";
  return null;
}

function markIndex(pattern, index) {
  if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) return false;
  if (pattern.role === "solution") return true;
  const list = pattern.solution != null ? pattern.solution : pattern.solutionDots;
  if (!Array.isArray(list)) return false;
  return list.some((n) => Number(n) === index);
}

function rowsToDots(rows, align, pattern) {
  const dots = [];
  rows.forEach((count, row) => {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    const shift = align === "left" ? 0 : (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const role = markIndex(pattern, dots.length) ? "solution" : null;
      dots.push({ col: i - shift, row, role, hex: false });
    }
  });
  return dots;
}

function triangularDots(count, pattern) {
  const dots = [];
  let row = 0;
  let left = count;
  while (left > 0) {
    const n = Math.min(row + 1, left);
    const shift = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      dots.push({
        col: i - shift,
        row,
        role: markIndex(pattern, dots.length) ? "solution" : null,
        hex: false,
      });
    }
    left -= n;
    row += 1;
    if (row > 64) break;
  }
  return dots;
}

function squareDots(count, pattern) {
  const side = Math.max(1, Math.ceil(Math.sqrt(count)));
  const dots = [];
  for (let i = 0; i < count; i++) {
    const col = i % side;
    const row = Math.floor(i / side);
    dots.push({
      col: col - (side - 1) / 2,
      row,
      role: markIndex(pattern, i) ? "solution" : null,
      hex: false,
    });
  }
  return dots;
}

function hexagonalDots(count, pattern) {
  const dots = [];
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  const push = (q, r) => {
    if (dots.length >= count) return;
    dots.push({
      col: q + r / 2,
      row: (r * Math.sqrt(3)) / 2,
      role: markIndex(pattern, dots.length) ? "solution" : null,
      hex: true,
    });
  };
  push(0, 0);
  let ring = 1;
  while (dots.length < count && ring < 32) {
    let q = dirs[4][0] * ring;
    let r = dirs[4][1] * ring;
    for (let side = 0; side < 6 && dots.length < count; side++) {
      for (let step = 0; step < ring && dots.length < count; step++) {
        push(q, r);
        q += dirs[side][0];
        r += dirs[side][1];
      }
    }
    ring += 1;
  }
  return dots;
}

function patternDots(pattern) {
  if (Array.isArray(pattern)) {
    return pattern
      .map((entry) => {
        if (Array.isArray(entry)) {
          return {
            col: Number(entry[0]),
            row: Number(entry[1]),
            role: dotRole(entry),
            hex: false,
          };
        }
        if (entry && typeof entry === "object") {
          return {
            col: Number(entry.col != null ? entry.col : entry.c),
            row: Number(entry.row != null ? entry.row : entry.r),
            role: dotRole(entry),
            hex: false,
          };
        }
        return null;
      })
      .filter((d) => d && Number.isFinite(d.col) && Number.isFinite(d.row));
  }
  if (!pattern || typeof pattern !== "object") return [];
  if (Array.isArray(pattern.rows)) {
    const align = pattern.align === "left" ? "left" : "center";
    return rowsToDots(pattern.rows, align, pattern);
  }
  const kind = String(pattern.kind || "").toLowerCase();
  const count = Math.max(0, Math.floor(Number(pattern.count)));
  if (!count) return [];
  if (kind === "square") return squareDots(count, pattern);
  if (kind === "hexagonal" || kind === "hex") return hexagonalDots(count, pattern);
  if (kind === "triangular" || kind === "triangle") return triangularDots(count, pattern);
  return [];
}

function normalizeDots(chart, raw) {
  if (!Array.isArray(raw.patterns) || !raw.patterns.length) {
    throw new Error("addDotPattern: patterns required");
  }
  chart.patterns = raw.patterns;
  chart.dotGap = num(raw.dotGap, 16);
  chart.patternGap = num(raw.patternGap, 64);
  chart.dotRadius = num(raw.dotRadius, 3.5);
  chart.showArrows = raw.showArrows != null ? !!raw.showArrows : true;
  chart.labels = Array.isArray(raw.labels) ? raw.labels.map((s) => (s == null ? "" : String(s))) : [];
  return chart;
}

function emptyParts(chart) {
  return {
    kind: chart.kind,
    id: chart.id,
    role: chart.role,
    solutionStep: chart.solutionStep,
    color: chart.color,
    lines: [],
    polylines: [],
    rects: [],
    dots: [],
    texts: [],
  };
}

function axisChrome(chart, parts) {
  const top = chart.y - chart.plotH;
  if (chart.showAxes !== false) {
    parts.lines.push({ x1: chart.x, y1: chart.y, x2: chart.x + chart.plotW, y2: chart.y, color: "#111111" });
    parts.lines.push({ x1: chart.x, y1: chart.y, x2: chart.x, y2: top, color: "#111111" });
  }
  const tickLen = Math.max(3, Math.min(8, chart.plotW * 0.02));
  for (const t of chart.yTicks || []) {
    if (t < chart.yMin - 1e-9 || t > chart.yMax + 1e-9) continue;
    const wy = mapY(chart, t);
    if (chart.showGrid && Math.abs(t - chart.yMin) > 1e-9) {
      parts.lines.push({
        x1: chart.x,
        y1: wy,
        x2: chart.x + chart.plotW,
        y2: wy,
        dash: true,
        color: "#111111",
      });
    }
    parts.lines.push({
      x1: chart.x - tickLen,
      y1: wy,
      x2: chart.x,
      y2: wy,
      color: "#111111",
    });
    parts.texts.push({
      x: chart.x - tickLen - 2,
      y: wy,
      text: String(t),
      anchor: "end",
      baseline: "middle",
    });
  }
  if (chart.xLabel) {
    parts.texts.push({
      x: chart.x + chart.plotW / 2,
      y: chart.y + 36,
      text: chart.xLabel,
      anchor: "middle",
      baseline: "hanging",
    });
  }
  if (chart.yLabel) {
    parts.texts.push({
      x: chart.x - Math.max(36, chart.plotW * 0.12),
      y: top + chart.plotH / 2,
      text: chart.yLabel,
      anchor: "middle",
      baseline: "middle",
      rotate: -90,
    });
  }
}

function monotoneSlopes(xs, ys) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    d.push(h === 0 ? 0 : (ys[i + 1] - ys[i]) / h);
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

function hermite(xs, ys, m, x) {
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i += 1;
  const h = xs[i + 1] - xs[i];
  const t = h === 0 ? 0 : (x - xs[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * h * m[i] +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * h * m[i + 1]
  );
}

function ogivePoints(chart) {
  const xs = chart.boundaries;
  const ys = chart.values;
  if (!chart.smooth || xs.length < 3) {
    return xs.map((u, i) => ({ u, v: ys[i] }));
  }
  const m = monotoneSlopes(xs, ys);
  const pts = [];
  const steps = 8;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let s = 0; s < steps; s++) {
      const u = xs[i] + ((xs[i + 1] - xs[i]) * s) / steps;
      pts.push({ u, v: hermite(xs, ys, m, u) });
    }
  }
  pts.push({ u: xs[xs.length - 1], v: ys[ys.length - 1] });
  return pts;
}

function invertOgive(chart, yValue) {
  const pts = ogivePoints(chart);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const lo = Math.min(a.v, b.v);
    const hi = Math.max(a.v, b.v);
    if (yValue < lo - 1e-9 || yValue > hi + 1e-9) continue;
    const span = b.v - a.v;
    const t = Math.abs(span) < 1e-12 ? 0 : (yValue - a.v) / span;
    return a.u + (b.u - a.u) * Math.min(1, Math.max(0, t));
  }
  if (yValue <= pts[0].v) return pts[0].u;
  return pts[pts.length - 1].u;
}

function ogiveParts(chart) {
  const parts = emptyParts(chart);
  axisChrome(chart, parts);
  const samples = ogivePoints(chart).map((p) => ({ x: mapX(chart, p.u), y: mapY(chart, p.v) }));
  parts.polylines.push({
    points: samples,
    color: inkOf(chart, "#111111"),
    role: chart.role,
    solutionStep: chart.solutionStep,
    id: chart.id,
  });
  for (let i = 0; i < chart.boundaries.length; i++) {
    const wx = mapX(chart, chart.boundaries[i]);
    parts.texts.push({
      x: wx,
      y: chart.y + 14,
      text: String(chart.boundaries[i]),
      anchor: "middle",
      baseline: "hanging",
    });
  }
  for (const proj of chart.projections) {
    const u = invertOgive(chart, proj.y);
    const cx = mapX(chart, u);
    const cy = mapY(chart, proj.y);
    const look = {
      role: proj.role,
      solutionStep: proj.solutionStep != null ? proj.solutionStep : chart.solutionStep,
      color: proj.role === "solution" ? undefined : chart.color,
    };
    if (proj.role === "solution" && chart.color && chart.role === "solution") look.color = chart.color;
    const color = inkOf(look, "#111111");
    parts.lines.push({
      x1: chart.x,
      y1: cy,
      x2: cx,
      y2: cy,
      dash: true,
      color,
      id: chart.id,
      role: look.role,
      solutionStep: look.solutionStep,
    });
    parts.lines.push({
      x1: cx,
      y1: cy,
      x2: cx,
      y2: chart.y,
      dash: true,
      color,
      id: chart.id,
      role: look.role,
      solutionStep: look.solutionStep,
    });
    if (proj.yLabel) {
      parts.texts.push({
        x: chart.x - 8,
        y: cy,
        text: proj.yLabel,
        anchor: "end",
        baseline: "middle",
        color,
        id: chart.id,
        role: look.role,
        solutionStep: look.solutionStep,
      });
    }
    if (proj.xLabel) {
      parts.texts.push({
        x: cx,
        y: chart.y + 14,
        text: proj.xLabel,
        anchor: "middle",
        baseline: "hanging",
        color,
        id: chart.id,
        role: look.role,
        solutionStep: look.solutionStep,
      });
    }
  }
  return parts;
}

function histogramParts(chart) {
  const parts = emptyParts(chart);
  axisChrome(chart, parts);
  const mids = [];
  for (let i = 0; i < chart.values.length; i++) {
    const x0 = mapX(chart, chart.edges[i]);
    const x1 = mapX(chart, chart.edges[i + 1]);
    const top = mapY(chart, chart.values[i]);
    const rect = {
      x: x0,
      y: top,
      w: x1 - x0,
      h: chart.y - top,
      color: inkOf(chart, "#111111"),
      pattern: chart.barPattern,
    };
    parts.rects.push(rect);
    if (chart.barPattern === "hatch" && rect.h > 1e-6 && rect.w > 1e-6) {
      for (const s of hatchStrokesInRect(rect.x, rect.y, rect.w, rect.h, { spacing: chart.hatchSpacing })) {
        parts.lines.push({ ...s, color: inkOf(chart, "#111111") });
      }
    }
    const midU = (chart.edges[i] + chart.edges[i + 1]) / 2;
    mids.push({ x: mapX(chart, midU), y: top });
    parts.texts.push({
      x: x0,
      y: chart.y + 14,
      text: String(chart.edges[i]),
      anchor: "middle",
      baseline: "hanging",
    });
  }
  parts.texts.push({
    x: mapX(chart, chart.edges[chart.edges.length - 1]),
    y: chart.y + 14,
    text: String(chart.edges[chart.edges.length - 1]),
    anchor: "middle",
    baseline: "hanging",
  });
  if (chart.showFrequencyPolygon && mids.length) {
    const poly = [
      { x: mapX(chart, chart.edges[0]), y: chart.y },
      ...mids,
      { x: mapX(chart, chart.edges[chart.edges.length - 1]), y: chart.y },
    ];
    parts.polylines.push({
      points: poly,
      color: inkOf(chart, "#111111"),
      role: chart.role,
      solutionStep: chart.solutionStep,
    });
  }
  return parts;
}

function clusterOf(dots, gap) {
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const d of dots) {
    minC = Math.min(minC, d.col);
    maxC = Math.max(maxC, d.col);
    minR = Math.min(minR, d.row);
    maxR = Math.max(maxR, d.row);
  }
  if (!dots.length) return { minC: 0, maxC: 0, minR: 0, maxR: 0, w: 0, h: 0 };
  return {
    minC,
    maxC,
    minR,
    maxR,
    w: (maxC - minC) * gap,
    h: (maxR - minR) * gap,
  };
}

function dotParts(chart) {
  const parts = emptyParts(chart);
  const gap = chart.dotGap;
  let cursor = chart.x;
  const clusters = chart.patterns.map((pattern) => patternDots(pattern));
  clusters.forEach((dots, index) => {
    const box = clusterOf(dots, gap);
    const originX = cursor - box.minC * gap;
    const originY = chart.y - box.minR * gap;
    let maxX = cursor;
    let midYs = [];
    for (const d of dots) {
      const x = originX + d.col * gap;
      const y = originY + d.row * gap;
      const solution = d.role === "solution" || chart.role === "solution";
      const look = {
        role: solution ? "solution" : undefined,
        color: solution ? chart.color : undefined,
        solutionStep: chart.solutionStep,
      };
      parts.dots.push({
        x,
        y,
        r: chart.dotRadius,
        color: inkOf(look, "#111111"),
        role: look.role,
        solutionStep: chart.solutionStep,
      });
      maxX = Math.max(maxX, x);
      midYs.push(y);
    }
    const label = chart.labels[index];
    if (label) {
      const lx = dots.length
        ? originX + ((box.minC + box.maxC) / 2) * gap
        : cursor;
      const ly = (dots.length ? originY + box.maxR * gap : chart.y) + gap + 8;
      parts.texts.push({
        x: lx,
        y: ly,
        text: label,
        anchor: "middle",
        baseline: "hanging",
      });
    }
    const right = Math.max(maxX, cursor);
    const next = clusters[index + 1];
    if (chart.showArrows && next) {
      const nextBox = clusterOf(next, gap);
      const yMid = midYs.length ? midYs.reduce((s, v) => s + v, 0) / midYs.length : chart.y;
      const x1 = right + 10;
      const x2 = right + chart.patternGap - nextBox.w - 16;
      const tip = Math.max(x1 + 12, x2);
      parts.lines.push({ x1, y1: yMid, x2: tip, y2: yMid, color: "#111111" });
      parts.lines.push({ x1: tip, y1: yMid, x2: tip - 7, y2: yMid - 4, color: "#111111" });
      parts.lines.push({ x1: tip, y1: yMid, x2: tip - 7, y2: yMid + 4, color: "#111111" });
    }
    cursor = right + chart.patternGap;
    if (chart.showArrows && index === clusters.length - 1) {
      const yMid = midYs.length ? midYs.reduce((s, v) => s + v, 0) / midYs.length : chart.y;
      for (let k = 0; k < 3; k++) {
        parts.dots.push({
          x: right + 18 + k * 8,
          y: yMid,
          r: 1.6,
          color: "#111111",
        });
      }
    }
  });
  return parts;
}

function chartReady(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.kind === "ogive") return Array.isArray(raw.boundaries) && raw.u0 != null;
  if (raw.kind === "histogram") return Array.isArray(raw.edges) && Array.isArray(raw.values);
  if (raw.kind === "dots") return Array.isArray(raw.patterns) && raw.dotGap != null;
  return false;
}

export function statChartParts(raw) {
  const chart = chartReady(raw) ? raw : normalizeStatChart(raw);
  if (chart.kind === "histogram") return histogramParts(chart);
  if (chart.kind === "dots") return dotParts(chart);
  return ogiveParts(chart);
}

export function addStatChartBounds(raw, add) {
  let parts;
  try {
    parts = statChartParts(raw);
  } catch {
    return;
  }
  const consider = (x, y) => add(x, y);
  for (const line of parts.lines) {
    consider(line.x1, line.y1);
    consider(line.x2, line.y2);
  }
  for (const poly of parts.polylines) {
    for (const p of poly.points) consider(p.x, p.y);
  }
  for (const r of parts.rects) {
    consider(r.x, r.y);
    consider(r.x + r.w, r.y + r.h);
  }
  for (const d of parts.dots) {
    consider(d.x - d.r, d.y - d.r);
    consider(d.x + d.r, d.y + d.r);
  }
  for (const t of parts.texts) {
    const w = Math.max(12, String(t.text || "").length * 7);
    consider(t.x - w / 2, t.y - 8);
    consider(t.x + w / 2, t.y + 16);
    if (t.rotate) {
      consider(t.x - 16, t.y - w / 2);
      consider(t.x + 16, t.y + w / 2);
    }
  }
}

function lineSvg(line, toS, lw) {
  const a = toS(line.x1, line.y1);
  const b = toS(line.x2, line.y2);
  const dash = line.dash ? ` stroke-dasharray="${(Number(lw) * 4).toFixed(2)} ${(Number(lw) * 2.6).toFixed(2)}"` : "";
  const look = { id: line.id, role: line.role, solutionStep: line.solutionStep };
  return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${escapeXml(line.color || "#111")}" stroke-width="${lw}" stroke-linecap="butt"${dash}${svgDataAttrs(look)} />\n`;
}

/**
 * @param {object} raw
 * @param {(x:number,y:number)=>{x:number,y:number}} toS
 * @param {{ stroke?: number, fontPx?: number }} [ink]
 */
export function svgStatChart(raw, toS, ink = {}) {
  let parts;
  try {
    parts = statChartParts(raw);
  } catch {
    return "";
  }
  const layers = ink.layers;
  const keep = (el) => elementShown(el, layers);
  const lw = (ink.stroke != null ? ink.stroke : 1.2).toFixed(2);
  const fontPx = (ink.fontPx != null ? ink.fontPx : 12).toFixed(1);
  const fam = 'font-family="STIX Two Text, Times New Roman, serif" font-style="italic"';
  let body = "";
  const groupLook = { id: parts.id, role: parts.role, solutionStep: parts.solutionStep };
  const open = svgDataAttrs(groupLook);
  if (open) body += `<g${open}>\n`;
  for (const line of parts.lines) if (keep(line)) body += lineSvg(line, toS, lw);
  for (const poly of parts.polylines) {
    if (!keep(poly) || !poly.points.length) continue;
    let d = "";
    poly.points.forEach((p, i) => {
      const s = toS(p.x, p.y);
      d += i === 0 ? `M${s.x.toFixed(2)},${s.y.toFixed(2)}` : ` L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
    });
    body += `<path d="${d}" fill="none" stroke="${escapeXml(poly.color || "#111")}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"${svgDataAttrs(poly)} />\n`;
  }
  for (const r of parts.rects) {
    if (!keep(r)) continue;
    const tl = toS(r.x, r.y);
    const br = toS(r.x + r.w, r.y + r.h);
    const x = Math.min(tl.x, br.x);
    const y = Math.min(tl.y, br.y);
    const w = Math.abs(br.x - tl.x);
    const h = Math.abs(br.y - tl.y);
    const fill = r.pattern === "solid" ? ' fill="#f4f4f4"' : ' fill="none"';
    body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"${fill} stroke="${escapeXml(r.color || "#111")}" stroke-width="${lw}" />\n`;
  }
  for (const d of parts.dots) {
    if (!keep(d)) continue;
    const s = toS(d.x, d.y);
    body += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${Number(d.r).toFixed(2)}" fill="${escapeXml(d.color || "#111")}"${svgDataAttrs(d)} />\n`;
  }
  for (const t of parts.texts) {
    if (!keep(t)) continue;
    const s = toS(t.x, t.y);
    const anchor = t.anchor === "end" ? "end" : t.anchor === "start" ? "start" : "middle";
    const baseline = t.baseline === "middle" ? "middle" : t.baseline === "auto" ? "auto" : "hanging";
    const rot =
      t.rotate != null
        ? ` transform="rotate(${Number(t.rotate).toFixed(1)} ${s.x.toFixed(2)} ${s.y.toFixed(2)})"`
        : "";
    body += `<text x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" fill="${escapeXml(t.color || "#111")}" ${fam} font-size="${fontPx}" text-anchor="${anchor}" dominant-baseline="${baseline}"${rot}${svgDataAttrs(t)}>${escapeXml(t.text)}</text>\n`;
  }
  if (open) body += `</g>\n`;
  return body;
}
