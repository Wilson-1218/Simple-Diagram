import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOps,
  documentToSvg,
  normalizeLengthStyle,
  normalizeLengthOrient,
  lengthOffsetFrame,
  dimMarkParts,
  arcsMarkParts,
} from "../src/diagram/index.mjs";

test("normalize length style/orient", () => {
  assert.equal(normalizeLengthStyle("dim"), "dim");
  assert.equal(normalizeLengthStyle(3), "arcs");
  assert.equal(normalizeLengthStyle("x"), "text");
  assert.equal(normalizeLengthOrient("horizontal"), "horizontal");
  assert.equal(normalizeLengthOrient("tilt"), "tilt");
});

test("addLength with style/orient/size", () => {
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
  ]);
  assert.equal(doc.lengthLabels.length, 1);
  const ll = doc.lengthLabels[0];
  assert.equal(ll.style, "dim");
  assert.equal(ll.orient, "horizontal");
  assert.equal(ll.size, 18);
  assert.equal(ll.text, "6cm");
});

test("dim/arcs geometry + SVG export contains marks", () => {
  const frame = lengthOffsetFrame({ x: 10, y: 10 }, { x: 10, y: 110 }, 1, 18);
  const dim = dimMarkParts(frame, 16, "h", 1);
  assert.ok(dim.tick0 && dim.arrow0 && dim.gap > 0);
  // Exam arcs: markers on segment ends (off=0), label lifted along normal
  const onSeg = lengthOffsetFrame({ x: 40, y: 80 }, { x: 160, y: 80 }, 1, 0);
  const arcs = arcsMarkParts(onSeg, 16, "4", 1);
  assert.ok(arcs.mark0 && arcs.mark0.left && arcs.mark0.right);
  assert.ok(arcs.mark1 && arcs.mark1.left && arcs.mark1.right);
  assert.ok(arcs.lift > 0);
  // tips sit on the segment ends
  assert.equal(arcs.mark0.left.x0, onSeg.p0.x);
  assert.equal(arcs.mark1.left.x0, onSeg.p1.x);
  // label centered; lifted along side normal (screen +y down → side=1 lifts below)
  assert.ok(Math.abs(arcs.label.x - 100) < 0.01);
  assert.ok(arcs.label.y > onSeg.p0.y);
  // flaring ends point toward the label side (ny = +1)
  assert.ok(arcs.mark0.left.y1 < arcs.mark0.left.y0 || arcs.mark0.left.y1 > arcs.mark0.left.y0);
  assert.ok(arcs.mark0.left.y1 > arcs.mark0.left.y0);

  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 40, y: 20 },
    { op: "addPoint", id: "B", x: 40, y: 140 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addLength", segmentId: "AB", text: "h", style: "dim", orient: "tilt" },
    {
      op: "addLength",
      segmentId: "AB",
      text: "6cm",
      style: "arcs",
      orient: "horizontal",
      side: -1,
    },
  ]);
  // second addLength pushes another label on same segment
  assert.ok(doc.lengthLabels.length >= 1);
  const svg = documentToSvg(doc, { scale: 2, hidePoints: true });
  assert.match(svg, /<text/);
  assert.match(svg, /#111/);
  // four quadratic end-mark arcs (2 per end)
  const qCount = (svg.match(/\sQ[\d.,\s-]+/g) || []).length;
  assert.ok(qCount >= 4, `expected ≥4 quadratic arcs, got ${qCount}`);
});
