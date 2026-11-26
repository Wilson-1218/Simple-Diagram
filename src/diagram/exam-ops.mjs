/**
 * Exam figure ops (v13.5.44): triangle centres, compass bearings, pie charts.
 *
 * Geometry choices (y grows downward in the document):
 * - Triangle centres use stored x,y as a Cartesian plane. Side a = |BC|, b = |AC|,
 *   c = |AB|. The incircle passes through the foot of the perpendicular from I
 *   onto AB, so its radius is that distance. The circumcircle passes through
 *   vertex `a`. The orthocentre is the intersection of the A-altitude (⊥ BC)
 *   and the B-altitude (⊥ CA).
 * - A degenerate triangle (a side shorter than 1e-9, or |sin| of an angle
 *   below 1e-10) makes incentre / circumcentre / orthocentre warn and add
 *   nothing. The centroid still exists and is still added.
 * - Bearings and pie angles use atan2 with y down: 0° is east, −90° is north,
 *   and positive sweep is clockwise on the page.
 * - The north arrow is two short solid segments off the hidden tip (no new
 *   stroke kind), so canvas, PNG, and SVG all draw it.
 * - Sector fills still take the minor arc. A slice wider than 180°, or a
 *   counter-clockwise slice of exactly 180°, is two minor fills. A clockwise
 *   180° slice is one fill (atan2 keeps +π). A full turn is one circle plus
 *   the radii, not a ring of outer arcs.
 */

import { appearanceFields } from "./appearance.mjs";
import { bearingArcSize, pieArcSize } from "./angle-arc.mjs";

const KIND = {
  incentre: "incentre",
  incenter: "incentre",
  circumcentre: "circumcentre",
  circumcenter: "circumcentre",
  centroid: "centroid",
  orthocentre: "orthocentre",
  orthocenter: "orthocentre",
};

const PIE_COLORS = ["#d6e3f0", "#f6d6c9", "#d9ead3", "#fce5b0", "#e6d5f2", "#f5c6c6"];

function asBool(v) {
  return !(v === false || v === 0 || v === "false" || v === "0" || v === "no");
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function isDegenerate(A, B, C) {
  const ab = dist(A, B);
  const bc = dist(B, C);
  const ca = dist(C, A);
  if (!(ab > 1e-9) || !(bc > 1e-9) || !(ca > 1e-9)) return true;
  const area2 = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
  return area2 / (ab * ca) < 1e-10;
}

export function incenter(A, B, C) {
  const a = dist(B, C);
  const b = dist(A, C);
  const c = dist(A, B);
  const p = a + b + c;
  if (!(p > 1e-12)) return null;
  return {
    x: (a * A.x + b * B.x + c * C.x) / p,
    y: (a * A.y + b * B.y + c * C.y) / p,
  };
}

export function circumcenter(A, B, C) {
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (!(Math.abs(d) > 1e-12)) return null;
  const a2 = A.x * A.x + A.y * A.y;
  const b2 = B.x * B.x + B.y * B.y;
  const c2 = C.x * C.x + C.y * C.y;
  return {
    x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d,
    y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d,
  };
}

export function centroid(A, B, C) {
  return { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
}

/** Intersection of altitude from A (⊥ BC) and altitude from B (⊥ CA). */
export function orthocenter(A, B, C) {
  const a1 = C.x - B.x;
  const b1 = C.y - B.y;
  const c1 = a1 * A.x + b1 * A.y;
  const a2 = C.x - A.x;
  const b2 = C.y - A.y;
  const c2 = a2 * B.x + b2 * B.y;
  const det = a1 * b2 - a2 * b1;
  if (!(Math.abs(det) > 1e-12)) return null;
  return {
    x: (c1 * b2 - c2 * b1) / det,
    y: (a1 * c2 - a2 * c1) / det,
  };
}

export function footOnLine(P, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  return { x: A.x + t * dx, y: A.y + t * dy };
}

function finitePoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * @param {object} doc
 * @param {object} op
 * @param {Function} nextId
 * @param {{ requirePoint: Function, pointById: Function, pushPoint: Function, pushSegment: Function, handlers: Record<string, Function> }} api
 * @param {{ opName: string, kind: string|null, drawCircle: boolean }} defaults
 */
export function applyTriangleCenter(doc, op, nextId, api, defaults) {
  const ctx = defaults.opName || "addTriangleCenter";
  const { requirePoint, pointById, pushPoint, handlers, inlinePointLabel } = api;
  if (op.a == null || op.b == null || op.c == null) {
    throw new Error(`${ctx}: a, b, c required`);
  }
  const kindRaw = op.kind != null && op.kind !== "" ? op.kind : defaults.kind;
  if (kindRaw == null || kindRaw === "") {
    throw new Error(`${ctx}: kind required`);
  }
  const kind = KIND[String(kindRaw).trim().toLowerCase()];
  if (!kind) throw new Error(`${ctx}: unknown kind ${kindRaw}`);

  const aId = requirePoint(doc, op.a, ctx);
  const bId = requirePoint(doc, op.b, ctx);
  const cId = requirePoint(doc, op.c, ctx);
  const A = pointById(doc, aId);
  const B = pointById(doc, bId);
  const C = pointById(doc, cId);

  if (kind !== "centroid" && isDegenerate(A, B, C)) {
    console.warn(`${ctx}: degenerate triangle; skipped`, {
      kind,
      a: op.a,
      b: op.b,
      c: op.c,
    });
    return doc;
  }

  let pos;
  if (kind === "incentre") pos = incenter(A, B, C);
  else if (kind === "circumcentre") pos = circumcenter(A, B, C);
  else if (kind === "centroid") pos = centroid(A, B, C);
  else pos = orthocenter(A, B, C);
  if (!finitePoint(pos)) {
    console.warn(`${ctx}: center undefined; skipped`, { kind });
    return doc;
  }

  const look = appearanceFields(op);
  const center = pushPoint(
    doc,
    nextId,
    pos.x,
    pos.y,
    op.id != null && op.id !== "" ? op.id : undefined,
    undefined,
    op.hidden === true,
    op
  );
  inlinePointLabel(doc, op, nextId, center, { legacyOxOy: true });

  let drawCircle =
    op.drawCircle != null && op.drawCircle !== "" ? asBool(op.drawCircle) : !!defaults.drawCircle;
  if (drawCircle && kind !== "incentre" && kind !== "circumcentre") {
    console.warn(`${ctx}: drawCircle ignored for ${kind}`);
    drawCircle = false;
  }

  const wantTouch =
    kind === "incentre" &&
    (op.markTouchPoints === true ||
      op.markTouchPoints === "true" ||
      (Array.isArray(op.touchIds) && op.touchIds.length > 0));
  if (
    kind !== "incentre" &&
    (op.markTouchPoints === true || (Array.isArray(op.touchIds) && op.touchIds.length > 0))
  ) {
    console.warn(`${ctx}: touch points are incentre only; ignored`);
  }

  let touchIds = null;
  if (wantTouch && op.touchIds != null) {
    if (!Array.isArray(op.touchIds) || op.touchIds.length !== 3) {
      throw new Error(`${ctx}: touchIds must be [idAB, idBC, idCA]`);
    }
    touchIds = op.touchIds.map((id) => {
      if (id == null || id === "") throw new Error(`${ctx}: touchIds entries must be non-empty ids`);
      return String(id);
    });
  }

  /** @type {string|null} */
  let throughId = null;
  /** @type {string[]|null} */
  let generatedTouches = null;
  if (kind === "incentre" && (drawCircle || wantTouch)) {
    const feet = [footOnLine(pos, A, B), footOnLine(pos, B, C), footOnLine(pos, C, A)];
    if (wantTouch) {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const hint = touchIds ? touchIds[i] : undefined;
        const p = pushPoint(doc, nextId, feet[i].x, feet[i].y, hint, undefined, false, op);
        ids.push(p.id);
      }
      throughId = ids[0];
      generatedTouches = ids;
    } else {
      const p = pushPoint(doc, nextId, feet[0].x, feet[0].y, undefined, undefined, true, op);
      throughId = p.id;
      generatedTouches = [p.id];
    }
  }

  if (drawCircle && kind === "incentre" && throughId) {
    const circle = { centerId: center.id, throughId, ...look };
    if (op.circleId != null && op.circleId !== "") circle.id = String(op.circleId);
    if (op.circleStyle != null && op.circleStyle !== "") circle.style = op.circleStyle;
    handlers.addCircle(doc, circle, nextId);
  }
  if (drawCircle && kind === "circumcentre") {
    const circle = { centerId: center.id, throughId: aId, ...look };
    if (op.circleId != null && op.circleId !== "") circle.id = String(op.circleId);
    if (op.circleStyle != null && op.circleStyle !== "") circle.style = op.circleStyle;
    handlers.addCircle(doc, circle, nextId);
  }
  center.construction = {
    kind: "triangleCenter",
    centerKind: kind,
    a: aId,
    b: bId,
    c: cId,
  };
  if (generatedTouches && generatedTouches.length) {
    center.construction.touchIds = generatedTouches;
  }
  return doc;
}

function addArrowHead(doc, nextId, api, tip, ux, uy, northLen, appearance) {
  const { pushPoint, pushSegment } = api;
  const scale = Math.min(1, northLen / 40);
  const back = 9 * scale;
  const half = 4.2 * scale;
  if (!(back > 1.5)) return;
  const bx = tip.x - ux * back;
  const by = tip.y - uy * back;
  const px = -uy;
  const py = ux;
  const left = pushPoint(doc, nextId, bx + px * half, by + py * half, undefined, undefined, true, appearance);
  const right = pushPoint(doc, nextId, bx - px * half, by - py * half, undefined, undefined, true, appearance);
  pushSegment(doc, nextId, tip.id, left.id, "solid", undefined, appearance);
  pushSegment(doc, nextId, tip.id, right.id, "solid", undefined, appearance);
}

function bearingMode(v, ctx) {
  if (v == null || v === "" || v === "acute") return "acute";
  if (v === true || v === "true" || v === "cw" || v === "CW") return "cw";
  throw new Error(`${ctx}: unknown mode ${v}`);
}

function clockwiseFromNorth(at, to) {
  const ang = Math.atan2(to.y - at.y, to.x - at.x);
  let d = ang + Math.PI / 2;
  while (d < 0) d += Math.PI * 2;
  while (d >= Math.PI * 2) d -= Math.PI * 2;
  return d;
}

const AXIS = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

/**
 * @param {object} doc
 * @param {object} op
 * @param {Function} nextId
 * @param {{ requirePoint: Function, pointById: Function, pushPoint: Function, pushSegment: Function, handlers: Record<string, Function> }} api
 */
export function applyBearing(doc, op, nextId, api) {
  const ctx = "addBearing";
  const { requirePoint, pointById, pushPoint, pushSegment, handlers } = api;
  const look = appearanceFields(op);
  const atRaw = op.at != null ? op.at : op.pointId;
  if (atRaw == null || atRaw === "") throw new Error(`${ctx}: at required`);
  const atId = requirePoint(doc, atRaw, ctx);
  const at = pointById(doc, atId);
  const northLen = op.northLen != null && op.northLen !== "" ? Number(op.northLen) : 56;
  if (!Number.isFinite(northLen) || !(northLen > 0)) {
    throw new Error(`${ctx}: northLen must be > 0`);
  }
  const mode = bearingMode(op.mode, ctx);
  const fromRaw = op.from == null || op.from === "" ? "N" : String(op.from).trim().toUpperCase();
  if (fromRaw.length !== 1 || !AXIS[fromRaw]) {
    throw new Error(`${ctx}: from must be N, S, E, or W`);
  }

  let toId = null;
  let toP = null;
  if (op.to != null && op.to !== "") {
    toId = requirePoint(doc, op.to, ctx);
    toP = pointById(doc, toId);
    if (toId === atId || dist(at, toP) < 1e-9) {
      console.warn(`${ctx}: to is at the station; arc skipped`);
      toId = null;
      toP = null;
    }
  }

  const tip = pushPoint(doc, nextId, at.x, at.y - northLen, undefined, undefined, true, op);
  pushSegment(doc, nextId, atId, tip.id, "solid", undefined, op);
  addArrowHead(doc, nextId, api, tip, 0, -1, northLen, op);

  const hideNorth =
    op.northLabel === false || op.northLabel === "" || op.northLabel === "false";
  if (!hideNorth) {
    const text = op.northLabel == null ? "N" : String(op.northLabel);
    if (text) {
      handlers.addLabel(doc, { pointId: tip.id, text, ox: 0, oy: -14, ...look }, nextId);
    }
  }

  /** @type {Record<string, string>} */
  const axisId = { N: tip.id };
  if (op.showCross === true || op.showCross === "true") {
    const tick = 14;
    const east = pushPoint(doc, nextId, at.x + tick, at.y, undefined, undefined, true, op);
    const west = pushPoint(doc, nextId, at.x - tick, at.y, undefined, undefined, true, op);
    const south = pushPoint(doc, nextId, at.x, at.y + tick, undefined, undefined, true, op);
    pushSegment(doc, nextId, atId, east.id, "dashed", undefined, op);
    pushSegment(doc, nextId, atId, west.id, "dashed", undefined, op);
    pushSegment(doc, nextId, atId, south.id, "dashed", undefined, op);
    axisId.E = east.id;
    axisId.W = west.id;
    axisId.S = south.id;
  }

  if (!toId || !toP) return doc;

  const fromKey = mode === "cw" ? "N" : fromRaw;
  let armId = axisId[fromKey];
  if (!armId) {
    const dir = AXIS[fromKey];
    const p = pushPoint(
      doc,
      nextId,
      at.x + dir.x * northLen,
      at.y + dir.y * northLen,
      undefined,
      undefined,
      true,
      op
    );
    armId = p.id;
  }
  if (armId === toId) {
    console.warn(`${ctx}: arc arms coincide; skipped`);
    return doc;
  }

  let reflex = false;
  if (mode === "cw") {
    const sweep = clockwiseFromNorth(at, toP);
    if (sweep < 1e-4 || sweep > Math.PI * 2 - 1e-4) {
      console.warn(`${ctx}: bearing angle is empty; arc skipped`);
      return doc;
    }
    reflex = sweep > Math.PI + 1e-8;
  } else {
    const arm = pointById(doc, armId);
    const a0 = Math.atan2(arm.y - at.y, arm.x - at.x);
    const a1 = Math.atan2(toP.y - at.y, toP.x - at.x);
    let delta = a1 - a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    if (Math.abs(delta) < 1e-4) {
      console.warn(`${ctx}: bearing angle is empty; arc skipped`);
      return doc;
    }
  }

  const arcSize = bearingArcSize(northLen, op.arcSize);
  const text = op.text != null ? String(op.text) : "";
  handlers.addAngleArc(
    doc,
    {
      vertex: atId,
      arm1: armId,
      arm2: toId,
      text,
      size: arcSize,
      reflex,
      ...look,
    },
    nextId
  );
  return doc;
}

function sliceSpans(slices, ctx) {
  if (!Array.isArray(slices) || slices.length < 2) {
    throw new Error(`${ctx}: slices length must be ≥ 2`);
  }
  const rows = slices.map((s, i) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      throw new Error(`${ctx}: slices[${i}] must be an object`);
    }
    return s;
  });
  const allAngles = rows.every((s) => s.angle != null && s.angle !== "" && Number.isFinite(Number(s.angle)));
  if (allAngles) {
    return rows.map((s) => ({ slice: s, span: Number(s.angle), normalize: false }));
  }
  const weights = rows.map((s, i) => {
    if (s.value != null && s.value !== "" && Number.isFinite(Number(s.value))) return Number(s.value);
    if (s.angle != null && s.angle !== "" && Number.isFinite(Number(s.angle))) return Number(s.angle);
    throw new Error(`${ctx}: slices[${i}] needs angle or value`);
  });
  return rows.map((s, i) => ({ slice: s, span: weights[i], normalize: true }));
}

function safePieces(a0, sweep) {
  const EPS = 1e-8;
  if (sweep > -Math.PI + EPS && sweep <= Math.PI + EPS) return [[a0, a0 + sweep]];
  if (!(Math.abs(sweep) > EPS)) return [];
  const half = sweep / 2;
  return safePieces(a0, half).concat(safePieces(a0 + half, half));
}

function angleKey(angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  if (a < 1e-8 || a > Math.PI * 2 - 1e-8) a = 0;
  return a.toFixed(5);
}

/**
 * @param {object} doc
 * @param {object} op
 * @param {Function} nextId
 * @param {{ requirePoint: Function, pointById: Function, pushPoint: Function, pushSegment: Function, handlers: Record<string, Function> }} api
 */
export function applyPieChart(doc, op, nextId, api) {
  const ctx = "addPieChart";
  const { requirePoint, pointById, pushPoint, pushSegment, handlers } = api;
  const look = appearanceFields(op);
  const callerSetRatio = op.labelRadiusRatio != null && op.labelRadiusRatio !== "";
  const drafted = sliceSpans(op.slices, ctx);
  const positive = [];
  const normalize = drafted.some((row) => row.normalize);
  if (normalize) {
    const keep = drafted.filter((row) => row.span > 1e-9);
    if (keep.length < drafted.length) {
      console.warn(`${ctx}: non-positive slice; skipped`, {
        skipped: drafted.length - keep.length,
      });
    }
    const sum = keep.reduce((acc, row) => acc + row.span, 0);
    if (!(sum > 1e-12)) {
      console.warn(`${ctx}: slice values sum to 0; skipped`);
      return doc;
    }
    for (const row of keep) positive.push({ slice: row.slice, deg: (row.span / sum) * 360 });
  } else {
    for (const row of drafted) {
      if (!(row.span > 1e-9)) {
        console.warn(`${ctx}: non-positive slice; skipped`);
        continue;
      }
      positive.push({ slice: row.slice, deg: row.span });
    }
  }
  if (positive.length < 1) {
    console.warn(`${ctx}: no positive slices; skipped`);
    return doc;
  }

  let cx;
  let cy;
  let centerId;
  const createdCenter = op.centerId == null || op.centerId === "";
  if (!createdCenter) {
    centerId = requirePoint(doc, op.centerId, ctx);
    const c = pointById(doc, centerId);
    cx = c.x;
    cy = c.y;
  } else {
    cx = Number(op.x);
    cy = Number(op.y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      throw new Error(`${ctx}: x, y or centerId required`);
    }
  }
  const r = op.r != null && op.r !== "" ? Number(op.r) : 95;
  if (!Number.isFinite(r) || !(r > 0)) throw new Error(`${ctx}: r must be > 0`);
  const startDeg = op.startDeg != null && op.startDeg !== "" ? Number(op.startDeg) : 0;
  if (!Number.isFinite(startDeg)) throw new Error(`${ctx}: startDeg must be finite`);
  const clockwise = op.clockwise == null || op.clockwise === "" ? true : asBool(op.clockwise);
  const sign = clockwise ? 1 : -1;
  const prefix = op.idPrefix != null ? String(op.idPrefix) : "";
  let ratio = op.labelRadiusRatio != null && op.labelRadiusRatio !== "" ? Number(op.labelRadiusRatio) : 0.62;
  if (!Number.isFinite(ratio)) ratio = 0.62;

  if (createdCenter) {
    const hint = prefix ? `${prefix}C` : undefined;
    const center = pushPoint(doc, nextId, cx, cy, hint, undefined, true, op);
    centerId = center.id;
  }

  const rimByKey = new Map();
  let rimSeq = 0;
  function rimAt(angle) {
    const key = angleKey(angle);
    if (rimByKey.has(key)) return rimByKey.get(key);
    const hint = prefix ? `${prefix}r${rimSeq}` : undefined;
    rimSeq += 1;
    const p = pushPoint(
      doc,
      nextId,
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle),
      hint,
      undefined,
      true,
      op
    );
    rimByKey.set(key, p.id);
    return p.id;
  }

  let ang = (startDeg * Math.PI) / 180;
  const boundaryAngles = [ang];
  const placed = [];
  for (let i = 0; i < positive.length; i++) {
    const deg = positive[i].deg;
    const sweep = sign * deg * (Math.PI / 180);
    const a0 = ang;
    ang += sweep;
    boundaryAngles.push(ang);
    placed.push({ ...positive[i], a0, sweep, startId: null, endId: null, index: i });
  }
  for (const row of placed) {
    row.startId = rimAt(row.a0);
    row.endId = rimAt(row.a0 + row.sweep);
  }

  const spoke = new Set();
  for (const a of boundaryAngles) {
    const id = rimAt(a);
    if (id === centerId || spoke.has(id)) continue;
    spoke.add(id);
    pushSegment(doc, nextId, centerId, id, "solid", undefined, op);
  }

  const total = boundaryAngles[boundaryAngles.length - 1] - boundaryAngles[0];
  const closed = Math.abs(Math.abs(total) - Math.PI * 2) < 1e-4;
  if (closed && spoke.size > 0) {
    const throughId = rimAt(boundaryAngles[0]);
    handlers.addCircle(doc, { centerId, throughId, ...look }, nextId);
  }

  for (const row of placed) {
    const patternRaw = row.slice.pattern != null ? row.slice.pattern : op.pattern;
    const pattern = patternRaw != null && patternRaw !== "" ? String(patternRaw) : "solid";
    const hatch = pattern.trim().toLowerCase() === "hatch";
    const explicitSliceColor = row.slice.color != null && row.slice.color !== "";
    const explicitOpColor = op.color != null && op.color !== "";
    const color = explicitSliceColor
      ? row.slice.color
      : explicitOpColor
        ? op.color
        : look.role === "solution"
          ? undefined
          : hatch
            ? undefined
            : PIE_COLORS[row.index % PIE_COLORS.length];
    const opacity =
      row.slice.opacity != null && row.slice.opacity !== ""
        ? row.slice.opacity
        : op.opacity != null && op.opacity !== ""
          ? op.opacity
          : hatch
            ? undefined
            : 0.55;
    const pieces = safePieces(row.a0, row.sweep);
    for (const [p0, p1] of pieces) {
      const startId = rimAt(p0);
      const endId = rimAt(p1);
      if (startId === endId) continue;
      const fill = { kind: "sector", centerId, startId, endId, pattern, ...look };
      if (color != null) fill.color = color;
      if (opacity != null && !(look.role === "solution" && color == null && (row.slice.opacity == null || row.slice.opacity === "") && (op.opacity == null || op.opacity === ""))) {
        fill.opacity = opacity;
      }
      handlers.addFill(doc, fill, nextId);
      if (!closed) {
        handlers.addSector(doc, { centerId, startId, endId, mode: "arc", ...look }, nextId);
      }
    }

    const sliceSetRatio = row.slice.labelRadiusRatio != null && row.slice.labelRadiusRatio !== "";
    const pinned = sliceSetRatio || callerSetRatio;
    const hasCategory = typeof row.slice.label === "string" && row.slice.label !== "";
    const angleRaw = sliceAngleField(row.slice);
    const hasAngleText = angleRaw != null;
    const splitLabel = hasCategory && (hasAngleText || row.slice.rightAngle === true) && !pinned;
    const mid = row.a0 + row.sweep / 2;
    const narrow = Math.abs(row.deg) < 45;
    let labelRatio = ratio;
    let align = "center";
    if (sliceSetRatio) labelRatio = Number(row.slice.labelRadiusRatio);
    else if (callerSetRatio) labelRatio = ratio;
    else if (splitLabel && narrow) {
      labelRatio = 1.16;
      align = Math.cos(mid) >= 0 ? "left" : "right";
    } else if (splitLabel) labelRatio = 0.68;
    const useRatio = Number.isFinite(labelRatio) ? labelRatio : splitLabel ? 0.68 : ratio;
    if (hasCategory) {
      handlers.addText(
        doc,
        {
          x: cx + useRatio * r * Math.cos(mid),
          y: cy + useRatio * r * Math.sin(mid),
          text: row.slice.label,
          align,
          ...look,
        },
        nextId
      );
    }

    if (row.startId && row.endId && row.startId !== row.endId && hasAngleText) {
      const text = angleRaw === true ? `${trimDeg(row.deg)}°` : String(angleRaw);
      const arcSize = pieArcSize(r, op.arcSize);
      const arc = {
        vertex: centerId,
        arm1: row.startId,
        arm2: row.endId,
        text,
        size: arcSize,
        reflex: Math.abs(row.deg) > 180 + 1e-6,
        ...look,
      };
      if (hasCategory && hasAngleText && !pinned) {
        const textR = Math.max(0.36 * r, arcSize + 12);
        arc.textRadiusOffset = textR - (arcSize + 11);
      }
      handlers.addAngleArc(doc, arc, nextId);
    }

    if (row.slice.rightAngle === true && row.startId && row.endId && row.startId !== row.endId) {
      handlers.addRightAngle(
        doc,
        { vertex: centerId, arm1: row.startId, arm2: row.endId, ...look },
        nextId
      );
    }
  }
  return doc;
}

/** angleText is the stored name. angleLabel is the alias when angleText is omitted. */
function sliceAngleField(slice) {
  if (!slice || typeof slice !== "object") return null;
  if (slice.angleText != null && slice.angleText !== false && slice.angleText !== "") {
    return slice.angleText;
  }
  if (slice.angleLabel != null && slice.angleLabel !== false && slice.angleLabel !== "") {
    return slice.angleLabel;
  }
  return null;
}

function trimDeg(deg) {
  const rounded = Math.round(deg * 1000) / 1000;
  return String(rounded);
}
