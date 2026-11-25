import { emptyDiagram, cloneDoc } from "./empty-doc.mjs";
import { createIdFactory } from "./ids.mjs";
import {
  applyBuiltinTemplate,
  BUILTIN_TEMPLATE_IDS,
  BUILTIN_TEMPLATES,
  registerShapeVertexAlias,
  shapeAliasMap,
  SHAPE_SOLID_TEMPLATE_IDS,
  TEMPLATE_CELL_SIZE,
} from "./templates.mjs";
import { chainPathFillEdges } from "./path-fill.mjs";
import { normalizeBoxWhisker } from "./box-whisker.mjs";
import { normalizeBarChart } from "./bar-chart.mjs";
import { normalizeFillPattern } from "./hatch.mjs";
import { normalizeLengthSide } from "./length-mark.mjs";
import { coordWorldFromAxis, normalizeCoordTicks } from "./coord-plot.mjs";
import { parseInequality, solveFeasibleRegion } from "./feasible-region.mjs";
import { buildPolyhedron } from "./polyhedron.mjs";
import { applyBearing, applyPieChart, applyTriangleCenter } from "./exam-ops.mjs";
import { appearanceFields, elementRole, stampAppearance } from "./appearance.mjs";
import { DEFAULT_ARC_SIZE } from "./angle-arc.mjs";

const LINE_STYLES = new Set(["solid", "dashed", "dotted", "dashdot"]);

function ensureArrays(doc) {
  const keys = [
    "points",
    "segments",
    "labels",
    "texts",
    "rightAngles",
    "angleArcs",
    "midTicks",
    "parallelMarks",
    "equalMarks",
    "lengthLabels",
    "circles",
    "ellipses",
    "sectors",
    "fills",
    "coordPlots",
    "boxWhiskers",
    "barCharts",
  ];
  for (const k of keys) {
    if (!Array.isArray(doc[k])) doc[k] = [];
  }
  return doc;
}

function clampOpacity(n, fallback = 0.2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function normalizeFillColor(c, fallback = "#666666") {
  if (c == null || c === "") return fallback;
  const s = String(c).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return (
      "#" +
      s[1] +
      s[1] +
      s[2] +
      s[2] +
      s[3] +
      s[3]
    ).toLowerCase();
  }
  throw new Error(`invalid fill color: ${c}`);
}

/**
 * Canonical point id. A real point always wins, so an alias never steals
 * an id the caller already created. Otherwise `{prefix}{Letter}` and a free
 * bare letter A–V resolve to the shape vertex registered at creation.
 * If the alias map was dropped, a single-letter label still resolves.
 */
function resolvePointId(doc, id) {
  if (id == null || id === "") return null;
  if (doc.points.some((p) => p.id === id)) return id;
  if (typeof id !== "string") return null;
  const aliases = doc.pointAliases;
  if (aliases && typeof aliases === "object" && !Array.isArray(aliases)) {
    const target = aliases[id];
    if (typeof target === "string" && target !== id && doc.points.some((p) => p.id === target)) {
      return target;
    }
  }
  return inferVertexAlias(doc, id);
}

function inferVertexAlias(doc, key) {
  const prefixed = /^(.*)([A-V])$/.exec(key);
  if (prefixed && prefixed[1]) {
    const prefix = prefixed[1];
    const letter = prefixed[2];
    const re = new RegExp(`^${escapeRegExp(prefix)}\\d+$`);
    let found = null;
    for (const p of doc.points) {
      if (!re.test(p.id)) continue;
      if (labelLetter(doc, p.id) === letter) found = p.id;
    }
    if (found) return found;
  }
  if (/^[A-V]$/.test(key)) {
    let found = null;
    for (const p of doc.points) {
      if (labelLetter(doc, p.id) === key) found = p.id;
    }
    if (found) return found;
  }
  return null;
}

function labelLetter(doc, pointId) {
  let letter = null;
  for (const lab of doc.labels || []) {
    if (!lab || lab.pointId !== pointId) continue;
    const t = lab.text != null ? String(lab.text).trim() : "";
    if (/^[A-V]$/.test(t)) letter = t;
  }
  return letter;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPoint(doc, id) {
  const resolved = resolvePointId(doc, id);
  if (!resolved) return null;
  return doc.points.find((p) => p.id === resolved) || null;
}

function requirePoint(doc, id, ctx) {
  const p = findPoint(doc, id);
  if (!p) {
    throw new Error(`${ctx}: point not found: ${id}`);
  }
  return p.id;
}

function requireSegment(doc, id, ctx) {
  if (!doc.segments.some((s) => s.id === id)) {
    throw new Error(`${ctx}: segment not found: ${id}`);
  }
}

function requireCircle(doc, id, ctx) {
  const cir = doc.circles.find((c) => c.id === id);
  if (!cir) throw new Error(`${ctx}: circle not found: ${id}`);
  return cir;
}

function pointById(doc, id) {
  return findPoint(doc, id);
}

function circleGeom(doc, circleId, ctx) {
  const cir = requireCircle(doc, circleId, ctx);
  const c = pointById(doc, cir.centerId);
  const thr = pointById(doc, cir.throughId);
  if (!c || !thr) throw new Error(`${ctx}: circle points missing`);
  const r = Math.hypot(thr.x - c.x, thr.y - c.y);
  if (!(r > 1e-9)) throw new Error(`${ctx}: circle radius too small`);
  return { cir, c, r };
}

function pushPoint(doc, nextId, x, y, idHint, marker, hidden, appearance) {
  const id = idHint
    ? resolveId({ id: idHint }, nextId, "p")
    : nextId("p");
  if (doc.points.some((p) => p.id === id)) throw new Error(`duplicate point id ${id}`);
  const p = { id, x: Number(x), y: Number(y) };
  if (marker) p.marker = marker;
  if (hidden === true) p.hidden = true;
  if (appearance) stampAppearance(p, appearance);
  doc.points.push(p);
  return p;
}

function pushSegment(doc, nextId, a, b, style, idHint, appearance) {
  const id = idHint
    ? resolveId({ id: idHint }, nextId, "s")
    : nextId("s");
  if (doc.segments.some((s) => s.id === id)) throw new Error(`duplicate segment id ${id}`);
  if (a === b) throw new Error("segment ends must differ");
  const seg = { id, a, b, style: styleOr(style, "solid") };
  if (appearance) stampAppearance(seg, appearance);
  doc.segments.push(seg);
  refreshAutoLabels(doc, [a, b]);
  return id;
}

/** Find existing segment between a–b (either order), or create one. */
function ensureSegmentBetween(doc, nextId, a, b, style, appearance) {
  const existing = doc.segments.find(
    (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a)
  );
  if (existing) return existing.id;
  return pushSegment(doc, nextId, a, b, style, undefined, appearance);
}

/**
 * Resolve endpoints from `a`+`b` point ids or `segmentId`.
 * @returns {{ aId: string, bId: string, a: object, b: object }}
 */
function resolveEndpoints(doc, op, ctx) {
  if (op.segmentId) {
    requireSegment(doc, op.segmentId, ctx);
    const seg = doc.segments.find((s) => s.id === op.segmentId);
    const a = pointById(doc, seg.a);
    const b = pointById(doc, seg.b);
    if (!a || !b) throw new Error(`${ctx}: segment endpoints missing`);
    return { aId: a.id, bId: b.id, a, b };
  }
  if (op.a == null || op.b == null) {
    throw new Error(`${ctx}: need segmentId or a+b point ids`);
  }
  const aId = requirePoint(doc, op.a, ctx);
  const bId = requirePoint(doc, op.b, ctx);
  if (aId === bId) throw new Error(`${ctx}: a and b must differ`);
  const a = pointById(doc, aId);
  const b = pointById(doc, bId);
  return { aId, bId, a, b };
}

/** Infinite-line intersection of AB and CD. Returns {x,y,t,u} or null. */
function lineLineIntersection(a, b, c, d) {
  const x1 = a.x;
  const y1 = a.y;
  const x2 = b.x;
  const y2 = b.y;
  const x3 = c.x;
  const y3 = c.y;
  const x4 = d.x;
  const y4 = d.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t, u };
}

/**
 * Line AB × circle (center c, radius r). Returns [{x,y,t}, …] (0–2).
 */
function lineCircleIntersections(a, b, c, r) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  if (!(A > 1e-18)) return [];
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < -1e-12) return [];
  const hits = [];
  if (Math.abs(disc) <= 1e-12) {
    const t = -B / (2 * A);
    hits.push({ x: a.x + t * dx, y: a.y + t * dy, t });
  } else {
    const s = Math.sqrt(disc);
    const t0 = (-B - s) / (2 * A);
    const t1 = (-B + s) / (2 * A);
    hits.push({ x: a.x + t0 * dx, y: a.y + t0 * dy, t: t0 });
    hits.push({ x: a.x + t1 * dx, y: a.y + t1 * dy, t: t1 });
  }
  return hits;
}

/**
 * Circle × circle. Returns [{x,y}, …] (0–2).
 */
function circleCircleIntersections(c0, r0, c1, r1) {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-12)) return []; // coincident centers
  if (d > r0 + r1 + 1e-9) return [];
  if (d < Math.abs(r0 - r1) - 1e-9) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - a * a;
  const h = h2 < 0 && h2 > -1e-12 ? 0 : Math.sqrt(Math.max(0, h2));
  const mx = c0.x + (a * dx) / d;
  const my = c0.y + (a * dy) / d;
  if (h < 1e-9) return [{ x: mx, y: my }];
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  return [
    { x: mx + rx, y: my + ry },
    { x: mx - rx, y: my - ry },
  ];
}

const HIT_X_EPS = 1e-4;

/** Stable order: x asc; |Δx|≤1e-4 → y asc. */
function sortHitsStable(hits) {
  return hits.slice().sort((p, q) => {
    if (Math.abs(p.x - q.x) > HIT_X_EPS) return p.x - q.x;
    return p.y - q.y;
  });
}

/**
 * Resolve of1/of2: segment/circle id string, or inline {type:"line",a,b}.
 * @returns {{ kind: "line", a: object, b: object } | { kind: "circle", c: object, r: number }}
 */
function resolveOfGeom(doc, of, ctx) {
  if (of == null) throw new Error(`${ctx}: of1/of2 required`);
  if (typeof of === "object") {
    if (of.type === "line") {
      const aId = requirePoint(doc, of.a, ctx);
      const bId = requirePoint(doc, of.b, ctx);
      if (aId === bId) throw new Error(`${ctx}: line endpoints must differ`);
      const a = pointById(doc, aId);
      const b = pointById(doc, bId);
      return { kind: "line", a, b };
    }
    throw new Error(`${ctx}: inline of must be {type:"line",a,b}`);
  }
  const id = String(of);
  const seg = doc.segments.find((s) => s.id === id);
  if (seg) {
    const a = pointById(doc, seg.a);
    const b = pointById(doc, seg.b);
    if (!a || !b) throw new Error(`${ctx}: segment ${id} endpoints missing`);
    return { kind: "line", a, b };
  }
  const cir = doc.circles.find((c) => c.id === id);
  if (cir) {
    const g = circleGeom(doc, id, ctx);
    return { kind: "circle", c: g.c, r: g.r };
  }
  throw new Error(`${ctx}: of id not a segment or circle: ${id}`);
}

function tOnSegment(t, extendLines) {
  if (extendLines) return true;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

/**
 * Compute intersection hits between two resolved geometries.
 * @returns {{ x: number, y: number, t?: number, u?: number }[]}
 */
function computeIntersections(g1, g2, extendLines) {
  if (g1.kind === "line" && g2.kind === "line") {
    const hit = lineLineIntersection(g1.a, g1.b, g2.a, g2.b);
    if (!hit) return [];
    if (!tOnSegment(hit.t, extendLines) || !tOnSegment(hit.u, extendLines)) {
      return [];
    }
    return [hit];
  }
  if (g1.kind === "line" && g2.kind === "circle") {
    return lineCircleIntersections(g1.a, g1.b, g2.c, g2.r).filter((h) =>
      tOnSegment(h.t, extendLines)
    );
  }
  if (g1.kind === "circle" && g2.kind === "line") {
    return lineCircleIntersections(g2.a, g2.b, g1.c, g1.r).filter((h) =>
      tOnSegment(h.t, extendLines)
    );
  }
  if (g1.kind === "circle" && g2.kind === "circle") {
    return circleCircleIntersections(g1.c, g1.r, g2.c, g2.r);
  }
  return [];
}

/**
 * Pick one hit when two exist and id2 is not set.
 * Priority: avoidPointId → nearPointId → pick.
 */
function disambiguateHit(hits, op, doc) {
  const sorted = sortHitsStable(hits);
  if (sorted.length <= 1) return sorted[0] || null;
  if (op.avoidPointId) {
    requirePoint(doc, op.avoidPointId, "addIntersection");
    const ref = pointById(doc, op.avoidPointId);
    let best = sorted[0];
    let bestD = -1;
    for (const h of sorted) {
      const d = Math.hypot(h.x - ref.x, h.y - ref.y);
      if (d > bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }
  if (op.nearPointId) {
    requirePoint(doc, op.nearPointId, "addIntersection");
    const ref = pointById(doc, op.nearPointId);
    let best = sorted[0];
    let bestD = Infinity;
    for (const h of sorted) {
      const d = Math.hypot(h.x - ref.x, h.y - ref.y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }
  const pick = op.pick != null ? String(op.pick).toLowerCase() : "first";
  if (pick === "left") {
    return sorted.slice().sort((p, q) => p.x - q.x || p.y - q.y)[0];
  }
  if (pick === "right") {
    return sorted.slice().sort((p, q) => q.x - p.x || p.y - q.y)[0];
  }
  if (pick === "top" || pick === "above") {
    return sorted.slice().sort((p, q) => p.y - q.y || p.x - q.x)[0];
  }
  if (pick === "bottom" || pick === "below") {
    return sorted.slice().sort((p, q) => q.y - p.y || p.x - q.x)[0];
  }
  if (pick === "1" || pick === "second") return sorted[1];
  // 0 | first | default
  return sorted[0];
}

function pointOnCircle(c, r, angle) {
  return { x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) };
}

function resolveCircleAngle(doc, geom, op, ctx) {
  if (op.touchId || op.throughId || op.pointId) {
    const pid = op.touchId || op.throughId || op.pointId;
    requirePoint(doc, pid, ctx);
    const p = pointById(doc, pid);
    return Math.atan2(p.y - geom.c.y, p.x - geom.c.x);
  }
  if (op.angle != null) {
    const a = Number(op.angle);
    if (!Number.isFinite(a)) throw new Error(`${ctx}: angle must be finite`);
    return a;
  }
  if (op.deg != null) {
    const d = Number(op.deg);
    if (!Number.isFinite(d)) throw new Error(`${ctx}: deg must be finite`);
    return (d * Math.PI) / 180;
  }
  return 0;
}

const DEFAULT_LAYERS = {
  gridShow: true,
  gridLock: false,
  coordsShow: true,
  coordsLock: false,
  helpersShow: true,
  helpersLock: true,
  solutionShow: true,
};

function normalizeLayers(raw) {
  const base = { ...DEFAULT_LAYERS };
  if (!raw || typeof raw !== "object") return base;
  for (const k of Object.keys(DEFAULT_LAYERS)) {
    if (raw[k] != null) base[k] = !!raw[k];
  }
  return base;
}

function styleOr(s, fallback = "solid") {
  if (s == null || s === "") return fallback;
  if (!LINE_STYLES.has(s)) throw new Error(`invalid line style: ${s}`);
  return s;
}

function optionalPositive(v) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !(n > 0)) return undefined;
  return n;
}

function curveExtras(c) {
  const extra = {};
  if (!c || typeof c !== "object") return extra;
  if (c.style != null && c.style !== "") {
    if (c.style !== "solid" && c.style !== "dashed" && c.style !== "dotted") {
      throw new Error(`invalid curve style: ${c.style}`);
    }
    extra.style = c.style;
  }
  if (c.color != null && String(c.color).trim() !== "") {
    extra.color = String(c.color).trim();
  }
  if (c.domain != null) {
    if (!Array.isArray(c.domain) || c.domain.length < 2) {
      throw new Error("curve domain must be [uMin, uMax]");
    }
    const a = Number(c.domain[0]);
    const b = Number(c.domain[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error("curve domain must be finite numbers");
    }
    extra.domain = [a, b];
  }
  return extra;
}

function resolveCoordPlot(doc, plotId) {
  const plots = doc.coordPlots || [];
  if (plotId != null && plotId !== "") {
    return plots.find((p) => p.id === plotId) || null;
  }
  return plots.length ? plots[plots.length - 1] : null;
}

function readMathUV(op) {
  const hasU = op.u != null || op.mathX != null;
  const hasV = op.v != null || op.mathY != null;
  if (!hasU && !hasV) return null;
  return {
    u: Number(op.u != null ? op.u : op.mathX),
    v: Number(op.v != null ? op.v : op.mathY),
  };
}

/**
 * Place a point in a coord plot's math space and optional axis projections.
 * Missing plot → console.warn + skip (no throw), same as addIntersection.
 */
function placePlotPoint(doc, op, nextId, ctx) {
  const plot = resolveCoordPlot(doc, op.plotId);
  if (!plot) {
    console.warn(`${ctx}: plot not found; skipped`, {
      plotId: op.plotId != null ? op.plotId : null,
    });
    return doc;
  }
  const uv = readMathUV(op);
  const u = uv ? uv.u : NaN;
  const v = uv ? uv.v : NaN;
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    throw new Error(`${ctx}: u,v (or mathX,mathY) must be finite`);
  }
  const w = coordWorldFromAxis(plot, u, v);
  const id = resolveId(op, nextId, "p");
  if (doc.points.some((p) => p.id === id)) throw new Error(`${ctx}: duplicate id ${id}`);
  const p = { id, x: w.x, y: w.y };
  if (op.marker) p.marker = op.marker;
  if (op.hidden === true) p.hidden = true;
  stampAppearance(p, op);
  doc.points.push(p);
  maybeInlineLabel(doc, op, nextId, p, { legacyOxOy: true, stringify: true, passSize: true });
  const style = styleOr(op.projectStyle, "dashed");
  if (op.projectX === true) addAxisProjection(doc, nextId, plot, p, "x", u, style, op.xTickLabel, op);
  if (op.projectY === true) addAxisProjection(doc, nextId, plot, p, "y", v, style, op.yTickLabel, op);
  return doc;
}

function addAxisProjection(doc, nextId, plot, point, axis, math, style, tickLabel, appearance) {
  const footW =
    axis === "x" ? coordWorldFromAxis(plot, math, 0) : coordWorldFromAxis(plot, 0, math);
  const foot = pushPoint(doc, nextId, footW.x, footW.y, undefined, undefined, true, appearance);
  if (foot.id !== point.id) pushSegment(doc, nextId, point.id, foot.id, style, undefined, appearance);
  if (tickLabel != null && String(tickLabel) !== "") {
    const lab = {
      id: nextId("lab"),
      pointId: foot.id,
      text: String(tickLabel),
      ox: axis === "y" ? -18 : 0,
      oy: axis === "x" ? 16 : 0,
      size: doc.labelFontSize || 16,
    };
    if (appearance) stampAppearance(lab, appearance);
    doc.labels.push(lab);
  }
}

function defaultCurveParams(type) {
  if (type === "line") return { m: -1, c: 4 };
  if (type === "vline") return { x: 0 };
  if (type === "quad") return { a: 1, b: 0, c: 0 };
  if (type === "log" || type === "log10") return { a: 1, base: 10 };
  if (type === "ln") return { a: 1 };
  if (type === "exp") return { a: 1, b: Math.E };
  if (type === "circle") {
    return { h: 0, k: 0, r: 2, r2: 4, D: 0, E: 0, F: -4, circleForm: "general" };
  }
  if (type === "sin" || type === "cos" || type === "tan") {
    return { A: 1, B: 1, C: 0, D: 0 };
  }
  return {};
}

function defaultCurveLabel(lab) {
  const d = {
    show: false,
    kind: "formula",
    formulaMode: "algebraic",
    customText: "",
    t: 0.55,
    n: 0.55,
  };
  if (!lab || typeof lab !== "object") return d;
  const customText =
    lab.customText != null ? String(lab.customText) : lab.text != null ? String(lab.text) : "";
  // Explicit kind:"formula" wins. Otherwise text / customText means a custom label.
  let kind = "formula";
  if (lab.kind === "formula") kind = "formula";
  else if (lab.kind === "custom" || customText.trim() !== "") kind = "custom";
  const show =
    lab.show != null ? !!lab.show : kind === "custom" && customText.trim() !== "";
  return {
    show,
    kind,
    formulaMode: lab.formulaMode === "numeric" ? "numeric" : "algebraic",
    customText,
    t: Number.isFinite(Number(lab.t)) ? Math.min(1, Math.max(0, Number(lab.t))) : d.t,
    n: Number.isFinite(Number(lab.n)) ? Math.min(6, Math.max(-6, Number(lab.n))) : d.n,
  };
}

function rightAngleMode(op) {
  if (!op || typeof op !== "object") return "2d";
  if (op.skew === true || op.mode === "3d" || op.mode === "3D") return "3d";
  return "2d";
}

function solidCellSpan(spec) {
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const row of spec.pts || []) {
    const c = Number(row[0]);
    const r = Number(row[1]);
    if (Number.isFinite(c)) {
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    if (Number.isFinite(r)) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
  }
  return {
    cellW: Math.max(1, maxC - minC),
    cellH: Math.max(1, maxR - minR),
  };
}

function baseCenterOfSolid(kind, created) {
  if (kind === "cone") {
    const o = created[0];
    return o ? { x: o.x, y: o.y } : null;
  }
  if (kind === "pyramid") {
    const base = [0, 1, 2, 3].map((i) => created[i]).filter(Boolean);
    if (base.length < 3) return null;
    return {
      x: base.reduce((s, p) => s + p.x, 0) / base.length,
      y: base.reduce((s, p) => s + p.y, 0) / base.length,
    };
  }
  return null;
}

/**
 * Pyramid/cone apex offset, optional base center + dotted height,
 * cylinder/cone water ellipse. Omitted fields leave the template alone.
 */
function finishSolidExtras(doc, nextId, kind, created, op, prefix) {
  const spec = BUILTIN_TEMPLATES[kind];
  if (!spec || !created.length) return;
  const vIndex = (spec.pts || []).findIndex((row) => row[2] === "V");
  const vPt = vIndex >= 0 ? created[vIndex] : null;
  if (
    vPt &&
    (kind === "pyramid" || kind === "cone") &&
    Array.isArray(op.apexOffset) &&
    op.apexOffset.length >= 2
  ) {
    const dx = Number(op.apexOffset[0]);
    const dy = Number(op.apexOffset[1]);
    if (Number.isFinite(dx)) vPt.x += dx;
    if (Number.isFinite(dy)) vPt.y += dy;
  }
  const wantCenter = op.includeBaseCenter === true || op.drawHeight === true;
  if (wantCenter && vPt && (kind === "pyramid" || kind === "cone")) {
    const pos = baseCenterOfSolid(kind, created);
    if (pos) {
      const center = pushPoint(doc, nextId, pos.x, pos.y, prefix ? `${prefix}O` : "O");
      if (op.drawHeight === true) {
        pushSegment(
          doc,
          nextId,
          center.id,
          vPt.id,
          "dotted",
          prefix ? `${prefix}sOV` : undefined
        );
      }
    }
  }
  const level = Number(op.waterLevel);
  if ((kind === "cylinder" || kind === "cone") && Number.isFinite(level) && level > 0 && level < 1) {
    addWaterEllipse(doc, nextId, kind, created, level, prefix);
  }
}

/** Horizontal water ellipse: local radius at height fraction t (0 bottom → 1 top/apex). */
function addWaterEllipse(doc, nextId, kind, created, t, prefix) {
  let cx;
  let cy;
  let rx;
  let ry;
  if (kind === "cylinder") {
    const bottom = created[0];
    const top = created[4];
    const rxPt = created[1];
    const ryPt = created[2];
    if (!bottom || !top || !rxPt || !ryPt) return;
    cx = bottom.x + (top.x - bottom.x) * t;
    cy = bottom.y + (top.y - bottom.y) * t;
    rx = Math.hypot(rxPt.x - bottom.x, rxPt.y - bottom.y);
    ry = Math.hypot(ryPt.x - bottom.x, ryPt.y - bottom.y);
  } else {
    const base = created[0];
    const apex = created[4];
    const rxPt = created[1];
    const ryPt = created[2];
    if (!base || !apex || !rxPt || !ryPt) return;
    const k = 1 - t;
    cx = base.x + (apex.x - base.x) * t;
    cy = base.y + (apex.y - base.y) * t;
    rx = Math.hypot(rxPt.x - base.x, rxPt.y - base.y) * k;
    ry = Math.hypot(ryPt.x - base.x, ryPt.y - base.y) * k;
  }
  if (!(rx > 0.5) || !(ry > 0.5)) return;
  const c = pushPoint(doc, nextId, cx, cy, prefix ? `${prefix}wC` : undefined, undefined, true);
  const rxP = pushPoint(
    doc,
    nextId,
    cx + rx,
    cy,
    prefix ? `${prefix}wX` : undefined,
    undefined,
    true
  );
  const ryP = pushPoint(
    doc,
    nextId,
    cx,
    cy + ry,
    prefix ? `${prefix}wY` : undefined,
    undefined,
    true
  );
  doc.ellipses.push({
    id: nextId("ell"),
    centerId: c.id,
    rxId: rxP.id,
    ryId: ryP.id,
    style: "solid",
    backDashed: true,
  });
}

function finiteOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Clip inequalities to a polygon fill on a coord plot.
 * Missing plot warns and skips. An unparseable inequality warns and is skipped.
 * Strict inequalities clip as closed half-planes; their boundary stroke is dashed.
 */
function applyFeasibleRegion(doc, op, nextId, ctx) {
  if (!Array.isArray(op.inequalities)) {
    throw new Error(`${ctx}: inequalities required`);
  }
  const plot = resolveCoordPlot(doc, op.plotId);
  if (!plot) {
    console.warn(`${ctx}: coord plot not found; skipped`, {
      plotId: op.plotId != null ? op.plotId : null,
    });
    return doc;
  }
  const planes = [];
  for (const raw of op.inequalities) {
    const plane = parseInequality(raw);
    if (!plane) {
      console.warn(`${ctx}: unparseable inequality; skipped`, { inequality: raw });
      continue;
    }
    planes.push(plane);
  }
  if (!planes.length) {
    console.warn(`${ctx}: no valid inequalities; skipped`);
    return doc;
  }
  const bounds = feasibleDomain(plot, op.domainClip, ctx);
  if (!bounds) return doc;
  const solved = solveFeasibleRegion(bounds, planes, {
    drawBoundaries: op.drawBoundaries === true,
  });
  if (solved.empty) {
    console.warn(`${ctx}: empty feasible region; skipped fill`, {
      plotId: plot.id,
    });
  } else {
    const pointIds = [];
    for (const v of solved.vertices) {
      const w = coordWorldFromAxis(plot, v.u, v.v);
      pointIds.push(pushPoint(doc, nextId, w.x, w.y, undefined, undefined, true, op).id);
    }
    const pattern = op.pattern == null || op.pattern === "" ? "hatch" : op.pattern;
    const fillOp = {
      kind: "polygon",
      pointIds,
      pattern,
      color: op.color,
      opacity: op.opacity,
      ...appearanceFields(op),
    };
    if (op.id != null && op.id !== "") fillOp.id = op.id;
    if (op.hatchSpacing != null) fillOp.hatchSpacing = op.hatchSpacing;
    HANDLERS.addFill(doc, fillOp, nextId);
    if (op.label != null && String(op.label) !== "" && solved.centroid) {
      const w = coordWorldFromAxis(plot, solved.centroid.u, solved.centroid.v);
      HANDLERS.addText(
        doc,
        {
          x: w.x,
          y: w.y,
          text: String(op.label),
          align: "center",
          bold: true,
          ...appearanceFields(op),
        },
        nextId
      );
    }
  }
  if (!Array.isArray(plot.curves)) plot.curves = [];
  for (const b of solved.boundaries) {
    const label = b.label
      ? { show: true, kind: "custom", customText: b.label, text: b.label }
      : undefined;
    const boundary = {
      id: nextId("curve"),
      type: b.type,
      params: { ...defaultCurveParams(b.type), ...b.params },
      label: defaultCurveLabel(label),
      ...curveExtras({ style: b.style }),
    };
    stampAppearance(boundary, op);
    plot.curves.push(boundary);
  }
  return doc;
}

function feasibleDomain(plot, raw, ctx) {
  let uMin = finiteOr(plot.xmin, -2);
  let uMax = finiteOr(plot.xmax, 6);
  let vMin = finiteOr(plot.ymin, -2);
  let vMax = finiteOr(plot.ymax, 6);
  if (raw != null) {
    const ok =
      Array.isArray(raw) &&
      raw.length >= 4 &&
      raw.slice(0, 4).every((n) => Number.isFinite(Number(n)));
    if (!ok) {
      console.warn(`${ctx}: domainClip must be [uMin, uMax, vMin, vMax]; using plot window`);
    } else {
      uMin = Number(raw[0]);
      uMax = Number(raw[1]);
      vMin = Number(raw[2]);
      vMax = Number(raw[3]);
    }
  }
  if (uMin > uMax) {
    const t = uMin;
    uMin = uMax;
    uMax = t;
  }
  if (vMin > vMax) {
    const t = vMin;
    vMin = vMax;
    vMax = t;
  }
  if (!(uMax - uMin > 1e-12) || !(vMax - vMin > 1e-12)) {
    console.warn(`${ctx}: domain clip has no area; skipped`);
    return null;
  }
  return { uMin, uMax, vMin, vMax };
}

function examApi() {
  return {
    requirePoint,
    pointById,
    pushPoint,
    pushSegment,
    handlers: HANDLERS,
    inlinePointLabel: maybeInlineLabel,
  };
}

/**
 * Finite numeric offset, or null when the caller omitted it.
 * `0` is explicit. Booleans, blanks, and non-finite values are omitted.
 */
function finiteOffset(v) {
  if (typeof v === "boolean") return null;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normAngle(a) {
  const t = Math.PI * 2;
  let x = a % t;
  if (x < 0) x += t;
  return x;
}

function pointRecord(doc, id) {
  return (doc.points || []).find((p) => p.id === id) || null;
}

/** Angles of segments that end at pointId, from the point toward the other end. */
function incidentSegmentAngles(doc, pointId) {
  const p = pointRecord(doc, pointId);
  if (!p) return [];
  const angles = [];
  for (const s of doc.segments || []) {
    const otherId = s.a === pointId ? s.b : s.b === pointId ? s.a : null;
    if (!otherId) continue;
    const q = pointRecord(doc, otherId);
    if (!q) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    if (Math.hypot(dx, dy) < 1e-9) continue;
    angles.push(Math.atan2(dy, dx));
  }
  return angles;
}

/**
 * Outward normals (center → point) for circles the point lies on.
 * On-circle tolerance is max(1e-3, 1e-6·r) world units. Ellipses and sectors
 * are not treated as circles.
 */
function circleOutwardAngles(doc, pointId) {
  const p = pointRecord(doc, pointId);
  if (!p) return [];
  const out = [];
  for (const cir of doc.circles || []) {
    if (cir.centerId === pointId) continue;
    const c = pointRecord(doc, cir.centerId);
    const thr = pointRecord(doc, cir.throughId);
    if (!c || !thr) continue;
    const r = Math.hypot(thr.x - c.x, thr.y - c.y);
    if (!(r > 1e-9)) continue;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(d - r) <= Math.max(1e-3, 1e-6 * r)) {
      out.push(Math.atan2(dy, dx));
    }
  }
  return out;
}

/** Unit-vector mean. Returns the first angle when the vectors cancel. */
function averageAngle(angles) {
  let x = 0;
  let y = 0;
  for (const a of angles) {
    x += Math.cos(a);
    y += Math.sin(a);
  }
  if (Math.hypot(x, y) < 1e-9) return angles[0];
  return Math.atan2(y, x);
}

/**
 * Bisector of the largest angular gap.
 * Equal gaps (within 1e-9): prefer the more upward bisector (−y), then +x.
 */
function bisectLargestGap(angles) {
  const sorted = angles.map(normAngle).sort((u, v) => u - v);
  let bestGap = -1;
  const mids = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
    const gap = next - cur;
    const mid = cur + gap / 2;
    if (gap > bestGap + 1e-9) {
      bestGap = gap;
      mids.length = 0;
      mids.push(mid);
    } else if (Math.abs(gap - bestGap) <= 1e-9) {
      mids.push(mid);
    }
  }
  if (mids.length <= 1) return mids[0] || 0;
  mids.sort((u, v) => {
    const su = Math.sin(u);
    const sv = Math.sin(v);
    if (Math.abs(su - sv) > 1e-9) return su - sv;
    return Math.cos(v) - Math.cos(u);
  });
  return mids[0];
}

function roundPolar(dist, theta) {
  const round = (n) => {
    const r = Math.round(n);
    return r === 0 ? 0 : r;
  };
  return {
    ox: round(dist * Math.cos(theta)),
    oy: round(dist * Math.sin(theta)),
  };
}

/** True when theta is not pointing against the preferred outward angle. */
function pointsAlong(theta, preferred) {
  if (preferred == null || !Number.isFinite(preferred)) return true;
  return Math.cos(theta) * Math.cos(preferred) + Math.sin(theta) * Math.sin(preferred) >= -1e-9;
}

/**
 * Smart label offset. Isolated points (no segment, not on a circle) stay (0, -14).
 * A circle outward normal replaces a segment-based direction only when that
 * direction would put the label inside the circle.
 */
function computeSmartLabelOffset(doc, pointId, dist) {
  const angles = incidentSegmentAngles(doc, pointId);
  const outward = circleOutwardAngles(doc, pointId);
  const preferred = outward.length ? averageAngle(outward) : null;
  if (angles.length >= 2) {
    let theta = bisectLargestGap(angles);
    if (preferred != null && !pointsAlong(theta, preferred)) theta = preferred;
    return roundPolar(dist, theta);
  }
  if (angles.length === 1) {
    let theta = angles[0] + Math.PI;
    if (preferred != null && !pointsAlong(theta, preferred)) theta = preferred;
    return roundPolar(dist, theta);
  }
  if (preferred != null) return roundPolar(dist, preferred);
  return { ox: 0, oy: -14 };
}

/** Session flag. Not enumerable, so save JSON does not gain a private field. */
function setAutoFlag(lab, value) {
  Object.defineProperty(lab, "_autoOffset", {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

function labelIsAuto(lab) {
  if (!lab || typeof lab !== "object") return false;
  if (lab._autoOffset === false) return false;
  if (lab._autoOffset === true || lab.autoOffset === true) {
    setAutoFlag(lab, true);
    lab.autoOffset = true;
    return true;
  }
  return false;
}

/** Recompute labels marked auto. `onlyPointIds` limits the pass to new segment ends. */
function refreshAutoLabels(doc, onlyPointIds) {
  const limit = onlyPointIds ? new Set(onlyPointIds) : null;
  for (const lab of doc.labels || []) {
    if (!lab || (limit && !limit.has(lab.pointId))) continue;
    if (!labelIsAuto(lab)) continue;
    if (!pointRecord(doc, lab.pointId)) continue;
    const stored = finiteOffset(lab.offsetDist);
    const dist = stored != null ? stored : 16;
    const off = computeSmartLabelOffset(doc, lab.pointId, dist);
    lab.ox = off.ox;
    lab.oy = off.oy;
  }
}

/**
 * Inline label on a construction op.
 * `label: true` → text is the point id; a non-empty string is used as text.
 * Hidden points are skipped. `labelOx` / `labelOy` are explicit; when
 * `legacyOxOy` is set, numeric `ox` / `oy` are explicit too (triangle centres,
 * plot points). Omitted numbers use the smart offset.
 * `id2` intersections label only the point passed in.
 */
function maybeInlineLabel(doc, op, nextId, point, opts = {}) {
  if (!point || point.hidden === true) return;
  let text = null;
  if (op.label === true) text = point.id;
  else if (typeof op.label === "string" && op.label !== "") text = op.label;
  else if (opts.stringify && op.label != null && String(op.label) !== "") text = String(op.label);
  else return;
  const lab = { pointId: point.id, text };
  const prefixOx = finiteOffset(op.labelOx);
  const prefixOy = finiteOffset(op.labelOy);
  const ox = prefixOx != null ? prefixOx : opts.legacyOxOy ? finiteOffset(op.ox) : null;
  const oy = prefixOy != null ? prefixOy : opts.legacyOxOy ? finiteOffset(op.oy) : null;
  if (ox != null) lab.ox = ox;
  if (oy != null) lab.oy = oy;
  if (opts.passSize && op.size != null) lab.size = op.size;
  const dist = finiteOffset(op.offsetDist);
  if (dist != null && ox == null && oy == null) lab.offsetDist = dist;
  Object.assign(lab, appearanceFields(op));
  HANDLERS.addLabel(doc, lab, nextId);
}

function resolveId(op, nextId, prefix) {
  if (op.id != null && op.id !== "") {
    if (typeof op.id !== "string") throw new Error("id must be a string");
    return nextId.claim(op.id);
  }
  return nextId(prefix);
}

/** @type {Record<string, function>} */
const HANDLERS = {
  addPoint(doc, op, nextId) {
    if (op.u != null || op.v != null || op.mathX != null || op.mathY != null) {
      return placePlotPoint(doc, op, nextId, "addPoint");
    }
    const id = resolveId(op, nextId, "p");
    if (doc.points.some((p) => p.id === id)) throw new Error(`addPoint: duplicate id ${id}`);
    const x = Number(op.x);
    const y = Number(op.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("addPoint: x,y must be finite numbers");
    }
    const p = { id, x, y };
    if (op.marker) p.marker = op.marker;
    if (op.hidden === true) p.hidden = true;
    stampAppearance(p, op);
    doc.points.push(p);
    maybeInlineLabel(doc, op, nextId, p);
    return doc;
  },

  addSegment(doc, op, nextId) {
    const id = resolveId(op, nextId, "s");
    if (doc.segments.some((s) => s.id === id)) throw new Error(`addSegment: duplicate id ${id}`);
    const a = requirePoint(doc, op.a, "addSegment");
    const b = requirePoint(doc, op.b, "addSegment");
    if (a === b) throw new Error("addSegment: a and b must differ");
    const dup = doc.segments.some(
      (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a)
    );
    if (dup) throw new Error(`addSegment: segment already exists between ${a} and ${b}`);
    const seg = {
      id,
      a,
      b,
      style: styleOr(op.style, "solid"),
    };
    stampAppearance(seg, op);
    doc.segments.push(seg);
    refreshAutoLabels(doc, [a, b]);
    return doc;
  },

  addLabel(doc, op, nextId) {
    const id = resolveId(op, nextId, "lab");
    const pointId = requirePoint(doc, op.pointId, "addLabel");
    const text = op.text != null ? String(op.text) : "";
    // One label per point (matches UI)
    doc.labels = doc.labels.filter((l) => l.pointId !== pointId);
    const oxN = finiteOffset(op.ox);
    const oyN = finiteOffset(op.oy);
    // A number on either axis wins over auto / autoOffset and is never rewritten.
    const explicit = oxN != null || oyN != null;
    const size = op.size != null ? Number(op.size) : doc.labelFontSize || 16;
    const lab = {
      id,
      pointId,
      text,
      ox: explicit ? (oxN != null ? oxN : 0) : 0,
      oy: explicit ? (oyN != null ? oyN : -14) : -14,
      size,
    };
    if (!explicit) {
      const distN = finiteOffset(op.offsetDist);
      const dist = distN != null ? distN : 16;
      const off = computeSmartLabelOffset(doc, pointId, dist);
      lab.ox = off.ox;
      lab.oy = off.oy;
      // Durable flag. `_autoOffset` is rebuilt from this after a save drops the private field.
      lab.autoOffset = true;
      if (distN != null) lab.offsetDist = distN;
      setAutoFlag(lab, true);
    } else {
      setAutoFlag(lab, false);
    }
    stampAppearance(lab, op);
    doc.labels.push(lab);
    return doc;
  },

  /**
   * Free-floating caption (not bound to a point).
   * Required: x, y, text. Optional: id, size, align (center|left|right), bold.
   */
  addText(doc, op, nextId) {
    const id = resolveId(op, nextId, "txt");
    const x = Number(op.x);
    const y = Number(op.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("addText: x,y must be finite");
    }
    if (op.text == null) throw new Error("addText: text required");
    const text = String(op.text);
    const size = op.size != null ? Number(op.size) : doc.labelFontSize || 16;
    let align = op.align != null ? String(op.align).toLowerCase() : "center";
    if (align !== "left" && align !== "right" && align !== "center") align = "center";
    const bold = !!op.bold;
    if (!Array.isArray(doc.texts)) doc.texts = [];
    const row = { id, x, y, text, size, align, bold };
    stampAppearance(row, op);
    doc.texts.push(row);
    return doc;
  },

  addRightAngle(doc, op, nextId) {
    const id = resolveId(op, nextId, "ra");
    const vertex = requirePoint(doc, op.vertex, "addRightAngle");
    const arm1 = requirePoint(doc, op.arm1, "addRightAngle");
    const arm2 = requirePoint(doc, op.arm2, "addRightAngle");
    const row = {
      id,
      vertex,
      arm1,
      arm2,
      size: op.size != null ? Number(op.size) : doc.rightAngleSize || 10,
    };
    // Omitted mode stays the paper-sized 2D mark (today's geometry).
    if (rightAngleMode(op) === "3d") row.mode = "3d";
    stampAppearance(row, op);
    doc.rightAngles.push(row);
    return doc;
  },

  addAngleArc(doc, op, nextId) {
    const id = resolveId(op, nextId, "arc");
    const vertex = requirePoint(doc, op.vertex, "addAngleArc");
    const arm1 = requirePoint(doc, op.arm1, "addAngleArc");
    const arm2 = requirePoint(doc, op.arm2, "addAngleArc");
    /** @type {{ id: string, vertex: string, arm1: string, arm2: string, size: number, group: number, text: string, reflex: boolean, textRadiusOffset?: number, textOx?: number, textOy?: number }} */
    let size = DEFAULT_ARC_SIZE;
    if (op.size != null && op.size !== "") {
      const n = Number(op.size);
      if (Number.isFinite(n) && n > 0) size = n;
    }
    const row = {
      id,
      vertex,
      arm1,
      arm2,
      size,
      group: op.group ? 1 : 0,
      text: op.text != null ? String(op.text) : "",
      reflex: !!op.reflex,
    };
    if (op.clamp === false || op.forceRadius === true) row.clamp = false;
    if (op.textRadiusOffset != null && Number.isFinite(Number(op.textRadiusOffset))) {
      row.textRadiusOffset = Number(op.textRadiusOffset);
    }
    if (op.textOx != null && Number.isFinite(Number(op.textOx))) {
      row.textOx = Number(op.textOx);
    }
    if (op.textOy != null && Number.isFinite(Number(op.textOy))) {
      row.textOy = Number(op.textOy);
    }
    stampAppearance(row, op);
    doc.angleArcs.push(row);
    return doc;
  },

  /** Alias: reflex angle mark (>180°). */
  addReflex(doc, op, nextId) {
    return HANDLERS.addAngleArc(doc, { ...op, reflex: true }, nextId);
  },

  addParallelMark(doc, op, nextId) {
    const id = resolveId(op, nextId, "pm");
    requireSegment(doc, op.segmentId, "addParallelMark");
    const row = {
      id,
      segmentId: op.segmentId,
      group: op.group ? 1 : 0,
      side: op.side === -1 ? -1 : 1,
    };
    stampAppearance(row, op);
    doc.parallelMarks.push(row);
    return doc;
  },

  /**
   * Dedicated box-and-whisker plot (not assembled from rects/segments).
   * Tick positions are caller-supplied — never invent equal spacing.
   */
  addBoxWhisker(doc, op, nextId) {
    const id = resolveId(op, nextId, "bw");
    const bw = normalizeBoxWhisker({ ...op, id }, { requireId: true });
    if (doc.boxWhiskers.some((x) => x.id === id)) {
      throw new Error(`addBoxWhisker: duplicate id ${id}`);
    }
    doc.boxWhiskers.push(bw);
    return doc;
  },

  /**
   * Dedicated bar / column chart (categories + heights + axes + grid).
   * yLabel is written along the vertical axis (rotate −90° or stacked glyphs).
   * barPattern "hatch" draws parallel slanted strokes inside bars.
   */
  addBarChart(doc, op, nextId) {
    const id = resolveId(op, nextId, "bc");
    const bc = normalizeBarChart({ ...op, id }, { requireId: true });
    if (doc.barCharts.some((x) => x.id === id)) {
      throw new Error(`addBarChart: duplicate id ${id}`);
    }
    doc.barCharts.push(bc);
    return doc;
  },

  addEqualMark(doc, op, nextId) {
    const id = resolveId(op, nextId, "em");
    requireSegment(doc, op.segmentId, "addEqualMark");
    const row = {
      id,
      segmentId: op.segmentId,
      group: op.group ? 1 : 0,
      side: op.side === -1 ? -1 : 1,
    };
    stampAppearance(row, op);
    doc.equalMarks.push(row);
    return doc;
  },

  addLengthLabel(doc, op, nextId) {
    const id = resolveId(op, nextId, "ll");
    requireSegment(doc, op.segmentId, "addLengthLabel");
    const style =
      op.style === "dim" || op.style === 2 || op.style === "2"
        ? "dim"
        : op.style === "arcs" || op.style === 3 || op.style === "3"
          ? "arcs"
          : op.style === "ends" ||
              op.style === "endArcs" ||
              op.style === 4 ||
              op.style === "4"
            ? "ends"
            : "text";
    const orient =
      op.orient === "horizontal" || op.orient === "h" || op.orient === "fixed"
        ? "horizontal"
        : "tilt";
    const stroke =
      op.stroke === "solid" || op.stroke === "dashed" || op.stroke === "dotted"
        ? op.stroke
        : "dotted";
    const seg = doc.segments.find((s) => s.id === op.segmentId);
    const pa = seg ? pointById(doc, seg.a) : null;
    const pb = seg ? pointById(doc, seg.b) : null;
    /** @type {{ id: string, segmentId: string, text: string, side: 1|-1, style: string, orient: string, stroke?: string, size?: number }} */
    const row = {
      id,
      segmentId: op.segmentId,
      text: op.text != null ? String(op.text) : "",
      side: normalizeLengthSide(op.side, pa, pb),
      style,
      orient,
    };
    if (style === "arcs") row.stroke = stroke;
    if (op.size != null && Number.isFinite(Number(op.size))) {
      row.size = Math.min(48, Math.max(10, Math.round(Number(op.size))));
    }
    stampAppearance(row, op);
    doc.lengthLabels.push(row);
    return doc;
  },

  addMidTick(doc, op, nextId) {
    const id = resolveId(op, nextId, "mt");
    requireSegment(doc, op.segmentId, "addMidTick");
    const pointId = op.pointId ? requirePoint(doc, op.pointId, "addMidTick") : null;
    const m = { id, segmentId: op.segmentId };
    if (pointId) m.pointId = pointId;
    doc.midTicks.push(m);
    return doc;
  },

  /**
   * Foot of perpendicular: project pointId onto the line through a segment
   * (segmentId) or through endpoints a/b. Creates foot point (marker "foot")
   * and optional altitude segment (drawSegment default true).
   */
  addFoot(doc, op, nextId) {
    const fromId = requirePoint(doc, op.pointId, "addFoot");
    const from = pointById(doc, fromId);
    let a;
    let b;
    if (op.segmentId) {
      requireSegment(doc, op.segmentId, "addFoot");
      const seg = doc.segments.find((s) => s.id === op.segmentId);
      a = pointById(doc, seg.a);
      b = pointById(doc, seg.b);
    } else {
      const aId = op.a != null ? op.a : op.lineA;
      const bId = op.b != null ? op.b : op.lineB;
      requirePoint(doc, aId, "addFoot");
      requirePoint(doc, bId, "addFoot");
      a = pointById(doc, aId);
      b = pointById(doc, bId);
    }
    if (!a || !b) throw new Error("addFoot: line endpoints missing");
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 1e-18)) throw new Error("addFoot: line is degenerate");
    const t = ((from.x - a.x) * dx + (from.y - a.y) * dy) / len2;
    const fx = a.x + t * dx;
    const fy = a.y + t * dy;
    if (Math.hypot(from.x - fx, from.y - fy) < 1e-9) {
      throw new Error("addFoot: point already lies on the line");
    }
    const footHint = op.footId != null ? op.footId : op.id;
    const marker = op.marker === false || op.marker === "" ? undefined : op.marker || "foot";
    const foot = pushPoint(doc, nextId, fx, fy, footHint || undefined, marker, undefined, op);
    if (op.label || op.labelText) {
      const text = op.labelText != null ? String(op.labelText) : String(op.label === true ? "H" : op.label);
      HANDLERS.addLabel(
        doc,
        { pointId: foot.id, text, ox: -10, oy: -12, ...appearanceFields(op) },
        nextId
      );
    }
    const drawSeg = op.drawSegment !== false && op.segment !== false;
    if (drawSeg) {
      const style = styleOr(op.style, "solid");
      const segHint = op.altitudeId || (op.idPrefix ? `${op.idPrefix}alt` : undefined);
      try {
        pushSegment(doc, nextId, fromId, foot.id, style, segHint, op);
      } catch (err) {
        // Duplicate altitude is OK (reuse existing).
        if (!String(err.message || err).includes("already exists")) throw err;
      }
    }
    return doc;
  },

  /**
   * Midpoint of a–b or of segmentId. Optional equal-length marks on subsegments.
   * Example: { op:"addMidpoint", id:"M", segmentId:"AB", markEqual:true, equalGroup:0 }
   */
  addMidpoint(doc, op, nextId) {
    const { aId, bId, a, b } = resolveEndpoints(doc, op, "addMidpoint");
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const marker =
      op.marker === false || op.marker === "" ? undefined : op.marker || undefined;
    const mid = pushPoint(
      doc,
      nextId,
      mx,
      my,
      op.id != null && op.id !== "" ? op.id : undefined,
      marker,
      op.hidden === true,
      op
    );
    maybeInlineLabel(doc, op, nextId, mid);
    if (op.markEqual) {
      const group = op.equalGroup != null ? op.equalGroup : 0;
      const style = styleOr(op.style, "solid");
      const look = appearanceFields(op);
      const s1 = ensureSegmentBetween(doc, nextId, aId, mid.id, style, op);
      const s2 = ensureSegmentBetween(doc, nextId, mid.id, bId, style, op);
      HANDLERS.addEqualMark(doc, { segmentId: s1, group, ...look }, nextId);
      HANDLERS.addEqualMark(doc, { segmentId: s2, group, ...look }, nextId);
    }
    return doc;
  },

  /**
   * Ratio / section point on a→b (or segmentId).
   * t wins over m:n; default t=0.5. P = A + t(B−A); or P = (nA + mB)/(m+n).
   * Example: { op:"addRatioPoint", id:"G", a:"A", b:"M", m:2, n:1 }
   */
  addRatioPoint(doc, op, nextId) {
    const { a, b } = resolveEndpoints(doc, op, "addRatioPoint");
    let t;
    if (op.t != null) {
      t = Number(op.t);
      if (!Number.isFinite(t)) throw new Error("addRatioPoint: t must be finite");
    } else if (op.m != null || op.n != null) {
      const m = Number(op.m);
      const n = Number(op.n);
      if (!Number.isFinite(m) || !Number.isFinite(n)) {
        throw new Error("addRatioPoint: m and n must be finite");
      }
      const sum = m + n;
      if (Math.abs(sum) < 1e-15) {
        throw new Error("addRatioPoint: m+n must not be 0");
      }
      // P = (n*A + m*B)/(m+n) ⇒ t = m/(m+n)
      t = m / sum;
    } else {
      t = 0.5;
    }
    const x = a.x + t * (b.x - a.x);
    const y = a.y + t * (b.y - a.y);
    const marker =
      op.marker === false || op.marker === "" ? undefined : op.marker || undefined;
    const p = pushPoint(
      doc,
      nextId,
      x,
      y,
      op.id != null && op.id !== "" ? op.id : undefined,
      marker,
      op.hidden === true,
      op
    );
    maybeInlineLabel(doc, op, nextId, p);
    return doc;
  },

  /**
   * Intersection of two segments/circles (or inline lines).
   * of1/of2: segment|circle id, or {type:"line",a,b}.
   * extendLines default true; false → hit must lie on segment [0,1].
   * Two hits + id2 → both in stable order (x asc, |Δx|≤1e-4 → y asc).
   * Else disambiguate: avoidPointId → nearPointId → pick.
   * Missing intersection → console.warn + skip (no throw).
   */
  addIntersection(doc, op, nextId) {
    if (op.of1 == null || op.of2 == null) {
      throw new Error("addIntersection: of1 and of2 required");
    }
    const g1 = resolveOfGeom(doc, op.of1, "addIntersection");
    const g2 = resolveOfGeom(doc, op.of2, "addIntersection");
    const extendLines = op.extendLines !== false;
    const hits = computeIntersections(g1, g2, extendLines);
    if (!hits.length) {
      console.warn("addIntersection: no intersection; skipped", {
        of1: op.of1,
        of2: op.of2,
        extendLines,
      });
      return doc;
    }
    const marker =
      op.marker === false || op.marker === "" ? undefined : op.marker || undefined;
    const hidden = op.hidden === true;
    const sorted = sortHitsStable(hits);
    const wantBoth = op.id2 != null && op.id2 !== "" && sorted.length >= 2;
    if (wantBoth) {
      const first = pushPoint(doc, nextId, sorted[0].x, sorted[0].y, op.id, marker, hidden, op);
      pushPoint(doc, nextId, sorted[1].x, sorted[1].y, op.id2, marker, hidden, op);
      maybeInlineLabel(doc, op, nextId, first);
      return doc;
    }
    const chosen =
      sorted.length === 1 ? sorted[0] : disambiguateHit(sorted, op, doc);
    if (!chosen) {
      console.warn("addIntersection: no intersection after disambiguation; skipped");
      return doc;
    }
    const hit = pushPoint(
      doc,
      nextId,
      chosen.x,
      chosen.y,
      op.id != null && op.id !== "" ? op.id : undefined,
      marker,
      hidden,
      op
    );
    maybeInlineLabel(doc, op, nextId, hit);
    return doc;
  },

  addCircle(doc, op, nextId) {
    const id = resolveId(op, nextId, "cir");
    const centerId = requirePoint(doc, op.centerId, "addCircle");
    const throughId = requirePoint(doc, op.throughId, "addCircle");
    const c = {
      id,
      centerId,
      throughId,
      style: styleOr(op.style, "solid"),
    };
    stampAppearance(c, op);
    doc.circles.push(c);
    return doc;
  },

  addEllipse(doc, op, nextId) {
    const id = resolveId(op, nextId, "ell");
    const centerId = requirePoint(doc, op.centerId, "addEllipse");
    const rxId = requirePoint(doc, op.rxId, "addEllipse");
    const ryId = requirePoint(doc, op.ryId, "addEllipse");
    const e = {
      id,
      centerId,
      rxId,
      ryId,
      style: styleOr(op.style, "solid"),
    };
    if (op.backDashed) e.backDashed = true;
    stampAppearance(e, op);
    doc.ellipses.push(e);
    return doc;
  },

  addSector(doc, op, nextId) {
    const id = resolveId(op, nextId, "sec");
    const centerId = requirePoint(doc, op.centerId, "addSector");
    const startId = requirePoint(doc, op.startId, "addSector");
    const endId = requirePoint(doc, op.endId, "addSector");
    const mode = op.mode === "sector" ? "sector" : "arc";
    const row = {
      id,
      centerId,
      startId,
      endId,
      style: styleOr(op.style, "solid"),
      mode,
    };
    stampAppearance(row, op);
    doc.sectors.push(row);
    return doc;
  },

  /**
   * Region fill. kind: "polygon" (default) | "sector" | "segment" | "polyArc" | "pathFill".
   * pattern: "solid" (default) | "hatch" — hatch = parallel slanted strokes (exam bar shade).
   * polygon: pointIds ≥3
   * sector: centerId + startId + endId (+ optional circleId)
   * segment (circular): circleId|centerId + startId + endId (chord endpoints)
   */
  addFill(doc, op, nextId) {
    if (op.inequalities != null) {
      return applyFeasibleRegion(doc, op, nextId, "addFill");
    }
    const id = resolveId(op, nextId, "fill");
    if (doc.fills.some((f) => f.id === id)) throw new Error(`addFill: duplicate id ${id}`);
    const kind =
      op.kind === "sector" ||
      op.kind === "segment" ||
      op.kind === "polyArc" ||
      op.kind === "pathFill"
        ? op.kind
        : "polygon";
    const pattern = normalizeFillPattern(op.pattern);
    const explicitColor = op.color != null && String(op.color).trim() !== "";
    const solutionFill = elementRole(op) === "solution" && !explicitColor;
    const color = solutionFill
      ? undefined
      : normalizeFillColor(op.color, pattern === "hatch" ? "#111111" : "#666666");
    const opacity = solutionFill
      ? clampOpacity(op.opacity, pattern === "hatch" ? 1 : 0.25)
      : clampOpacity(op.opacity, pattern === "hatch" ? 1 : 0.2);
    const hatchSpacing =
      op.hatchSpacing != null ? Math.max(2, Number(op.hatchSpacing) || 8) : undefined;
    const withPattern = (f) => {
      if (pattern === "hatch") {
        f.pattern = "hatch";
        if (hatchSpacing != null) f.hatchSpacing = hatchSpacing;
      }
      if (solutionFill) delete f.color;
      stampAppearance(f, op);
      if (solutionFill) delete f.color;
      return f;
    };
    if (kind === "pathFill") {
      // edges: [{type:"line",a,b} | {type:"arc",centerId,from,to, circleId?}, ...]
      // Typical exam slice: two arcs + one chord (order/orientation auto-chained when closable).
      if (!Array.isArray(op.edges) || op.edges.length < 2) {
        throw new Error("addFill(pathFill): edges must be an array of ≥2 edges");
      }
      const edges = [];
      for (const e of op.edges) {
        if (!e || typeof e !== "object") throw new Error("addFill(pathFill): bad edge");
        if (e.type === "line") {
          const a = requirePoint(doc, e.a, "addFill(pathFill line)");
          const b = requirePoint(doc, e.b, "addFill(pathFill line)");
          edges.push({ type: "line", a, b });
        } else if (e.type === "arc") {
          const centerId = requirePoint(doc, e.centerId, "addFill(pathFill arc)");
          const from = requirePoint(doc, e.from, "addFill(pathFill arc)");
          const to = requirePoint(doc, e.to, "addFill(pathFill arc)");
          const edge = {
            type: "arc",
            centerId,
            from,
            to,
          };
          if (e.circleId) {
            requireCircle(doc, e.circleId, "addFill(pathFill arc)");
            edge.circleId = String(e.circleId);
          }
          edges.push(edge);
        } else {
          throw new Error('addFill(pathFill): edge.type must be "line" or "arc"');
        }
      }
      const chained = chainPathFillEdges(edges);
      doc.fills.push(
        withPattern({
          id,
          kind: "pathFill",
          edges: chained || edges,
          color,
          opacity,
        })
      );
      return doc;
    }
    if (kind === "polygon") {
      let pointIds;
      if (Array.isArray(op.mathPoints)) {
        const plot = resolveCoordPlot(doc, op.plotId);
        if (!plot) {
          console.warn("addFill: coord plot not found; skipped", {
            plotId: op.plotId != null ? op.plotId : null,
          });
          return doc;
        }
        if (op.mathPoints.length < 3) {
          throw new Error("addFill(polygon): mathPoints must be an array of ≥3 [u, v] pairs");
        }
        pointIds = [];
        for (const pair of op.mathPoints) {
          if (!Array.isArray(pair) || pair.length < 2) {
            throw new Error("addFill(polygon): mathPoints entries must be [u, v]");
          }
          const u = Number(pair[0]);
          const v = Number(pair[1]);
          if (!Number.isFinite(u) || !Number.isFinite(v)) {
            throw new Error("addFill(polygon): mathPoints must be finite");
          }
          const w = coordWorldFromAxis(plot, u, v);
          pointIds.push(pushPoint(doc, nextId, w.x, w.y, undefined, undefined, true, op).id);
        }
      } else {
        const raw = op.pointIds != null ? op.pointIds : op.points;
        if (!Array.isArray(raw) || raw.length < 3) {
          throw new Error("addFill(polygon): pointIds must be an array of ≥3 point ids");
        }
        pointIds = raw.map((x) => requirePoint(doc, x, "addFill"));
      }
      if (new Set(pointIds).size < 3) {
        throw new Error("addFill: need at least 3 distinct point ids");
      }
      doc.fills.push(withPattern({ id, kind: "polygon", pointIds, color, opacity }));
      return doc;
    }
    if (kind === "polyArc") {
      // Straight polyline through pointIds, closed by circular arc startId→endId about centerId.
      // Exam pattern e.g. E–D–C + arc CE (centre B).
      const raw = op.pointIds != null ? op.pointIds : op.points;
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error("addFill(polyArc): pointIds must be an array of ≥2 point ids");
      }
      const pointIds = raw.map((x) => requirePoint(doc, x, "addFill(polyArc)"));
      const centerId = requirePoint(doc, op.centerId, "addFill(polyArc)");
      const startId = requirePoint(doc, op.startId, "addFill(polyArc)");
      const endId = requirePoint(doc, op.endId, "addFill(polyArc)");
      const f = {
        id,
        kind: "polyArc",
        pointIds,
        centerId,
        startId,
        endId,
        color,
        opacity,
      };
      if (op.circleId) {
        requireCircle(doc, op.circleId, "addFill(polyArc)");
        f.circleId = op.circleId;
      }
      doc.fills.push(withPattern(f));
      return doc;
    }
    if (kind === "sector") {
      const centerId = requirePoint(doc, op.centerId, "addFill(sector)");
      const startId = requirePoint(doc, op.startId, "addFill(sector)");
      const endId = requirePoint(doc, op.endId, "addFill(sector)");
      const f = {
        id,
        kind: "sector",
        centerId,
        startId,
        endId,
        color,
        opacity,
      };
      if (op.circleId) {
        requireCircle(doc, op.circleId, "addFill(sector)");
        f.circleId = op.circleId;
      }
      doc.fills.push(withPattern(f));
      return doc;
    }
    // circular segment
    const startId = requirePoint(doc, op.startId, "addFill(segment)");
    const endId = requirePoint(doc, op.endId, "addFill(segment)");
    if (op.circleId) requireCircle(doc, op.circleId, "addFill(segment)");
    else if (op.centerId == null) throw new Error("addFill(segment): need circleId or centerId");
    const centerId = op.centerId != null ? requirePoint(doc, op.centerId, "addFill(segment)") : null;
    const f = {
      id,
      kind: "segment",
      startId,
      endId,
      color,
      opacity,
    };
    if (op.circleId) f.circleId = op.circleId;
    if (centerId) f.centerId = centerId;
    doc.fills.push(withPattern(f));
    return doc;
  },

  /**
   * Place a common shape by corner/origin + size.
   * Plane kinds: square|rect|rhombus|…|circle|semicircle
   * Solid kinds (via insertTemplate): cube|cuboid|rectPrism|frustum|tetra|…
   */
  addShape(doc, op, nextId) {
    let kind = op.kind || op.shape || "square";
    if (kind === "isosceles") kind = "iso";
    if (kind === "right" || kind === "rightTriangle") kind = "rightTri";
    if (kind === "isoRightTriangle") kind = "isoRight";
    if (kind === "para") kind = "parallelogram";
    if (kind === "trap" || kind === "isosTrapezoid") kind = "trapezoid";
    if (kind === "pent") kind = "pentagon";
    if (kind === "hex") kind = "hexagon";
    if (kind === "semi") kind = "semicircle";
    if (kind === "rectPrism" || kind === "prism") kind = "rectPrism";
    const x0 = Number(op.x);
    const y0 = Number(op.y);
    if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
      throw new Error("addShape: x,y must be finite (origin / first corner)");
    }
    const w = Math.abs(Number(op.w != null ? op.w : op.size != null ? op.size : 80));
    if (!(w > 1e-6)) throw new Error("addShape: w/size must be > 0");
    const hRaw = op.h != null ? Number(op.h) : w;
    const h = Math.abs(hRaw) > 1e-6 ? Math.abs(hRaw) : w;
    const style = styleOr(op.style, "solid");
    const prefix = op.idPrefix != null ? String(op.idPrefix) : "";

    if (SHAPE_SOLID_TEMPLATE_IDS.includes(kind) && BUILTIN_TEMPLATES[kind]) {
      const spec = BUILTIN_TEMPLATES[kind];
      const span = solidCellSpan(spec);
      const scale = w / (span.cellW * TEMPLATE_CELL_SIZE);
      /** @type {number|undefined} */
      let scaleY;
      if (op.h != null && op.h !== "") {
        const hAbs = Math.abs(Number(op.h));
        if (Number.isFinite(hAbs) && hAbs > 1e-6) {
          scaleY = hAbs / (span.cellH * TEMPLATE_CELL_SIZE);
        }
      }
      const n0 = doc.points.length;
      applyBuiltinTemplate(doc, kind, {
        dx: x0,
        dy: y0,
        scale,
        scaleY,
        nextId,
        labelSize: doc.labelFontSize,
        rightAngleSize: doc.rightAngleSize,
        idPrefix: prefix,
        label: op.label,
        labels: op.labels,
      });
      finishSolidExtras(doc, nextId, kind, doc.points.slice(n0), op, prefix);
      return doc;
    }

    const labelPoint = (p, i) => {
      const text =
        Array.isArray(op.labels) && op.labels[i] != null && String(op.labels[i]) !== ""
          ? String(op.labels[i])
          : String.fromCharCode(65 + i);
      registerShapeVertexAlias(doc, prefix, text, p.id);
      if (!(op.label || op.labels)) return;
      HANDLERS.addLabel(doc, { pointId: p.id, text, ox: -10, oy: -12 }, nextId);
    };

    if (kind === "circle") {
      const cHint = prefix ? `${prefix}0` : op.centerId;
      const tHint = prefix ? `${prefix}1` : op.throughId;
      const c = pushPoint(doc, nextId, x0, y0, cHint || undefined);
      const t = pushPoint(doc, nextId, x0 + w, y0, tHint || undefined);
      labelPoint(c, 0);
      labelPoint(t, 1);
      const id = resolveId(op, nextId, "cir");
      doc.circles.push({
        id,
        centerId: c.id,
        throughId: t.id,
        style,
      });
      return doc;
    }

    if (kind === "semicircle") {
      const a = pushPoint(doc, nextId, x0, y0, prefix ? `${prefix}0` : undefined);
      const b = pushPoint(doc, nextId, x0 + w, y0, prefix ? `${prefix}1` : undefined);
      const c = pushPoint(doc, nextId, x0 + w / 2, y0, prefix ? `${prefix}2` : undefined);
      labelPoint(a, 0);
      labelPoint(b, 1);
      labelPoint(c, 2);
      pushSegment(doc, nextId, a.id, b.id, style, prefix ? `${prefix}s0` : undefined);
      const id = resolveId(op, nextId, "sec");
      doc.sectors.push({
        id,
        centerId: c.id,
        startId: a.id,
        endId: b.id,
        style,
        mode: "arc",
      });
      return doc;
    }

    const pts = [];
    if (kind === "square" || kind === "rect") {
      const hh = kind === "square" ? w : h;
      pts.push([x0, y0], [x0 + w, y0], [x0 + w, y0 + hh], [x0, y0 + hh]);
    } else if (kind === "rhombus") {
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      pts.push([cx, y0], [x0 + w, cy], [cx, y0 + h], [x0, cy]);
    } else if (kind === "parallelogram") {
      const shear = w * 0.35;
      pts.push([x0, y0], [x0 + w, y0], [x0 + w + shear, y0 + h], [x0 + shear, y0 + h]);
    } else if (kind === "trapezoid") {
      const inset = w * 0.22;
      pts.push([x0, y0], [x0 + w, y0], [x0 + w - inset, y0 + h], [x0 + inset, y0 + h]);
    } else if (kind === "kite") {
      const cx = x0 + w / 2;
      const midY = y0 + h * 0.38;
      pts.push([cx, y0], [x0 + w, midY], [cx, y0 + h], [x0, midY]);
    } else if (kind === "equilateral") {
      const hh = (Math.sqrt(3) / 2) * w;
      pts.push([x0, y0], [x0 + w, y0], [x0 + w / 2, y0 - hh]);
      doc.shapeMode = "equilateral";
    } else if (kind === "iso") {
      pts.push([x0, y0], [x0 + w, y0], [x0 + w / 2, y0 - h]);
    } else if (kind === "rightTri") {
      pts.push([x0, y0], [x0 + w, y0], [x0, y0 + h]);
    } else if (kind === "isoRight") {
      pts.push([x0, y0], [x0 + w, y0], [x0, y0 + w]);
    } else if (kind === "pentagon" || kind === "hexagon") {
      const n = kind === "pentagon" ? 5 : 6;
      const cx = x0 + w / 2;
      const cy = y0 + w / 2;
      const r = w / 2;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    } else {
      throw new Error(
        `addShape: unknown kind "${kind}" (plane kinds or solid: cube|cuboid|rectPrism|frustum|tetra|pyramid|triPrism|cylinder|cone)`
      );
    }
    const ids = [];
    for (let i = 0; i < pts.length; i++) {
      const hint = prefix ? `${prefix}${i}` : op.pointIds && op.pointIds[i];
      const p = pushPoint(doc, nextId, pts[i][0], pts[i][1], hint || undefined);
      ids.push(p.id);
      labelPoint(p, i);
    }
    // Equilateral construction helpers default to dotted unless style was set explicitly.
    const edgeStyle =
      kind === "equilateral" && op.style == null && op.lineStyle == null
        ? "dotted"
        : style;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      const segHint = prefix ? `${prefix}s${i}` : undefined;
      pushSegment(doc, nextId, a, b, edgeStyle, segHint);
    }
    return doc;
  },

  /**
   * Tangent segment at a circle point; halfLen = half of total length.
   * Endpoint order (default leftToRight): aId = left (smaller x), bId = right;
   * if nearly vertical (|Δx|≤1e-3), aId = above (smaller y). order:"ccw" keeps
   * geometric tangent direction (−sin θ, cos θ) from a→b without spatial swap.
   */
  addTangent(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addTangent");
    const ang = resolveCircleAngle(doc, geom, op, "addTangent");
    let touchId = op.touchId || op.pointId || null;
    if (touchId) touchId = requirePoint(doc, touchId, "addTangent");
    const touch = touchId
      ? pointById(doc, touchId)
      : pointOnCircle(geom.c, geom.r, ang);
    if (!touchId) {
      touchId = pushPoint(doc, nextId, touch.x, touch.y, op.touchPointId, undefined, undefined, op).id;
    }
    const half = Math.abs(Number(op.halfLen != null ? op.halfLen : op.length != null ? Number(op.length) / 2 : 40));
    if (!(half > 1e-6)) throw new Error("addTangent: halfLen/length must be > 0");
    const tx = -Math.sin(ang);
    const ty = Math.cos(ang);
    let ax = touch.x - half * tx;
    let ay = touch.y - half * ty;
    let bx = touch.x + half * tx;
    let by = touch.y + half * ty;
    const order = String(op.order || "leftToRight").trim().toLowerCase();
    if (order !== "ccw") {
      // leftToRight (default): smaller x → aId; nearly vertical → smaller y → aId
      const swap =
        Math.abs(ax - bx) > 1e-3 ? ax > bx : ay > by;
      if (swap) {
        const tx0 = ax;
        const ty0 = ay;
        ax = bx;
        ay = by;
        bx = tx0;
        by = ty0;
      }
    }
    const a = pushPoint(doc, nextId, ax, ay, op.aId, undefined, undefined, op);
    const b = pushPoint(doc, nextId, bx, by, op.bId, undefined, undefined, op);
    pushSegment(doc, nextId, a.id, b.id, op.style, op.id, op);
    return doc;
  },

  /** Radius segment: center → rim (throughId or angle/deg). */
  addRadius(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addRadius");
    let throughId = op.throughId || null;
    if (!throughId) {
      const ang = resolveCircleAngle(doc, geom, op, "addRadius");
      const p = pointOnCircle(geom.c, geom.r, ang);
      throughId = pushPoint(doc, nextId, p.x, p.y, op.throughPointId, undefined, undefined, op).id;
    } else {
      throughId = requirePoint(doc, throughId, "addRadius");
    }
    pushSegment(doc, nextId, geom.cir.centerId, throughId, op.style, op.id, op);
    return doc;
  },

  /** Diameter through center; direction from angle/deg or throughId. */
  addDiameter(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addDiameter");
    const ang = resolveCircleAngle(doc, geom, op, "addDiameter");
    const p0 = pointOnCircle(geom.c, geom.r, ang);
    const p1 = pointOnCircle(geom.c, geom.r, ang + Math.PI);
    const a = pushPoint(doc, nextId, p0.x, p0.y, op.aId, undefined, undefined, op);
    const b = pushPoint(doc, nextId, p1.x, p1.y, op.bId, undefined, undefined, op);
    pushSegment(doc, nextId, a.id, b.id, op.style, op.id, op);
    return doc;
  },

  /** Chord between two rim points (ids or angle0/angle1 or deg0/deg1). */
  addChord(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addChord");
    let aId = op.startId || op.a || null;
    let bId = op.endId || op.b || null;
    if (!aId) {
      let ang0;
      if (op.angle0 != null) ang0 = Number(op.angle0);
      else if (op.deg0 != null) ang0 = (Number(op.deg0) * Math.PI) / 180;
      else throw new Error("addChord: need startId or angle0/deg0");
      if (!Number.isFinite(ang0)) throw new Error("addChord: angle0 invalid");
      const p = pointOnCircle(geom.c, geom.r, ang0);
      aId = pushPoint(doc, nextId, p.x, p.y, op.aId, undefined, undefined, op).id;
    } else aId = requirePoint(doc, aId, "addChord");
    if (!bId) {
      let ang1;
      if (op.angle1 != null) ang1 = Number(op.angle1);
      else if (op.deg1 != null) ang1 = (Number(op.deg1) * Math.PI) / 180;
      else throw new Error("addChord: need endId or angle1/deg1");
      if (!Number.isFinite(ang1)) throw new Error("addChord: angle1 invalid");
      const p = pointOnCircle(geom.c, geom.r, ang1);
      bId = pushPoint(doc, nextId, p.x, p.y, op.bId, undefined, undefined, op).id;
    } else bId = requirePoint(doc, bId, "addChord");
    pushSegment(doc, nextId, aId, bId, op.style, op.id, op);
    return doc;
  },

  /** Align selected points: axis left|center|right|top|middle|bottom. */
  alignPoints(doc, op) {
    const ids = op.pointIds || op.ids;
    if (!Array.isArray(ids) || ids.length < 2) {
      throw new Error("alignPoints: pointIds needs ≥2 ids");
    }
    const pts = ids.map((id) => {
      requirePoint(doc, id, "alignPoints");
      return pointById(doc, id);
    });
    const axis = op.axis || op.align || "left";
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    for (const p of pts) {
      if (axis === "left") p.x = minX;
      else if (axis === "right") p.x = maxX;
      else if (axis === "center" || axis === "hcenter") p.x = midX;
      else if (axis === "top") p.y = minY;
      else if (axis === "bottom") p.y = maxY;
      else if (axis === "middle" || axis === "vcenter") p.y = midY;
      else throw new Error(`alignPoints: unknown axis "${axis}"`);
    }
    return doc;
  },

  /** Equal-space points along X or Y (sorted by that axis). */
  distributePoints(doc, op) {
    const ids = op.pointIds || op.ids;
    if (!Array.isArray(ids) || ids.length < 3) {
      throw new Error("distributePoints: pointIds needs ≥3 ids");
    }
    const axis = op.axis === "y" || op.axis === "v" ? "y" : "x";
    const pts = ids.map((id) => {
      requirePoint(doc, id, "distributePoints");
      return pointById(doc, id);
    });
    pts.sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
    const first = pts[0];
    const last = pts[pts.length - 1];
    const span = axis === "x" ? last.x - first.x : last.y - first.y;
    for (let i = 1; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      if (axis === "x") pts[i].x = first.x + span * t;
      else pts[i].y = first.y + span * t;
    }
    return doc;
  },

  /** Set equal length for ≥2 segments by scaling from midpoint (to median length). */
  equalizeSegments(doc, op) {
    const ids = op.segmentIds || op.ids;
    if (!Array.isArray(ids) || ids.length < 2) {
      throw new Error("equalizeSegments: segmentIds needs ≥2");
    }
    const segs = ids.map((id) => {
      requireSegment(doc, id, "equalizeSegments");
      return doc.segments.find((s) => s.id === id);
    });
    const lens = segs.map((s) => {
      const a = pointById(doc, s.a);
      const b = pointById(doc, s.b);
      return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const target =
      op.length != null
        ? Number(op.length)
        : lens.slice().sort((a, b) => a - b)[Math.floor(lens.length / 2)];
    if (!(target > 1e-9)) throw new Error("equalizeSegments: target length invalid");
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const a = pointById(doc, s.a);
      const b = pointById(doc, s.b);
      const len = lens[i];
      if (!(len > 1e-9)) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const half = target / 2;
      a.x = mx - ux * half;
      a.y = my - uy * half;
      b.x = mx + ux * half;
      b.y = my + uy * half;
    }
    return doc;
  },

  addCoordPlot(doc, op, nextId) {
    const id = resolveId(op, nextId, "plot");
    const ox = Number(op.ox);
    const oy = Number(op.oy);
    if (!Number.isFinite(ox) || !Number.isFinite(oy)) {
      throw new Error("addCoordPlot: ox,oy must be finite");
    }
    const plot = {
      id,
      ox,
      oy,
      unitPx: op.unitPx != null ? Number(op.unitPx) : 40,
      xmin: op.xmin != null ? Number(op.xmin) : -2,
      xmax: op.xmax != null ? Number(op.xmax) : 6,
      ymin: op.ymin != null ? Number(op.ymin) : -2,
      ymax: op.ymax != null ? Number(op.ymax) : 6,
      axisLabelX: op.axisLabelX != null ? String(op.axisLabelX) : "x",
      axisLabelY: op.axisLabelY != null ? String(op.axisLabelY) : "y",
      showOrigin: op.showOrigin !== false,
      showTicks: op.showTicks !== false,
      showTickLabels: op.showTickLabels !== false,
      xAngleUnit: op.xAngleUnit === "deg" ? "deg" : "rad",
      angleAxisOn: !!op.angleAxisOn,
      curves: [],
    };
    const xTicks = normalizeCoordTicks(op.xTicks);
    const yTicks = normalizeCoordTicks(op.yTicks);
    if (xTicks) plot.xTicks = xTicks;
    if (yTicks) plot.yTicks = yTicks;
    const xStep = optionalPositive(op.xStep);
    const yStep = optionalPositive(op.yStep);
    const xUnitPx = optionalPositive(op.xUnitPx);
    const yUnitPx = optionalPositive(op.yUnitPx);
    if (xStep != null) plot.xStep = xStep;
    if (yStep != null) plot.yStep = yStep;
    if (xUnitPx != null) plot.xUnitPx = xUnitPx;
    if (yUnitPx != null) plot.yUnitPx = yUnitPx;
    if (Array.isArray(op.curves)) {
      for (const c of op.curves) {
        const ctype = c.type === "log10" ? "log" : c.type || "line";
        plot.curves.push({
          id: c.id || nextId("curve"),
          type: ctype,
          params: { ...defaultCurveParams(ctype), ...(c.params || {}) },
          label: defaultCurveLabel(c.label),
          ...curveExtras(c),
        });
      }
    }
    doc.coordPlots.push(plot);
    const regions = [];
    if (op.feasibleRegion != null) regions.push(op.feasibleRegion);
    if (Array.isArray(op.feasibleRegions)) {
      for (const region of op.feasibleRegions) regions.push(region);
    }
    for (const region of regions) {
      if (!region || typeof region !== "object" || Array.isArray(region)) {
        console.warn("addCoordPlot: feasible region must be an object; skipped");
        continue;
      }
      applyFeasibleRegion(doc, { ...region, plotId: plot.id }, nextId, "addCoordPlot");
    }
    return doc;
  },

  /**
   * Feasible region of linear inequalities on a coord plot.
   * Same options as addCoordPlot.feasibleRegion and addFill inequalities.
   */
  addFeasibleRegion(doc, op, nextId) {
    return applyFeasibleRegion(doc, op, nextId, "addFeasibleRegion");
  },

  /**
   * Point in the last (or plotId) coord plot's math space.
   * u/v aliases: mathX/mathY. ox/oy are label offsets, not the plot origin.
   * projectX/projectY persist dashed (or projectStyle) segments plus optional tick labels.
   */
  addPlotPoint(doc, op, nextId) {
    return placePlotPoint(doc, op, nextId, "addPlotPoint");
  },

  /**
   * Project a 3D polyhedron. Hidden edges come from face normals
   * (not the solid-template dash pattern).
   * vertices: { A: [x,y,z], ... }. Face winding may be either way;
   * normals are flipped outward from the vertex centroid.
   */
  add3DPolyhedron(doc, op, nextId) {
    const built = buildPolyhedron(op);
    const prefix = op.idPrefix != null ? String(op.idPrefix) : "";
    const idOf = new Map();
    for (const p of built.placed) {
      const pt = pushPoint(doc, nextId, p.x, p.y, `${prefix}${p.key}`);
      idOf.set(p.key, pt.id);
      if (p.text != null) {
        doc.labels.push({
          id: nextId("lab"),
          pointId: pt.id,
          text: p.text,
          ox: p.ox,
          oy: p.oy,
          size: doc.labelFontSize || 16,
        });
      }
    }
    built.edges.forEach((e, i) => {
      pushSegment(
        doc,
        nextId,
        idOf.get(e.a),
        idOf.get(e.b),
        e.style,
        prefix ? `${prefix}s${i}` : undefined
      );
    });
    return doc;
  },

  /** Add / append a curve on an existing coord plot. */
  addCurve(doc, op, nextId) {
    const plot = doc.coordPlots.find((p) => p.id === op.plotId);
    if (!plot) throw new Error(`addCurve: plot not found: ${op.plotId}`);
    if (!Array.isArray(plot.curves)) plot.curves = [];
    const type = op.type === "log10" ? "log" : op.type || "line";
    const id = resolveId(op, nextId, "curve");
    const curve = {
      id,
      type,
      params: { ...defaultCurveParams(type), ...(op.params || {}) },
      label: defaultCurveLabel(op.label),
      ...curveExtras(op),
    };
    stampAppearance(curve, op);
    plot.curves.push(curve);
    return doc;
  },

  setView(doc, op) {
    if (!doc.view || typeof doc.view !== "object") doc.view = { x: 0, y: 0, scale: 2 };
    if (op.x != null) doc.view.x = Number(op.x);
    if (op.y != null) doc.view.y = Number(op.y);
    if (op.scale != null) {
      const s = Number(op.scale);
      if (!(s > 0)) throw new Error("setView: scale must be > 0");
      doc.view.scale = s;
    }
    return doc;
  },

  setMeta(doc, op) {
    const keys = [
      "nextLetter",
      "labelFontSize",
      "rightAngleSize",
      "gridSnap",
      "gridMode",
      "hideExportPoints",
      "sectorMode",
      "fillMode",
      "shapeMode",
      "circlePartMode",
      "name",
      "activeParallelGroup",
      "activeEqualGroup",
      "activeArcGroup",
    ];
    for (const k of keys) {
      if (op[k] !== undefined) doc[k] = op[k];
    }
    if (op.exportCrop !== undefined) doc.exportCrop = op.exportCrop;
    if (op.layers !== undefined) {
      doc.layers = normalizeLayers({ ...(doc.layers || {}), ...op.layers });
    }
    return doc;
  },

  /** Alias: set layer show/lock flags. */
  setLayers(doc, op) {
    const patch = { ...(op.layers || {}) };
    for (const k of Object.keys(DEFAULT_LAYERS)) {
      if (op[k] !== undefined) patch[k] = op[k];
    }
    doc.layers = normalizeLayers({ ...(doc.layers || {}), ...patch });
    return doc;
  },

  movePoint(doc, op) {
    const p = findPoint(doc, op.id);
    if (!p) throw new Error(`movePoint: not found: ${op.id}`);
    const x = Number(op.x);
    const y = Number(op.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("movePoint: x,y must be finite");
    }
    p.x = x;
    p.y = y;
    if (op.marker !== undefined) {
      if (op.marker == null || op.marker === "") delete p.marker;
      else p.marker = op.marker;
    }
    return doc;
  },

  remove(doc, op) {
    const type = op.type || op.kind;
    const id = op.id;
    if (!type || !id) throw new Error("remove: type and id required");
    const map = {
      point: "points",
      segment: "segments",
      label: "labels",
      text: "texts",
      rightAngle: "rightAngles",
      angleArc: "angleArcs",
      midTick: "midTicks",
      parallelMark: "parallelMarks",
      equalMark: "equalMarks",
      lengthLabel: "lengthLabels",
      circle: "circles",
      ellipse: "ellipses",
      sector: "sectors",
      fill: "fills",
      coordPlot: "coordPlots",
      boxWhisker: "boxWhiskers",
      barChart: "barCharts",
    };
    const key = map[type];
    if (!key) throw new Error(`remove: unknown type ${type}`);
    const removeId = type === "point" ? resolvePointId(doc, id) || id : id;
    const before = doc[key].length;
    doc[key] = doc[key].filter((x) => x.id !== removeId);
    if (doc[key].length === before) throw new Error(`remove: ${type} ${id} not found`);
    return doc;
  },

  /**
   * Insert a built-in geometry template (rightTri, frustum, cuboid, …).
   * Cells → world via TEMPLATE_CELL_SIZE; optional dx/dy/scale.
   */
  insertTemplate(doc, op, nextId) {
    const tid = op.id || op.templateId || op.template;
    if (!tid || typeof tid !== "string") {
      throw new Error(
        `insertTemplate: id required (one of ${BUILTIN_TEMPLATE_IDS.join(", ")})`
      );
    }
    applyBuiltinTemplate(doc, tid, {
      dx: op.dx,
      dy: op.dy,
      scale: op.scale,
      cellSize: op.cellSize,
      nextId,
      labelSize: op.labelSize,
      rightAngleSize: op.rightAngleSize,
    });
    return doc;
  },

  /**
   * Triangle centre. kind: incentre|incenter|circumcentre|circumcenter|centroid|orthocentre|orthocenter.
   * a, b, c are vertex ids (addShape letter aliases resolve). Degenerate → warn and skip.
   */
  addTriangleCenter(doc, op, nextId) {
    return applyTriangleCenter(doc, op, nextId, examApi(), {
      opName: "addTriangleCenter",
      kind: null,
      drawCircle: false,
    });
  },

  /** North arrow at a point, optional bearing arc. Alias addCompass. */
  addBearing(doc, op, nextId) {
    return applyBearing(doc, op, nextId, examApi());
  },

  /** Pie / doughnut-free sector chart. Alias addPie. */
  addPieChart(doc, op, nextId) {
    return applyPieChart(doc, op, nextId, examApi());
  },
};

/** Aliases for AI-friendly names */
HANDLERS.addParallel = HANDLERS.addParallelMark;
HANDLERS.addEqual = HANDLERS.addEqualMark;
HANDLERS.addLength = HANDLERS.addLengthLabel;
HANDLERS.addArc = HANDLERS.addAngleArc;
HANDLERS.addTemplate = HANDLERS.insertTemplate;
HANDLERS.addBoxPlot = HANDLERS.addBoxWhisker;
HANDLERS.addBar = HANDLERS.addBarChart;
HANDLERS.addCaption = HANDLERS.addText;
HANDLERS.addIncircle = (doc, op, nextId) =>
  applyTriangleCenter(doc, op, nextId, examApi(), {
    opName: "addIncircle",
    kind: "incentre",
    drawCircle: true,
  });
HANDLERS.addCircumcircle = (doc, op, nextId) =>
  applyTriangleCenter(doc, op, nextId, examApi(), {
    opName: "addCircumcircle",
    kind: "circumcentre",
    drawCircle: true,
  });
HANDLERS.addCompass = HANDLERS.addBearing;
HANDLERS.addPie = HANDLERS.addPieChart;

export const OP_NAMES = Object.keys(HANDLERS).sort();

/**
 * Apply a list of ops to a diagram document (pure).
 * @param {object|null|undefined} doc  Starting document; null → emptyDiagram()
 * @param {object[]} ops
 * @returns {object} new document
 */
export function applyOps(doc, ops) {
  if (ops == null) ops = [];
  if (!Array.isArray(ops)) throw new Error("ops must be an array");
  const carried =
    doc && doc.pointAliases && typeof doc.pointAliases === "object" && !Array.isArray(doc.pointAliases)
      ? { ...doc.pointAliases }
      : null;
  let out = ensureArrays(cloneDoc(doc || emptyDiagram()));
  if (out.formatVersion == null) out.formatVersion = 1;
  if (carried) {
    const aliases = shapeAliasMap(out);
    Object.assign(aliases, carried);
  }
  const nextId = createIdFactory(out, "id");

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op || typeof op !== "object") {
      throw new Error(`ops[${i}]: must be an object`);
    }
    const name = op.op || op.type || op.action;
    if (!name || typeof name !== "string") {
      throw new Error(`ops[${i}]: missing op name (use "op": "addPoint", …)`);
    }
    const handler = HANDLERS[name];
    if (!handler) {
      throw new Error(`ops[${i}]: unknown op "${name}". Known: ${OP_NAMES.join(", ")}`);
    }
    try {
      out = handler(out, op, nextId);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`ops[${i}] (${name}): ${msg}`);
    }
  }
  refreshAutoLabels(out);
  return out;
}

export { emptyDiagram, HANDLERS as opHandlers };
