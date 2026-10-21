/**
 * Compact summary of a diagram for agents (counts + ids).
 * @param {object} doc
 * @returns {object}
 */
export function summarizeDiagram(doc) {
  if (!doc || typeof doc !== "object") {
    return { error: "document must be an object" };
  }
  const count = (arr) => (Array.isArray(arr) ? arr.length : 0);
  const ids = (arr) =>
    Array.isArray(arr) ? arr.map((x) => x && x.id).filter(Boolean) : [];
  const fillKinds = {};
  if (Array.isArray(doc.fills)) {
    for (const f of doc.fills) {
      const k = f && (f.kind === "sector" || f.kind === "segment") ? f.kind : "polygon";
      fillKinds[k] = (fillKinds[k] || 0) + 1;
    }
  }
  return {
    name: doc.name || null,
    formatVersion: doc.formatVersion ?? null,
    version: doc.version ?? null,
    counts: {
      points: count(doc.points),
      segments: count(doc.segments),
      labels: count(doc.labels),
      circles: count(doc.circles),
      ellipses: count(doc.ellipses),
      sectors: count(doc.sectors),
      fills: count(doc.fills),
      fillKinds,
      rightAngles: count(doc.rightAngles),
      angleArcs: count(doc.angleArcs),
      coordPlots: count(doc.coordPlots),
      lengthLabels: count(doc.lengthLabels),
      parallelMarks: count(doc.parallelMarks),
      equalMarks: count(doc.equalMarks),
    },
    pointIds: ids(doc.points),
    segmentIds: ids(doc.segments),
    circleIds: ids(doc.circles),
    layers: doc.layers || null,
    view: doc.view || null,
    gridSnap: doc.gridSnap,
    gridMode: doc.gridMode,
  };
}

/** Brief catalog of ops for MCP list_ops / agents. */
export const OP_CATALOG = {
  addPoint: { args: "id?, x, y, marker?", note: "World coords; y down on canvas" },
  addSegment: { args: "id?, a, b, style?", note: "style: solid|dashed|dotted|dashdot" },
  addLabel: { args: "pointId, text, ox?, oy?, size?", note: "One label per point" },
  addRightAngle: { args: "vertex, arm1, arm2, size?" },
  addAngleArc: { args: "vertex, arm1, arm2, group?, text?, reflex?" },
  addReflex: { args: "same as addAngleArc", note: "Forces reflex:true" },
  addParallelMark: { args: "segmentId, group?, side?" },
  addEqualMark: { args: "segmentId, group?, side?" },
  addLengthLabel: { args: "segmentId, text, side?" },
  addMidTick: { args: "segmentId, pointId?" },
  addFoot: {
    args: "pointId, segmentId | a+b, footId?, drawSegment?, style?, label?, marker?",
    note: "orthogonal projection onto line; marker foot; altitude segment by default",
  },
  addCircle: { args: "centerId, throughId, style?" },
  addEllipse: { args: "centerId, rxId, ryId, style?, backDashed?" },
  addSector: { args: "centerId, startId, endId, mode?, style?", note: "mode arc|sector" },
  addFill: {
    args: "kind?, pointIds? | centerId+startId+endId | polyArc | pathFill edges[{line|arc}], color?, opacity?",
    note: "kind polygon|sector|segment|polyArc|pathFill",
  },
  addShape: {
    args: "kind, x, y, w, h?, style?, label?, labels?, idPrefix?",
    note: "kind square|rect|rhombus|parallelogram|trapezoid|kite|equilateral|iso|rightTri|isoRight|pentagon|hexagon|circle|semicircle",
  },
  addTangent: { args: "circleId, touchId|angle|deg, halfLen|length, style?" },
  addRadius: { args: "circleId, throughId|angle|deg, style?" },
  addDiameter: { args: "circleId, throughId|angle|deg, style?" },
  addChord: { args: "circleId, startId+endId | deg0+deg1 | angle0+angle1, style?" },
  addCoordPlot: { args: "ox, oy, window?, curves?" },
  addCurve: { args: "plotId, type, params?, label?" },
  alignPoints: { args: "pointIds, axis", note: "left|center|right|top|middle|bottom" },
  distributePoints: { args: "pointIds (≥3), axis x|y" },
  equalizeSegments: { args: "segmentIds (≥2), length?" },
  setView: { args: "x?, y?, scale?" },
  setMeta: { args: "gridSnap?, gridMode?, layers?, name?, …" },
  setLayers: { args: "gridShow?, coordsShow?, helpersShow?, *Lock?" },
  movePoint: { args: "id, x, y" },
  remove: { args: "type, id", note: "type point|segment|fill|circle|…" },
  insertTemplate: {
    args: "id, dx?, dy?, scale?",
    note: "Builtin geometry: rightTri|isoTri|genTri|…|frustum|cuboid|cylinder|cone; alias addTemplate",
  },
  addTemplate: {
    args: "id, dx?, dy?, scale?",
    note: "Alias of insertTemplate",
  },
};
