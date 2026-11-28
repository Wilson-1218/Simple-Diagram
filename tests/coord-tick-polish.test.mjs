import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  applyOps,
  boxWhiskerParts,
  documentToSvg,
  validateDiagram,
} from "../src/diagram/index.mjs";
import { approxTextWidth } from "../src/diagram/length-mark.mjs";

test("APP_VERSION is 13.5.57", () => {
  assert.equal(APP_VERSION, "13.5.57");
});

function textNodes(svg) {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, ""),
  }));
}

function texts(svg) {
  return textNodes(svg).map((n) => n.text);
}

function lineCount(svg) {
  return (svg.match(/<line\b/g) || []).length;
}

function assertTextInsideViewBox(svg, needle) {
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(vb, "viewBox missing");
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const node = textNodes(svg).find((n) => n.text === needle);
  assert.ok(node, `missing text ${needle}`);
  const num = (name) => {
    const m = node.attrs.match(new RegExp(`\\b${name}="([^"]+)"`));
    assert.ok(m, name);
    return Number(m[1]);
  };
  const x = num("x");
  const y = num("y");
  const fs = num("font-size");
  const anchor = (node.attrs.match(/text-anchor="([^"]+)"/) || [])[1];
  const baseline = (node.attrs.match(/dominant-baseline="([^"]+)"/) || [])[1];
  const tw = approxTextWidth(needle, fs);
  const th = fs;
  let x0 = x - tw / 2;
  let x1 = x + tw / 2;
  if (anchor === "start") {
    x0 = x;
    x1 = x + tw;
  } else if (anchor === "end") {
    x0 = x - tw;
    x1 = x;
  }
  let y0 = y - th * 0.8;
  let y1 = y + th * 0.35;
  if (baseline === "middle") {
    y0 = y - th * 0.6;
    y1 = y + th * 0.6;
  } else if (baseline === "hanging") {
    y0 = y;
    y1 = y + th;
  }
  assert.ok(x0 >= -0.5 && x1 <= w + 0.5, `x ${x0.toFixed(1)}..${x1.toFixed(1)} vs view ${w}`);
  assert.ok(y0 >= -0.5 && y1 <= h + 0.5, `y ${y0.toFixed(1)}..${y1.toFixed(1)} vs view ${h}`);
}

test("origin O skips a default 0 tick label but keeps the mark and other ticks", () => {
  const base = {
    op: "addCoordPlot",
    id: "p",
    ox: 200,
    oy: 180,
    unitPx: 30,
    xmin: -2,
    xmax: 3,
    ymin: -1,
    ymax: 3,
    yTicks: [],
  };
  const withZero = applyOps(null, [{ ...base, xTicks: [-1, 0, { pos: 0 }, 2] }]);
  const svg = documentToSvg(withZero);
  const labels = texts(svg);
  assert.ok(labels.includes("O"));
  assert.ok(labels.includes("-1"));
  assert.ok(labels.includes("2"));
  assert.equal(labels.filter((t) => t === "0").length, 0);
  assert.equal(withZero.coordPlots[0].xTicks.length, 4);

  const noZero = applyOps(null, [{ ...base, xTicks: [-1, 2] }]);
  assert.equal(lineCount(svg), lineCount(documentToSvg(noZero)) + 2);

  const custom = applyOps(null, [
    { ...base, xTicks: [{ pos: 0, label: "a" }, 1], yTicks: [{ pos: 0, label: "0" }] },
  ]);
  const customText = texts(documentToSvg(custom));
  assert.ok(customText.includes("a"));
  assert.ok(customText.includes("O"));
  assert.equal(customText.filter((t) => t === "0").length, 0);

  const named = applyOps(null, [
    { ...base, showOrigin: false, xTicks: [0, 1], yTicks: [{ pos: 0 }] },
  ]);
  const namedText = texts(documentToSvg(named));
  assert.ok(namedText.filter((t) => t === "0").length >= 2);
  assert.equal(namedText.filter((t) => t === "O").length, 0);
});

test("projection tick text is omitted when the axis already shows that position", () => {
  const plot = {
    op: "addCoordPlot",
    id: "plot1",
    ox: 80,
    oy: 220,
    unitPx: 28,
    xmin: -2,
    xmax: 6,
    ymin: -2,
    ymax: 6,
  };
  const doc = applyOps(null, [
    plot,
    {
      op: "addPlotPoint",
      id: "P",
      u: 3,
      v: 2,
      projectX: true,
      projectY: true,
      projectStyle: "dashed",
      xTickLabel: "3",
      yTickLabel: "2",
    },
  ]);
  assert.equal(doc.segments.filter((s) => s.style === "dashed").length, 2);
  assert.equal(doc.labels.filter((l) => l.text === "3" || l.text === "2").length, 0);
  const svg = documentToSvg(doc);
  assert.match(svg, /stroke-dasharray/);
  // Default integers already print 2 and 3 on each axis. A second projection label would make three.
  assert.equal(texts(svg).filter((t) => t === "3").length, 2);
  assert.equal(texts(svg).filter((t) => t === "2").length, 2);

  const forced = applyOps(null, [
    plot,
    {
      op: "addPlotPoint",
      id: "P",
      u: 3,
      v: 2,
      projectX: true,
      xTickLabel: "3",
      forceTickLabel: true,
    },
  ]);
  assert.equal(forced.segments.filter((s) => s.style === "dashed").length, 1);
  assert.equal(forced.labels.filter((l) => l.text === "3").length, 1);

  const free = applyOps(null, [
    plot,
    { op: "addPlotPoint", id: "Q", u: 3.5, v: 1, projectX: true, xTickLabel: "3.5" },
  ]);
  assert.equal(free.labels.filter((l) => l.text === "3.5").length, 1);
  assert.equal(free.segments.filter((s) => s.style === "dashed").length, 1);

  const hidden = applyOps(null, [
    { ...plot, showTicks: false, showTickLabels: false },
    { op: "addPlotPoint", id: "P", u: 3, v: 2, projectX: true, xTickLabel: "3" },
  ]);
  assert.equal(hidden.labels.filter((l) => l.text === "3").length, 1);

  const explicit = applyOps(null, [
    { ...plot, showTickLabels: false, xTicks: [{ pos: 3, label: "three" }], yTicks: [] },
    { op: "addPlotPoint", id: "P", u: 3, v: 1, projectX: true, xTickLabel: "3" },
  ]);
  assert.equal(explicit.labels.filter((l) => l.text === "3").length, 0);
  assert.equal(explicit.segments.filter((s) => s.style === "dashed").length, 1);
});

test("curve intersection projection ticks follow the same dedup", () => {
  const curves = {
    op: "addCoordPlot",
    id: "plot1",
    ox: 40,
    oy: 160,
    unitPx: 24,
    xmin: -1,
    xmax: 5,
    ymin: -1,
    ymax: 5,
    curves: [
      { id: "ln", type: "line", params: { m: 1, c: 0 } },
      { id: "h", type: "line", params: { m: 0, c: 3 } },
    ],
  };
  const doc = applyOps(null, [
    curves,
    {
      op: "addCurveIntersection",
      curve1: "ln",
      curve2: "h",
      id: "P",
      projectX: true,
      xTickLabel: "3",
    },
  ]);
  assert.equal(doc.points.filter((p) => p.id === "P").length, 1);
  assert.equal(doc.segments.filter((s) => s.style === "dashed").length, 1);
  assert.equal(doc.labels.filter((l) => l.text === "3").length, 0);

  const forced = applyOps(null, [
    curves,
    {
      op: "addPlotIntersection",
      curve1: "ln",
      curve2: "h",
      id: "P",
      projectX: true,
      xTickLabel: "3",
      forceTickLabel: true,
    },
  ]);
  assert.equal(forced.segments.filter((s) => s.style === "dashed").length, 1);
  assert.equal(forced.labels.filter((l) => l.text === "3").length, 1);
});

function whisker(extra) {
  return {
    op: "addBoxWhisker",
    id: "bw",
    y: 200,
    min: 50,
    q1: 80,
    median: 110,
    q3: 150,
    max: 190,
    ticks: [40, 120, 200],
    boxHeight: 36,
    ...extra,
  };
}

test("box whisker axisLabel is placed and kept inside the export viewBox", () => {
  const horizontal = applyOps(null, [whisker({ axisLabel: "Age", axisY: 250 })]);
  const bw = horizontal.boxWhiskers[0];
  assert.equal(bw.axisLabel, "Age");
  assert.equal(bw.orientation, "h");
  const parts = boxWhiskerParts(bw);
  assert.equal(parts.axis.x2, 200);
  assert.equal(parts.axis.y1, 250);
  assert.equal(parts.axisLabel.text, "Age");
  assert.equal(parts.axisLabel.anchor, "start");
  assert.equal(parts.axisLabel.baseline, "middle");
  assert.equal(parts.axisLabel.x, 200 + 14);
  assert.equal(parts.axisLabel.y, 250);
  assert.equal(parts.tickMarks.length, 3);
  const svgH = documentToSvg(horizontal);
  assert.ok(texts(svgH).includes("Age"));
  assert.match(svgH, /text-anchor="start"/);
  assertTextInsideViewBox(svgH, "Age");
  assert.equal(validateDiagram(horizontal).ok, true);

  const viaX = applyOps(null, [whisker({ xLabel: "Age" })]);
  assert.equal(viaX.boxWhiskers[0].axisLabel, "Age");
  assert.equal(boxWhiskerParts(viaX.boxWhiskers[0]).axisLabel.anchor, "start");

  const blank = applyOps(null, [whisker({ axisLabel: "  " })]);
  assert.equal(blank.boxWhiskers[0].axisLabel, undefined);
  assert.equal(boxWhiskerParts(blank.boxWhiskers[0]).axisLabel, null);
  assert.equal(boxWhiskerParts(blank.boxWhiskers[0]).axis.x2, 200);

  const vertical = applyOps(null, [
    {
      op: "addBoxPlot",
      id: "bwv",
      orientation: "vertical",
      x: 140,
      min: 30,
      q1: 60,
      median: 90,
      q3: 130,
      max: 170,
      ticks: [30, 90, 170],
      yLabel: "Age",
      role: "solution",
    },
  ]);
  const vb = vertical.boxWhiskers[0];
  assert.equal(vb.orientation, "v");
  assert.equal(vb.axisLabel, "Age");
  const vp = boxWhiskerParts(vb);
  assert.equal(vp.axisLabel.anchor, "middle");
  assert.equal(vp.axisLabel.x, vp.axis.x1);
  assert.ok(vp.axisLabel.y < Math.min(vp.axis.y1, vp.axis.y2));
  assert.equal(vp.tickMarks.length, 3);
  const svgV = documentToSvg(vertical);
  assert.ok(texts(svgV).includes("Age"));
  assert.match(svgV, /text-anchor="middle"/);
  assertTextInsideViewBox(svgV, "Age");
  assert.equal(validateDiagram(vertical).ok, true);
});

test("role solution and existing box-whisker / coord-plot ops stay compatible", () => {
  const doc = applyOps(null, [
    whisker({ role: "solution", axisLabel: "Age" }),
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 40,
      oy: 80,
      unitPx: 16,
      xmin: -2,
      xmax: 4,
      ymin: -2,
      ymax: 4,
      xTicks: [-1, 0, 2],
      yTicks: [0, 1],
      role: "solution",
    },
    {
      op: "addPlotPoint",
      id: "P",
      u: 2,
      v: 1,
      projectX: true,
      projectY: true,
      xTickLabel: "2",
      yTickLabel: "1",
      role: "solution",
    },
  ]);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, (v.errors || []).join("; "));
  assert.equal(doc.boxWhiskers[0].min, 50);
  assert.equal(doc.boxWhiskers[0].q3, 150);
  assert.equal(doc.boxWhiskers[0].axisLabel, "Age");
  assert.equal(doc.coordPlots[0].xTicks.length, 3);
  assert.equal(doc.points.find((p) => p.id === "P").role, "solution");
  assert.equal(doc.segments.filter((s) => s.style === "dashed").length, 2);
  assert.equal(doc.labels.filter((l) => l.text === "2" || l.text === "1").length, 0);
  const svg = documentToSvg(doc);
  assert.equal(texts(svg).filter((t) => t === "0").length, 0);
  assert.ok(texts(svg).includes("O"));
  assert.ok(texts(svg).includes("-1"));
  assert.ok(texts(svg).includes("Age"));
});
