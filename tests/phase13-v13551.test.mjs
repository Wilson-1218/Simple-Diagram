import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  CURVE_AREA_STEPS,
  OP_NAMES,
  applyOps,
  curveLabelWorld,
  documentToSvg,
  emptyDiagram,
  recomputeConstructions,
  statChartParts,
  validateDiagram,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.62 and the new ops are registered", () => {
  assert.equal(APP_VERSION, "13.5.62");
  assert.equal(CURVE_AREA_STEPS, 80);
  assert.equal(OP_NAMES.length, 64);
  for (const name of ["addCumulativeFrequency", "addOgive", "addHistogram", "addDotPattern"]) {
    assert.ok(OP_NAMES.includes(name), name);
  }
  assert.equal("solutionMaxStep" in emptyDiagram().layers, false);
});

function pt(doc, id) {
  return doc.points.find((p) => p.id === id);
}

test("cube omit-field vertices stay put and circle radius is still w", () => {
  const cube = applyOps(null, [{ op: "addShape", kind: "cube", x: 100, y: 80, w: 120 }]);
  const a = cube.points.find((p) => p.id === "p_0001");
  const b = cube.points.find((p) => p.id === "p_0003");
  const c = cube.points.find((p) => p.id === "p_0005");
  assert.ok(Math.abs(a.x - 48.57142857142858) < 1e-9);
  assert.ok(Math.abs(a.y - 114.28571428571428) < 1e-9);
  assert.ok(Math.abs(b.x - 134.28571428571428) < 1e-9);
  assert.ok(Math.abs(b.y - 131.42857142857142) < 1e-9);
  assert.ok(Math.abs(c.x - 168.57142857142856) < 1e-9);
  assert.ok(Math.abs(c.y - 80) < 1e-9);
  assert.equal(cube.points.some((p) => p.role), false);

  const cir = applyOps(null, [{ op: "addShape", kind: "circle", x: 10, y: 20, w: 40 }]);
  const center = cir.points[0];
  const through = cir.points[1];
  assert.equal(center.x, 10);
  assert.equal(center.y, 20);
  assert.equal(through.x, 50);
  assert.equal(through.y, 20);
});

test("hemisphere bowl, dome, water line, and base centre", () => {
  const up = applyOps(null, [
    { op: "addShape", kind: "hemisphere", x: 200, y: 200, w: 80, includeBaseCenter: true, waterLevel: 0.5 },
  ]);
  assert.equal(validateDiagram(up).ok, true);
  const o = pt(up, "O");
  assert.ok(o);
  assert.equal(o.hidden, undefined);
  assert.equal(o.x, 200);
  assert.equal(o.y, 200);
  const sec = up.sectors[0];
  const start = pt(up, sec.startId);
  const end = pt(up, sec.endId);
  assert.ok(start.x > o.x);
  assert.ok(end.x < o.x);
  assert.equal(up.ellipses.length, 2);
  assert.equal(up.ellipses[0].backDashed, true);
  assert.equal(up.ellipses[1].backDashed, true);
  const water = pt(up, up.ellipses[1].centerId);
  assert.ok(water.y > o.y, "bowl section sits below the rim");
  assert.equal(up.points.some((p) => p.role === "solution"), false);

  const dome = applyOps(null, [
    { op: "addShape", kind: "hemisphere", x: 40, y: 40, w: 30, opening: "down", idPrefix: "K", includeBaseCenter: true },
  ]);
  assert.ok(pt(dome, "KO"));
  const dsec = dome.sectors[0];
  assert.ok(pt(dome, dsec.startId).x < pt(dome, "KO").x);
  assert.equal(dome.ellipses.length, 1);
});

test("sphere uses circle radius w and a dashed equator", () => {
  const doc = applyOps(null, [{ op: "addShape", kind: "sphere", x: 100, y: 80, w: 50 }]);
  const o = pt(doc, "O");
  assert.equal(o.x, 100);
  assert.equal(o.y, 80);
  assert.equal(o.hidden, undefined);
  const through = doc.points.find((p) => p.hidden && p.x === 150 && p.y === 80);
  assert.ok(through);
  assert.equal(doc.circles[0].centerId, "O");
  assert.equal(doc.circles[0].throughId, through.id);
  assert.equal(doc.ellipses[0].backDashed, true);
  assert.ok(doc.labels.some((l) => l.text === "O" && l.pointId === "O"));

  const solid = applyOps(null, [{ op: "addShape", kind: "sphere", x: 10, y: 10, w: 20, backDashed: false, labels: false }]);
  assert.equal(solid.ellipses[0].backDashed, false);
  assert.equal(solid.labels.length, 0);
});

test("ogive alias, histogram bars touch, and solution dots", () => {
  const ogive = applyOps(null, [
    {
      op: "addOgive",
      id: "og",
      x: 40,
      y: 200,
      boundaries: [10, 20, 30, 40, 50],
      values: [0, 4, 11, 18, 20],
      projections: [{ y: 10, xLabel: "m", role: "solution", solutionStep: 2 }],
    },
  ]);
  assert.equal(ogive.barCharts[0].kind, "ogive");
  assert.equal(ogive.barCharts[0].smooth, false);
  const parts = statChartParts(ogive.barCharts[0]);
  const proj = parts.lines.filter((l) => l.role === "solution");
  assert.ok(proj.length >= 2);
  const svg = documentToSvg(ogive);
  assert.match(svg, /#dc2626/);
  assert.match(svg, /data-role="solution"/);
  assert.match(svg, /data-step="2"/);
  assert.match(svg, /data-id="og"/);

  const hist = applyOps(null, [
    {
      op: "addHistogram",
      x: 0,
      y: 100,
      boundaries: [0, 10, 20, 30],
      values: [2, 5, 1],
      showFrequencyPolygon: true,
      barPattern: "solid",
    },
  ]);
  const bars = statChartParts(hist.barCharts[0]).rects;
  assert.equal(bars.length, 3);
  const histParts = statChartParts(hist.barCharts[0]);
  const edgeLabels = histParts.texts.filter((t) => t.text === "0" || t.text === "10" || t.text === "30");
  const left0 = edgeLabels.find((t) => t.text === "0" && t.x > -1);
  assert.ok(Math.abs(left0.x - bars[0].x) < 1e-6, "boundary 0 sits on the first bar edge");
  assert.ok(Math.abs(bars[0].x + bars[0].w - bars[1].x) < 1e-6);
  assert.ok(Math.abs(bars[1].x + bars[1].w - bars[2].x) < 1e-6);
  assert.ok(statChartParts(hist.barCharts[0]).polylines.length >= 1);
  assert.equal(validateDiagram(hist).ok, true, (validateDiagram(hist).errors || []).join("; "));

  const dots = applyOps(null, [
    {
      op: "addDotPattern",
      x: 20,
      y: 40,
      patterns: [
        [[0, 0], [1, 0, "solution"]],
        { rows: [1, 3], align: "center" },
        { kind: "triangular", count: 6, solution: [5] },
        { kind: "square", count: 4 },
        { kind: "hexagonal", count: 7 },
      ],
    },
  ]);
  const drawn = statChartParts(dots.barCharts[0]).dots.filter((d) => !d.ellipsis);
  const red = drawn.filter((d) => d.color === "#dc2626");
  assert.ok(red.length >= 2);
  const svgDots = documentToSvg(dots);
  assert.match(svgDots, /#dc2626/);
  assert.equal(validateDiagram(dots).ok, true);
});

test("solutionStep filters on doc.layers and omits empty data attributes", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0, role: "solution" },
    { op: "addPoint", id: "C", x: 40, y: 40, role: "solution", solutionStep: 1 },
    { op: "addPoint", id: "D", x: 0, y: 40, role: "solution", solutionStep: 3 },
    { op: "addSegment", a: "A", b: "B", id: "AB" },
    { op: "setLayers", solutionMaxStep: 1 },
  ]);
  assert.equal(doc.layers.solutionMaxStep, 1);
  assert.equal(doc.layers.solutionShow, true);
  const svg = documentToSvg(doc, { hidePoints: false });
  assert.match(svg, /data-id="C"/);
  assert.match(svg, /data-id="AB"/);
  assert.match(svg, /data-step="1"/);
  assert.equal(svg.includes('data-id="D"'), false);
  assert.equal(svg.includes('data-role="question"'), false);
  assert.equal(svg.includes('data-step=""'), false);
  assert.match(svg, /data-id="A"/);
  assert.equal(/data-id="A"[^>]*data-role/.test(svg), false);
  assert.match(svg, /data-id="B"[^>]*data-role="solution"/);
  const all = applyOps(null, [
    { op: "addPoint", id: "Q", x: 0, y: 0 },
    { op: "addPoint", id: "S", x: 10, y: 0, role: "solution", solutionStep: 4 },
  ]);
  assert.match(documentToSvg(all, { hidePoints: false }), /data-step="4"/);
  const mid = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 20, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", segmentId: "AB", role: "solution", solutionStep: 2 },
  ]);
  const m = mid.points.find((p) => p.construction && p.construction.kind === "midpoint");
  assert.equal(m.role, "solution");
  assert.equal(m.solutionStep, 2);
});

test("omitted curve label t stays off the axes; explicit t is unchanged", () => {
  const plot = {
    ox: 0,
    oy: 0,
    unitPx: 40,
    xUnitPx: 40,
    yUnitPx: 40,
    xmin: 0,
    xmax: 10,
    ymin: 0,
    ymax: 10,
    curves: [
      {
        id: "L",
        type: "line",
        params: { m: 1, c: 0 },
        label: { show: true, kind: "custom", customText: "y=x", n: 0.55 },
      },
    ],
  };
  const placed = curveLabelWorld(plot, plot.curves[0]);
  const clearance = Math.min(Math.abs(placed.x), Math.abs(placed.y));
  assert.ok(clearance > 40, `label too close to an axis (${clearance})`);
  const pinned = curveLabelWorld(plot, {
    ...plot.curves[0],
    label: { ...plot.curves[0].label, t: 0.55 },
  });
  assert.ok(Math.hypot(pinned.x - placed.x, pinned.y - placed.y) > 1);
});

test("auto viewBox keeps a far caption and uses at least 16px of pad", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addText", x: 400, y: -80, text: "title" },
  ]);
  const svg = documentToSvg(doc, { scale: 2 });
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const text = svg.match(/<text x="([0-9.]+)" y="([0-9.]+)"[^>]*>title/);
  assert.ok(vb && text, svg.slice(0, 240));
  const x = Number(text[1]);
  const y = Number(text[2]);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  assert.ok(x >= 16 && y >= 16 && w - x >= 16 && h - y >= 16, `${x},${y} in ${w}x${h}`);
});

test("recorded constructions follow a moved base and a pinned dependent stays", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", segmentId: "AB", id: "M" },
    { op: "addPoint", id: "P", x: 20, y: 30 },
    { op: "addFoot", pointId: "P", a: "A", b: "B", footId: "F" },
    { op: "addCircle", id: "cir", centerId: "A", throughId: "B" },
    { op: "addTangent", circleId: "cir", touchId: "B", halfLen: 15, aId: "T1", bId: "T2" },
  ]);
  const before = {
    m: { ...pt(doc, "M") },
    f: { ...pt(doc, "F") },
    t1: { ...pt(doc, "T1") },
  };
  pt(doc, "B").x = 80;
  recomputeConstructions(doc, ["B"]);
  assert.ok(Math.abs(pt(doc, "M").x - 40) < 1e-6);
  assert.ok(Math.abs(pt(doc, "M").y - 0) < 1e-6);
  assert.ok(Math.abs(pt(doc, "F").x - 20) < 1e-6);
  assert.ok(Math.hypot(pt(doc, "T1").x - before.t1.x, pt(doc, "T1").y - before.t1.y) > 1);
  const pinned = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", segmentId: "AB", id: "M" },
  ]);
  pt(pinned, "A").x = 10;
  recomputeConstructions(pinned, ["A", "M"]);
  assert.equal(pt(pinned, "M").x, 20);
  assert.ok(Math.abs(before.m.x - 20) < 1e-9);
  assert.ok(Math.abs(before.f.x - 20) < 1e-6);
});
