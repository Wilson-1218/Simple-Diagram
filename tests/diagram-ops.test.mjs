import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  OP_NAMES,
} from "../src/diagram/index.mjs";

test("empty diagram validates", () => {
  const doc = emptyDiagram();
  const v = validateDiagram(doc);
  assert.equal(v.ok, true);
  assert.equal(doc.formatVersion, 1);
});

test("applyOps builds a right triangle", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: -80 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "BC", a: "B", b: "C" },
    { op: "addSegment", id: "CA", a: "C", b: "A" },
    { op: "addRightAngle", vertex: "A", arm1: "B", arm2: "C" },
    { op: "addLabel", pointId: "A", text: "A" },
    { op: "addEqualMark", segmentId: "AB", group: 0 },
    { op: "addParallelMark", segmentId: "BC" },
    { op: "setView", scale: 2 },
  ]);
  assert.equal(doc.points.length, 3);
  assert.equal(doc.segments.length, 3);
  assert.equal(doc.rightAngles.length, 1);
  assert.equal(doc.labels.length, 1);
  assert.equal(doc.view.scale, 2);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("deterministic ids without explicit id", () => {
  const ops = [
    { op: "addPoint", x: 1, y: 2 },
    { op: "addPoint", x: 3, y: 4 },
    { op: "addSegment", a: "p_0001", b: "p_0002" },
  ];
  const a = applyOps(null, ops);
  const b = applyOps(null, ops);
  assert.deepEqual(
    a.points.map((p) => p.id),
    b.points.map((p) => p.id)
  );
  assert.equal(a.segments[0].id, b.segments[0].id);
});

test("addCoordPlot + addCurve", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 200,
      oy: 200,
      xmin: -1,
      xmax: 7,
      ymin: -2,
      ymax: 2,
    },
    {
      op: "addCurve",
      plotId: "plot1",
      type: "sin",
      params: { A: 1, B: 1, C: 0, D: 0 },
      label: { show: true, kind: "formula" },
    },
  ]);
  assert.equal(doc.coordPlots.length, 1);
  assert.equal(doc.coordPlots[0].curves.length, 1);
  assert.equal(doc.coordPlots[0].curves[0].type, "sin");
  assert.equal(validateDiagram(doc).ok, true);
});

test("validate catches missing refs", () => {
  const bad = emptyDiagram();
  bad.segments.push({ id: "s1", a: "missing", b: "also", style: "solid" });
  const v = validateDiagram(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("missing")));
});

test("legacy missing formatVersion warns but ok", () => {
  const doc = emptyDiagram();
  delete doc.formatVersion;
  doc.points.push({ id: "A", x: 0, y: 0 });
  const v = validateDiagram(doc);
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => w.includes("formatVersion")));
});

test("addFill + remove fill", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addPoint", id: "C", x: 20, y: -30 },
    { op: "addFill", id: "f1", pointIds: ["A", "B", "C"], color: "#666666", opacity: 0.2 },
  ]);
  assert.equal(doc.fills.length, 1);
  assert.deepEqual(doc.fills[0].pointIds, ["A", "B", "C"]);
  assert.equal(doc.fills[0].opacity, 0.2);
  assert.equal(validateDiagram(doc).ok, true);
  const removed = applyOps(doc, [{ op: "remove", type: "fill", id: "f1" }]);
  assert.equal(removed.fills.length, 0);
  assert.ok(OP_NAMES.includes("addFill"));
});

test("unknown formatVersion rejected", () => {
  const doc = emptyDiagram({ formatVersion: 99 });
  const v = validateDiagram(doc);
  assert.equal(v.ok, false);
});

test("OP_NAMES covers core MVP ops", () => {
  for (const name of [
    "addPoint",
    "addSegment",
    "addLabel",
    "addRightAngle",
    "addAngleArc",
    "addReflex",
    "addParallelMark",
    "addEqualMark",
    "addCoordPlot",
    "addCurve",
    "addFill",
    "setView",
    "remove",
  ]) {
    assert.ok(OP_NAMES.includes(name), name);
  }
});

test("applyOps does not mutate input", () => {
  const base = emptyDiagram();
  const before = JSON.stringify(base);
  applyOps(base, [{ op: "addPoint", id: "Z", x: 1, y: 1 }]);
  assert.equal(JSON.stringify(base), before);
});
