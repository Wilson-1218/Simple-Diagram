import { emptyDiagram, cloneDoc } from "./empty-doc.mjs";
import { createIdFactory } from "./ids.mjs";
import {
  applyBuiltinTemplate,
  BUILTIN_TEMPLATE_IDS,
  BUILTIN_TEMPLATES,
  SHAPE_SOLID_TEMPLATE_IDS,
  TEMPLATE_CELL_SIZE,
} from "./templates.mjs";
import { chainPathFillEdges } from "./path-fill.mjs";

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

function requireCircle(doc, id, ctx) {
  const cir = doc.circles.find((c) => c.id === id);
  if (!cir) throw new Error(`${ctx}: circle not found: ${id}`);
  return cir;
}

function pointById(doc, id) {
  return doc.points.find((p) => p.id === id) || null;
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

function pushPoint(doc, nextId, x, y, idHint, marker) {
  const id = idHint
    ? resolveId({ id: idHint }, nextId, "p")
    : nextId("p");
  if (doc.points.some((p) => p.id === id)) throw new Error(`duplicate point id ${id}`);
  const p = { id, x: Number(x), y: Number(y) };
  if (marker) p.marker = marker;
  doc.points.push(p);
  return p;
}

function pushSegment(doc, nextId, a, b, style, idHint) {
  const id = idHint
    ? resolveId({ id: idHint }, nextId, "s")
    : nextId("s");
  if (doc.segments.some((s) => s.id === id)) throw new Error(`duplicate segment id ${id}`);
  if (a === b) throw new Error("segment ends must differ");
  doc.segments.push({ id, a, b, style: styleOr(style, "solid") });
  return id;
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
    /** @type {{ id: string, segmentId: string, text: string, side: 1|-1, style: string, orient: string, stroke?: string, size?: number }} */
    const row = {
      id,
      segmentId: op.segmentId,
      text: op.text != null ? String(op.text) : "",
      side: op.side === -1 ? -1 : 1,
      style,
      orient,
    };
    if (style === "arcs") row.stroke = stroke;
    if (op.size != null && Number.isFinite(Number(op.size))) {
      row.size = Math.min(48, Math.max(10, Math.round(Number(op.size))));
    }
    doc.lengthLabels.push(row);
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

  /**
   * Foot of perpendicular: project pointId onto the line through a segment
   * (segmentId) or through endpoints a/b. Creates foot point (marker "foot")
   * and optional altitude segment (drawSegment default true).
   */
  addFoot(doc, op, nextId) {
    requirePoint(doc, op.pointId, "addFoot");
    const from = pointById(doc, op.pointId);
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
    const foot = pushPoint(doc, nextId, fx, fy, footHint || undefined, marker);
    if (op.label || op.labelText) {
      const text = op.labelText != null ? String(op.labelText) : String(op.label === true ? "H" : op.label);
      HANDLERS.addLabel(doc, { pointId: foot.id, text, ox: -10, oy: -12 }, nextId);
    }
    const drawSeg = op.drawSegment !== false && op.segment !== false;
    if (drawSeg) {
      const style = styleOr(op.style, "solid");
      const segHint = op.altitudeId || (op.idPrefix ? `${op.idPrefix}alt` : undefined);
      try {
        pushSegment(doc, nextId, op.pointId, foot.id, style, segHint);
      } catch (err) {
        // Duplicate altitude is OK (reuse existing).
        if (!String(err.message || err).includes("already exists")) throw err;
      }
    }
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

  /**
   * Region fill. kind: "polygon" (default) | "sector" | "segment".
   * polygon: pointIds ≥3
   * sector: centerId + startId + endId (+ optional circleId)
   * segment (circular): circleId|centerId + startId + endId (chord endpoints)
   */
  addFill(doc, op, nextId) {
    const id = resolveId(op, nextId, "fill");
    if (doc.fills.some((f) => f.id === id)) throw new Error(`addFill: duplicate id ${id}`);
    const kind =
      op.kind === "sector" ||
      op.kind === "segment" ||
      op.kind === "polyArc" ||
      op.kind === "pathFill"
        ? op.kind
        : "polygon";
    const color = normalizeFillColor(op.color, "#666666");
    const opacity = clampOpacity(op.opacity, 0.2);
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
          requirePoint(doc, e.a, "addFill(pathFill line)");
          requirePoint(doc, e.b, "addFill(pathFill line)");
          edges.push({ type: "line", a: String(e.a), b: String(e.b) });
        } else if (e.type === "arc") {
          requirePoint(doc, e.centerId, "addFill(pathFill arc)");
          requirePoint(doc, e.from, "addFill(pathFill arc)");
          requirePoint(doc, e.to, "addFill(pathFill arc)");
          const edge = {
            type: "arc",
            centerId: String(e.centerId),
            from: String(e.from),
            to: String(e.to),
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
      doc.fills.push({
        id,
        kind: "pathFill",
        edges: chained || edges,
        color,
        opacity,
      });
      return doc;
    }
    if (kind === "polygon") {
      const raw = op.pointIds != null ? op.pointIds : op.points;
      if (!Array.isArray(raw) || raw.length < 3) {
        throw new Error("addFill(polygon): pointIds must be an array of ≥3 point ids");
      }
      const pointIds = raw.map((x) => String(x));
      for (const pid of pointIds) requirePoint(doc, pid, "addFill");
      if (new Set(pointIds).size < 3) {
        throw new Error("addFill: need at least 3 distinct point ids");
      }
      doc.fills.push({ id, kind: "polygon", pointIds, color, opacity });
      return doc;
    }
    if (kind === "polyArc") {
      // Straight polyline through pointIds, closed by circular arc startId→endId about centerId.
      // Exam pattern e.g. E–D–C + arc CE (centre B).
      const raw = op.pointIds != null ? op.pointIds : op.points;
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error("addFill(polyArc): pointIds must be an array of ≥2 point ids");
      }
      const pointIds = raw.map((x) => String(x));
      for (const pid of pointIds) requirePoint(doc, pid, "addFill(polyArc)");
      requirePoint(doc, op.centerId, "addFill(polyArc)");
      requirePoint(doc, op.startId, "addFill(polyArc)");
      requirePoint(doc, op.endId, "addFill(polyArc)");
      const f = {
        id,
        kind: "polyArc",
        pointIds,
        centerId: op.centerId,
        startId: op.startId,
        endId: op.endId,
        color,
        opacity,
      };
      if (op.circleId) {
        requireCircle(doc, op.circleId, "addFill(polyArc)");
        f.circleId = op.circleId;
      }
      doc.fills.push(f);
      return doc;
    }
    if (kind === "sector") {
      requirePoint(doc, op.centerId, "addFill(sector)");
      requirePoint(doc, op.startId, "addFill(sector)");
      requirePoint(doc, op.endId, "addFill(sector)");
      const f = {
        id,
        kind: "sector",
        centerId: op.centerId,
        startId: op.startId,
        endId: op.endId,
        color,
        opacity,
      };
      if (op.circleId) {
        requireCircle(doc, op.circleId, "addFill(sector)");
        f.circleId = op.circleId;
      }
      doc.fills.push(f);
      return doc;
    }
    // circular segment
    requirePoint(doc, op.startId, "addFill(segment)");
    requirePoint(doc, op.endId, "addFill(segment)");
    if (op.circleId) requireCircle(doc, op.circleId, "addFill(segment)");
    else if (op.centerId) requirePoint(doc, op.centerId, "addFill(segment)");
    else throw new Error("addFill(segment): need circleId or centerId");
    const f = {
      id,
      kind: "segment",
      startId: op.startId,
      endId: op.endId,
      color,
      opacity,
    };
    if (op.circleId) f.circleId = op.circleId;
    if (op.centerId) f.centerId = op.centerId;
    doc.fills.push(f);
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
      let minC = Infinity;
      let maxC = -Infinity;
      for (const row of spec.pts || []) {
        minC = Math.min(minC, Number(row[0]));
        maxC = Math.max(maxC, Number(row[0]));
      }
      const cellW = Math.max(1, maxC - minC);
      const scale = w / (cellW * TEMPLATE_CELL_SIZE);
      applyBuiltinTemplate(doc, kind, {
        dx: x0,
        dy: y0,
        scale,
        nextId,
        labelSize: doc.labelFontSize,
        rightAngleSize: doc.rightAngleSize,
      });
      return doc;
    }

    const labelPoint = (p, i) => {
      if (!(op.label || op.labels)) return;
      const text =
        Array.isArray(op.labels) && op.labels[i] != null
          ? String(op.labels[i])
          : String.fromCharCode(65 + i);
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

  /** Tangent segment at a circle point; halfLen = half of total length. */
  addTangent(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addTangent");
    const ang = resolveCircleAngle(doc, geom, op, "addTangent");
    const touch =
      op.touchId || op.pointId
        ? pointById(doc, op.touchId || op.pointId)
        : pointOnCircle(geom.c, geom.r, ang);
    let touchId = op.touchId || op.pointId || null;
    if (!touchId) {
      touchId = pushPoint(doc, nextId, touch.x, touch.y, op.touchPointId).id;
    }
    const half = Math.abs(Number(op.halfLen != null ? op.halfLen : op.length != null ? Number(op.length) / 2 : 40));
    if (!(half > 1e-6)) throw new Error("addTangent: halfLen/length must be > 0");
    const tx = -Math.sin(ang);
    const ty = Math.cos(ang);
    const a = pushPoint(
      doc,
      nextId,
      touch.x - half * tx,
      touch.y - half * ty,
      op.aId
    );
    const b = pushPoint(
      doc,
      nextId,
      touch.x + half * tx,
      touch.y + half * ty,
      op.bId
    );
    pushSegment(doc, nextId, a.id, b.id, op.style, op.id);
    return doc;
  },

  /** Radius segment: center → rim (throughId or angle/deg). */
  addRadius(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addRadius");
    let throughId = op.throughId || null;
    if (!throughId) {
      const ang = resolveCircleAngle(doc, geom, op, "addRadius");
      const p = pointOnCircle(geom.c, geom.r, ang);
      throughId = pushPoint(doc, nextId, p.x, p.y, op.throughPointId).id;
    } else {
      requirePoint(doc, throughId, "addRadius");
    }
    pushSegment(doc, nextId, geom.cir.centerId, throughId, op.style, op.id);
    return doc;
  },

  /** Diameter through center; direction from angle/deg or throughId. */
  addDiameter(doc, op, nextId) {
    const geom = circleGeom(doc, op.circleId, "addDiameter");
    const ang = resolveCircleAngle(doc, geom, op, "addDiameter");
    const p0 = pointOnCircle(geom.c, geom.r, ang);
    const p1 = pointOnCircle(geom.c, geom.r, ang + Math.PI);
    const a = pushPoint(doc, nextId, p0.x, p0.y, op.aId);
    const b = pushPoint(doc, nextId, p1.x, p1.y, op.bId);
    pushSegment(doc, nextId, a.id, b.id, op.style, op.id);
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
      aId = pushPoint(doc, nextId, p.x, p.y, op.aId).id;
    } else requirePoint(doc, aId, "addChord");
    if (!bId) {
      let ang1;
      if (op.angle1 != null) ang1 = Number(op.angle1);
      else if (op.deg1 != null) ang1 = (Number(op.deg1) * Math.PI) / 180;
      else throw new Error("addChord: need endId or angle1/deg1");
      if (!Number.isFinite(ang1)) throw new Error("addChord: angle1 invalid");
      const p = pointOnCircle(geom.c, geom.r, ang1);
      bId = pushPoint(doc, nextId, p.x, p.y, op.bId).id;
    } else requirePoint(doc, bId, "addChord");
    pushSegment(doc, nextId, aId, bId, op.style, op.id);
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
};

/** Aliases for AI-friendly names */
HANDLERS.addParallel = HANDLERS.addParallelMark;
HANDLERS.addEqual = HANDLERS.addEqualMark;
HANDLERS.addLength = HANDLERS.addLengthLabel;
HANDLERS.addArc = HANDLERS.addAngleArc;
HANDLERS.addTemplate = HANDLERS.insertTemplate;

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
