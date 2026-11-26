import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
  normalizeLengthSide,
  hatchInkForDisplay,
  HATCH_INK_DARK_SCREEN,
  HATCH_INK_PAPER,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for phase1 AI/UX", () => {
  assert.equal(APP_VERSION, "13.5.50");
});

test("addTangent leftToRight: bottom touch → aId left, bId right", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "Btm", x: 0, y: 50 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "Btm" },
    {
      op: "addTangent",
      circleId: "c1",
      touchId: "Btm",
      halfLen: 30,
      aId: "TL",
      bId: "TR",
    },
  ]);
  const tl = doc.points.find((p) => p.id === "TL");
  const tr = doc.points.find((p) => p.id === "TR");
  assert.ok(tl && tr);
  assert.ok(tl.x < tr.x - 1e-6, `expected TL left of TR, got ${tl.x} vs ${tr.x}`);
});

test("addTangent order ccw keeps geometric endpoints", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "Btm", x: 0, y: 50 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "Btm" },
    {
      op: "addTangent",
      circleId: "c1",
      touchId: "Btm",
      halfLen: 30,
      aId: "A",
      bId: "B",
      order: "ccw",
    },
  ]);
  const a = doc.points.find((p) => p.id === "A");
  const b = doc.points.find((p) => p.id === "B");
  // Bottom touch, geometric (−sin, cos) at θ=π/2 → a on +x (right)
  assert.ok(a.x > b.x + 1e-6, `ccw: A should be right of B, got ${a.x} vs ${b.x}`);
});

test("addTangent nearly vertical → aId above (smaller y)", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "R", x: 50, y: 0 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "R" },
    {
      op: "addTangent",
      circleId: "c1",
      touchId: "R",
      halfLen: 30,
      aId: "Up",
      bId: "Dn",
    },
  ]);
  const up = doc.points.find((p) => p.id === "Up");
  const dn = doc.points.find((p) => p.id === "Dn");
  assert.ok(up.y < dn.y - 1e-6);
});

test("normalizeLengthSide maps world directions via a→b normal", () => {
  // Horizontal a→right: normal (+1) = (0,1) = below
  assert.equal(
    normalizeLengthSide("below", { x: 0, y: 0 }, { x: 10, y: 0 }),
    1
  );
  assert.equal(
    normalizeLengthSide("above", { x: 0, y: 0 }, { x: 10, y: 0 }),
    -1
  );
  // Vertical a→down: normal (+1) = (−1,0) = left
  assert.equal(
    normalizeLengthSide("left", { x: 0, y: 0 }, { x: 0, y: 10 }),
    1
  );
  assert.equal(
    normalizeLengthSide("right", { x: 0, y: 0 }, { x: 0, y: 10 }),
    -1
  );
  assert.equal(normalizeLengthSide(-1), -1);
  assert.equal(normalizeLengthSide(1), 1);
});

test("addLengthLabel accepts side string and stores ±1", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    {
      op: "addLengthLabel",
      segmentId: "AB",
      text: "5",
      side: "above",
    },
  ]);
  assert.equal(doc.lengthLabels[0].side, -1);
});

test("hatchInkForDisplay remaps dark default only on dark screen", () => {
  assert.equal(hatchInkForDisplay(undefined, { dark: false }), HATCH_INK_PAPER);
  assert.equal(hatchInkForDisplay("#111111", { dark: false }), "#111111");
  assert.equal(hatchInkForDisplay("#111111", { dark: true }), HATCH_INK_DARK_SCREEN);
  assert.equal(hatchInkForDisplay("#000000", { dark: true }), HATCH_INK_DARK_SCREEN);
  assert.equal(hatchInkForDisplay("#336699", { dark: true }), "#336699");
});

test("documentToSvg keeps hatch #111 and halos angle/length text", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 40, y: 40 },
    { op: "addPoint", id: "A", x: 100, y: 40 },
    { op: "addPoint", id: "B", x: 40, y: 100 },
    { op: "addSegment", id: "OA", a: "O", b: "A" },
    { op: "addSegment", id: "OB", a: "O", b: "B" },
    { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", text: "θ" },
    { op: "addLengthLabel", segmentId: "OA", text: "6", side: "above" },
    {
      op: "addFill",
      kind: "polygon",
      pointIds: ["O", "A", "B"],
      pattern: "hatch",
    },
  ]);
  assert.equal(doc.fills[0].color, "#111111");
  const svg = documentToSvg(doc, { scale: 2, hidePoints: true });
  assert.match(svg, /stroke="#111111"/);
  assert.match(svg, /paint-order="stroke fill"/);
  assert.match(svg, />θ</);
  assert.match(svg, />6</);
});

test("addAngleArc stores optional text offsets", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 40, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 40 },
    {
      op: "addAngleArc",
      vertex: "O",
      arm1: "A",
      arm2: "B",
      text: "α",
      textRadiusOffset: 4,
      textOx: 1,
      textOy: -2,
    },
  ]);
  const arc = doc.angleArcs[0];
  assert.equal(arc.textRadiusOffset, 4);
  assert.equal(arc.textOx, 1);
  assert.equal(arc.textOy, -2);
});
