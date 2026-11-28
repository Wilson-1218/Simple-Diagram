import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  CURVE_AREA_STEPS,
  CURVE_ROOT_SAMPLES,
  OP_NAMES,
  applyOps,
  documentToSvg,
  sortIntersectionRoots,
  validateDiagram,
} from "../src/diagram/index.mjs";

const PLOT = {
  op: "addCoordPlot",
  id: "plot1",
  ox: 280,
  oy: 340,
  unitPx: 40,
  xmin: -3,
  xmax: 3,
  ymin: -1,
  ymax: 6,
  curves: [
    { id: "para", type: "quad", params: { a: 1, b: 0, c: 0 } },
    { id: "ln", type: "line", params: { m: 0, c: 4 } },
  ],
};

function uv(doc, id, plot = doc.coordPlots[0]) {
  const p = doc.points.find((q) => q.id === id);
  const xu = plot.xUnitPx != null ? plot.xUnitPx : plot.unitPx;
  const yu = plot.yUnitPx != null ? plot.yUnitPx : plot.unitPx;
  return { u: (p.x - plot.ox) / xu, v: (plot.oy - p.y) / yu, point: p };
}

function withWarns(fn) {
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args.map((a) => String(a)).join(" "));
  try {
    return { doc: fn(), warns };
  } finally {
    console.warn = orig;
  }
}

test("APP_VERSION is 13.5.57 and curve ops are registered", () => {
  assert.equal(APP_VERSION, "13.5.57");
  assert.equal(OP_NAMES.length, 64);
  assert.ok(OP_NAMES.includes("addCurveIntersection"));
  assert.ok(OP_NAMES.includes("addPlotIntersection"));
  assert.ok(OP_NAMES.includes("addAreaBetweenCurves"));
  assert.equal(CURVE_ROOT_SAMPLES, 400);
  assert.ok(CURVE_AREA_STEPS >= 64 && CURVE_AREA_STEPS <= 96);
});

test("parabola and a line yield P, Q in u order and a solution hatch", () => {
  const doc = applyOps(null, [
    PLOT,
    {
      op: "addCurveIntersection",
      curve1: "para",
      curve2: "ln",
      ids: ["P", "Q"],
      role: "solution",
    },
    {
      op: "addAreaBetweenCurves",
      curve1: "para",
      curve2: "ln",
      label: "R",
      role: "solution",
    },
  ]);
  const P = uv(doc, "P");
  const Q = uv(doc, "Q");
  assert.ok(Math.abs(P.u + 2) < 1e-9 && Math.abs(P.v - 4) < 1e-9);
  assert.ok(Math.abs(Q.u - 2) < 1e-9 && Math.abs(Q.v - 4) < 1e-9);
  assert.ok(P.u < Q.u);
  assert.equal(P.point.role, "solution");
  assert.equal(Q.point.role, "solution");
  assert.equal(P.point.hidden, undefined);
  assert.equal(doc.coordPlots[0].curves.length, 2);

  assert.equal(doc.fills.length, 1);
  const fill = doc.fills[0];
  assert.equal(fill.kind, "polygon");
  assert.equal(fill.pattern, "hatch");
  assert.equal(fill.role, "solution");
  assert.equal(fill.color, undefined);
  assert.equal(fill.hatchSpacing, undefined);
  assert.ok(fill.pointIds.length >= 64 * 2 - 4 && fill.pointIds.length <= 96 * 2);
  for (const id of fill.pointIds) {
    const p = doc.points.find((q) => q.id === id);
    assert.equal(p.hidden, true);
    assert.equal(p.role, "solution");
  }

  assert.equal(doc.texts.length, 1);
  const text = doc.texts[0];
  assert.equal(text.text, "R");
  assert.equal(text.bold, true);
  assert.equal(text.align, "center");
  assert.equal(text.role, "solution");
  const tu = (text.x - 280) / 40;
  const tv = (340 - text.y) / 40;
  assert.ok(Math.abs(tu) < 0.02, `centroid u ${tu}`);
  assert.ok(Math.abs(tv - 2.4) < 0.02, `centroid v ${tv}`);

  const svg = documentToSvg(doc);
  assert.match(svg, />R</);
  assert.match(svg, /font-weight="bold"/);
  assert.match(svg, /paint-order="stroke fill"/);
  const checked = validateDiagram(doc);
  assert.equal(checked.ok, true, checked.errors.join("; "));
});

test("no roots warns and adds nothing", () => {
  const { doc, warns } = withWarns(() =>
    applyOps(null, [
      PLOT,
      {
        op: "addCurveIntersection",
        curve1: "para",
        curve2: { type: "line", params: { m: 0, c: -1 } },
        id: "Z",
      },
      { op: "addAreaBetweenCurves", curve1: "para", curve2: -1 },
    ])
  );
  assert.equal(doc.points.length, 0);
  assert.equal(doc.fills.length, 0);
  assert.equal(doc.texts.length, 0);
  assert.equal(doc.coordPlots[0].curves.length, 2);
  assert.ok(warns.some((w) => w.includes("no roots")));
  assert.ok(warns.some((w) => w.includes("need at least two")));
});

test("missing plot warns and skips", () => {
  const { doc, warns } = withWarns(() =>
    applyOps(null, [
      { op: "addPlotIntersection", curve1: "xAxis", curve2: "yAxis", id: "P" },
      { op: "addAreaBetweenCurves", curve1: "xAxis" },
    ])
  );
  assert.equal(doc.points.length, 0);
  assert.equal(doc.fills.length, 0);
  assert.ok(warns.length >= 2);
  assert.ok(warns.every((w) => w.includes("skipped")));
});

test("pick, nearU, id2, and inline curve stay off the plot", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 10,
      xmin: -1,
      xmax: 3,
      ymin: -1,
      ymax: 3,
      curves: [
        { id: "p", type: "quad", params: { a: 1, b: 0, c: 0 } },
        { id: "l", type: "line", params: { m: 1, c: 0 } },
      ],
    },
    { op: "addCurveIntersection", of1: "p", of2: "l", id: "L", pick: "left" },
    { op: "addCurveIntersection", curve1: 0, curve2: 1, id: "R", pick: "right" },
    { op: "addCurveIntersection", curve1: "p", curve2: "l", id: "T", pick: "top" },
    { op: "addCurveIntersection", curve1: "p", curve2: "l", id: "B", pick: "bottom" },
    { op: "addCurveIntersection", curve1: "p", curve2: "l", id: "S", pick: "second" },
    { op: "addCurveIntersection", curve1: "p", curve2: "l", id: "N", nearU: 0.2 },
    {
      op: "addCurveIntersection",
      curve1: "p",
      curve2: { type: "line", params: { m: 0, c: 1 } },
      id: "A",
      id2: "C",
      label: true,
      ox: 4,
      oy: -8,
      hidden: false,
      projectY: true,
      yTickLabel: "v",
      forceTickLabel: true,
      color: "#2255aa",
    },
  ]);
  assert.equal(doc.coordPlots[0].curves.length, 2);
  const u = (id) => uv(doc, id).u;
  assert.ok(Math.abs(u("L")) < 1e-9);
  assert.ok(Math.abs(u("R") - 1) < 1e-9);
  assert.ok(Math.abs(u("T") - 1) < 1e-9);
  assert.ok(Math.abs(u("B")) < 1e-9);
  assert.ok(Math.abs(u("S") - 1) < 1e-9);
  assert.ok(Math.abs(u("N")) < 1e-9);
  assert.ok(Math.abs(u("A") + 1) < 1e-9);
  assert.ok(Math.abs(u("C") - 1) < 1e-9);
  const A = doc.points.find((p) => p.id === "A");
  assert.equal(A.color, "#2255aa");
  const lab = doc.labels.find((l) => l.pointId === "A");
  assert.equal(lab.text, "A");
  assert.equal(lab.ox, 4);
  assert.equal(lab.oy, -8);
  assert.ok(doc.segments.length >= 1);
  assert.ok(doc.labels.some((l) => l.text === "v"));
});

test("tan roots skip the asymptote", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 40,
      xmin: -1,
      xmax: 4,
      ymin: -6,
      ymax: 6,
      curves: [{ id: "t", type: "tan", params: { A: 1, B: 1, C: 0, D: 0 } }],
    },
    { op: "addCurveIntersection", curve1: "t", curve2: "xAxis", ids: ["A", "B", "C"] },
  ]);
  const us = doc.points.map((p) => p.x / 40).sort((a, b) => a - b);
  assert.equal(us.length, 2);
  assert.ok(Math.abs(us[0]) < 1e-6);
  assert.ok(Math.abs(us[1] - Math.PI) < 1e-6);
  assert.ok(us.every((u) => Math.abs(u - Math.PI / 2) > 0.2));
});

test("domain, yAxis, quad pair, and explicit area sample", () => {
  const clipped = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 10,
      xmin: -3,
      xmax: 3,
      ymin: -1,
      ymax: 6,
      curves: [
        { id: "para", type: "quad", params: { a: 1, b: 0, c: 0 }, domain: [-1, 3] },
        { id: "h", type: "line", params: { m: 0, c: 4 } },
      ],
    },
    { op: "addCurveIntersection", curve1: "para", curve2: "h", ids: ["P", "Q"], domain: [0, 3] },
  ]);
  assert.equal(clipped.points.length, 1);
  assert.ok(Math.abs(clipped.points[0].x / 10 - 2) < 1e-9);

  const alg = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 10,
      xmin: -2,
      xmax: 4,
      ymin: -2,
      ymax: 4,
      curves: [
        { id: "a", type: "quad", params: { a: 1, b: 0, c: 0 } },
        { id: "b", type: "quad", params: { a: 2, b: 0, c: -3 } },
      ],
    },
    { op: "addCurveIntersection", curve1: "a", curve2: "b", id: "P", id2: "Q" },
    { op: "addCurveIntersection", curve1: "yAxis", curve2: { type: "line", params: { m: 1, c: 1 } }, id: "R" },
  ]);
  const pu = uv(alg, "P").u;
  const qu = uv(alg, "Q").u;
  assert.ok(pu < qu);
  assert.ok(Math.abs(Math.abs(pu) - Math.sqrt(3)) < 1e-9);
  assert.ok(Math.abs(uv(alg, "R").u) < 1e-12);
  assert.ok(Math.abs(uv(alg, "R").v - 1) < 1e-12);

  const area = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 10,
      xmin: 0,
      xmax: 3,
      ymin: -1,
      ymax: 5,
      curves: [{ id: "para", type: "quad", params: { a: 1, b: 0, c: 0 } }],
    },
    {
      op: "addFill",
      kind: "betweenCurves",
      curve1: "para",
      curve2: 0,
      domain: [0, 2],
      pattern: "solid",
      opacity: 0.4,
      id: "F",
      hatchSpacing: 12,
    },
  ]);
  assert.equal(area.fills.length, 1);
  assert.equal(area.fills[0].id, "F");
  assert.equal(area.fills[0].pattern, undefined);
  assert.equal(area.fills[0].opacity, 0.4);
  assert.equal(area.fills[0].hatchSpacing, undefined);
  assert.ok(area.points.length >= 64 * 2 - 4 && area.points.length <= 96 * 2);
  assert.ok(area.points.every((p) => p.hidden === true));
  assert.equal(area.coordPlots[0].curves.length, 1);
});

test("sort breaks a 1e-4 u tie by v", () => {
  const sorted = sortIntersectionRoots([
    { u: 1, v: 5 },
    { u: 1.00005, v: -1 },
    { u: -2, v: 0 },
  ]);
  assert.deepEqual(
    sorted.map((r) => [r.u, r.v]),
    [
      [-2, 0],
      [1.00005, -1],
      [1, 5],
    ]
  );
});

test("more than two roots shade each adjacent interval", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 20,
      xmin: -1,
      xmax: 7,
      ymin: -2,
      ymax: 2,
      curves: [{ id: "s", type: "sin", params: { A: 1, B: 1, C: 0, D: 0 } }],
    },
    { op: "addAreaBetweenCurves", curve1: "s", curve2: "xAxis" },
  ]);
  assert.equal(doc.fills.length, 2);
  assert.ok(doc.fills.every((f) => f.pattern === "hatch"));
});
