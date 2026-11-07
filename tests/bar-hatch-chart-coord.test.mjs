import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  documentToSvg,
  APP_VERSION,
  STABLE_TOP_LEVEL_KEYS,
  OP_NAMES,
  normalizeBarChart,
  barChartParts,
  hatchStrokesInRect,
  normalizeFillPattern,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for bar/hatch/coord-export", () => {
  assert.equal(APP_VERSION, "13.5.32");
});

test("stable top-level keys include barCharts (37)", () => {
  assert.equal(STABLE_TOP_LEVEL_KEYS.length, 37);
  assert.ok(STABLE_TOP_LEVEL_KEYS.includes("barCharts"));
  const doc = emptyDiagram();
  assert.ok(Array.isArray(doc.barCharts));
  assert.equal(doc.version, APP_VERSION);
});

test("OP_NAMES includes addBarChart / addBar and hatch-aware addFill", () => {
  assert.ok(OP_NAMES.includes("addBarChart"));
  assert.ok(OP_NAMES.includes("addBar"));
  assert.ok(OP_NAMES.includes("addFill"));
});

test("hatchStrokesInRect yields parallel slanted strokes inside rect", () => {
  const strokes = hatchStrokesInRect(0, 0, 40, 80, { spacing: 8 });
  assert.ok(strokes.length >= 3);
  for (const s of strokes) {
    assert.ok(s.x1 >= -1e-6 && s.x2 <= 40 + 1e-6);
    assert.ok(s.y1 >= -1e-6 && s.y2 <= 80 + 1e-6);
  }
  assert.equal(normalizeFillPattern("hatch"), "hatch");
  assert.equal(normalizeFillPattern("solid"), "solid");
});

test("addFill pattern hatch persists and exports hatch lines", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 100, y: 200 },
    { op: "addPoint", id: "B", x: 140, y: 200 },
    { op: "addPoint", id: "C", x: 140, y: 120 },
    { op: "addPoint", id: "D", x: 100, y: 120 },
    {
      op: "addFill",
      id: "fh",
      kind: "polygon",
      pointIds: ["A", "B", "C", "D"],
      pattern: "hatch",
      hatchSpacing: 6,
    },
  ]);
  assert.equal(doc.fills.length, 1);
  assert.equal(doc.fills[0].pattern, "hatch");
  const svg = documentToSvg(doc);
  assert.match(svg, /clipPath/);
  assert.ok((svg.match(/<line\b/g) || []).length >= 3);
  // hatch must not be a solid rgba wash
  assert.doesNotMatch(svg, /fill="rgba\(/);
});

test("addBarChart: categories, hatch bars, vertical yLabel", () => {
  const doc = applyOps(null, [
    {
      op: "addBarChart",
      id: "bc1",
      x: 120,
      y: 320,
      plotW: 240,
      plotH: 160,
      categories: ["P", "Q", "R"],
      values: [4, 7, 5],
      yMin: 0,
      yMax: 8,
      yTicks: [0, 2, 4, 6, 8],
      yLabel: "Number of teachers",
      xLabel: "School",
      barPattern: "hatch",
      showGrid: true,
    },
  ]);
  assert.equal(doc.barCharts.length, 1);
  const bc = doc.barCharts[0];
  assert.equal(bc.categories.length, 3);
  assert.deepEqual(bc.values, [4, 7, 5]);
  assert.equal(bc.barPattern, "hatch");
  assert.equal(bc.yLabel, "Number of teachers");

  const v = validateDiagram(doc);
  assert.equal(v.ok, true, v.errors && v.errors.join("; "));

  const parts = barChartParts(bc);
  assert.equal(parts.bars.length, 3);
  assert.ok(parts.hatch.length >= 3);
  assert.ok(parts.grid.length >= 1);
  assert.equal(parts.yLabel.mode, "rotate");
  assert.equal(parts.yLabel.text, "Number of teachers");

  const svg = documentToSvg(doc);
  assert.match(svg, /Number of teachers/);
  assert.match(svg, /rotate\(-90/);
  assert.match(svg, /School/);
  assert.ok((svg.match(/<rect\b/g) || []).length >= 3);
  // horizontal grid + axes + hatch → many lines
  assert.ok((svg.match(/<line\b/g) || []).length >= 10);
});

test("addBar alias + solid bars without hatch", () => {
  const doc = applyOps(null, [
    {
      op: "addBar",
      id: "bcs",
      x: 50,
      y: 200,
      categories: ["a", "b"],
      heights: [3, 1],
      yMax: 4,
      barPattern: "solid",
      showGrid: false,
    },
  ]);
  assert.equal(doc.barCharts[0].barPattern, "solid");
  assert.equal(barChartParts(doc.barCharts[0]).hatch.length, 0);
});

test("documentToSvg renders coordPlots (axes, ticks, curves)", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 200,
      oy: 200,
      unitPx: 30,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 3,
      axisLabelX: "x",
      axisLabelY: "y",
    },
    {
      op: "addCurve",
      plotId: "plot1",
      type: "sin",
      params: { A: 1, B: 1, C: 0, D: 0 },
    },
  ]);
  assert.equal(doc.coordPlots.length, 1);
  assert.equal(doc.coordPlots[0].curves.length, 1);

  const svg = documentToSvg(doc);
  // Axes exist (not blank)
  assert.ok((svg.match(/<line\b/g) || []).length >= 4, "axes + ticks");
  assert.match(svg, /<path d="M/); // sampled curve
  assert.match(svg, />x</); // axis name
  assert.match(svg, />y</);
  assert.match(svg, />O</);
  // integer tick labels (non-zero)
  assert.match(svg, />1</);
  assert.match(svg, />2</);
});

test("normalizeBarChart rejects mismatched lengths", () => {
  assert.throws(
    () =>
      normalizeBarChart({
        id: "bad",
        x: 0,
        y: 0,
        categories: ["a"],
        values: [1, 2],
      }),
    /length/
  );
});

test("remove barChart", () => {
  const doc = applyOps(null, [
    {
      op: "addBarChart",
      id: "rm",
      x: 10,
      y: 100,
      categories: ["a"],
      values: [2],
      yMax: 5,
    },
    { op: "remove", type: "barChart", id: "rm" },
  ]);
  assert.equal(doc.barCharts.length, 0);
});
