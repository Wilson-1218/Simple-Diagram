/**
 * v13.5.65 — reverse pathFill inner arc, empty bar yTicks, y-tick label alignment.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  applyOps,
  barChartParts,
  documentToSvg,
  fillOutlinePoints,
  pointInPolygon,
  sampleMinorArc,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.65", () => {
  assert.equal(APP_VERSION, "13.5.65");
});

function pt(doc, id) {
  return doc.points.find((p) => p.id === id);
}

test("pathFill reverse inner arc A(+36°)→B(-36°) stays on its own circle", () => {
  const doc = applyOps(null, [
    { op: "setMeta", autoScaleText: false },
    { op: "addPoint", id: "O", x: 140, y: 195, showDot: false, label: "O", labelOx: -14, labelOy: 2 },
    { op: "addPoint", id: "R1", x: 295, y: 195, hidden: true },
    { op: "addPoint", id: "R2", x: 345, y: 195, hidden: true },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "R1" },
    { op: "addCircle", id: "c2", centerId: "O", throughId: "R2" },
    { op: "addPoint", id: "B", onCircle: "c1", deg: -36, showDot: false, label: "B" },
    { op: "addPoint", id: "A", onCircle: "c1", deg: 36, showDot: false, label: "A" },
    { op: "addPoint", id: "D", onCircle: "c2", deg: -36, showDot: false, label: "D" },
    { op: "addPoint", id: "C", onCircle: "c2", deg: 36, showDot: false, label: "C" },
    { op: "remove", type: "circle", id: "c1" },
    { op: "remove", type: "circle", id: "c2" },
    { op: "addSector", centerId: "O", startId: "B", endId: "A", mode: "arc" },
    { op: "addSector", centerId: "O", startId: "D", endId: "C", mode: "arc" },
    { op: "addSegment", a: "O", b: "D" },
    { op: "addSegment", a: "O", b: "C" },
    {
      op: "addFill",
      id: "ann",
      kind: "pathFill",
      pattern: "hatch",
      hatchSpacing: 6,
      edges: [
        { type: "arc", centerId: "O", from: "D", to: "C" },
        { type: "line", a: "C", b: "A" },
        { type: "arc", centerId: "O", from: "A", to: "B" },
        { type: "line", a: "B", b: "D" },
      ],
    },
  ]);
  const outline = fillOutlinePoints(doc.fills[0], (id) => pt(doc, id));
  assert.ok(outline && outline.length >= 8);
  for (const p of outline) {
    const rad = Math.hypot(p.x - 140, p.y - 195);
    assert.ok(rad >= 154.5 && rad <= 205.5, `sample r ${rad} at (${p.x}, ${p.y})`);
    assert.ok(p.x >= 265, `sample x ${p.x}`);
  }
  assert.ok(
    outline.some((p) => Math.hypot(p.x - 295, p.y - 195) < 0.05),
    "inner-arc midpoint is (295, 195)"
  );
  assert.equal(pointInPolygon(235.8, 195, outline), false, "mirrored bulge is outside");
  assert.equal(pointInPolygon(280, 195, outline), false, "sector hole inside the inner arc stays empty");
  assert.equal(pointInPolygon(320, 195, outline), true, "annulus between the arcs is filled");
  let maxStep = 0;
  for (let i = 1; i < outline.length; i++) {
    maxStep = Math.max(
      maxStep,
      Math.hypot(outline[i].x - outline[i - 1].x, outline[i].y - outline[i - 1].y)
    );
  }
  assert.ok(maxStep < 60, `outline step ${maxStep} must follow the arc, not the chord AB`);

  const inner = sampleMinorArc(pt(doc, "O"), pt(doc, "A"), pt(doc, "B"));
  assert.ok(Math.hypot(inner[0].x - pt(doc, "A").x, inner[0].y - pt(doc, "A").y) < 0.05);
  assert.ok(Math.hypot(inner[inner.length - 1].x - pt(doc, "B").x, inner[inner.length - 1].y - pt(doc, "B").y) < 0.05);

  const solid = applyOps(null, [
    { op: "addPoint", id: "O", x: 140, y: 195 },
    { op: "addPoint", id: "A", x: pt(doc, "A").x, y: pt(doc, "A").y },
    { op: "addPoint", id: "B", x: pt(doc, "B").x, y: pt(doc, "B").y },
    { op: "addPoint", id: "C", x: pt(doc, "C").x, y: pt(doc, "C").y },
    { op: "addPoint", id: "D", x: pt(doc, "D").x, y: pt(doc, "D").y },
    {
      op: "addFill",
      id: "ann",
      kind: "pathFill",
      pattern: "solid",
      edges: doc.fills[0].edges,
    },
  ]);
  const svg = documentToSvg(solid, { scale: 1, pad: 0, hidePoints: true });
  assert.match(svg, /A155\.00,155\.00 0 0 0 /, "inner arc dTheta<0 uses sweep 0");
  assert.match(svg, /A205\.00,205\.00 0 0 1 /, "outer arc dTheta>=0 uses sweep 1");
});

test("addBarChart yTicks:[] stays empty on the chart and in SVG", () => {
  const base = {
    op: "addBarChart",
    x: 140,
    y: 290,
    plotW: 340,
    plotH: 175,
    categories: ["6", "7", "8", "9", "10"],
    values: [11, 14, 11, 9, 4],
    yMin: 0,
    yMax: 18,
    showGrid: false,
    boxed: true,
    barPattern: "hatch",
    title: "Scores",
    xLabel: "Class",
    yLabel: "Count",
  };
  const doc = applyOps(null, [{ ...base, id: "empty", yTicks: [] }]);
  assert.deepEqual(doc.barCharts[0].yTicks, []);
  const parts = barChartParts(doc.barCharts[0]);
  assert.equal(parts.tickMarks.length, 0);
  assert.equal(parts.tickLabels.length, 0);
  assert.equal(parts.grid.length, 0);
  const svg = documentToSvg(doc, { scale: 1, pad: 0 });
  for (const n of ["0", "2", "4", "12", "14", "16", "18"]) {
    assert.equal(svg.includes(`>${n}<`), false, `default tick ${n} must not be drawn`);
  }

  const generated = applyOps(null, [{ ...base, id: "auto" }]);
  assert.ok(generated.barCharts[0].yTicks.length > 2);
  assert.ok(generated.barCharts[0].yTicks.includes(0));
  assert.ok(generated.barCharts[0].yTicks.includes(18));
  const autoParts = barChartParts(generated.barCharts[0]);
  assert.ok(autoParts.tickLabels.length > 2);
});

function textNodes(svg) {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, ""),
  }));
}

function attrNum(node, name) {
  const m = node.attrs.match(new RegExp(`\\b${name}="([^"]+)"`));
  assert.ok(m, name);
  return Number(m[1]);
}

function yAxisX(svg) {
  const lines = [];
  for (const m of svg.matchAll(/<line\b([^>]*)\/>/g)) {
    const a = m[1];
    const num = (name) => Number((a.match(new RegExp(`\\b${name}="([^"]+)"`)) || [])[1]);
    const x1 = num("x1");
    const x2 = num("x2");
    if (Math.abs(x1 - x2) < 0.05) lines.push({ x: x1, len: Math.abs(num("y2") - num("y1")) });
  }
  lines.sort((a, b) => b.len - a.len);
  assert.ok(lines.length, "y axis");
  return lines[0].x;
}

function assertRightYLabel(svg, label, axisX) {
  const node = textNodes(svg).find((n) => n.text === label);
  assert.ok(node, `missing ${label}`);
  assert.match(node.attrs, /text-anchor="end"/);
  assert.match(node.attrs, /stroke="#ffffff"/);
  const x = attrNum(node, "x");
  assert.ok(Math.abs(x - (axisX - 8)) < 0.06, `${label} x ${x} vs axis-8 ${axisX - 8}`);
}

test("coord y tick labels are right-aligned at ox-8 with a white halo", () => {
  const defaults = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "def",
      ox: 400,
      oy: 280,
      unitPx: 28,
      xmin: -2,
      xmax: 4,
      ymin: -12,
      ymax: 12,
      xTicks: [],
    },
  ]);
  const defSvg = documentToSvg(defaults, { scale: 1 });
  const defAxis = yAxisX(defSvg);
  for (const label of ["2", "10", "-2", "-10"]) assertRightYLabel(defSvg, label, defAxis);

  const explicit = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "ex",
      ox: 590,
      oy: 185,
      unitPx: 28,
      xmin: -3.2,
      xmax: 6.8,
      ymin: -3.6,
      ymax: 2.6,
      showTicks: false,
      showTickLabels: false,
      xTicks: [{ pos: 4, label: "4" }],
      yTicks: [{ pos: -2, label: "-2" }],
      axisLabelY: "log_9 y",
      curves: [{ type: "line", params: { m: 0.5, c: -2 }, domain: [-2.5, 6.2] }],
    },
  ]);
  const exSvg = documentToSvg(explicit, { scale: 1 });
  assertRightYLabel(exSvg, "-2", yAxisX(exSvg));

  const projected = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "pr",
      ox: 590,
      oy: 185,
      unitPx: 28,
      xmin: -3.2,
      xmax: 6.8,
      ymin: -3.6,
      ymax: 2.6,
      showTicks: false,
      showTickLabels: false,
      xTicks: [],
      yTicks: [],
    },
    {
      op: "addPlotPoint",
      id: "P",
      u: 1,
      v: -2,
      showDot: false,
      projectY: true,
      yTickLabel: "-2",
    },
  ]);
  const yLab = projected.labels.find((l) => l.text === "-2");
  assert.ok(yLab);
  assert.equal(yLab.ox, -8);
  assert.equal(yLab.anchor, "end");
  const prSvg = documentToSvg(projected, { scale: 1 });
  assertRightYLabel(prSvg, "-2", yAxisX(prSvg));
});
