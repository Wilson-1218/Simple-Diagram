import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOps,
  documentToSvg,
  normalizeLengthStyle,
  normalizeLengthOrient,
  normalizeLengthStroke,
  lengthOffsetFrame,
  dimMarkParts,
  arcsMarkParts,
  endsMarkParts,
} from "../src/diagram/index.mjs";

test("normalize length style/orient/stroke", () => {
  assert.equal(normalizeLengthStyle("dim"), "dim");
  assert.equal(normalizeLengthStyle(3), "arcs");
  assert.equal(normalizeLengthStyle(4), "ends");
  assert.equal(normalizeLengthStyle("ends"), "ends");
  assert.equal(normalizeLengthStyle("x"), "text");
  assert.equal(normalizeLengthOrient("horizontal"), "horizontal");
  assert.equal(normalizeLengthOrient("tilt"), "tilt");
  assert.equal(normalizeLengthStroke("dashed"), "dashed");
  assert.equal(normalizeLengthStroke(undefined), "dotted");
});

test("addLength with style/orient/size/stroke", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 100 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    {
      op: "addLength",
      segmentId: "AB",
      text: "6cm",
      style: "dim",
      orient: "horizontal",
      size: 18,
    },
    {
      op: "addLength",
      segmentId: "AB",
      text: "42",
      style: "arcs",
      stroke: "dashed",
      side: -1,
    },
  ]);
  assert.ok(doc.lengthLabels.length >= 2);
  const dim = doc.lengthLabels.find((l) => l.style === "dim");
  const arcs = doc.lengthLabels.find((l) => l.style === "arcs");
  assert.equal(dim.size, 18);
  assert.equal(arcs.stroke, "dashed");
  assert.equal(arcs.text, "42");
});

test("dim/arcs/ends geometry + SVG export", () => {
  const frame = lengthOffsetFrame({ x: 10, y: 10 }, { x: 10, y: 110 }, 1, 18);
  const dim = dimMarkParts(frame, 16, "h", 1);
  assert.ok(dim.tick0 && dim.arrow0 && dim.gap > 0);

  // Style 3 parallel bow
  const bow = arcsMarkParts(frame, 16, "42", 1);
  assert.ok(bow.arcA && bow.arcB && bow.gap > 0);
  assert.ok(bow.label.x === frame.mx);

  // Style 4 end ticks
  const onSeg = lengthOffsetFrame({ x: 40, y: 80 }, { x: 160, y: 80 }, 1, 0);
  const ends = endsMarkParts(onSeg, 16, "4", 1);
  assert.ok(ends.mark0 && ends.mark0.left && ends.mark1.right);
  assert.equal(ends.mark0.left.x0, onSeg.p0.x);

  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 40, y: 20 },
    { op: "addPoint", id: "B", x: 40, y: 140 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addLength", segmentId: "AB", text: "h", style: "dim", orient: "tilt" },
    {
      op: "addLength",
      segmentId: "AB",
      text: "42",
      style: "arcs",
      stroke: "dotted",
      orient: "horizontal",
      side: -1,
    },
    {
      op: "addLength",
      segmentId: "AB",
      text: "4",
      style: "ends",
      side: 1,
    },
  ]);
  assert.ok(doc.lengthLabels.length >= 2);
  const svg = documentToSvg(doc, { scale: 2, hidePoints: true });
  assert.match(svg, /<text/);
  assert.match(svg, /#111/);
  assert.match(svg, /stroke-dasharray/);
  const qCount = (svg.match(/\sQ[\d.,\s-]+/g) || []).length;
  // 2 parallel-arc halves + 4 end-tick arcs
  assert.ok(qCount >= 6, `expected ≥6 quadratic arcs, got ${qCount}`);
});
