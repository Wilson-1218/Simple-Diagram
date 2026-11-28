import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  OP_NAMES,
  validateDiagram,
} from "../src/diagram/index.mjs";

test("APP_VERSION still current after phase3 construction ops", () => {
  assert.equal(APP_VERSION, "13.5.55");
});

test("OP_NAMES includes construction ops", () => {
  for (const name of ["addMidpoint", "addRatioPoint", "addIntersection"]) {
    assert.ok(OP_NAMES.includes(name), name);
  }
});

test("addMidpoint + markEqual creates equal-marked subsegments", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    {
      op: "addMidpoint",
      id: "M",
      segmentId: "AB",
      markEqual: true,
      equalGroup: 0,
    },
  ]);
  const m = doc.points.find((p) => p.id === "M");
  assert.ok(m);
  assert.equal(m.x, 50);
  assert.equal(m.y, 0);
  // Subsegments A–M and M–B exist
  const am = doc.segments.find(
    (s) => (s.a === "A" && s.b === "M") || (s.a === "M" && s.b === "A")
  );
  const mb = doc.segments.find(
    (s) => (s.a === "M" && s.b === "B") || (s.a === "B" && s.b === "M")
  );
  assert.ok(am, "AM segment");
  assert.ok(mb, "MB segment");
  assert.equal(doc.equalMarks.length, 2);
  const groups = doc.equalMarks.map((e) => e.group);
  assert.deepEqual(groups, [0, 0]);
  const marked = new Set(doc.equalMarks.map((e) => e.segmentId));
  assert.ok(marked.has(am.id));
  assert.ok(marked.has(mb.id));
  assert.equal(validateDiagram(doc).ok, true);
});

test("addRatioPoint m:n and t extension", () => {
  const mn = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 90, y: 0 },
    { op: "addRatioPoint", id: "G", a: "A", b: "B", m: 2, n: 1 },
  ]);
  // P = (nA + mB)/(m+n) = (1·A + 2·B)/3 → t=2/3 → x=60
  const g = mn.points.find((p) => p.id === "G");
  assert.ok(g);
  assert.ok(Math.abs(g.x - 60) < 1e-9);
  assert.equal(g.y, 0);

  const tExt = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 10 },
    { op: "addPoint", id: "B", x: 100, y: 10 },
    { op: "addRatioPoint", id: "P", a: "A", b: "B", t: 1.5 },
  ]);
  const p = tExt.points.find((x) => x.id === "P");
  assert.ok(Math.abs(p.x - 150) < 1e-9);
  assert.equal(p.y, 10);

  // t wins over m:n
  const both = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addRatioPoint", id: "Q", a: "A", b: "B", m: 1, n: 1, t: 0.25 },
  ]);
  assert.ok(Math.abs(both.points.find((x) => x.id === "Q").x - 25) < 1e-9);
});

test("addIntersection line×line with extendLines", () => {
  const base = [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 10, y: 0 },
    { op: "addPoint", id: "C", x: 5, y: -20 },
    { op: "addPoint", id: "D", x: 5, y: -10 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "CD", a: "C", b: "D" },
  ];
  // Infinite lines meet at (5,0) — outside CD segment
  const ext = applyOps(null, [
    ...base,
    { op: "addIntersection", id: "X", of1: "AB", of2: "CD" },
  ]);
  const x = ext.points.find((p) => p.id === "X");
  assert.ok(x);
  assert.ok(Math.abs(x.x - 5) < 1e-9);
  assert.ok(Math.abs(x.y - 0) < 1e-9);

  // Without extend: no hit on CD [0,1] → warn + skip
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    const noExt = applyOps(null, [
      ...base,
      { op: "addIntersection", id: "Y", of1: "AB", of2: "CD", extendLines: false },
    ]);
    assert.equal(
      noExt.points.find((p) => p.id === "Y"),
      undefined
    );
    assert.ok(warns.length >= 1);
  } finally {
    console.warn = orig;
  }

  // Inline line of
  const inline = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 20, y: 0 },
    { op: "addPoint", id: "C", x: 10, y: -10 },
    { op: "addPoint", id: "D", x: 10, y: 10 },
    {
      op: "addIntersection",
      id: "I",
      of1: { type: "line", a: "A", b: "B" },
      of2: { type: "line", a: "C", b: "D" },
    },
  ]);
  const i = inline.points.find((p) => p.id === "I");
  assert.ok(Math.abs(i.x - 10) < 1e-9 && Math.abs(i.y - 0) < 1e-9);
});

test("addIntersection line×circle avoidPointId", () => {
  // Circle r=50; horizontal line y=30 → hits at x=±40
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "R", x: 50, y: 0 },
    { op: "addCircle", id: "c1", centerId: "O", throughId: "R" },
    { op: "addPoint", id: "L0", x: -60, y: 30 },
    { op: "addPoint", id: "L1", x: 60, y: 30 },
    { op: "addSegment", id: "L", a: "L0", b: "L1" },
    { op: "addPoint", id: "Near", x: 40, y: 30 },
    {
      op: "addIntersection",
      id: "D",
      of1: "L",
      of2: "c1",
      avoidPointId: "Near",
    },
  ]);
  const d = doc.points.find((p) => p.id === "D");
  assert.ok(d);
  // avoid Near(40,30) → pick left (−40, 30)
  assert.ok(d.x < 0, `expected left hit, got x=${d.x}`);
  assert.ok(Math.abs(d.y - 30) < 1e-6);
  assert.ok(Math.abs(Math.abs(d.x) - 40) < 1e-6);
});

test("addIntersection circle×circle pick", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "O1", x: 0, y: 0 },
    { op: "addPoint", id: "R1", x: 50, y: 0 },
    { op: "addCircle", id: "c1", centerId: "O1", throughId: "R1" },
    { op: "addPoint", id: "O2", x: 60, y: 0 },
    { op: "addPoint", id: "R2", x: 110, y: 0 },
    { op: "addCircle", id: "c2", centerId: "O2", throughId: "R2" },
    {
      op: "addIntersection",
      id: "Top",
      of1: "c1",
      of2: "c2",
      pick: "top",
    },
  ]);
  const top = doc.points.find((p) => p.id === "Top");
  assert.ok(top);
  // Two intersections symmetric about x-axis; top = smaller y
  assert.ok(top.y < 0, `pick:top should be above (smaller y), got y=${top.y}`);

  const both = applyOps(null, [
    { op: "addPoint", id: "O1", x: 0, y: 0 },
    { op: "addPoint", id: "R1", x: 50, y: 0 },
    { op: "addCircle", id: "c1", centerId: "O1", throughId: "R1" },
    { op: "addPoint", id: "O2", x: 60, y: 0 },
    { op: "addPoint", id: "R2", x: 110, y: 0 },
    { op: "addCircle", id: "c2", centerId: "O2", throughId: "R2" },
    {
      op: "addIntersection",
      id: "P0",
      id2: "P1",
      of1: "c1",
      of2: "c2",
    },
  ]);
  const p0 = both.points.find((p) => p.id === "P0");
  const p1 = both.points.find((p) => p.id === "P1");
  assert.ok(p0 && p1);
  // Stable: same x (within 1e-4) → y ascending
  assert.ok(p0.y <= p1.y + 1e-9);
  assert.ok(Math.abs(p0.x - p1.x) < 1e-4);
});

test("construction points usable by addSegment / addCircle / addLabel", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 80, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 60 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", id: "M", segmentId: "AB" },
    { op: "addRatioPoint", id: "G", a: "A", b: "C", t: 0.5 },
    {
      op: "addIntersection",
      id: "X",
      of1: { type: "line", a: "M", b: "C" },
      of2: { type: "line", a: "G", b: "B" },
    },
    { op: "addSegment", id: "MX", a: "M", b: "X" },
    { op: "addCircle", id: "cx", centerId: "X", throughId: "M" },
    { op: "addLabel", pointId: "X", text: "X" },
    { op: "addAngleArc", vertex: "X", arm1: "M", arm2: "G" },
  ]);
  assert.ok(doc.points.find((p) => p.id === "X"));
  assert.ok(doc.segments.find((s) => s.id === "MX"));
  assert.ok(doc.circles.find((c) => c.id === "cx"));
  assert.ok(doc.labels.some((l) => l.pointId === "X"));
  assert.ok(doc.angleArcs.some((a) => a.vertex === "X"));
  assert.equal(validateDiagram(doc).ok, true);
});
