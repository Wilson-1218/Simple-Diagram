import { emptyDiagram, cloneDoc } from "./empty-doc.mjs";
import { createIdFactory } from "./ids.mjs";

const LINE_STYLES = new Set(["solid", "dashed", "dotted", "dashdot"]);

function ensureArrays(doc) {
  const keys = [
    "points",
    "segments",
    "labels",
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

function requirePoint(doc, id, ctx) {
  if (!doc.points.some((p) => p.id === id)) {
    throw new Error(`${ctx}: point not found: ${id}`);
  }
}

function requireSegment(doc, id, ctx) {
  if (!doc.segments.some((s) => s.id === id)) {
    throw new Error(`${ctx}: segment not found: ${id}`);
  }
}

function styleOr(s, fallback = "solid") {
  if (s == null || s === "") return fallback;
  if (!LINE_STYLES.has(s)) throw new Error(`invalid line style: ${s}`);
  return s;
}

function defaultCurveParams(type) {
  if (type === "line") return { m: -1, c: 4 };
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
  return {
    show: !!lab.show,
    kind: lab.kind === "custom" ? "custom" : "formula",
    formulaMode: lab.formulaMode === "numeric" ? "numeric" : "algebraic",
    customText: lab.customText != null ? String(lab.customText) : "",
    t: Number.isFinite(Number(lab.t)) ? Math.min(1, Math.max(0, Number(lab.t))) : d.t,
    n: Number.isFinite(Number(lab.n)) ? Math.min(6, Math.max(-6, Number(lab.n))) : d.n,
  };
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
    const id = resolveId(op, nextId, "p");
    if (doc.points.some((p) => p.id === id)) throw new Error(`addPoint: duplicate id ${id}`);
    const x = Number(op.x);
    const y = Number(op.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("addPoint: x,y must be finite numbers");
    }
    const p = { id, x, y };
    if (op.marker) p.marker = op.marker;
    doc.points.push(p);
    return doc;
  },

  addSegment(doc, op, nextId) {
    const id = resolveId(op, nextId, "s");
    if (doc.segments.some((s) => s.id === id)) throw new Error(`addSegment: duplicate id ${id}`);
    requirePoint(doc, op.a, "addSegment");
    requirePoint(doc, op.b, "addSegment");
    if (op.a === op.b) throw new Error("addSegment: a and b must differ");
    const dup = doc.segments.some(
      (s) => (s.a === op.a && s.b === op.b) || (s.a === op.b && s.b === op.a)
    );
    if (dup) throw new Error(`addSegment: segment already exists between ${op.a} and ${op.b}`);
    doc.segments.push({
      id,
      a: op.a,
      b: op.b,
      style: styleOr(op.style, "solid"),
    });
    return doc;
  },

  addLabel(doc, op, nextId) {
    const id = resolveId(op, nextId, "lab");
    requirePoint(doc, op.pointId, "addLabel");
    const text = op.text != null ? String(op.text) : "";
    // One label per point (matches UI)
    doc.labels = doc.labels.filter((l) => l.pointId !== op.pointId);
    const ox = op.ox != null ? Number(op.ox) : 0;
    const oy = op.oy != null ? Number(op.oy) : -14;
    const size = op.size != null ? Number(op.size) : doc.labelFontSize || 16;
    doc.labels.push({ id, pointId: op.pointId, text, ox, oy, size });
    return doc;
  },

  addRightAngle(doc, op, nextId) {
    const id = resolveId(op, nextId, "ra");
    requirePoint(doc, op.vertex, "addRightAngle");
    requirePoint(doc, op.arm1, "addRightAngle");
    requirePoint(doc, op.arm2, "addRightAngle");
    doc.rightAngles.push({
      id,
      vertex: op.vertex,
      arm1: op.arm1,
      arm2: op.arm2,
      size: op.size != null ? Number(op.size) : doc.rightAngleSize || 10,
    });
    return doc;
  },

  addAngleArc(doc, op, nextId) {
    const id = resolveId(op, nextId, "arc");
    requirePoint(doc, op.vertex, "addAngleArc");
    requirePoint(doc, op.arm1, "addAngleArc");
    requirePoint(doc, op.arm2, "addAngleArc");
    doc.angleArcs.push({
      id,
      vertex: op.vertex,
      arm1: op.arm1,
      arm2: op.arm2,
      size: op.size != null ? Number(op.size) : doc.rightAngleSize || 10,
      group: op.group ? 1 : 0,
      text: op.text != null ? String(op.text) : "",
      reflex: !!op.reflex,
    });
    return doc;
  },

  /** Alias: reflex angle mark (>180°). */
  addReflex(doc, op, nextId) {
    return HANDLERS.addAngleArc(doc, { ...op, reflex: true }, nextId);
  },

  addParallelMark(doc, op, nextId) {
    const id = resolveId(op, nextId, "pm");
    requireSegment(doc, op.segmentId, "addParallelMark");
    doc.parallelMarks.push({
      id,
      segmentId: op.segmentId,
      group: op.group ? 1 : 0,
      side: op.side === -1 ? -1 : 1,
    });
    return doc;
  },

  addEqualMark(doc, op, nextId) {
    const id = resolveId(op, nextId, "em");
    requireSegment(doc, op.segmentId, "addEqualMark");
    doc.equalMarks.push({
      id,
      segmentId: op.segmentId,
      group: op.group ? 1 : 0,
      side: op.side === -1 ? -1 : 1,
    });
    return doc;
  },

  addLengthLabel(doc, op, nextId) {
    const id = resolveId(op, nextId, "ll");
    requireSegment(doc, op.segmentId, "addLengthLabel");
    doc.lengthLabels.push({
      id,
      segmentId: op.segmentId,
      text: op.text != null ? String(op.text) : "",
      side: op.side === -1 ? -1 : 1,
    });
    return doc;
  },

  addMidTick(doc, op, nextId) {
    const id = resolveId(op, nextId, "mt");
    requireSegment(doc, op.segmentId, "addMidTick");
    if (op.pointId) requirePoint(doc, op.pointId, "addMidTick");
    const m = { id, segmentId: op.segmentId };
    if (op.pointId) m.pointId = op.pointId;
    doc.midTicks.push(m);
    return doc;
  },

  addCircle(doc, op, nextId) {
    const id = resolveId(op, nextId, "cir");
    requirePoint(doc, op.centerId, "addCircle");
    requirePoint(doc, op.throughId, "addCircle");
    const c = {
      id,
      centerId: op.centerId,
      throughId: op.throughId,
      style: styleOr(op.style, "solid"),
    };
    doc.circles.push(c);
    return doc;
  },

  addEllipse(doc, op, nextId) {
    const id = resolveId(op, nextId, "ell");
    requirePoint(doc, op.centerId, "addEllipse");
    requirePoint(doc, op.rxId, "addEllipse");
    requirePoint(doc, op.ryId, "addEllipse");
    const e = {
      id,
      centerId: op.centerId,
      rxId: op.rxId,
      ryId: op.ryId,
      style: styleOr(op.style, "solid"),
    };
    if (op.backDashed) e.backDashed = true;
    doc.ellipses.push(e);
    return doc;
  },

  addSector(doc, op, nextId) {
    const id = resolveId(op, nextId, "sec");
    requirePoint(doc, op.centerId, "addSector");
    requirePoint(doc, op.startId, "addSector");
    requirePoint(doc, op.endId, "addSector");
    const mode = op.mode === "sector" ? "sector" : "arc";
    doc.sectors.push({
      id,
      centerId: op.centerId,
      startId: op.startId,
      endId: op.endId,
      style: styleOr(op.style, "solid"),
      mode,
    });
    return doc;
  },

  /** Region fill: closed polygon by existing point ids (≥3), translucent solid. */
  addFill(doc, op, nextId) {
    const id = resolveId(op, nextId, "fill");
    if (doc.fills.some((f) => f.id === id)) throw new Error(`addFill: duplicate id ${id}`);
    const raw = op.pointIds != null ? op.pointIds : op.points;
    if (!Array.isArray(raw) || raw.length < 3) {
      throw new Error("addFill: pointIds must be an array of ≥3 point ids");
    }
    const pointIds = raw.map((x) => String(x));
    for (const pid of pointIds) requirePoint(doc, pid, "addFill");
    if (new Set(pointIds).size < 3) {
      throw new Error("addFill: need at least 3 distinct point ids");
    }
    doc.fills.push({
      id,
      pointIds,
      color: normalizeFillColor(op.color, "#666666"),
      opacity: clampOpacity(op.opacity, 0.2),
    });
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
    if (Array.isArray(op.curves)) {
      for (const c of op.curves) {
        const ctype = c.type === "log10" ? "log" : c.type || "line";
        plot.curves.push({
          id: c.id || nextId("curve"),
          type: ctype,
          params: { ...defaultCurveParams(ctype), ...(c.params || {}) },
          label: defaultCurveLabel(c.label),
        });
      }
    }
    doc.coordPlots.push(plot);
    return doc;
  },

  /** Add / append a curve on an existing coord plot. */
  addCurve(doc, op, nextId) {
    const plot = doc.coordPlots.find((p) => p.id === op.plotId);
    if (!plot) throw new Error(`addCurve: plot not found: ${op.plotId}`);
    if (!Array.isArray(plot.curves)) plot.curves = [];
    const type = op.type === "log10" ? "log" : op.type || "line";
    const id = resolveId(op, nextId, "curve");
    plot.curves.push({
      id,
      type,
      params: { ...defaultCurveParams(type), ...(op.params || {}) },
      label: defaultCurveLabel(op.label),
    });
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
      "name",
      "activeParallelGroup",
      "activeEqualGroup",
      "activeArcGroup",
    ];
    for (const k of keys) {
      if (op[k] !== undefined) doc[k] = op[k];
    }
    if (op.exportCrop !== undefined) doc.exportCrop = op.exportCrop;
    return doc;
  },

  movePoint(doc, op) {
    const p = doc.points.find((x) => x.id === op.id);
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
    };
    const key = map[type];
    if (!key) throw new Error(`remove: unknown type ${type}`);
    const before = doc[key].length;
    doc[key] = doc[key].filter((x) => x.id !== id);
    if (doc[key].length === before) throw new Error(`remove: ${type} ${id} not found`);
    return doc;
  },
};

/** Aliases for AI-friendly names */
HANDLERS.addParallel = HANDLERS.addParallelMark;
HANDLERS.addEqual = HANDLERS.addEqualMark;
HANDLERS.addLength = HANDLERS.addLengthLabel;
HANDLERS.addArc = HANDLERS.addAngleArc;

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
  let out = ensureArrays(cloneDoc(doc || emptyDiagram()));
  if (out.formatVersion == null) out.formatVersion = 1;
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
  return out;
}

export { emptyDiagram, HANDLERS as opHandlers };
