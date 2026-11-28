import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, documentToSvg, validateDiagram, APP_VERSION } from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.63", () => {
  assert.equal(APP_VERSION, "13.5.63");
});

function segBetween(doc, a, b) {
  return doc.segments.find(
    (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a)
  );
}

test("pyramid and cuboid letter aliases resolve KC and a free C", () => {
  const pyramid = applyOps(null, [
    { op: "addShape", kind: "pyramid", x: 0, y: 0, w: 80, idPrefix: "K" },
    { op: "addSegment", id: "edge", a: "A", b: "KC" },
    { op: "addRightAngle", vertex: "KV", arm1: "KA", arm2: "C" },
  ]);
  const c = pyramid.points.find((p) => p.id === "K2");
  const v = pyramid.points.find((p) => p.id === "K4");
  assert.equal(pyramid.labels.find((l) => l.pointId === "K2").text, "C");
  assert.equal(pyramid.labels.find((l) => l.pointId === "K4").text, "V");
  assert.ok(segBetween(pyramid, "K0", "K2"));
  assert.equal(pyramid.segments.find((s) => s.id === "edge").a, "K0");
  assert.equal(pyramid.segments.find((s) => s.id === "edge").b, "K2");
  assert.equal(pyramid.rightAngles[0].vertex, "K4");
  assert.equal(pyramid.rightAngles[0].arm1, "K0");
  assert.equal(pyramid.rightAngles[0].arm2, "K2");
  assert.equal(v.id, "K4");
  assert.ok(c);
  assert.equal(validateDiagram(pyramid).ok, true, validateDiagram(pyramid).errors.join("; "));

  const cuboid = applyOps(null, [
    { op: "addShape", kind: "cuboid", x: 20, y: 30, w: 100, idPrefix: "K" },
    { op: "addSegment", id: "span", a: "KC", b: "H" },
  ]);
  assert.equal(cuboid.labels.find((l) => l.pointId === "K2").text, "C");
  assert.equal(cuboid.labels.find((l) => l.pointId === "K7").text, "H");
  const span = cuboid.segments.find((s) => s.id === "span");
  assert.equal(span.a, "K2");
  assert.equal(span.b, "K7");
  assert.equal(validateDiagram(cuboid).ok, true, validateDiagram(cuboid).errors.join("; "));
});

test("a pre-existing point C or KC is not replaced", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "C", x: 5, y: 7 },
    { op: "addPoint", id: "KC", x: 1, y: 2 },
    { op: "addShape", kind: "pyramid", x: 40, y: 40, w: 90, idPrefix: "K" },
    { op: "addSegment", id: "keep", a: "C", b: "K0" },
    { op: "addSegment", id: "owned", a: "KC", b: "K4" },
  ]);
  const c = doc.points.find((p) => p.id === "C");
  const kc = doc.points.find((p) => p.id === "KC");
  assert.equal(doc.points.filter((p) => p.id === "C").length, 1);
  assert.equal(c.x, 5);
  assert.equal(c.y, 7);
  assert.equal(kc.x, 1);
  assert.equal(kc.y, 2);
  assert.ok(doc.points.some((p) => p.id === "K2"));
  assert.equal(doc.segments.find((s) => s.id === "keep").a, "C");
  assert.equal(doc.segments.find((s) => s.id === "keep").b, "K0");
  assert.equal(doc.segments.find((s) => s.id === "owned").a, "KC");
  assert.equal(doc.segments.find((s) => s.id === "owned").b, "K4");
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("suppressed labels still alias the template letter", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "pyramid", x: 0, y: 0, w: 60, idPrefix: "K", labels: false },
    { op: "addSegment", id: "diag", a: "A", b: "C" },
  ]);
  assert.equal(doc.labels.length, 0);
  const seg = doc.segments.find((s) => s.id === "diag");
  assert.equal(seg.a, "K0");
  assert.equal(seg.b, "K2");
});

const CUBE = {
  A: [0, 0, 1],
  B: [1, 0, 1],
  C: [1, 1, 1],
  D: [0, 1, 1],
  E: [0, 0, 0],
  H: [0, 1, 0],
  G: [1, 1, 0],
  F: [1, 0, 0],
};

function edgeStyles(faces) {
  const doc = applyOps(null, [
    {
      op: "add3DPolyhedron",
      origin: [100, 100],
      scale: 30,
      yawDeg: 0,
      pitchDeg: 0,
      idPrefix: "K",
      vertices: CUBE,
      faces,
    },
  ]);
  const map = {};
  for (const s of doc.segments) {
    const a = s.a < s.b ? s.a : s.b;
    const b = s.a < s.b ? s.b : s.a;
    map[`${a}|${b}`] = s.style;
  }
  return { doc, map };
}

test("clockwise and counterclockwise faces both get outward normals", () => {
  const outward = edgeStyles([
    ["A", "B", "C", "D"],
    ["E", "H", "G", "F"],
  ]);
  const mixed = edgeStyles([
    ["D", "C", "B", "A"],
    ["E", "H", "G", "F"],
  ]);
  assert.deepEqual(mixed.map, outward.map);
  assert.equal(mixed.map["KA|KB"], "solid");
  assert.equal(mixed.map["KE|KH"], "dashed");
  assert.equal(validateDiagram(mixed.doc).ok, true, validateDiagram(mixed.doc).errors.join("; "));

  const tilted = applyOps(null, [
    {
      op: "add3DPolyhedron",
      origin: [80, 80],
      scale: 24,
      yawDeg: 35,
      pitchDeg: 20,
      vertices: CUBE,
      faces: [
        ["D", "C", "B", "A"],
        ["F", "G", "H", "E"],
      ],
    },
  ]);
  const ref = applyOps(null, [
    {
      op: "add3DPolyhedron",
      origin: [80, 80],
      scale: 24,
      yawDeg: 35,
      pitchDeg: 20,
      vertices: CUBE,
      faces: [
        ["A", "B", "C", "D"],
        ["E", "H", "G", "F"],
      ],
    },
  ]);
  const styleOf = (doc, a, b) =>
    doc.segments.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a)).style;
  for (const s of ref.segments) {
    assert.equal(styleOf(tilted, s.a, s.b), s.style);
  }
  assert.ok(ref.segments.some((s) => s.style === "dashed"));
  assert.ok(ref.segments.some((s) => s.style === "solid"));
});

function filledMarkers(svg) {
  return [...svg.matchAll(/<circle\b[^>]*\bfill="#111"/g)].length;
}

test("feasible region and mathPoints create hidden vertices and still fill", () => {
  const region = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 260,
      oy: 360,
      unitPx: 36,
      xmin: -1,
      xmax: 6,
      ymin: -1,
      ymax: 7,
    },
    { op: "addPoint", id: "P", x: 12, y: 18 },
    {
      op: "addFeasibleRegion",
      inequalities: ["y <= 1.5x + 3", "2x + 3y <= 22", "y >= 0"],
    },
  ]);
  assert.equal(region.fills.length, 1);
  assert.equal(region.fills[0].pattern, "hatch");
  assert.ok(region.fills[0].pointIds.length >= 3);
  for (const id of region.fills[0].pointIds) {
    const p = region.points.find((q) => q.id === id);
    assert.equal(p.hidden, true, id);
  }
  assert.equal(region.points.find((p) => p.id === "P").hidden, undefined);
  const regionSvg = documentToSvg(region, { hidePoints: false, scale: 1, pad: 20 });
  assert.match(regionSvg, /clipPath/);
  assert.equal(filledMarkers(regionSvg), 1);

  const viaPlot = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "plot1",
      ox: 200,
      oy: 300,
      unitPx: 20,
      xmin: 0,
      xmax: 4,
      ymin: 0,
      ymax: 4,
      feasibleRegion: {
        inequalities: ["x >= 0", "y >= 0", "x <= 3", "y <= 2"],
      },
    },
  ]);
  assert.equal(viaPlot.fills.length, 1);
  assert.ok(viaPlot.fills[0].pointIds.every((id) => viaPlot.points.find((p) => p.id === id).hidden === true));

  const math = applyOps(null, [
    { op: "addCoordPlot", id: "plot1", ox: 100, oy: 300, unitPx: 10 },
    { op: "addPoint", id: "Q", x: 4, y: 4 },
    {
      op: "addFill",
      id: "reg",
      kind: "polygon",
      plotId: "plot1",
      mathPoints: [
        [0, 0],
        [0, 3],
        [2, 6],
        [5, 0],
      ],
      pattern: "hatch",
    },
  ]);
  assert.equal(math.fills.length, 1);
  const verts = math.fills[0].pointIds.map((id) => math.points.find((p) => p.id === id));
  assert.deepEqual(
    verts.map((p) => [p.x, p.y]),
    [
      [100, 300],
      [100, 270],
      [120, 240],
      [150, 300],
    ]
  );
  assert.ok(verts.every((p) => p.hidden === true));
  assert.equal(math.points.find((p) => p.id === "Q").hidden, undefined);
  const mathSvg = documentToSvg(math, { hidePoints: false, scale: 1, pad: 20 });
  assert.match(mathSvg, /clipPath/);
  assert.equal(filledMarkers(mathSvg), 1);

  const explicit = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 30, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 30 },
    { op: "addFill", pointIds: ["A", "B", "C"], opacity: 0.3 },
  ]);
  assert.ok(explicit.points.every((p) => p.hidden == null));
  assert.equal(explicit.fills[0].pointIds.join(","), "A,B,C");
});
