import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  arcDraw,
  boxWhiskerParts,
  documentToSvg,
  readableInkScale,
  resolveInkBudget,
  statChartParts,
  svgStatChart,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.58", () => {
  assert.equal(APP_VERSION, "13.5.58");
});

function chartSvg(op, scale = 2) {
  const doc = applyOps(null, [op]);
  const raw = doc.barCharts[0];
  const svg = svgStatChart(raw, (x, y) => ({ x, y }), { stroke: 2, scale });
  return { doc, raw, parts: statChartParts(raw), svg };
}

test("chart text, dots, and ellipsis follow export scale; grid is 0.42 of the axis", () => {
  const ogive = chartSvg({
    op: "addCumulativeFrequency",
    x: 40,
    y: 220,
    boundaries: [0, 10, 20, 30],
    values: [0, 8, 14, 20],
    yStep: 10,
    showGrid: true,
  });
  assert.match(ogive.svg, /font-size="24\.0"/);
  const widths = [...ogive.svg.matchAll(/stroke-width="([0-9.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(widths.includes(2));
  assert.ok(widths.some((w) => Math.abs(w - 0.84) < 1e-6), widths.join(","));
  const grid = ogive.parts.lines.find((l) => l.grid);
  assert.equal(grid.dash, true);

  const dots = chartSvg({
    op: "addDotPattern",
    x: 10,
    y: 40,
    patterns: [[[0, 0]], [[0, 0], [1, 0]]],
  });
  assert.equal(dots.raw.dotRadius, 4.5);
  const content = dots.parts.dots.filter((d) => !d.ellipsis);
  const ellipsis = dots.parts.dots.filter((d) => d.ellipsis);
  assert.ok(content.every((d) => d.r === 4.5));
  assert.equal(ellipsis.length, 3);
  assert.ok(content.every((d) => dots.svg.includes(`r="${(d.r * 2).toFixed(2)}"`)));
  assert.ok(ellipsis.every((d) => dots.svg.includes(`r="${(1.6 * 2).toFixed(2)}"`)));

  const pinned = chartSvg({
    op: "addDotPattern",
    x: 0,
    y: 0,
    dotRadius: 3.5,
    patterns: [[[0, 0]]],
  });
  assert.equal(pinned.raw.dotRadius, 3.5);
});

test("ogive projection on a tick does not stack a second number", () => {
  const hit = chartSvg({
    op: "addOgive",
    x: 30,
    y: 200,
    boundaries: [0, 10, 20],
    values: [0, 10, 20],
    yStep: 10,
    projections: [{ y: 10, yLabel: "10", xLabel: "m", role: "solution" }],
  });
  const tens = hit.parts.texts.filter((t) => t.text === "10" && t.anchor === "end");
  assert.equal(tens.length, 1);
  assert.equal(tens[0].color, "#dc2626");
  assert.equal(tens[0].role, "solution");
  assert.ok(hit.parts.texts.some((t) => t.text === "m" && t.role === "solution"));

  const plain = chartSvg({
    op: "addOgive",
    x: 30,
    y: 200,
    boundaries: [0, 10, 20],
    values: [0, 10, 20],
    yStep: 10,
    projections: [{ y: 10, yLabel: "10", xLabel: "Q1" }],
  });
  const plainTens = plain.parts.texts.filter((t) => t.text === "10" && t.anchor === "end");
  assert.equal(plainTens.length, 1);
  assert.notEqual(plainTens[0].color, "#dc2626");

  const off = chartSvg({
    op: "addOgive",
    x: 30,
    y: 200,
    boundaries: [0, 10, 20],
    values: [0, 10, 20],
    yStep: 10,
    projections: [{ y: 7, yLabel: "7", role: "solution" }],
  });
  assert.equal(off.parts.texts.filter((t) => t.text === "7").length, 1);
  assert.equal(off.parts.texts.find((t) => t.text === "7").color, "#dc2626");
});

test("dot arrows and ellipsis share one mid-line; trailing arrow stops before the ellipsis", () => {
  const { parts } = chartSvg({
    op: "addDotPattern",
    x: 0,
    y: 80,
    patterns: [[[0, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0]], []],
  });
  const content = parts.dots.filter((d) => !d.ellipsis);
  const ellipsis = parts.dots.filter((d) => d.ellipsis);
  assert.equal(content.length, 1 + 3 + 2);
  assert.equal(ellipsis.length, 3);
  const horizontals = parts.lines.filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 10);
  assert.equal(horizontals.length, 3);
  const midY = horizontals[0].y1;
  assert.ok(horizontals.every((l) => l.y1 === midY));
  assert.ok(ellipsis.every((d) => d.y === midY));
  const ys = content.map((d) => d.y);
  const tallMid = (Math.min(...ys) + Math.max(...ys)) / 2;
  assert.ok(Math.abs(midY - tallMid) < 1e-6);
  const tip = Math.max(...horizontals.map((l) => Math.max(l.x1, l.x2)));
  const ellipsisLeft = Math.min(...ellipsis.map((d) => d.x));
  assert.ok(tip < ellipsisLeft);

  const stopped = chartSvg({
    op: "addDotPattern",
    x: 0,
    y: 80,
    trailingArrow: false,
    patterns: [[[0, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0]], []],
  });
  const stoppedShafts = stopped.parts.lines.filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 10);
  assert.equal(stoppedShafts.length, 2);
  assert.equal(stopped.parts.dots.filter((d) => d.ellipsis).length, 3);
});

test("ellipse style strokes the whole ring; solid backDashed stays split", () => {
  const dashed = applyOps(null, [
    { op: "addPoint", id: "C", x: 0, y: 0 },
    { op: "addPoint", id: "RX", x: 40, y: 0 },
    { op: "addPoint", id: "RY", x: 0, y: 18 },
    { op: "addEllipse", centerId: "C", rxId: "RX", ryId: "RY", style: "dashed" },
  ]);
  assert.equal(dashed.ellipses[0].style, "dashed");
  const svg = documentToSvg(dashed);
  const paths = svg.match(/<path /g) || [];
  const dashedPaths = svg.match(/<path [^>]*stroke-dasharray=/g) || [];
  assert.equal(paths.length, 2);
  assert.equal(dashedPaths.length, 2);

  const dotted = applyOps(null, [
    { op: "addPoint", id: "C", x: 0, y: 0 },
    { op: "addPoint", id: "RX", x: 30, y: 0 },
    { op: "addPoint", id: "RY", x: 0, y: 12 },
    { op: "addEllipse", centerId: "C", rxId: "RX", ryId: "RY", style: "dotted", backDashed: true },
  ]);
  const dotSvg = documentToSvg(dotted);
  const dotPaths = dotSvg.match(/<path /g) || [];
  const dotDashed = dotSvg.match(/<path [^>]*stroke-dasharray=/g) || [];
  assert.equal(dotPaths.length, 2);
  assert.equal(dotDashed.length, 2);

  const hemi = applyOps(null, [{ op: "addShape", kind: "hemisphere", x: 80, y: 80, w: 36 }]);
  const hemiSvg = documentToSvg(hemi);
  const hemiPaths = hemiSvg.match(/<path /g) || [];
  const hemiDash = hemiSvg.match(/<path [^>]*stroke-dasharray=/g) || [];
  assert.ok(hemi.ellipses.some((e) => e.backDashed === true));
  assert.ok(hemiPaths.length >= 2);
  assert.ok(hemiDash.length >= 1);
  assert.ok(hemiPaths.length > hemiDash.length);
});

test("pie category and angle text split, and angleLabel aliases angleText", () => {
  const doc = applyOps(null, [
    {
      op: "addPieChart",
      x: 100,
      y: 100,
      r: 80,
      slices: [
        { angle: 30, label: "Food", angleText: "30°" },
        { angle: 160, label: "Clothing", angleLabel: "160°" },
        { angle: 50, label: "Pinned", angleLabel: "50°", labelRadiusRatio: 0.5 },
        { angle: 120, label: "Only" },
      ],
    },
  ]);
  const clothing = doc.texts.find((t) => t.text === "Clothing");
  const food = doc.texts.find((t) => t.text === "Food");
  const pinned = doc.texts.find((t) => t.text === "Pinned");
  const only = doc.texts.find((t) => t.text === "Only");
  assert.ok(Math.abs(Math.hypot(clothing.x - 100, clothing.y - 100) - 0.68 * 80) < 1e-6);
  assert.equal(clothing.align, "center");
  assert.ok(Math.abs(Math.hypot(food.x - 100, food.y - 100) - 1.16 * 80) < 1e-6);
  assert.equal(food.align, "left");
  assert.ok(Math.abs(Math.hypot(pinned.x - 100, pinned.y - 100) - 0.5 * 80) < 1e-6);
  assert.ok(Math.abs(Math.hypot(only.x - 100, only.y - 100) - 0.62 * 80) < 1e-6);

  const arc160 = doc.angleArcs.find((a) => a.text === "160°");
  const arc30 = doc.angleArcs.find((a) => a.text === "30°");
  const arc50 = doc.angleArcs.find((a) => a.text === "50°");
  assert.ok(arc160 && arc30 && arc50);
  const g160 = arcDraw(arc160, { x: 100, y: 100 }, doc.points.find((p) => p.id === arc160.arm1), doc.points.find((p) => p.id === arc160.arm2));
  assert.ok(Math.abs(g160.textR - 0.36 * 80) < 1e-6);
  const g50 = arcDraw(arc50, { x: 100, y: 100 }, doc.points.find((p) => p.id === arc50.arm1), doc.points.find((p) => p.id === arc50.arm2));
  assert.ok(Math.abs(g50.textR - (g50.effectiveR + 11)) < 1e-6);

  const left = applyOps(null, [
    {
      op: "addPieChart",
      x: 0,
      y: 0,
      r: 50,
      startDeg: 180,
      slices: [
        { angle: 20, label: "Left", angleLabel: "20°" },
        { angle: 340, label: "Rest" },
      ],
    },
  ]);
  assert.equal(left.texts.find((t) => t.text === "Left").align, "right");
  const svg = documentToSvg(left);
  assert.match(svg, /text-anchor="end"[^>]*>Left/);

  const both = applyOps(null, [
    {
      op: "addPieChart",
      x: 0,
      y: 0,
      r: 40,
      slices: [
        { angle: 90, angleText: "kept", angleLabel: "ignored" },
        { angle: 270 },
      ],
    },
  ]);
  assert.ok(both.angleArcs.some((a) => a.text === "kept"));
  assert.equal(both.angleArcs.some((a) => a.text === "ignored"), false);
});

test("box-whisker guides stay under the box, caps default to 0.55·boxH, viewBox keeps the number line", () => {
  const doc = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw",
      y: 40,
      min: 20,
      q1: 35,
      median: 40,
      q3: 55,
      max: 70,
      ticks: [20, 40, 70],
      axisMin: 0,
      axisMax: 100,
      axisLabel: "分數",
      boxHeight: 20,
    },
  ]);
  const bw = doc.boxWhiskers[0];
  assert.ok(Math.abs(bw.cap - (0.55 * 20) / 2) < 1e-9);
  const parts = boxWhiskerParts(bw);
  assert.equal(parts.axis.x1, 0);
  assert.equal(parts.axis.x2, 100);
  assert.equal(parts.arrows.length, 4);
  const boxTop = parts.box.y;
  const boxBottom = parts.box.y + parts.box.h;
  assert.ok(parts.guides.length >= 5);
  for (const g of parts.guides) {
    assert.ok(Math.min(g.y1, g.y2) >= boxTop - 1e-6);
    assert.ok(g.y1 >= boxBottom - 1e-6 || Math.abs(g.x1 - bw.min) < 1e-6 || Math.abs(g.x1 - bw.max) < 1e-6);
    assert.ok(g.y2 > g.y1);
  }
  const caps = parts.caps;
  assert.ok(caps.every((c) => Math.abs(Math.abs(c.y2 - c.y1) - 0.55 * 20) < 1e-6));

  const explicit = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "old",
      y: 10,
      min: 1,
      q1: 2,
      median: 3,
      q3: 4,
      max: 5,
      ticks: [1, 5],
      cap: 7,
      boxHeight: 20,
    },
  ]);
  assert.equal(explicit.boxWhiskers[0].cap, 7);
  const full = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "full",
      y: 10,
      min: 1,
      q1: 2,
      median: 3,
      q3: 4,
      max: 5,
      cap: 7,
      capHeight: 11,
      boxHeight: 20,
    },
  ]);
  assert.equal(full.boxWhiskers[0].cap, 5.5);
  assert.equal(full.boxWhiskers[0].capHeight, 11);

  const svg = documentToSvg(doc, { scale: 2 });
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(vb);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const axis = [...svg.matchAll(/<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"/g)].map((m) =>
    m.slice(1).map(Number)
  );
  const span = axis.find((ln) => Math.abs(ln[3] - ln[1]) < 0.02 && ln[2] - ln[0] > 150);
  assert.ok(span, "number line missing");
  assert.ok(span[0] >= 16 && w - span[2] >= 16);
  const label = svg.match(/<text x="([0-9.]+)" y="([0-9.]+)"[^>]*>分數/);
  assert.ok(label);
  const lx = Number(label[1]);
  const ly = Number(label[2]);
  assert.ok(lx >= 16 && ly >= 16 && w - lx >= 16 && h - ly >= 16);
  assert.match(svg, /stroke-dasharray=/);
});

test("readable defaults grow only when the world span exceeds 420", () => {
  assert.equal(readableInkScale(100, 419), 1);
  assert.equal(readableInkScale(420, 10), 1);
  assert.ok(Math.abs(readableInkScale(680, 100) - 680 / 340) < 1e-12);
  assert.ok(Math.abs(readableInkScale(100, 510) - 510 / 340) < 1e-12);

  function rightAngleDoc(far, size) {
    const ops = [
      { op: "addPoint", id: "A", x: 0, y: 0 },
      { op: "addPoint", id: "B", x: far, y: 0 },
      { op: "addPoint", id: "C", x: 0, y: 40 },
      { op: "addSegment", a: "A", b: "B" },
      { op: "addSegment", a: "A", b: "C" },
      { op: "addRightAngle", vertex: "A", arm1: "B", arm2: "C" },
    ];
    if (size != null) ops[5].size = size;
    return applyOps(null, ops);
  }
  function leg(doc) {
    const svg = documentToSvg(doc, { scale: 2 });
    const poly = svg.match(/<polyline points="([0-9.]+),([0-9.]+) ([0-9.]+),([0-9.]+)/);
    assert.ok(poly, svg.slice(0, 200));
    const dx = Number(poly[3]) - Number(poly[1]);
    const dy = Number(poly[4]) - Number(poly[2]);
    return { svg, len: Math.hypot(dx, dy) };
  }
  const smallOmit = leg(rightAngleDoc(200));
  const smallPin = leg(rightAngleDoc(200, 10));
  assert.ok(Math.abs(smallOmit.len - smallPin.len) < 0.05);

  const big = rightAngleDoc(500);
  assert.equal(big.rightAngles[0].size, undefined);
  const bigPin = rightAngleDoc(500, 10);
  assert.equal(bigPin.rightAngles[0].size, 10);
  const bigOmit = leg(big);
  const bigFixed = leg(bigPin);
  assert.ok(bigOmit.len > bigFixed.len * 1.2);

  const ticks = applyOps(null, [
    { op: "addPoint", id: "Far", x: 0, y: 0 },
    { op: "addPoint", id: "Far2", x: 500, y: 480 },
    {
      op: "addBoxWhisker",
      id: "bw",
      y: 200,
      min: 10,
      q1: 20,
      median: 30,
      q3: 40,
      max: 50,
      ticks: [
        { pos: 10, label: "T10" },
        { pos: 50, label: "T50" },
      ],
      boxHeight: 16,
    },
    { op: "addText", x: 40, y: 40, text: "pinned", size: 18 },
  ]);
  const svg = documentToSvg(ticks, { scale: 2 });
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const viewW = Number(vb[1]);
  const viewH = Number(vb[2]);
  const worldW = viewW / 2;
  const worldH = viewH / 2;
  const ink = resolveInkBudget(viewW, viewH);
  const expectedTick = ink.fontForSize(14 * readableInkScale(worldW, worldH));
  const tickFs = Number(svg.match(/font-size="([0-9.]+)"[^>]*>T10</)[1]);
  assert.ok(Math.abs(tickFs - expectedTick) < 0.15, `${tickFs} vs ${expectedTick}`);
  assert.ok(readableInkScale(worldW, worldH) > 1);
  const pinnedFs = Number(svg.match(/font-size="([0-9.]+)"[^>]*>pinned/)[1]);
  assert.ok(Math.abs(pinnedFs - ink.fontForSize(18)) < 0.15);
});
