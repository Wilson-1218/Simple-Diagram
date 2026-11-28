import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
  validateDiagram,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for phase4 hidden points", () => {
  assert.equal(APP_VERSION, "13.5.63");
});

test("hidden:true on addPoint / construction ops stays in doc.points", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addPoint", id: "H", x: 50, y: 80, hidden: true },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", id: "M", segmentId: "AB", hidden: true },
    { op: "addRatioPoint", id: "G", a: "A", b: "B", t: 0.25, hidden: true },
    {
      op: "addPoint",
      id: "C",
      x: 50,
      y: -100,
    },
    { op: "addSegment", id: "AC", a: "A", b: "C" },
    {
      op: "addIntersection",
      id: "X",
      of1: "AB",
      of2: { type: "line", a: "C", b: "H" },
      hidden: true,
    },
  ]);
  const h = doc.points.find((p) => p.id === "H");
  const m = doc.points.find((p) => p.id === "M");
  const g = doc.points.find((p) => p.id === "G");
  const x = doc.points.find((p) => p.id === "X");
  assert.ok(h && h.hidden === true);
  assert.ok(m && m.hidden === true && m.x === 50 && m.y === 0);
  assert.ok(g && g.hidden === true && g.x === 25);
  assert.ok(x && x.hidden === true);
  assert.equal(doc.points.find((p) => p.id === "A").hidden, undefined);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true);
});

test("hidden points are omitted from SVG export markers", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 10, y: 20 },
    { op: "addPoint", id: "B", x: 110, y: 20 },
    { op: "addPoint", id: "H", x: 60, y: 90, hidden: true },
    { op: "addMidpoint", id: "M", a: "A", b: "B", hidden: true },
  ]);
  const svg = documentToSvg(doc, { scale: 1, pad: 0, hidePoints: false });
  // SVG translates by bounds min; A→(0,0), B→(100,0); H/M must not appear as markers.
  const circles = [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(
    (m) => ({ cx: Number(m[1]), cy: Number(m[2]) })
  );
  assert.equal(circles.length, 2, `expected 2 point markers, got ${circles.length}`);
  const near = (a, b) => Math.abs(a - b) < 0.5;
  assert.ok(
    circles.some((c) => near(c.cx, 0) && near(c.cy, 0)),
    "A marker (translated)"
  );
  assert.ok(
    circles.some((c) => near(c.cx, 100) && near(c.cy, 0)),
    "B marker (translated)"
  );
  // H world (60,90) → screen (50,70); M world (60,20) → screen (50,0)
  assert.ok(
    !circles.some((c) => near(c.cx, 50) && near(c.cy, 70)),
    "H must not render"
  );
  assert.ok(
    !circles.some((c) => near(c.cx, 50) && near(c.cy, 0)),
    "M must not render"
  );
});

test("hidden:false / omitted defaults to visible", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0, hidden: false },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addMidpoint", id: "M", a: "A", b: "B" },
  ]);
  assert.equal(doc.points.find((p) => p.id === "A").hidden, undefined);
  assert.equal(doc.points.find((p) => p.id === "M").hidden, undefined);
  const svg = documentToSvg(doc, { scale: 1, pad: 0, hidePoints: false });
  const n = [...svg.matchAll(/<circle cx="/g)].length;
  assert.equal(n, 3);
});

test("hidden point still usable as segment endpoint", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "P", x: 30, y: 40, hidden: true },
    { op: "addSegment", id: "AP", a: "A", b: "P" },
    { op: "addLabel", pointId: "P", text: "P", ox: 10, oy: -12 },
  ]);
  assert.equal(doc.segments.length, 1);
  assert.equal(doc.labels.length, 1);
  assert.equal(validateDiagram(doc).ok, true);
});
