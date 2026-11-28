import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  OP_NAMES,
  applyOps,
  approxTextWidth,
  boxWhiskerParts,
  documentToSvg,
  readableInkScale,
  statChartParts,
  svgStatChart,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.55 and stem-leaf ops are registered", () => {
  assert.equal(APP_VERSION, "13.5.55");
  assert.equal(OP_NAMES.length, 64);
  assert.ok(OP_NAMES.includes("addStemLeaf"));
  assert.ok(OP_NAMES.includes("addStemAndLeaf"));
});

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

function circleDoc(extra) {
  return applyOps(null, [
    { op: "addPoint", id: "O", x: 100, y: 200 },
    { op: "addPoint", id: "R", x: 160, y: 200 },
    { op: "addCircle", id: "c", centerId: "O", throughId: "R" },
    ...extra,
  ]);
}

test("addPoint on a circle uses polar placement and the y-down angle", () => {
  const doc = circleDoc([
    { op: "addPoint", id: "E", circleId: "c", deg: 0, label: "E" },
    { op: "addPoint", id: "N", onCircle: "c", deg: -90, label: "N" },
    { op: "addPoint", id: "Z", circleId: "c", label: "Z" },
    { op: "addPoint", id: "A", circleId: "c", angle: Math.PI / 2 },
  ]);
  const pt = (id) => doc.points.find((p) => p.id === id);
  const e = pt("E");
  const n = pt("N");
  const z = pt("Z");
  const a = pt("A");
  assert.ok(Math.abs(e.x - 160) < 1e-9 && Math.abs(e.y - 200) < 1e-9);
  assert.ok(Math.abs(z.x - 160) < 1e-9 && Math.abs(z.y - 200) < 1e-9);
  assert.ok(Math.abs(n.x - 100) < 1e-6 && Math.abs(n.y - 140) < 1e-6);
  assert.ok(Math.abs(a.x - 100) < 1e-6 && Math.abs(a.y - 260) < 1e-6);
  for (const p of [e, n, z, a]) {
    const d = Math.hypot(p.x - 100, p.y - 200);
    assert.ok(Math.abs(d - 60) <= Math.max(1e-3, 1e-6 * 60));
  }
  const labE = doc.labels.find((l) => l.pointId === "E");
  const labN = doc.labels.find((l) => l.pointId === "N");
  assert.ok(labE.ox > 0);
  assert.ok(labN.oy < 0);

  const missing = withWarns(() =>
    applyOps(doc, [{ op: "addPoint", id: "M", circleId: "nope", deg: 20, x: 1, y: 2 }])
  );
  assert.equal(missing.doc.points.some((p) => p.id === "M"), false);
  assert.ok(missing.warns.some((w) => w.includes("circle not found")));
});

test("showDot false and marker none keep the label; hidden string labels stay", () => {
  const doc = applyOps(null, [
    { op: "setMeta", hideExportPoints: false },
    { op: "addPoint", id: "A", x: 10, y: 10, showDot: false, label: true },
    { op: "addPoint", id: "B", x: 40, y: 10, marker: "none", label: "Bee" },
    { op: "addPoint", id: "C", x: 70, y: 10, hidden: true, label: "See" },
    { op: "addPoint", id: "D", x: 100, y: 10, hidden: true, label: true },
    { op: "addPoint", id: "E", x: 130, y: 10, hidden: true },
    { op: "addPoint", id: "F", x: 160, y: 10, label: false },
    { op: "addPoint", id: "G", x: 10, y: 40 },
    { op: "addPoint", id: "H", x: 80, y: 40 },
    { op: "addSegment", a: "G", b: "H" },
    { op: "addMidpoint", id: "M", a: "G", b: "H", hidden: true, label: "Mid" },
    { op: "addRatioPoint", id: "P", a: "G", b: "H", t: 0.25, showDot: false, label: "P" },
  ]);
  const pt = (id) => doc.points.find((p) => p.id === id);
  assert.equal(pt("A").hidden, undefined);
  assert.equal(pt("A").marker, "none");
  assert.equal(doc.labels.find((l) => l.pointId === "A").text, "A");
  assert.equal(pt("B").hidden, undefined);
  assert.equal(pt("B").marker, "none");
  assert.equal(doc.labels.find((l) => l.pointId === "B").text, "Bee");
  assert.equal(pt("C").hidden, true);
  assert.equal(doc.labels.find((l) => l.pointId === "C").text, "See");
  assert.equal(pt("D").hidden, true);
  assert.equal(doc.labels.some((l) => l.pointId === "D"), false);
  assert.equal(doc.labels.some((l) => l.pointId === "E"), false);
  assert.equal(doc.labels.find((l) => l.pointId === "M").text, "Mid");
  assert.equal(pt("P").marker, "none");
  assert.equal(pt("P").hidden, undefined);
  assert.equal(doc.labels.find((l) => l.pointId === "P").text, "P");

  const svg = documentToSvg(doc, { scale: 2 });
  assert.match(svg, />See</);
  assert.match(svg, />Bee</);
  assert.equal((svg.match(/<circle /g) || []).length, 3);

  const plot = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 200,
      oy: 200,
      unitPx: 30,
      xmin: 0,
      xmax: 4,
      ymin: 0,
      ymax: 4,
    },
    {
      op: "addFill",
      kind: "polygon",
      mathPoints: [
        [0, 0],
        [0, 2],
        [2, 0],
      ],
      label: "region-should-not-label-vertices",
    },
    {
      op: "addFeasibleRegion",
      inequalities: ["x >= 0", "y >= 0", "x + y <= 3"],
      label: "R",
    },
  ]);
  const auto = plot.points.filter((p) => p.hidden === true);
  assert.ok(auto.length >= 3);
  assert.equal(
    plot.labels.some((l) => auto.some((p) => p.id === l.pointId)),
    false
  );
});

function whisker(extra) {
  return applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw",
      y: 40,
      min: 10,
      q1: 20,
      median: 30,
      q3: 40,
      max: 50,
      boxHeight: 20,
      ticks: [10, 50],
      axisMin: 0,
      axisMax: 60,
      ...extra,
    },
  ]).boxWhiskers[0];
}

test("box whisker caps, arrows, and guides follow DSE fields", () => {
  const plain = whisker({});
  assert.ok(Math.abs(plain.cap - (0.55 * 20) / 2) < 1e-9);
  const plainParts = boxWhiskerParts(plain);
  assert.equal(plainParts.caps.length, 2);
  assert.equal(plainParts.arrows.length, 4);
  assert.ok(plainParts.guides.length >= 5);
  assert.ok(plainParts.guides.every((g) => (g.guideStyle || "dashed") === "dashed" && g.y2 > g.y1));

  const zero = whisker({ capHeight: 0, cap: 9 });
  assert.equal(zero.cap, 0);
  assert.equal(zero.capHeight, 0);
  assert.equal(boxWhiskerParts(zero).caps.length, 0);
  assert.notEqual(zero.cap, (0.55 * 20) / 2);

  const hiddenCaps = whisker({ showCaps: false, capHeight: 22 });
  assert.equal(hiddenCaps.cap, 0);
  assert.equal(hiddenCaps.capHeight, 22);
  assert.equal(boxWhiskerParts(hiddenCaps).caps.length, 0);

  const right = boxWhiskerParts(whisker({ axisArrows: "right" }));
  assert.equal(right.arrows.length, 2);
  assert.ok(right.arrows.every((a) => Math.max(a.x1, a.x2) >= 60 - 1e-6));
  assert.equal(boxWhiskerParts(whisker({ axisArrows: "none" })).arrows.length, 0);

  const none = boxWhiskerParts(whisker({ guideStyle: "none" }));
  assert.equal(none.guides.length, 0);
  const dotted = boxWhiskerParts(whisker({ guideStyle: "dotted" }));
  assert.ok(dotted.guides.every((g) => g.guideStyle === "dotted" && g.y2 > g.y1));
  const solid = boxWhiskerParts(whisker({ guideStyle: "solid" }));
  assert.ok(solid.guides.every((g) => g.guideStyle === "solid"));
  const dashedSvg = documentToSvg(
    applyOps(null, [
      { op: "addBoxWhisker", id: "bw", y: 40, min: 10, q1: 20, median: 30, q3: 40, max: 50, ticks: [10, 50] },
    ])
  );
  const solidSvg = documentToSvg(
    applyOps(null, [
      {
        op: "addBoxWhisker",
        id: "bw",
        y: 40,
        min: 10,
        q1: 20,
        median: 30,
        q3: 40,
        max: 50,
        ticks: [10, 50],
        guideStyle: "solid",
      },
    ])
  );
  const dashes = (svg) => (svg.match(/stroke-dasharray=/g) || []).length;
  assert.ok(dashes(dashedSvg) > dashes(solidSvg));
});

test("dot pattern alignment, block arrows, and dot ink", () => {
  const base = {
    op: "addDotPattern",
    x: 0,
    y: 80,
    patterns: [[[0, 0]], [[0, 0], [0, 1], [0, 2]]],
  };
  const current = statChartParts(applyOps(null, [base]).barCharts[0]);
  const centered = statChartParts(applyOps(null, [{ ...base, verticalAlign: "center" }]).barCharts[0]);
  const contentY = (parts) => parts.dots.filter((d) => !d.ellipsis).map((d) => d.y);
  assert.deepEqual(contentY(centered), contentY(current));
  const short = current.dots.filter((d) => !d.ellipsis)[0];
  assert.ok(Math.abs(short.y - 80) < 1e-9);

  const bottom = statChartParts(applyOps(null, [{ ...base, verticalAlign: "bottom" }]).barCharts[0]);
  const bottomDots = bottom.dots.filter((d) => !d.ellipsis);
  const tallBottom = Math.max(...bottomDots.map((d) => d.y));
  const shortBottom = bottomDots[0].y;
  assert.ok(Math.abs(shortBottom - tallBottom) < 1e-9);
  const shafts = (parts) => parts.lines.filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 10);
  const midY = shafts(current)[0].y1;
  const baseY = tallBottom;
  const arrowY = baseY - 0.25 * 16;
  assert.ok(shafts(bottom).every((l) => Math.abs(l.y1 - arrowY) < 1e-6));
  assert.ok(Math.abs(midY - arrowY) > 1);
  const middle = statChartParts(
    applyOps(null, [{ ...base, verticalAlign: "bottom", arrowAlign: "middle" }]).barCharts[0]
  );
  assert.ok(shafts(middle).every((l) => Math.abs(l.y1 - midY) < 1e-6));

  const block = statChartParts(
    applyOps(null, [{ ...base, arrowStyle: "block", patterns: [[[0, 0]], [[0, 0]], []] }]).barCharts[0]
  );
  assert.equal(block.polygons.length, 2);
  assert.equal(block.polygons[0].points.length, 7);
  assert.equal(block.polygons[0].fill, "none");
  assert.equal(block.lines.filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 8).length, 0);

  const ink = applyOps(null, [{ ...base, dotFill: "#bdbdbd", dotStroke: "#111111" }]);
  const parts = statChartParts(ink.barCharts[0]);
  const content = parts.dots.filter((d) => !d.ellipsis);
  assert.ok(content.every((d) => d.fill === "#bdbdbd" && d.stroke === "#111111"));
  const svg = svgStatChart(ink.barCharts[0], (x, y) => ({ x, y }), { stroke: 2, scale: 2 });
  assert.match(svg, /fill="#bdbdbd"/);
  assert.match(svg, /stroke="#111111"/);
});

test("addStemLeaf draws a stem-and-leaf table inside the viewBox", () => {
  const doc = applyOps(null, [
    {
      op: "addStemAndLeaf",
      id: "sl",
      x: 40,
      y: 30,
      rows: [
        { stem: 1, leaves: "2 4" },
        { stem: 2, leaves: [0, 8] },
        { stem: 3, leaves: "" },
      ],
    },
  ]);
  const chart = doc.barCharts[0];
  assert.equal(chart.kind, "stemLeaf");
  assert.equal(chart.stemHeader, "Stem (tens)");
  assert.equal(chart.leafHeader, "Leaf (units)");
  assert.equal(chart.rowGap, 32);
  assert.equal(chart.leafGap, 26);
  assert.equal(chart.fontSize, 14);
  assert.equal(chart.rows[2].leaves.length, 0);
  const parts = statChartParts(chart);
  const stems = parts.texts.filter((t) => t.anchor === "end" && t.baseline === "middle");
  assert.equal(stems.length, 3);
  assert.ok(stems.every((t) => t.x === stems[0].x));
  const leaves = parts.texts.filter((t) => t.baseline === "middle" && t.anchor === "middle");
  assert.equal(leaves.length, 4);
  const row1 = leaves.filter((t) => Math.abs(t.y - stems[0].y) < 1e-6);
  const row2 = leaves.filter((t) => Math.abs(t.y - stems[1].y) < 1e-6);
  assert.equal(row1.length, 2);
  assert.equal(row2.length, 2);
  assert.ok(Math.abs(row1[0].x - row2[0].x) < 1e-6);
  assert.ok(Math.abs(row1[1].x - row1[0].x - 26) < 1e-6);
  const divider = parts.lines.find((l) => Math.abs(l.x1 - l.x2) < 1e-6);
  assert.ok(divider);
  assert.ok(divider.y1 <= 30 + 1e-6);
  assert.ok(divider.y2 > stems[2].y);
  assert.ok(stems[0].x < divider.x1);
  const stemLine = parts.lines.find((l) => Math.abs(l.y1 - l.y2) < 1e-6 && l.x2 < divider.x1);
  assert.ok(stemLine);
  assert.ok(Math.abs(stemLine.x2 - stemLine.x1 - approxTextWidth("Stem (tens)", 14)) < 1e-6);
  const svg = documentToSvg(doc, { scale: 2 });
  assert.match(svg, />Stem \(tens\)</);
  assert.match(svg, />Leaf \(units\)</);
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const texts = [...svg.matchAll(/<text x="([0-9.]+)" y="([0-9.]+)"/g)];
  assert.ok(texts.length >= 5);
  for (const m of texts) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    assert.ok(x >= 16 && y >= 16 && w - x >= 16 && h - y >= 16);
  }
  const lines = [...svg.matchAll(/<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"/g)];
  assert.ok(lines.length >= 3);
  for (const m of lines) {
    const x1 = Number(m[1]);
    const y1 = Number(m[2]);
    const x2 = Number(m[3]);
    const y2 = Number(m[4]);
    assert.ok(x1 >= 16 && x2 >= 16 && w - x1 >= 16 && w - x2 >= 16);
    assert.ok(y1 >= 16 && y2 >= 16 && h - y1 >= 16 && h - y2 >= 16);
  }
});

test("autoScaleText false keeps default font 14 and right-angle size 10", () => {
  function doc(auto, size) {
    const angle = { op: "addRightAngle", vertex: "A", arm1: "B", arm2: "C" };
    if (size != null) angle.size = size;
    const ops = [
      { op: "addPoint", id: "A", x: 0, y: 0 },
      { op: "addPoint", id: "B", x: 500, y: 0 },
      { op: "addPoint", id: "C", x: 0, y: 40 },
      { op: "addSegment", a: "A", b: "B" },
      { op: "addSegment", a: "A", b: "C" },
      angle,
      {
        op: "addBoxWhisker",
        y: 80,
        min: 10,
        q1: 20,
        median: 30,
        q3: 40,
        max: 50,
        ticks: [{ pos: 20, label: "20" }],
        axisMin: 0,
        axisMax: 80,
      },
    ];
    if (auto === false) ops.unshift({ op: "setMeta", autoScaleText: false });
    return applyOps(null, ops);
  }
  function leg(svg) {
    const poly = svg.match(/<polyline points="([0-9.]+),([0-9.]+) ([0-9.]+),([0-9.]+)/);
    const dx = Number(poly[3]) - Number(poly[1]);
    const dy = Number(poly[4]) - Number(poly[2]);
    return Math.hypot(dx, dy);
  }
  const scaled = documentToSvg(doc(undefined), { scale: 2 });
  const frozen = documentToSvg(doc(false), { scale: 2 });
  const pinned = documentToSvg(doc(false, 10), { scale: 2 });
  assert.ok(readableInkScale(500, 40) > 1);
  assert.ok(leg(scaled) > leg(frozen) * 1.2);
  assert.ok(Math.abs(leg(frozen) - leg(pinned)) < 0.05);
  const sizeOf = (svg) => {
    const m = svg.match(/font-size="([0-9.]+)"[^>]*>20</);
    assert.ok(m, svg.slice(0, 400));
    return Number(m[1]);
  };
  assert.ok(sizeOf(scaled) > sizeOf(frozen) * 1.2);
});
