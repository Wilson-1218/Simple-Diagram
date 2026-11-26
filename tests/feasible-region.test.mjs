import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  documentToSvg,
  validateDiagram,
  APP_VERSION,
  OP_NAMES,
  parseInequality,
  clipHalfPlanes,
  polygonAreaAndCentroid,
} from "../src/diagram/index.mjs";

const PLOT = {
  op: "addCoordPlot",
  id: "plot1",
  ox: 260,
  oy: 360,
  unitPx: 36,
  xmin: -1,
  xmax: 6,
  ymin: -1,
  ymax: 7,
};

const EXAMPLE = ["y <= 1.5x + 3", "2x + 3y <= 22", "y >= 0"];

/** Hand solution inside xmin -1, xmax 6, ymin -1, ymax 7. */
const EXAMPLE_VERTS = [
  [-1, 0],
  [6, 0],
  [6, 10 / 3],
  [2, 6],
  [-1, 1.5],
];

function assertClose(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} vs ${expected}`);
}

function assertPlane(raw, a, b, c, strict = false) {
  const p = parseInequality(raw);
  assert.ok(p, `unparsed ${JSON.stringify(raw)}`);
  assertClose(p.a, a);
  assertClose(p.b, b);
  assertClose(p.c, c);
  assert.equal(p.strict, strict);
  return p;
}

function assertVertexSet(actual, expected) {
  assert.equal(actual.length, expected.length, JSON.stringify(actual));
  for (const [u, v] of expected) {
    const hit = actual.some((p) => Math.abs(p.u - u) <= 1e-6 && Math.abs(p.v - v) <= 1e-6);
    assert.ok(hit, `missing (${u}, ${v}) in ${JSON.stringify(actual)}`);
  }
}

function mathVerts(doc) {
  const plot = doc.coordPlots[0];
  const xu = plot.xUnitPx != null ? plot.xUnitPx : plot.unitPx;
  const yu = plot.yUnitPx != null ? plot.yUnitPx : plot.unitPx;
  const fill = doc.fills[0];
  return fill.pointIds.map((id) => {
    const p = doc.points.find((q) => q.id === id);
    return { u: (p.x - plot.ox) / xu, v: (plot.oy - p.y) / yu };
  });
}

test("APP_VERSION is 13.5.49 and addFeasibleRegion is an op", () => {
  assert.equal(APP_VERSION, "13.5.49");
  assert.ok(OP_NAMES.includes("addFeasibleRegion"));
});

test("string parse accepts fractions and a strict inequality", () => {
  assertPlane("y <= (3/2)x + 3", -1.5, 1, 3, false);
  assertPlane("y <= 3/2 x + 3", -1.5, 1, 3, false);
  assertPlane("y <= 2x + 1", -2, 1, 1, false);
  assertPlane("y >= -0.5x + 3", -0.5, -1, -3, false);
  assertPlane("y < 1.5*x - 2", -1.5, 1, -2, true);
  assertPlane("x + y <= 5", 1, 1, 5, false);
  assertPlane("3x - 2y >= -6", -3, 2, 6, false);
  assertPlane("2x + 3y - 12 <= 0", 2, 3, 12, false);
  assertPlane("x >= 0", -1, 0, 0, false);
  assertPlane("y >= 0", 0, -1, 0, false);
  assertPlane("x <= 4", 1, 0, 4, false);
  assertPlane("y > 1", 0, -1, -1, true);
  assertPlane("y ≤ 2x + 1", -2, 1, 1, false);
  const obj = assertPlane({ a: 1, b: 1, op: "<=", c: 5 }, 1, 1, 5, false);
  assert.equal(obj.strict, false);
  const labeled = parseInequality({ expr: "y <= 2x + 1", label: "L_1" });
  assert.equal(labeled.label, "L_1");
  assertClose(labeled.a, -2);
  assert.equal(parseInequality("not an inequality"), null);
});

test("example inequalities clip to the hand-solution polygon", () => {
  const planes = EXAMPLE.map((s) => parseInequality(s));
  const poly = clipHalfPlanes({ uMin: -1, uMax: 6, vMin: -1, vMax: 7 }, planes);
  assertVertexSet(poly, EXAMPLE_VERTS);
  const metrics = polygonAreaAndCentroid(EXAMPLE_VERTS.map(([u, v]) => ({ u, v })));
  const got = polygonAreaAndCentroid(poly);
  assertClose(got.centroid.u, metrics.centroid.u, 1e-6);
  assertClose(got.centroid.v, metrics.centroid.v, 1e-6);
});

test("addCoordPlot feasibleRegion fills the example and labels the centroid", () => {
  const doc = applyOps(null, [
    {
      ...PLOT,
      feasibleRegion: {
        inequalities: EXAMPLE,
        pattern: "hatch",
        hatchSpacing: 8,
        label: "R",
        drawBoundaries: true,
      },
    },
  ]);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
  assert.equal(doc.fills.length, 1);
  assert.equal(doc.fills[0].kind, "polygon");
  assert.equal(doc.fills[0].pattern, "hatch");
  assert.equal(doc.fills[0].hatchSpacing, 8);
  const verts = mathVerts(doc);
  assertVertexSet(verts, EXAMPLE_VERTS);

  const metrics = polygonAreaAndCentroid(EXAMPLE_VERTS.map(([u, v]) => ({ u, v })));
  const label = doc.texts.find((t) => t.text === "R");
  assert.ok(label);
  assert.equal(label.bold, true);
  assert.equal(label.align, "center");
  const plot = doc.coordPlots[0];
  assertClose((label.x - plot.ox) / plot.unitPx, metrics.centroid.u, 1e-6);
  assertClose((plot.oy - label.y) / plot.unitPx, metrics.centroid.v, 1e-6);

  const curves = plot.curves;
  assert.equal(curves.length, 2);
  for (const c of curves) assert.equal(c.style, "solid");
  assert.ok(curves.some((c) => c.type === "line" && Math.abs(c.params.m - 1.5) < 1e-9));
  assert.ok(curves.every((c) => !(c.type === "line" && Math.abs(c.params.m) < 1e-9 && Math.abs(c.params.c) < 1e-9)));

  const svg = documentToSvg(doc);
  assert.match(svg, /clipPath/);
  assert.match(svg, /font-weight="bold"/);
  assert.match(svg, />R</);
});

test("strict boundary is dashed, closed boundary is solid, axes are not curves", () => {
  const doc = applyOps(null, [
    PLOT,
    {
      op: "addFeasibleRegion",
      inequalities: [
        "y < 2x + 1",
        "y <= 3",
        "x >= 0",
        "y >= 0",
        "x <= 4",
        { expr: "y < x + 5", style: "solid", label: "L_1", drawLine: true },
      ],
      drawBoundaries: true,
    },
  ]);
  assert.equal(doc.fills[0].pattern, "hatch");
  const curves = doc.coordPlots[0].curves;
  const dashed = curves.filter((c) => c.style === "dashed");
  const solid = curves.filter((c) => c.style === "solid");
  assert.equal(dashed.length, 1);
  assert.ok(Math.abs(dashed[0].params.m - 2) < 1e-9);
  assert.ok(Math.abs(dashed[0].params.c - 1) < 1e-9);
  assert.ok(solid.some((c) => c.type === "line" && Math.abs(c.params.m) < 1e-9 && Math.abs(c.params.c - 3) < 1e-9));
  assert.ok(solid.some((c) => c.type === "vline" && Math.abs(c.params.x - 4) < 1e-9));
  const labeled = curves.find((c) => c.label && c.label.customText === "L_1");
  assert.ok(labeled);
  assert.equal(labeled.style, "solid");
  assert.equal(labeled.label.kind, "custom");
  assert.ok(
    curves.every((c) => {
      if (c.type === "vline") return Math.abs(c.params.x) > 1e-6;
      if (c.type === "line") return !(Math.abs(c.params.m) < 1e-9 && Math.abs(c.params.c) < 1e-9);
      return true;
    })
  );
  const svg = documentToSvg(doc);
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /baseline-shift="sub"/);
});

test("addFeasibleRegion and addFill inequalities both hatch the same polygon", () => {
  const region = { inequalities: EXAMPLE, label: "R" };
  const viaOp = applyOps(null, [PLOT, { op: "addFeasibleRegion", ...region }]);
  const viaFill = applyOps(null, [PLOT, { op: "addFill", plotId: "plot1", ...region }]);
  for (const doc of [viaOp, viaFill]) {
    assert.equal(doc.fills.length, 1);
    assert.equal(doc.fills[0].pattern, "hatch");
    assert.equal(doc.fills[0].hatchSpacing, undefined);
    assert.equal(doc.coordPlots[0].curves.length, 0);
    assertVertexSet(mathVerts(doc), EXAMPLE_VERTS);
  }
  const plotOnly = applyOps(null, [{ ...PLOT, feasibleRegions: [region] }]);
  assert.equal(plotOnly.fills[0].pattern, "hatch");
  assertVertexSet(mathVerts(plotOnly), EXAMPLE_VERTS);
});

test("omitted feasible region leaves an old plot unchanged", () => {
  const ops = [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 260,
      oy: 360,
      unitPx: 36,
      xmin: -1,
      xmax: 6,
      ymin: -1,
      ymax: 7,
      curves: [{ type: "line", params: { m: 1, c: 0 } }],
    },
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 30, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 30 },
    { op: "addFill", id: "tri", pointIds: ["A", "B", "C"], opacity: 0.2 },
  ];
  const doc = applyOps(null, ops);
  assert.equal(doc.points.length, 3);
  assert.equal(doc.texts.length, 0);
  assert.equal(doc.fills.length, 1);
  assert.equal(doc.fills[0].pattern, undefined);
  assert.equal(doc.fills[0].kind, "polygon");
  assert.deepEqual(doc.fills[0].pointIds, ["A", "B", "C"]);
  assert.equal(doc.coordPlots.length, 1);
  assert.equal(doc.coordPlots[0].curves.length, 1);
  assert.equal(doc.coordPlots[0].curves[0].type, "line");
  assert.equal(doc.coordPlots[0].feasibleRegion, undefined);
  assert.equal(validateDiagram(doc).ok, true);
});

test("missing plot and a bad inequality warn and do not throw", () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args.map(String).join(" "));
  try {
    const missing = applyOps(null, [
      { op: "addFeasibleRegion", inequalities: ["y >= 0", "y <= 1", "x >= 0", "x <= 1"] },
    ]);
    assert.equal(missing.fills.length, 0);
    const partial = applyOps(null, [
      PLOT,
      {
        op: "addFeasibleRegion",
        inequalities: ["nope", "x >= 0", "y >= 0", "x <= 2", "y <= 2"],
      },
    ]);
    assert.equal(partial.fills.length, 1);
    assert.equal(partial.fills[0].pattern, "hatch");
  } finally {
    console.warn = orig;
  }
  assert.ok(warns.some((w) => w.includes("plot")));
  assert.ok(warns.some((w) => w.includes("unparseable")));
});
