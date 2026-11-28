import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  arcDraw,
  barChartParts,
  boxWhiskerParts,
  coordAxisLabelText,
  coordXAxisNamePlacement,
  documentToSvg,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.60", () => {
  assert.equal(APP_VERSION, "13.5.60");
});

function pieBase() {
  return applyOps(null, [
    {
      op: "addPieChart",
      idPrefix: "P",
      x: 100,
      y: 100,
      r: 80,
      slices: [
        { angle: 30, label: "Food", angleText: "30°" },
        { angle: 160, label: "Clothing", angleText: "160°" },
        { angle: 170, label: "Rest" },
      ],
    },
  ]);
}

test("omitted pie fields keep v13.5.55 ids, coordinates, segments, and text", () => {
  const doc = pieBase();
  const pts = doc.points.map((p) => `${p.id}@${p.x.toFixed(4)},${p.y.toFixed(4)}`);
  assert.deepEqual(pts, [
    "PC@100.0000,100.0000",
    "Pr0@180.0000,100.0000",
    "Pr1@169.2820,140.0000",
    "Pr2@21.2154,86.1081",
  ]);
  assert.deepEqual(
    doc.segments.map((s) => `${s.id}:${s.a}-${s.b}`),
    ["s_0001:PC-Pr0", "s_0002:PC-Pr1", "s_0003:PC-Pr2"]
  );
  const texts = doc.texts.map((t) => `${t.text}@${t.x.toFixed(4)},${t.y.toFixed(4)} ${t.align}`);
  assert.deepEqual(texts, [
    "Food@189.6379,124.0184 left",
    "Clothing@81.3941,151.1193 center",
    "Rest@104.3229,50.5887 center",
  ]);
  for (const a of doc.angleArcs) {
    const v = doc.points.find((p) => p.id === a.vertex);
    const a1 = doc.points.find((p) => p.id === a.arm1);
    const a2 = doc.points.find((p) => p.id === a.arm2);
    const g = arcDraw(a, v, a1, a2);
    assert.equal(a.size, 15);
    assert.ok(Math.abs(g.textR - 0.36 * 80) < 1e-6);
  }
  assert.equal(doc.pointAliases.PO, "PC");
  assert.equal(doc.pointAliases.P0, "Pr0");
  assert.equal(doc.pointAliases.P1, "Pr1");
  assert.equal(doc.pointAliases.P2, "Pr2");
  assert.equal(doc.points.some((p) => p.id === "PO" || p.id === "P0"), false);
});

test("pie aliases are skipped when the id is already a point, and addAngleArc can use them", () => {
  const blocked = applyOps(null, [
    { op: "addPoint", id: "PO", x: 9, y: 9 },
    {
      op: "addPieChart",
      idPrefix: "P",
      x: 100,
      y: 100,
      r: 40,
      slices: [
        { angle: 180 },
        { angle: 180 },
      ],
    },
  ]);
  const occupied = blocked.points.find((p) => p.id === "PO");
  assert.equal(occupied.x, 9);
  assert.equal(occupied.y, 9);
  assert.equal(blocked.pointAliases.PO, undefined);
  assert.equal(blocked.points.find((p) => p.id === "PC").x, 100);
  assert.equal(blocked.pointAliases.P0, "Pr0");

  const doc = applyOps(null, [
    {
      op: "addPieChart",
      idPrefix: "P",
      x: 0,
      y: 0,
      r: 40,
      slices: [
        { angle: 90 },
        { angle: 270 },
      ],
    },
    { op: "addAngleArc", vertex: "PO", arm1: "P0", arm2: "P1", text: "alias" },
  ]);
  const arc = doc.angleArcs.find((a) => a.text === "alias");
  assert.equal(arc.vertex, "PC");
  assert.equal(arc.arm1, "Pr0");
  assert.equal(arc.arm2, "Pr1");

  const dumped = JSON.parse(JSON.stringify(doc));
  assert.equal(dumped.pointAliases, undefined);
  const again = applyOps(dumped, [
    { op: "addAngleArc", vertex: "PO", arm1: "P0", arm2: "P1", text: "after-json" },
  ]);
  const later = again.angleArcs.find((a) => a.text === "after-json");
  assert.equal(later.vertex, "PC");
  assert.equal(later.arm1, "Pr0");
});

test("subLabel and newline stay inside at labelRadiusRatio; keepLabelsInside blocks the outside push", () => {
  const sub = applyOps(null, [
    {
      op: "addPieChart",
      x: 100,
      y: 100,
      r: 80,
      slices: [
        { angle: 30, label: "Food", subLabel: "30%", angleText: "30°" },
        { angle: 330, label: "Rest" },
      ],
    },
  ]);
  const mid = (15 * Math.PI) / 180;
  const bx = 100 + 0.62 * 80 * Math.cos(mid);
  const by = 100 + 0.62 * 80 * Math.sin(mid);
  const food = sub.texts.find((t) => t.text === "Food");
  const pct = sub.texts.find((t) => t.text === "30%");
  assert.ok(Math.abs(food.x - bx) < 1e-6);
  assert.ok(Math.abs(food.y - (by - 9)) < 1e-6);
  assert.ok(Math.abs(pct.x - bx) < 1e-6);
  assert.ok(Math.abs(pct.y - (by + 9)) < 1e-6);
  assert.equal(food.align, "center");
  assert.ok(Math.hypot(food.x - 100, food.y - 100) < 80);

  const nl = applyOps(null, [
    {
      op: "addPieChart",
      x: 100,
      y: 100,
      r: 80,
      slices: [
        { angle: 30, label: "Others\n46%", angleText: "30°" },
        { angle: 330 },
      ],
    },
  ]);
  const others = nl.texts.find((t) => t.text === "Others");
  const forty = nl.texts.find((t) => t.text === "46%");
  assert.ok(Math.abs(others.y - (by - 9)) < 1e-6);
  assert.ok(Math.abs(forty.y - (by + 9)) < 1e-6);
  assert.equal(others.align, "center");

  const kept = applyOps(null, [
    {
      op: "addPieChart",
      x: 100,
      y: 100,
      r: 80,
      keepLabelsInside: true,
      slices: [
        { angle: 30, label: "Food", angleText: "30°" },
        { angle: 330, label: "Rest" },
      ],
    },
  ]);
  const inside = kept.texts.find((t) => t.text === "Food");
  const insideMid = (15 * Math.PI) / 180;
  assert.ok(Math.abs(Math.hypot(inside.x - 100, inside.y - 100) - 0.68 * 80) < 1e-6);
  assert.equal(inside.align, "center");
  assert.ok(Math.abs(inside.x - (100 + 0.68 * 80 * Math.cos(insideMid))) < 1e-6);
});

test("per-slice arcSize overrides, and staggerArcs alternates and clears a small angle", () => {
  const doc = applyOps(null, [
    {
      op: "addPieChart",
      x: 0,
      y: 0,
      r: 80,
      arcSize: 15,
      staggerArcs: true,
      slices: [
        { angle: 40, angleText: "40°", arcSize: 22 },
        { angle: 80, label: "Wide", angleText: "80°" },
        { angle: 240 },
      ],
    },
  ]);
  const a40 = doc.angleArcs.find((a) => a.text === "40°");
  const a80 = doc.angleArcs.find((a) => a.text === "80°");
  assert.equal(a40.size, 22);
  assert.equal(a80.size, 20);
  const g40 = arcDraw(
    a40,
    doc.points.find((p) => p.id === a40.vertex),
    doc.points.find((p) => p.id === a40.arm1),
    doc.points.find((p) => p.id === a40.arm2)
  );
  assert.ok(g40.textR >= 0.38 * 80 - 1e-6);
  assert.ok(g40.textR <= 0.42 * 80 + 1e-6);
  const g80 = arcDraw(
    a80,
    doc.points.find((p) => p.id === a80.vertex),
    doc.points.find((p) => p.id === a80.arm1),
    doc.points.find((p) => p.id === a80.arm2)
  );
  assert.ok(Math.abs(g80.textR - Math.max(0.36 * 80, 20 + 12)) < 1e-6);
});

test("box-whisker tick grid is opt-in and stays under the box in the viewBox", () => {
  const plain = applyOps(null, [
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
      axisY: 80,
      boxHeight: 20,
    },
  ]);
  assert.equal(plain.boxWhiskers[0].tickGridStyle, undefined);
  const plainParts = boxWhiskerParts(plain.boxWhiskers[0]);
  assert.equal(plainParts.tickGrids.length, 0);
  assert.equal(plainParts.guides.length, 5);

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
      axisY: 80,
      boxHeight: 20,
      tickGridStyle: "dotted",
    },
  ]);
  const parts = boxWhiskerParts(doc.boxWhiskers[0]);
  assert.equal(parts.tickGrids.length, 3);
  const boxTop = parts.box.y;
  const boxBottom = parts.box.y + parts.box.h;
  for (const g of parts.guides) {
    assert.ok(Math.min(g.y1, g.y2) >= boxTop - 1e-6);
    assert.ok(g.y2 > g.y1);
  }
  for (const line of parts.tickGrids) {
    assert.equal(line.tickGridStyle, "dotted");
    assert.ok(Math.abs(line.y1 - (40 - 20 * 0.95)) < 1e-9);
    assert.equal(line.y2, 80);
    assert.equal(line.x1, line.x2);
    assert.ok(line.y1 < boxTop);
  }
  const raised = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw",
      y: 40,
      min: 20,
      q1: 35,
      median: 40,
      q3: 55,
      max: 70,
      ticks: [20],
      axisY: 80,
      boxHeight: 20,
      tickGridStyle: "dashed",
      tickGridTop: 12,
      tickGridExtend: 5,
    },
  ]);
  const top = boxWhiskerParts(raised.boxWhiskers[0]).tickGrids[0];
  assert.equal(top.y1, 12);
  assert.equal(top.tickGridStyle, "dashed");

  const svg = documentToSvg(doc, { scale: 2 });
  assert.match(svg, /stroke-dasharray=/);
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const lines = [...svg.matchAll(/<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"/g)].map(
    (m) => m.slice(1).map(Number)
  );
  const vertical = lines.filter((ln) => Math.abs(ln[0] - ln[2]) < 0.05 && ln[3] - ln[1] > 40);
  assert.ok(vertical.length >= 3);
  for (const ln of vertical) {
    assert.ok(ln[0] >= 16 && w - ln[2] >= 16);
    assert.ok(ln[1] >= 16 && h - ln[3] >= 16);
  }
});

test("bar chart title and boxed frame are opt-in and stay inside the viewBox", () => {
  const plain = applyOps(null, [
    {
      op: "addBarChart",
      id: "bc",
      x: 40,
      y: 200,
      plotW: 180,
      plotH: 120,
      categories: ["A", "B"],
      values: [1, 3],
      yMax: 4,
      title: "  ",
      boxed: false,
    },
  ]);
  assert.equal(plain.barCharts[0].title, undefined);
  assert.equal(plain.barCharts[0].boxed, undefined);
  const plainParts = barChartParts(plain.barCharts[0]);
  assert.equal(plainParts.title, null);
  assert.equal(plainParts.frameSides.length, 0);
  assert.equal(plainParts.axisX.y1, 200);
  assert.equal(plainParts.axisY.x2, 40);

  const doc = applyOps(null, [
    {
      op: "addBarChart",
      id: "bc",
      x: 40,
      y: 200,
      plotW: 180,
      plotH: 120,
      categories: ["A", "B"],
      values: [1, 3],
      yMax: 4,
      title: "銷售",
      boxed: true,
    },
  ]);
  const parts = barChartParts(doc.barCharts[0]);
  assert.deepEqual(parts.title, { x: 130, y: 54, text: "銷售" });
  assert.deepEqual(parts.frameSides, [
    { x1: 40, y1: 80, x2: 220, y2: 80 },
    { x1: 220, y1: 80, x2: 220, y2: 200 },
  ]);
  const svg = documentToSvg(doc, { scale: 2 });
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const title = svg.match(/<text x="([0-9.]+)" y="([0-9.]+)"[^>]*dominant-baseline="middle"[^>]*>銷售/);
  assert.ok(title);
  const lx = Number(title[1]);
  const ly = Number(title[2]);
  assert.ok(lx >= 16 && ly >= 16 && w - lx >= 16 && h - ly >= 16);
  const horiz = [...svg.matchAll(/<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"/g)]
    .map((m) => m.slice(1).map(Number))
    .filter((ln) => Math.abs(ln[1] - ln[3]) < 0.05 && ln[2] - ln[0] > 100)
    .sort((a, b) => a[1] - b[1]);
  assert.ok(horiz.length >= 2, "boxed top side missing");
  const top = horiz[0];
  assert.ok(top[1] > ly);
  assert.ok(top[1] >= 16 && w - top[2] >= 16);
  const right = [...svg.matchAll(/<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"/g)]
    .map((m) => m.slice(1).map(Number))
    .find((ln) => Math.abs(ln[0] - ln[2]) < 0.05 && ln[3] - ln[1] > 80);
  assert.ok(right, "boxed right side missing");
  assert.ok(right[0] >= 16 && w - right[0] >= 16);
});

test("coord axis names: blank and false hide, right sits on the axis", () => {
  assert.equal(coordAxisLabelText(undefined, "x"), "x");
  assert.equal(coordAxisLabelText(null, "y"), "y");
  assert.equal(coordAxisLabelText("", "x"), "");
  assert.equal(coordAxisLabelText("   ", "x"), "");
  assert.equal(coordAxisLabelText(false, "y"), "");

  const omitted = applyOps(null, [
    { op: "addCoordPlot", id: "c", ox: 100, oy: 200, unitPx: 20, xmin: -1, xmax: 4, ymin: -1, ymax: 3 },
  ]);
  assert.equal(omitted.coordPlots[0].axisLabelX, "x");
  assert.equal(omitted.coordPlots[0].axisLabelY, "y");
  assert.equal(omitted.coordPlots[0].axisLabelXPos, undefined);
  assert.equal(coordXAxisNamePlacement(omitted.coordPlots[0]), "below");
  const oldSvg = documentToSvg(omitted, { scale: 2 });
  assert.match(
    oldSvg,
    /<text x="370.00" y="264.00"[^>]*dominant-baseline="hanging">(?:<tspan[^>]*>)?x/
  );

  const hidden = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "c",
      ox: 100,
      oy: 200,
      unitPx: 20,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 3,
      axisLabelX: "",
      axisLabelY: false,
    },
  ]);
  assert.equal(hidden.coordPlots[0].axisLabelX, "");
  assert.equal(hidden.coordPlots[0].axisLabelY, "");
  const hiddenSvg = documentToSvg(hidden, { scale: 2 });
  assert.equal(hiddenSvg.includes(">x<"), false);
  assert.equal(hiddenSvg.includes(">y<"), false);

  const blank = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "c",
      ox: 100,
      oy: 200,
      unitPx: 20,
      xmin: 0,
      xmax: 2,
      ymin: 0,
      ymax: 2,
      axisLabelX: "  ",
      axisLabelY: "   ",
    },
  ]);
  assert.equal(blank.coordPlots[0].axisLabelX, "");
  assert.equal(blank.coordPlots[0].axisLabelY, "");

  const right = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "c",
      ox: 100,
      oy: 200,
      unitPx: 20,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 3,
      axisLabelX: "t",
      axisLabelXPos: "right",
    },
  ]);
  assert.equal(right.coordPlots[0].axisLabelXPos, "right");
  const svg = documentToSvg(right, { scale: 2 });
  const hit = svg.match(
    /<text x="([0-9.]+)" y="([0-9.]+)"[^>]*text-anchor="start" dominant-baseline="middle"[^>]*>(?:<tspan[^>]*>)?t/
  );
  assert.ok(hit, svg.slice(svg.indexOf(">t"), svg.indexOf(">t") + 80));
  assert.equal(hit[1], "384.00");
  assert.equal(hit[2], "262.00");
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const lx = Number(hit[1]);
  const ly = Number(hit[2]);
  assert.ok(lx >= 16 && ly >= 16 && w - lx >= 16 && h - ly >= 16);
});
