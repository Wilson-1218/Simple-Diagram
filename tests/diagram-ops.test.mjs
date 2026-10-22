import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  documentToSvg,
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

test("addFill sector and segment kinds", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 40, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: -40 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "A" },
    {
      op: "addFill",
      id: "fs",
      kind: "sector",
      centerId: "O",
      startId: "A",
      endId: "B",
      opacity: 0.25,
    },
    {
      op: "addFill",
      id: "fg",
      kind: "segment",
      circleId: "c1",
      startId: "A",
      endId: "B",
      opacity: 0.2,
    },
  ]);
  assert.equal(doc.fills.length, 2);
  assert.equal(doc.fills[0].kind, "sector");
  assert.equal(doc.fills[1].kind, "segment");
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("circle part helpers + shape + layers", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 50, y: 0 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "A" },
    { op: "addTangent", circleId: "c1", touchId: "A", halfLen: 30, aId: "T0", bId: "T1" },
    { op: "addRadius", circleId: "c1", deg: 90, throughPointId: "R" },
    { op: "addDiameter", circleId: "c1", deg: 0, aId: "D0", bId: "D1" },
    { op: "addChord", circleId: "c1", deg0: 20, deg1: 100, aId: "P", bId: "Q" },
    { op: "addShape", kind: "square", x: 100, y: 100, w: 40, idPrefix: "S" },
    { op: "setLayers", gridShow: false, helpersShow: true },
    { op: "alignPoints", pointIds: ["S0", "S1"], axis: "top" },
  ]);
  assert.ok(doc.segments.length >= 5);
  assert.equal(doc.layers.gridShow, false);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("fixture ops-right-triangle applies cleanly", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const ops = JSON.parse(
    readFileSync(resolve(root, "examples/ops-right-triangle.json"), "utf8")
  );
  const doc = applyOps(null, ops);
  assert.equal(doc.points.length, 3);
  assert.equal(doc.fills.length, 1);
  assert.equal(validateDiagram(doc).ok, true);
});

test("fixture ops-circle-tangent applies cleanly", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const ops = JSON.parse(
    readFileSync(resolve(root, "examples/ops-circle-tangent.json"), "utf8")
  );
  const doc = applyOps(null, ops);
  assert.ok(doc.circles.length === 1);
  assert.ok(doc.fills.some((f) => f.kind === "segment"));
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("OP_NAMES includes v13.4 AI helpers", () => {
  for (const name of [
    "addShape",
    "addFoot",
    "addTangent",
    "addRadius",
    "addDiameter",
    "addChord",
    "alignPoints",
    "distributePoints",
    "equalizeSegments",
    "setLayers",
  ]) {
    assert.ok(OP_NAMES.includes(name), name);
  }
});

test("addShape solid kinds reuse insertTemplate geometry", () => {
  const cube = applyOps(null, [
    { op: "addShape", kind: "cube", x: 100, y: 80, w: 120 },
  ]);
  assert.ok(cube.points.length >= 8, "cube has 8 vertices");
  assert.ok(cube.segments.length >= 8);
  assert.equal(validateDiagram(cube).ok, true, validateDiagram(cube).errors.join("; "));
  const fr = applyOps(null, [
    { op: "addShape", kind: "frustum", x: 0, y: 0, w: 100 },
  ]);
  assert.ok(fr.points.length >= 8);
  assert.equal(validateDiagram(fr).ok, true);
});

test("addFoot projects onto line and draws altitude", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addPoint", id: "P", x: 40, y: 60 },
    { op: "addSegment", id: "ab", a: "A", b: "B" },
    { op: "addFoot", pointId: "P", segmentId: "ab", footId: "H", labelText: "H" },
  ]);
  const H = doc.points.find((p) => p.id === "H");
  assert.ok(H);
  assert.equal(H.marker, "foot");
  assert.ok(Math.abs(H.x - 40) < 1e-9);
  assert.ok(Math.abs(H.y - 0) < 1e-9);
  assert.ok(doc.segments.some((s) => (s.a === "P" && s.b === "H") || (s.a === "H" && s.b === "P")));
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("insertTemplate rightTri / frustum / circleGeom / genTri", async () => {
  const {
    BUILTIN_TEMPLATE_IDS,
    listBuiltinTemplates,
    MACRO_NAMES,
    runMacro,
  } = await import("../src/diagram/index.mjs");

  for (const id of ["rightTri", "frustum", "circleGeom", "genTri"]) {
    assert.ok(BUILTIN_TEMPLATE_IDS.includes(id), id);
  }

  const right = applyOps(null, [{ op: "insertTemplate", id: "rightTri" }]);
  assert.equal(right.points.length, 3);
  assert.equal(right.segments.length, 3);
  assert.equal(right.rightAngles.length, 1);
  assert.equal(right.labels.length, 3);
  assert.equal(validateDiagram(right).ok, true, validateDiagram(right).errors.join("; "));

  const fru = applyOps(null, [{ op: "addTemplate", id: "frustum", dx: 10, dy: -5 }]);
  assert.equal(fru.points.length, 8);
  assert.equal(fru.segments.length, 12);
  assert.ok(fru.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(validateDiagram(fru).ok, true, validateDiagram(fru).errors.join("; "));

  const circ = applyOps(null, [{ op: "insertTemplate", id: "circleGeom", scale: 1.5 }]);
  assert.equal(circ.points.length, 5);
  assert.equal(circ.circles.length, 1);
  assert.equal(circ.segments.length, 3);
  assert.equal(validateDiagram(circ).ok, true, validateDiagram(circ).errors.join("; "));

  const gen = applyOps(null, [{ op: "insertTemplate", id: "genTri" }]);
  assert.equal(gen.points.length, 3);
  assert.equal(gen.segments.length, 3);
  assert.equal(validateDiagram(gen).ok, true, validateDiagram(gen).errors.join("; "));

  const listed = listBuiltinTemplates();
  assert.ok(listed.every((t) => t.ui === true));
  assert.ok(listed.some((t) => t.id === "circleGeom" && t.group === "combo"));
  assert.ok(listed.some((t) => t.id === "altBase"));
  assert.ok(!listed.some((t) => t.id === "frustum"), "solids not in default list_templates");
  const all = listBuiltinTemplates({ uiOnly: false });
  assert.ok(all.some((t) => t.id === "rightTri" && t.group === "plane" && t.ui === false));
  assert.ok(all.some((t) => t.id === "frustum" && t.group === "solid" && t.ui === false));

  assert.ok(OP_NAMES.includes("insertTemplate"));
  assert.ok(OP_NAMES.includes("addTemplate"));

  const { ops, doc } = runMacro("drawRightTriangle", { a: 50, b: 40, apply: true });
  assert.ok(ops.length >= 7);
  assert.equal(doc.points.length, 3);
  assert.equal(doc.rightAngles.length, 1);
  assert.ok(MACRO_NAMES.includes("drawFrustum"));
  assert.ok(MACRO_NAMES.includes("drawCube"));
});

test("addFill polyArc and pathFill", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 100 },
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 100 },
    { op: "addPoint", id: "C", x: 100, y: 0 },
    { op: "addPoint", id: "P", x: 50, y: 100 - 50 * Math.sqrt(3) },
    { op: "addCircle", id: "cO", centerId: "O", throughId: "A" },
    {
      op: "addFill",
      kind: "polyArc",
      pointIds: ["A", "C", "B"],
      centerId: "O",
      startId: "B",
      endId: "A",
    },
    {
      op: "addFill",
      kind: "pathFill",
      edges: [
        { type: "line", a: "A", b: "C" },
        { type: "arc", centerId: "O", from: "C", to: "A" },
      ],
    },
  ]);
  assert.equal(validateDiagram(doc).ok, true);
  assert.equal(doc.fills[0].kind, "polyArc");
  assert.equal(doc.fills[1].kind, "pathFill");
  const svg = documentToSvg(doc, { scale: 1 });
  assert.ok(svg.includes("<path"));
});

test("helpersLock defaults true (marks layer)", async () => {
  const { emptyDiagram, DEFAULT_LAYERS } = await import("../src/diagram/index.mjs");
  assert.equal(DEFAULT_LAYERS.helpersLock, true);
  assert.equal(emptyDiagram().layers.helpersLock, true);
});
