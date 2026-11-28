/**
 * v13.5.62 — autoScaleText false is canvas 1:1.
 * Text scale and stroke scale are both exactly 1 (no span/340), including
 * size 14, angle text, length labels, and stem-leaf header lines.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_VERSION, applyOps, documentToSvg, readableInkScale } from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.64", () => {
  assert.equal(APP_VERSION, "13.5.64");
});

/** 2015 P1 five-up stand-in: Q8, Q12 stem-leaf, Q13, Q19. Span is past 420. */
function fiveUpOps(withMeta) {
  const ops = [];
  if (withMeta) ops.push({ op: "setMeta", autoScaleText: false });
  ops.push(
    { op: "addPoint", id: "A", x: 40, y: 40 },
    { op: "addPoint", id: "B", x: 240, y: 40 },
    { op: "addPoint", id: "C", x: 40, y: 200 },
    { op: "addLabel", pointId: "A", text: "A", size: 14, ox: 0, oy: -16 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "AC", a: "A", b: "C" },
    { op: "addCircle", centerId: "A", throughId: "B" },
    { op: "addSector", centerId: "A", startId: "B", endId: "C", mode: "arc" },
    { op: "addText", x: 90, y: 130, text: "Q8", size: 14 },
    { op: "addAngleArc", vertex: "A", arm1: "B", arm2: "C", text: "θ" },
    { op: "addLengthLabel", segmentId: "AB", text: "12", size: 14 },
    {
      op: "addStemLeaf",
      x: 340,
      y: 30,
      fontSize: 14,
      rows: [
        { stem: "1", leaves: [2, 5, 8] },
        { stem: "2", leaves: "0 3 7" },
      ],
    },
    { op: "addPoint", id: "D", x: 640, y: 40 },
    { op: "addPoint", id: "E", x: 840, y: 40 },
    { op: "addPoint", id: "F", x: 640, y: 190 },
    { op: "addSegment", a: "D", b: "E" },
    { op: "addSegment", a: "D", b: "F" },
    { op: "addRightAngle", vertex: "D", arm1: "E", arm2: "F" },
    { op: "addText", x: 720, y: 120, text: "Q13", size: 14 },
    { op: "addPoint", id: "P", x: 1120, y: 360 },
    { op: "addPoint", id: "Q", x: 980, y: 360 },
    { op: "addSegment", id: "PQ", a: "P", b: "Q" },
    { op: "addLabel", pointId: "P", text: "P", size: 14, ox: 12, oy: 0 },
    { op: "addText", x: 1040, y: 300, text: "Q19", size: 14 }
  );
  return ops;
}

function nums(svg, attr) {
  return [...svg.matchAll(new RegExp(`${attr}="([0-9.]+)"`, "g"))].map((m) => Number(m[1]));
}

function fontOf(svg, text) {
  const m = svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`));
  assert.ok(m, text);
  return Number(m[1]);
}

function circleStroke(svg) {
  const m = svg.match(/<circle[^>]*stroke-width="([0-9.]+)"/);
  assert.ok(m, "circle");
  return Number(m[1]);
}

function assertOneToOne(svg, exportScale) {
  const fonts = nums(svg, "font-size");
  const strokes = nums(svg, "stroke-width");
  assert.ok(fonts.length >= 8, `fonts ${fonts.length}`);
  assert.ok(strokes.length >= 4, `strokes ${strokes.length}`);
  const maxFont = Math.max(...fonts);
  const maxSw = Math.max(...strokes);
  assert.ok(maxFont <= 20 * exportScale, `font ${maxFont}`);
  assert.ok(maxSw <= 3 * exportScale, `stroke ${maxSw}`);
  assert.ok(Math.abs(fontOf(svg, "Q8") - 14 * exportScale) < 0.05, fontOf(svg, "Q8"));
  assert.ok(Math.abs(fontOf(svg, "Q13") - 14 * exportScale) < 0.05);
  assert.ok(Math.abs(fontOf(svg, "Q19") - 14 * exportScale) < 0.05);
  assert.ok(Math.abs(fontOf(svg, "12") - 14 * exportScale) < 0.05);
  assert.ok(Math.abs(fontOf(svg, "8") - 14 * exportScale) < 0.05);
  assert.ok(Math.abs(fontOf(svg, "θ") - 13 * exportScale) < 0.05);
  assert.ok(Math.abs(circleStroke(svg) - 1.35 * exportScale) < 0.02, circleStroke(svg));
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const span = Math.max(Number(vb[1]), Number(vb[2])) / exportScale;
  assert.ok(span > 420, span);
  assert.ok(readableInkScale(span, 0) > 3, readableInkScale(span, 0));
}

test("2015 P1 five-up stays 1:1 when autoScaleText is false", () => {
  const doc = applyOps(null, fiveUpOps(true));
  assert.equal(doc.autoScaleText, false);
  const svg = documentToSvg(doc, { scale: 1 });
  assertOneToOne(svg, 1);
  const fonts = nums(svg, "font-size");
  const strokes = nums(svg, "stroke-width");
  assert.ok(Math.max(...fonts) <= 20);
  assert.ok(Math.max(...strokes) <= 3);

  const svg2 = documentToSvg(doc, { scale: 2 });
  assertOneToOne(svg2, 2);
  assert.ok(Math.abs(fontOf(svg2, "Q8") / fontOf(svg, "Q8") - 2) < 0.02);
  assert.ok(Math.abs(circleStroke(svg2) / circleStroke(svg) - 2) < 0.02);

  const wideOn = documentToSvg(applyOps(null, fiveUpOps(false)), { scale: 1 });
  assert.ok(Math.max(...nums(wideOn, "font-size")) > 20);
  assert.ok(Math.max(...nums(wideOn, "stroke-width")) > 3);
});

test("options.autoScaleText false and doc.meta.autoScaleText false both freeze scale at 1", () => {
  const bare = applyOps(null, fiveUpOps(false));
  assert.notEqual(bare.autoScaleText, false);
  const byOption = documentToSvg(bare, { scale: 1, autoScaleText: false });
  assertOneToOne(byOption, 1);
  assert.ok(Math.max(...nums(byOption, "font-size")) <= 20);
  assert.ok(Math.max(...nums(byOption, "stroke-width")) <= 3);

  const byMeta = applyOps(null, fiveUpOps(false));
  byMeta.meta = { autoScaleText: false };
  const svg = documentToSvg(byMeta, { scale: 1 });
  assertOneToOne(svg, 1);
  assert.equal(fontOf(svg, "Q8"), fontOf(byOption, "Q8"));
  assert.equal(circleStroke(svg), circleStroke(byOption));
});
