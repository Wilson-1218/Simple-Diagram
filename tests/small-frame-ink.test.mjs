import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  documentToSvg,
  resolveInkBudget,
  inkUserUnitsPerMm,
  angleLabelRadius,
  DEFAULT_FRAME_WIDTH_MM,
  DEFAULT_FRAME_HEIGHT_MM,
  DEFAULT_MIN_STROKE_MM,
  APP_VERSION,
} from "../src/diagram/index.mjs";

function strokeWidths(svg) {
  const out = [];
  const re = /stroke-width="([0-9.]+)"/g;
  let m;
  while ((m = re.exec(svg))) out.push(Number(m[1]));
  return out;
}

function fontSizes(svg) {
  const out = [];
  const re = /font-size="([0-9.]+)"/g;
  let m;
  while ((m = re.exec(svg))) out.push(Number(m[1]));
  return out;
}

test("ink userUnits grow with viewBox so physical mm stays put when scale rises", () => {
  const frameW = DEFAULT_FRAME_WIDTH_MM;
  const frameH = DEFAULT_FRAME_HEIGHT_MM;
  const worldW = 400;
  const worldH = 300;
  const a = resolveInkBudget(worldW * 1, worldH * 1, {
    frameWidthMm: frameW,
    frameHeightMm: frameH,
    minStrokeMm: 0.4,
  });
  const b = resolveInkBudget(worldW * 4, worldH * 4, {
    frameWidthMm: frameW,
    frameHeightMm: frameH,
    minStrokeMm: 0.4,
  });
  // 4× larger viewBox → ~4× stroke in userUnits → same mm after fit
  assert.ok(Math.abs(b.stroke / a.stroke - 4) < 1e-9);
  assert.equal(a.strokeMm, DEFAULT_MIN_STROKE_MM);
  const physA = a.stroke / inkUserUnitsPerMm(worldW, worldH, frameW, frameH);
  const physB = b.stroke / inkUserUnitsPerMm(worldW * 4, worldH * 4, frameW, frameH);
  assert.ok(Math.abs(physA - 0.4) < 1e-9);
  assert.ok(Math.abs(physB - 0.4) < 1e-9);
});

test("documentToSvg stroke/fonts independent of export scale for fixed frame", () => {
  const ops = [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 320, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 240 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "AC", a: "A", b: "C" },
    { op: "addLabel", pointId: "A", text: "A", size: 16 },
    { op: "addEqualMark", segmentId: "AB", group: 0 },
    { op: "addParallelMark", segmentId: "AC", group: 0 },
    {
      op: "addRightAngle",
      vertex: "A",
      arm1: "B",
      arm2: "C",
      size: 10,
    },
  ];
  const doc = applyOps(null, ops);
  // pad is applied in world space as pad/scale — use 0 so viewBox scales purely with `scale`.
  const svg1 = documentToSvg(doc, { scale: 1, pad: 0 });
  const svg4 = documentToSvg(doc, { scale: 4, pad: 0 });
  const vb1 = svg1.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const vb4 = svg4.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(vb1 && vb4);
  const w1 = Number(vb1[1]);
  const h1 = Number(vb1[2]);
  const w4 = Number(vb4[1]);
  const h4 = Number(vb4[2]);
  assert.ok(Math.abs(w4 / w1 - 4) < 0.05, `viewBox ratio ${w4 / w1}`);
  const uu1 = inkUserUnitsPerMm(w1, h1, 54, 40);
  const uu4 = inkUserUnitsPerMm(w4, h4, 54, 40);
  // Geometry stroke is first on segments; mark strokes are ~0.95× (≥0.37mm).
  const sw1 = strokeWidths(svg1).find((n) => n > 0) || 0;
  const sw4 = strokeWidths(svg4).find((n) => n > 0) || 0;
  const phys1 = sw1 / uu1;
  const phys4 = sw4 / uu4;
  assert.ok(phys1 >= 0.39 && phys1 <= 0.45, `scale=1 stroke ${phys1}mm`);
  assert.ok(phys4 >= 0.39 && phys4 <= 0.45, `scale=4 stroke ${phys4}mm`);
  assert.ok(Math.abs(phys1 - phys4) < 0.05, `phys stroke drifted ${phys1} vs ${phys4}`);
  const markPhys1 = Math.min(...strokeWidths(svg1)) / uu1;
  assert.ok(markPhys1 >= 0.37, `mark stroke ${markPhys1}mm`);
  const fs1 = fontSizes(svg1)[0];
  const fs4 = fontSizes(svg4)[0];
  const pt1 = (fs1 / uu1) / (25.4 / 72);
  const pt4 = (fs4 / uu4) / (25.4 / 72);
  assert.ok(pt1 >= 7.5 && pt1 <= 8.5, `label pt@1=${pt1}`);
  assert.ok(pt4 >= 7.5 && pt4 <= 8.5, `label pt@4=${pt4}`);
  assert.ok(svg1.includes("<polyline"), "parallelMarks present @scale1");
  assert.ok(svg4.includes("<polyline"), "parallelMarks present @scale4");
});

test("parallelMarks still drawn; equal ticks use absolute mark stroke", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 200, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 150 },
    { op: "addPoint", id: "D", x: 200, y: 150 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "CD", a: "C", b: "D" },
    { op: "addParallelMark", segmentId: "AB", group: 0 },
    { op: "addParallelMark", segmentId: "CD", group: 1 },
    { op: "addEqualMark", segmentId: "AB", group: 1 },
  ]);
  const svg = documentToSvg(doc, { scale: 2 });
  const polys = (svg.match(/<polyline/g) || []).length;
  assert.ok(polys >= 3, `chevrons: expected ≥3 (1+2), got ${polys}`);
  // double equal → 2 tick lines beyond segment strokes
  const lines = (svg.match(/<line /g) || []).length;
  assert.ok(lines >= 4, `segments+ticks lines=${lines}`);
});

test("tiny angle arc keeps digits outside the arc", () => {
  const rad = 20;
  const fs = 18;
  const prefer = rad * 0.55;
  const got = angleLabelRadius(rad, fs);
  assert.ok(got > rad, `expected outside arc, got ${got} (prefer ${prefer})`);
  const big = angleLabelRadius(120, 14);
  assert.ok(Math.abs(big - 120 * 0.55) < 1e-9);

  const doc = applyOps(null, [
    { op: "addPoint", id: "V", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 100, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 100 },
    { op: "addSegment", id: "VA", a: "V", b: "A" },
    { op: "addSegment", id: "VB", a: "V", b: "B" },
    {
      op: "addAngleArc",
      vertex: "V",
      arm1: "A",
      arm2: "B",
      size: 10,
      text: "θ",
    },
  ]);
  const svg = documentToSvg(doc, { scale: 2, pad: 8 });
  assert.ok(svg.includes(">θ<") || svg.includes("θ"), "angle text present");
  // Arc path + text both present (label not dropped)
  assert.ok(svg.includes("<path"), "angle arc path");
  assert.ok(svg.includes("<text"), "angle label text");
});

test("APP_VERSION bumped for small-frame ink", () => {
  assert.equal(APP_VERSION, "13.5.28");
  assert.equal(DEFAULT_FRAME_HEIGHT_MM, 40);
});
