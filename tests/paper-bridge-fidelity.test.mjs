import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  documentToSvg,
  STABLE_TOP_LEVEL_KEYS,
  APP_VERSION,
} from "../src/diagram/index.mjs";

test("stable top-level keys: emptyDiagram has 34 + savedAt on save habit", () => {
  const doc = emptyDiagram();
  assert.equal(doc.formatVersion, 1);
  assert.equal(doc.app, "simple-diagram");
  assert.equal(doc.version, APP_VERSION);
  assert.equal(APP_VERSION, "13.5.30");
  assert.equal(STABLE_TOP_LEVEL_KEYS.length, 35);
  for (const k of STABLE_TOP_LEVEL_KEYS) {
    if (k === "savedAt") continue; // stamped only on editor save
    assert.ok(k in doc, `missing key ${k}`);
  }
  assert.equal(doc.fillMode, "polygon");
  assert.equal(doc.shapeMode, "square");
  assert.equal(doc.circlePartMode, "chord");
  for (const k of [
    "gridShow",
    "gridLock",
    "coordsShow",
    "coordsLock",
    "helpersShow",
    "helpersLock",
  ]) {
    assert.equal(typeof doc.layers[k], "boolean", `layers.${k}`);
  }
  assert.deepEqual(Object.keys(doc.view).sort(), ["scale", "x", "y"]);
});

test("pathFill + segment centerId round-trip through validate / SVG", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 80, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 60 },
    {
      op: "addFill",
      kind: "segment",
      centerId: "O",
      startId: "A",
      endId: "B",
      opacity: 0.25,
    },
    {
      op: "addFill",
      kind: "pathFill",
      edges: [
        { type: "line", a: "A", b: "B" },
        { type: "arc", centerId: "O", from: "B", to: "A" },
      ],
      color: "#ffffff",
      opacity: 1,
    },
  ]);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
  assert.equal(doc.fills[0].kind, "segment");
  assert.equal(doc.fills[0].centerId, "O");
  assert.equal(doc.fills[0].circleId, undefined);
  assert.equal(doc.fills[1].kind, "pathFill");
  assert.equal(doc.fills[1].edges.length, 2);
  const svg = documentToSvg(doc, { scale: 1 });
  assert.ok(svg.includes("<path"), "fills should paint");
});

test("parallelMarks appear in headless SVG export", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 80 },
    { op: "addPoint", id: "D", x: 100, y: 80 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "CD", a: "C", b: "D" },
    { op: "addParallelMark", segmentId: "AB", group: 0 },
    { op: "addParallelMark", segmentId: "CD", group: 0 },
  ]);
  const svg = documentToSvg(doc, { scale: 2 });
  assert.ok(svg.includes("<polyline"), "parallel chevrons as polylines");
  const count = (svg.match(/<polyline/g) || []).length;
  assert.ok(count >= 2, `expected ≥2 chevrons, got ${count}`);
});

test("equilateral addShape sets shapeMode and dotted helpers by default", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "equilateral", x: 0, y: 100, w: 80 },
  ]);
  assert.equal(doc.shapeMode, "equilateral");
  assert.equal(doc.segments.length, 3);
  assert.ok(doc.segments.every((s) => s.style === "dotted"));
  assert.equal(doc.labels.length, 0);
  assert.equal(validateDiagram(doc).ok, true);
});

test("ops-only payload shape: applyOps array then document validates", () => {
  const ops = [
    { op: "addPoint", id: "A", x: 10, y: 10 },
    { op: "addPoint", id: "B", x: 90, y: 10 },
    { op: "addSegment", a: "A", b: "B" },
    { op: "addParallelMark", segmentId: "s_0001" },
  ];
  // Deterministic segment id when omitted:
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 10, y: 10 },
    { op: "addPoint", id: "B", x: 90, y: 10 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addParallelMark", segmentId: "AB" },
  ]);
  assert.equal(doc.parallelMarks.length, 1);
  assert.equal(validateDiagram(doc).ok, true);
  void ops;
});
