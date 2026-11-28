import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  documentToSvg,
  validateDiagram,
  APP_VERSION,
  OP_NAMES,
  coordSampleOneCurve,
  coordWorldFromAxis,
  coordIntegerTicks,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for coord-plot phase 6", () => {
  assert.equal(APP_VERSION, "13.5.60");
  assert.ok(OP_NAMES.includes("addPlotPoint"));
});

test("xTicks [-4] replaces default integers and still draws when labels are off", () => {
  const base = {
    op: "addCoordPlot",
    id: "p",
    ox: 0,
    oy: 0,
    unitPx: 40,
    xmin: -4,
    xmax: 4,
    ymin: -1,
    ymax: 1,
    xTicks: [-4],
    yTicks: [],
  };
  const on = applyOps(null, [{ ...base, showTickLabels: true }]);
  const svgOn = documentToSvg(on);
  assert.match(svgOn, />-4</);
  assert.doesNotMatch(svgOn, />-3</);
  assert.doesNotMatch(svgOn, />-2</);
  assert.doesNotMatch(svgOn, />-1</);
  assert.doesNotMatch(svgOn, />1</);
  assert.doesNotMatch(svgOn, />2</);
  assert.doesNotMatch(svgOn, />3</);
  assert.doesNotMatch(svgOn, />4</);

  const off = applyOps(null, [{ ...base, showTickLabels: false }]);
  const svgOff = documentToSvg(off);
  assert.match(svgOff, />-4</);
  assert.doesNotMatch(svgOff, />-3</);
  assert.doesNotMatch(svgOff, />1</);
  assert.equal(off.coordPlots[0].showTickLabels, false);
});

test("yTicks object label k replaces default y integers", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 100,
      oy: 200,
      unitPx: 30,
      xmin: -1,
      xmax: 1,
      ymin: -1,
      ymax: 4,
      xTicks: [],
      yTicks: [{ pos: 2, label: "k" }],
    },
  ]);
  const svg = documentToSvg(doc);
  assert.match(svg, />k</);
  assert.doesNotMatch(svg, />1</);
  assert.doesNotMatch(svg, />2</);
  assert.doesNotMatch(svg, />3</);
  assert.doesNotMatch(svg, />4</);
  assert.equal(doc.coordPlots[0].yTicks[0].label, "k");
});

test("xStep 2 skips odd integers", () => {
  assert.deepEqual(coordIntegerTicks(-4, 4, 2), [-4, -2, 2, 4]);
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 0,
      oy: 0,
      unitPx: 20,
      xmin: -4,
      xmax: 4,
      ymin: -0.5,
      ymax: 0.5,
      xStep: 2,
    },
  ]);
  const svg = documentToSvg(doc);
  assert.match(svg, />-4</);
  assert.match(svg, />-2</);
  assert.match(svg, />2</);
  assert.match(svg, />4</);
  assert.doesNotMatch(svg, />-3</);
  assert.doesNotMatch(svg, />-1</);
  assert.doesNotMatch(svg, />1</);
  assert.doesNotMatch(svg, />3</);
});

test("addPlotPoint and addPoint land on the plot scale, including unequal units", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 100,
      oy: 200,
      unitPx: 40,
      xmin: -2,
      xmax: 6,
      ymin: -2,
      ymax: 6,
    },
    { op: "addPlotPoint", id: "P", plotId: "plot1", u: 1, v: 3 },
    { op: "addPoint", id: "Q", mathX: 2, mathY: 1 },
  ]);
  const P = doc.points.find((p) => p.id === "P");
  const Q = doc.points.find((p) => p.id === "Q");
  assert.equal(P.x, 100 + 1 * 40);
  assert.equal(P.y, 200 - 3 * 40);
  assert.equal(Q.x, 100 + 2 * 40);
  assert.equal(Q.y, 200 - 1 * 40);
  assert.deepEqual(coordWorldFromAxis(doc.coordPlots[0], 1, 3), { x: P.x, y: P.y });

  const uneven = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 100,
      oy: 200,
      unitPx: 40,
      xUnitPx: 10,
      yUnitPx: 20,
    },
    { op: "addPlotPoint", id: "R", u: 1, v: 3 },
  ]);
  const R = uneven.points.find((p) => p.id === "R");
  assert.equal(R.x, 100 + 1 * 10);
  assert.equal(R.y, 200 - 3 * 20);
});

test("projectX/projectY persist axis segments and tick labels", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 100,
      oy: 200,
      unitPx: 40,
      xTicks: [],
      yTicks: [],
    },
    {
      op: "addPlotPoint",
      id: "P",
      plotId: "plot1",
      u: 1,
      v: 3,
      label: "P(1, 3)",
      ox: 18,
      oy: -10,
      projectX: true,
      projectY: true,
      projectStyle: "dashed",
      xTickLabel: "1",
      yTickLabel: "3",
    },
  ]);
  const P = doc.points.find((p) => p.id === "P");
  assert.equal(P.x, 140);
  assert.equal(P.y, 80);
  const lab = doc.labels.find((l) => l.pointId === "P");
  assert.equal(lab.text, "P(1, 3)");
  assert.equal(lab.ox, 18);
  assert.equal(lab.oy, -10);

  const dashed = doc.segments.filter((s) => s.style === "dashed");
  assert.equal(dashed.length, 2);
  const ends = dashed.map((s) => [s.a, s.b].sort().join("|"));
  const footX = doc.points.find((p) => p.x === 140 && p.y === 200 && p.id !== "P");
  const footY = doc.points.find((p) => p.x === 100 && p.y === 80 && p.id !== "P");
  assert.ok(footX && footX.hidden === true);
  assert.ok(footY && footY.hidden === true);
  assert.ok(ends.some((e) => e.includes("P") && e.includes(footX.id)));
  assert.ok(ends.some((e) => e.includes("P") && e.includes(footY.id)));
  assert.equal(doc.labels.find((l) => l.pointId === footX.id).text, "1");
  assert.equal(doc.labels.find((l) => l.pointId === footY.id).text, "3");
  assert.ok(doc.labels.find((l) => l.pointId === footX.id).oy > 0);
  assert.ok(doc.labels.find((l) => l.pointId === footY.id).ox < 0);

  const svg = documentToSvg(doc);
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, />1</);
  assert.match(svg, />3</);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, (v.errors || []).join("; "));
});

test("missing plot warns and skips addPlotPoint", () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args.join(" "));
  try {
    const doc = applyOps(null, [{ op: "addPlotPoint", id: "P", u: 1, v: 2 }]);
    assert.equal(doc.points.length, 0);
    assert.ok(warns.some((w) => /skipped/.test(w)));
  } finally {
    console.warn = orig;
  }
});

test("curve domain clips samples and dashed style is exported", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 0,
      oy: 0,
      unitPx: 10,
      xmin: -4,
      xmax: 6,
      ymin: -4,
      ymax: 6,
      curves: [
        {
          id: "c1",
          type: "line",
          params: { m: 1, c: 0 },
          domain: [0, 2],
          style: "dashed",
        },
      ],
    },
  ]);
  const curve = doc.coordPlots[0].curves[0];
  assert.deepEqual(curve.domain, [0, 2]);
  assert.equal(curve.style, "dashed");
  const pts = coordSampleOneCurve(doc.coordPlots[0], curve).filter(Boolean);
  assert.ok(pts.length > 5);
  for (const p of pts) {
    assert.ok(p.x >= -1e-6 && p.x <= 20 + 1e-6, `x ${p.x}`);
    assert.ok(Math.abs(p.y - -p.x) < 1e-6);
  }
  const svg = documentToSvg(doc);
  assert.match(svg, /<path d="M/);
  assert.match(svg, /stroke-dasharray/);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, (v.errors || []).join("; "));
});

test("mathPoints polygon uses converted world vertices", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 100,
      oy: 300,
      unitPx: 10,
      xUnitPx: 10,
      yUnitPx: 10,
    },
    {
      op: "addFill",
      id: "reg",
      kind: "polygon",
      plotId: "plot1",
      mathPoints: [
        [0, 0],
        [0, 3],
        [2, 6],
        [5, 0],
      ],
      pattern: "hatch",
    },
  ]);
  assert.equal(doc.fills.length, 1);
  assert.equal(doc.fills[0].kind, "polygon");
  assert.equal(doc.fills[0].pattern, "hatch");
  const verts = doc.fills[0].pointIds.map((id) => doc.points.find((p) => p.id === id));
  assert.deepEqual(
    verts.map((p) => [p.x, p.y]),
    [
      [100, 300],
      [100, 270],
      [120, 240],
      [150, 300],
    ]
  );
  const svg = documentToSvg(doc);
  assert.match(svg, /clipPath/);
});

test("math text sub/sup in SVG; plain P is not restyled", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 40, y: 40 },
    { op: "addPoint", id: "B", x: 80, y: 40 },
    { op: "addPoint", id: "C", x: 120, y: 40 },
    { op: "addLabel", pointId: "A", text: "log_5 x" },
    { op: "addLabel", pointId: "B", text: "L_1" },
    { op: "addText", id: "t", x: 160, y: 40, text: "x^2" },
  ]);
  const svg = documentToSvg(doc);
  assert.match(svg, /baseline-shift="sub"/);
  assert.match(svg, /font-size="72%"/);
  assert.match(svg, /baseline-shift="super"/);
  assert.match(svg, /font-style="normal"[^>]*>log</);
  assert.match(svg, /<tspan[^>]*font-style="italic"[^>]*>L<\/tspan>/);
  assert.match(svg, /<tspan[^>]*baseline-shift="sub"[^>]*>1<\/tspan>/);
  assert.match(svg, /<tspan[^>]*font-style="italic"[^>]*>x<\/tspan>/);
  assert.match(svg, /<tspan[^>]*baseline-shift="super"[^>]*>2<\/tspan>/);

  const plain = applyOps(null, [
    { op: "addPoint", id: "A", x: 10, y: 10 },
    { op: "addLabel", pointId: "A", text: "P" },
  ]);
  const svgP = documentToSvg(plain);
  assert.match(svgP, /font-style="italic"[^>]*>P</);
  assert.doesNotMatch(svgP, /baseline-shift/);
  assert.doesNotMatch(svgP, /<tspan/);
});
