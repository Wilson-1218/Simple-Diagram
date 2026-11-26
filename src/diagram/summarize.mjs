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
      texts: count(doc.texts),
      circles: count(doc.circles),
      ellipses: count(doc.ellipses),
      sectors: count(doc.sectors),
      fills: count(doc.fills),
      fillKinds,
      rightAngles: count(doc.rightAngles),
      angleArcs: count(doc.angleArcs),
      coordPlots: count(doc.coordPlots),
      boxWhiskers: count(doc.boxWhiskers),
      barCharts: count(doc.barCharts),
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
  addPoint: {
    args: "id?, x, y, marker?, hidden?",
    note: "World coords; y down on canvas; hidden:true keeps point for geometry but skips canvas/SVG/PNG marker",
  },
  addSegment: { args: "id?, a, b, style?", note: "style: solid|dashed|dotted|dashdot" },
  addLabel: { args: "pointId, text, ox?, oy?, size?", note: "One label per point" },
  addText: {
    args: "x, y, text, id?, size?, align?, bold?",
    note: "Free-floating caption (not bound to point); align center|left|right (default center); bold default false; alias addCaption",
  },
  addCaption: {
    args: "x, y, text, id?, size?, align?, bold?",
    note: "Alias of addText",
  },
  addRightAngle: {
    args: "vertex, arm1, arm2, size?, mode?, skew?",
    note: 'mode "2d" (default) paper-sized square; mode "3d" or skew:true draws a parallelogram of side `size` along the two arms',
  },
  addAngleArc: { args: "vertex, arm1, arm2, group?, text?, reflex?" },
  addReflex: { args: "same as addAngleArc", note: "Forces reflex:true" },
  addParallelMark: { args: "segmentId, group?, side?" },
  addEqualMark: { args: "segmentId, group?, side?" },
  addBoxWhisker: {
    args: "y|x, min, q1, median, q3, max, outliers?, ticks?, boxHeight?, orientation?, showAxis?, axisLabel?|xLabel?|yLabel?",
    note: "Dedicated boxplot; ticks[] caller-supplied (no equal-spacing invent); axisLabel (aliases xLabel, yLabel) sits outside the number line and is included in the export bbox; alias addBoxPlot",
  },
  addBarChart: {
    args: "x, y, categories, values|heights, plotW?, plotH?, yMin?, yMax?, yTicks?, yStep?, xLabel?, yLabel?, yLabelMode?, barPattern?, showGrid?",
    note: "Dedicated bar chart; yLabel along axis (rotate|stack); barPattern hatch|solid; alias addBar. Stored on doc.barCharts",
  },
  addCumulativeFrequency: {
    args: "x, y, boundaries, values, plotW?, plotH?, yMax?, yStep?, xLabel?, yLabel?, smooth?, showGrid?, projections?",
    note: "Ogive. (x,y) lower-left like addBarChart. boundaries and values same length (first value usually 0). smooth false = polyline, true = monotone cubic. projections[{y,xLabel?,yLabel?,role?}]. Alias addOgive. Stored as barCharts kind ogive",
  },
  addHistogram: {
    args: "x, y, boundaries|centers, values|heights, plotW?, plotH?, yMax?, yStep?, xLabel?, yLabel?, showGrid?, showFrequencyPolygon?, barPattern?",
    note: "Touching bars (zero gap). boundaries length is values+1, or centers when length matches values. Stored as barCharts kind histogram",
  },
  addDotPattern: {
    args: "x, y, patterns, dotGap?, patternGap?, dotRadius?, showArrows?, labels?",
    note: "patterns: [[col,row]|[col,row,role]] or {rows,align} or {kind:triangular|square|hexagonal,count,solution?}. Stored as barCharts kind dots",
  },
  addFill: {
    args: "kind?, pattern?, pointIds? | centerId+startId+endId | polyArc | pathFill edges | inequalities+plotId? | betweenCurves, color?, opacity?, hatchSpacing?",
    note: "kind polygon|sector|segment|polyArc|pathFill|betweenCurves; pattern solid|hatch (slanted strokes). inequalities → feasible region (default hatch), same as addFeasibleRegion; betweenCurves → addAreaBetweenCurves; mathPoints and feasible-region corners are hidden points",
  },
  addLengthLabel: {
    args: "segmentId, text?, side?, style?(text|dim|arcs), orient?(tilt|horizontal), size?",
  },
  addMidTick: { args: "segmentId, pointId?" },
  addFoot: {
    args: "pointId, segmentId | a+b, footId?, drawSegment?, style?, label?, marker?",
    note: "orthogonal projection onto line; marker foot; altitude segment by default",
  },
  addTriangleCenter: {
    args: "a, b, c, kind, id?, hidden?, label?, ox?, oy?, drawCircle?, circleId?, circleStyle?, markTouchPoints?, touchIds?",
    note: "kind incentre|incenter|circumcentre|circumcenter|centroid|orthocentre|orthocenter. Letter aliases from addShape resolve. Degenerate triangle warns and skips. drawCircle default false",
  },
  addIncircle: {
    args: "same as addTriangleCenter",
    note: "Alias; kind defaults to incentre and drawCircle defaults to true. Radius is the distance from I to side AB",
  },
  addCircumcircle: {
    args: "same as addTriangleCenter",
    note: "Alias; kind defaults to circumcentre and drawCircle defaults to true. Circle passes through vertex a",
  },
  addBearing: {
    args: "at|pointId, northLen?, northLabel?, showCross?, to?, from?, text?, mode?, arcSize?",
    note: "Hidden north tip, solid north segment plus arrow, label N. mode acute (default) or cw|true (clockwise from north; reflex if >180). Alias addCompass",
  },
  addCompass: {
    args: "same as addBearing",
    note: "Alias of addBearing",
  },
  addPieChart: {
    args: "x,y|centerId, slices (≥2), r?, startDeg?, clockwise?, idPrefix?, labelRadiusRatio?, pattern?, opacity?",
    note: "angle degrees or value normalized to 360. label via addText; angleText via addAngleArc; rightAngle via addRightAngle. Alias addPie",
  },
  addPie: {
    args: "same as addPieChart",
    note: "Alias of addPieChart",
  },
  addMidpoint: {
    args: "a+b | segmentId, id?, markEqual?, equalGroup?, marker?, style?, hidden?",
    note: "midpoint; markEqual creates/marks subsegments (a,M)+(M,b) with equal marks; hidden skips draw",
  },
  addRatioPoint: {
    args: "a+b | segmentId, id?, t? | m+n, marker?, hidden?",
    note: "P=A+t(B−A); or P=(nA+mB)/(m+n); t wins over m:n; default t=0.5; hidden skips draw",
  },
  addIntersection: {
    args: "of1, of2, id?, id2?, extendLines?, avoidPointId?, nearPointId?, pick?, marker?, hidden?",
    note: "of = segment|circle id or {type:line,a,b}; line×line|line×circle|circle×circle; no throw if missing; hidden skips draw",
  },
  addCircle: { args: "centerId, throughId, style?" },
  addEllipse: { args: "centerId, rxId, ryId, style?, backDashed?" },
  addSector: { args: "centerId, startId, endId, mode?, style?", note: "mode arc|sector" },
  addShape: {
    args: "kind, x, y, w, h?, style?, label?, labels?, idPrefix?, apexOffset?, includeBaseCenter?, drawHeight?, waterLevel?",
    note: "kind square|rect|…|circle|semicircle|hemisphere|sphere|cube|cuboid|rectPrism|frustum|tetra|pyramid|triPrism|cylinder|cone. hemisphere/sphere radius is w (same as circle), centre (x,y), rim/equator ry = w/4. hemisphere opening up (default) is a bowl, down is a dome; waterLevel in (0,1) from the bottom; includeBaseCenter → O or {prefix}O. sphere backDashed defaults true. Solids: h is visual height (omit = today's proportions); pyramid/cone apexOffset [dx,dy], includeBaseCenter → O or {prefix}O, drawHeight dotted OV; cylinder/cone waterLevel in (0,1) splits an ellipse; idPrefix → vertices prefix0… and segments prefixs0…; labels:false or label:false skips vertex letters; letter aliases: KC and, if no point C exists, bare C resolve to the vertex labeled C (pyramid V is K4). hemisphere and sphere stamp role, color, and solutionStep onto the visible centre, rim, water line, and letter; other addShape kinds still do not",
  },
  add3DPolyhedron: {
    args: "vertices, faces, origin?, scale?, yawDeg?, pitchDeg?, idPrefix?, labels?",
    note: "vertices {A:[x,y,z]}; either face winding (normal flipped outward via (Fc-G)·n); front edges (and silhouette) solid, back-only edges dashed; idPrefix K + A → KA",
  },
  addTangent: { args: "circleId, touchId|angle|deg, halfLen|length, style?" },
  addRadius: { args: "circleId, throughId|angle|deg, style?" },
  addDiameter: { args: "circleId, throughId|angle|deg, style?" },
  addChord: { args: "circleId, startId+endId | deg0+deg1 | angle0+angle1, style?" },
  addCoordPlot: {
    args: "ox, oy, unitPx?, xUnitPx?, yUnitPx?, xStep?, yStep?, xTicks?, yTicks?, window?, curves?, feasibleRegion? | feasibleRegions?",
    note: "xTicks/yTicks replace that axis; xStep/yStep stride; xUnitPx/yUnitPx unequal scale; curve domain+style; feasibleRegion clips linear inequalities",
  },
  addCurve: { args: "plotId, type, params?, label?, domain?, style?", note: "type includes vline (params.x) for a vertical boundary" },
  addCurveIntersection: {
    args: "curve1|of1, curve2|of2, plotId?, id?, id2?, ids?, pick?, nearU?, domain?, label?, role?, color?",
    note: "roots become addPlotPoint in u order (v breaks a 1e-4 u tie). line/vline/quad algebraic; sin/cos/tan/exp/log/ln sampled. missing plot or no roots warns and skips. alias addPlotIntersection",
  },
  addAreaBetweenCurves: {
    args: "curve1|of1, curve2|of2?, plotId?, domain?, pattern?, hatchSpacing?, label?, role?, color?",
    note: "hatch polygon between graphs (default spacing 8). domain samples that interval; omitted domain uses intersection intervals. curve2 defaults to xAxis; a number is y=that number. vertices hidden. alias addFill kind betweenCurves",
  },
  addFeasibleRegion: {
    args: "inequalities, plotId?, pattern?, hatchSpacing?, color?, opacity?, label?, drawBoundaries?, domainClip?",
    note: "half-planes → hatch polygon (default) on the last coord plot; generated corners are hidden; missing plot warns and skips; strict < > is a dashed boundary",
  },
  addPlotPoint: {
    args: "plotId?, u|mathX, v|mathY, label?, ox?, oy?, projectX?, projectY?, projectStyle?, xTickLabel?, yTickLabel?, forceTickLabel?",
    note: "world x=ox+u*xUnitPx, y=oy-v*yUnitPx; missing plot warns and skips; projections persist as segments; tick text is omitted when that axis already shows a label within 1e-3 unless forceTickLabel",
  },
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
