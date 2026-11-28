export {
  emptyDiagram,
  cloneDoc,
  CURRENT_FORMAT_VERSION,
  APP_VERSION,
  DEFAULT_LAYERS,
  STABLE_TOP_LEVEL_KEYS,
} from "./empty-doc.mjs";
export { collectIds, createIdFactory } from "./ids.mjs";
export { validateDiagram } from "./validate.mjs";
export { applyOps, OP_NAMES, opHandlers } from "./ops.mjs";
export {
  DEFAULT_ARC_SIZE,
  effectiveArcRadius,
  arcTextRadius,
  arcDraw,
  pieArcSize,
  bearingArcSize,
} from "./angle-arc.mjs";
export {
  SOLUTION_INK,
  SOLUTION_INK_DARK,
  SOLUTION_FILL_OPACITY,
  elementStroke,
  resolveFillPaint,
  readSolutionStep,
} from "./appearance.mjs";
export { summarizeDiagram, OP_CATALOG } from "./summarize.mjs";
export {
  BUILTIN_TEMPLATES,
  BUILTIN_TEMPLATE_IDS,
  TEMPLATE_CATALOG,
  TEMPLATE_UI_IDS,
  SHAPE_SOLID_TEMPLATE_IDS,
  TEMPLATE_CELL_SIZE,
  TEMPLATE_CELL_SIZE as TEMPLATE_CELL,
  listBuiltinTemplates,
  applyBuiltinTemplate,
  assertTemplateCatalogIntegrity,
} from "./templates.mjs";
export {
  normalizeLengthStyle,
  normalizeLengthOrient,
  normalizeLengthStroke,
  normalizeLengthSide,
  lengthStrokeDash,
  readableEdgeAngle,
  lengthOffsetFrame,
  dimMarkParts,
  arcsMarkParts,
  arcsEndMark,
  endsMarkParts,
  approxTextWidth,
} from "./length-mark.mjs";
export {
  MACRO_NAMES,
  runMacro,
  drawRightTriangle,
  drawFrustum,
  drawCircleWithTangent,
  drawCuboid,
  drawCube,
} from "./macros.mjs";
export {
  documentToSvg,
  readableInkScale,
  resolveInkBudget,
  inkUserUnitsPerMm,
  angleLabelRadius,
  DEFAULT_FRAME_WIDTH_MM,
  DEFAULT_FRAME_HEIGHT_MM,
  DEFAULT_MIN_STROKE_MM,
  DEFAULT_LABEL_PT,
} from "./export-svg.mjs";
export { MAX_PNG_DIM, MAX_PNG_AREA, pngTargetPixels, cappedPngScale } from "./png-limit.mjs";
export {
  chainPathFillEdges,
  clonePathEdge,
  flipPathEdge,
  pathEdgeEndpoints,
  minorArcDelta,
  sampleMinorArc,
  fillOutlinePoints,
  pointInPolygon,
} from "./path-fill.mjs";
export {
  normalizeBoxWhisker,
  normalizeBoxWhiskerTicks,
  boxWhiskerTickPos,
  boxWhiskerTickLabel,
  boxWhiskerParts,
  boxWhiskerDash,
  addBoxWhiskerBounds,
} from "./box-whisker.mjs";
export {
  normalizeBarChart,
  barChartParts,
  addBarChartBounds,
  barValueToWorldY,
} from "./bar-chart.mjs";
export {
  normalizeStatChart,
  statChartParts,
  addStatChartBounds,
  svgStatChart,
  svgDataAttrs,
} from "./stat-charts.mjs";
export { recomputeConstructions, tangentEndpoints, perpendicularFoot } from "./constructions.mjs";
export {
  normalizeFillPattern,
  hatchInkForDisplay,
  HATCH_INK_PAPER,
  HATCH_INK_DARK_SCREEN,
  hatchStrokesInRect,
  hatchStrokesForPolygon,
  svgHatchInRect,
  svgHatchClipped,
  clipLineToRect,
} from "./hatch.mjs";
export {
  coordPlotBounds,
  addCoordPlotBounds,
  coordAxisLabelText,
  coordXAxisNamePlacement,
  coordAxisOverhangPx,
  coordAxisScales,
  coordIntegerTicks,
  coordSampleOneCurve,
  coordEvalY,
  coordWorldFromAxis,
  coordCurveDomain,
  coordCurveStyle,
  coordCurveInk,
  COORD_CURVE_INK_PAPER,
  COORD_CURVE_INK_DARK,
  coordCurveLabelText,
  curveLabelTExplicit,
  curveLabelWorld,
  normalizeCoordTicks,
  coordTickText,
  coordOriginZeroLabelSuppressed,
  coordDisplayedTickPositions,
  coordAxisShowsTickLabel,
  svgCoordPlot,
} from "./coord-plot.mjs";
export {
  parseInequality,
  clipHalfPlanes,
  solveFeasibleRegion,
  polygonAreaAndCentroid,
  isAxisBoundary,
} from "./feasible-region.mjs";
export {
  intersectCurves,
  sortIntersectionRoots,
  adjacentClosedIntervals,
  curveSearchDomain,
  sampleBetweenRings,
  CURVE_ROOT_SAMPLES,
  CURVE_AREA_STEPS,
} from "./curve-intersect.mjs";
export { parseMathRuns, svgTextInner } from "./math-text.mjs";
