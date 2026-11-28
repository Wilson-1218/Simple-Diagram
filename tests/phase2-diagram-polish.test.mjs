import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
  normalizeBoxWhisker,
  boxWhiskerParts,
  barChartParts,
  normalizeBarChart,
  coordAxisOverhangPx,
  svgCoordPlot,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for phase2 polish", () => {
  assert.equal(APP_VERSION, "13.5.55");
});

test("addLabel SVG uses paint-order white halo", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 40, y: 40 },
    { op: "addLabel", pointId: "A", text: "A", ox: -10, oy: -12 },
  ]);
  const svg = documentToSvg(doc, { scale: 2, hidePoints: true });
  assert.match(svg, /paint-order="stroke fill"/);
  assert.match(svg, /stroke="#ffffff"/);
  assert.match(svg, />A</);
});

test("boxWhisker ticks accept {pos,label} and bare numbers", () => {
  const bw = normalizeBoxWhisker({
    id: "bw",
    y: 200,
    min: 50,
    q1: 80,
    median: 110,
    q3: 150,
    max: 190,
    ticks: [40, { pos: 150, label: "10" }, { x: 200, label: "20" }],
  });
  assert.equal(bw.ticks.length, 3);
  assert.equal(bw.ticks[0], 40);
  assert.deepEqual(bw.ticks[1], { pos: 150, label: "10" });
  assert.deepEqual(bw.ticks[2], { pos: 200, label: "20" });

  const parts = boxWhiskerParts(bw);
  assert.equal(parts.tickMarks.length, 3);
  assert.equal(parts.tickLabels.length, 2);
  assert.equal(parts.tickLabels[0].text, "10");
  assert.equal(parts.tickLabels[0].baseline, "hanging"); // below horizontal
  assert.equal(parts.tickLabels[1].text, "20");

  const svg = documentToSvg(
    applyOps(null, [
      {
        op: "addBoxWhisker",
        id: "bw1",
        y: 200,
        min: 50,
        q1: 80,
        median: 110,
        q3: 150,
        max: 190,
        ticks: [
          { pos: 150, label: "10" },
          { pos: 200, label: "20" },
        ],
      },
    ])
  );
  assert.match(svg, />10</);
  assert.match(svg, />20</);
});

test("barChart xLabel sits further below category labels", () => {
  const bc = normalizeBarChart({
    id: "b",
    x: 40,
    y: 220,
    plotW: 200,
    plotH: 140,
    categories: ["A", "B"],
    values: [3, 5],
    yMax: 6,
    xLabel: "School",
  });
  const parts = barChartParts(bc);
  const catY = parts.catLabels[0].y;
  assert.ok(parts.xLabel);
  assert.ok(parts.xLabel.y - catY >= 24, `gap ${parts.xLabel.y - catY}`);
});

test("coord axis overhang when tick labels on", () => {
  const oh = coordAxisOverhangPx({
    unitPx: 40,
    showTicks: true,
    showTickLabels: true,
  });
  assert.ok(oh.pos >= 24 && oh.pos <= 28);
  assert.ok(oh.neg >= 10 && oh.neg <= 14);

  const off = coordAxisOverhangPx({
    unitPx: 40,
    showTickLabels: false,
  });
  assert.equal(off.pos, 0);
  assert.equal(off.neg, 0);

  const svg = svgCoordPlot(
    {
      ox: 100,
      oy: 100,
      unitPx: 40,
      xmin: -1,
      xmax: 3,
      ymin: -1,
      ymax: 2,
      axisLabelX: "x",
      axisLabelY: "y",
      showTickLabels: true,
    },
    (x, y) => ({ x, y }),
    { stroke: 1.2, fontPx: 12 }
  );
  // Positive overhang: ox + xmax*unitPx + ~24 = 100 + 120 + 24 = 244
  assert.match(svg, /x2="244/);
  assert.match(svg, /paint-order="stroke fill"/);
});
