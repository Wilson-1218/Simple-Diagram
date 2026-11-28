import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION, applyOps, validateDiagram } from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.54", () => {
  assert.equal(APP_VERSION, "13.5.54");
});

function labelAt(doc, id) {
  const lab = doc.labels.find((l) => l.pointId === id);
  assert.ok(lab, id);
  return lab;
}

function strictlyInside(p, a, b, c) {
  function cross(u, v, w) {
    return (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  }
  const c1 = cross(a, b, p);
  const c2 = cross(b, c, p);
  const c3 = cross(c, a, p);
  const pos = c1 > 1e-6 && c2 > 1e-6 && c3 > 1e-6;
  const neg = c1 < -1e-6 && c2 < -1e-6 && c3 < -1e-6;
  return pos || neg;
}

test("triangle vertex labels with omitted ox/oy sit outside the triangle", () => {
  const A = { x: 0, y: 0 };
  const B = { x: 200, y: 0 };
  const C = { x: 40, y: 160 };
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", ...A },
    { op: "addPoint", id: "B", ...B },
    { op: "addPoint", id: "C", ...C },
    { op: "addLabel", pointId: "A", text: "A" },
    { op: "addLabel", pointId: "B", text: "B" },
    { op: "addLabel", pointId: "C", text: "C" },
    { op: "addSegment", a: "A", b: "B" },
    { op: "addSegment", a: "B", b: "C" },
    { op: "addSegment", a: "C", b: "A" },
  ]);
  const g = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  for (const id of ["A", "B", "C"]) {
    const p = doc.points.find((q) => q.id === id);
    const lab = labelAt(doc, id);
    assert.equal(lab._autoOffset, true, id);
    assert.equal(lab.autoOffset, true, id);
    const at = { x: p.x + lab.ox, y: p.y + lab.oy };
    assert.equal(strictlyInside(at, A, B, C), false, `${id} label fell inside`);
    const outward = (p.x - g.x) * lab.ox + (p.y - g.y) * lab.oy;
    assert.ok(outward > 0, `${id} offset points inward (${lab.ox}, ${lab.oy})`);
  }
  assert.equal(validateDiagram(doc).ok, true);
});

test("addPoint label:true then addSegment yields an outward offset", () => {
  let doc = applyOps(null, [{ op: "addPoint", id: "A", x: 0, y: 0, label: true }]);
  assert.equal(labelAt(doc, "A").text, "A");
  assert.deepEqual([labelAt(doc, "A").ox, labelAt(doc, "A").oy], [0, -14]);
  assert.equal(labelAt(doc, "A")._autoOffset, true);

  const saved = JSON.parse(JSON.stringify(doc));
  assert.equal(saved.labels[0].autoOffset, true);
  assert.equal(saved.labels[0]._autoOffset, undefined);
  doc = applyOps(saved, [
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  const lab = labelAt(doc, "A");
  assert.equal(lab.ox, -16);
  assert.equal(lab.oy, 0);
  assert.equal(lab._autoOffset, true);

  const same = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0, label: true },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  assert.equal(labelAt(same, "A").ox, -16);
  assert.equal(labelAt(same, "A").oy, 0);
});

test("explicit numeric ox/oy is unchanged after later segments and reload", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addLabel", pointId: "A", text: "A", ox: 5, oy: -9 },
    { op: "addPoint", id: "B", x: 80, y: 30 },
    { op: "addPoint", id: "C", x: -20, y: 70 },
    { op: "addSegment", a: "A", b: "B" },
    { op: "addSegment", a: "A", b: "C" },
  ]);
  const lab = labelAt(doc, "A");
  assert.equal(lab.ox, 5);
  assert.equal(lab.oy, -9);
  assert.equal(lab._autoOffset, false);
  assert.equal(lab.autoOffset, undefined);

  const saved = JSON.parse(JSON.stringify(doc));
  assert.equal(saved.labels[0]._autoOffset, undefined);
  assert.equal(saved.labels[0].autoOffset, undefined);
  assert.equal(saved.labels[0].ox, 5);
  assert.equal(saved.labels[0].oy, -9);
  const again = applyOps(saved, [
    { op: "addPoint", id: "D", x: 10, y: -40 },
    { op: "addSegment", a: "A", b: "D" },
  ]);
  assert.equal(labelAt(again, "A").ox, 5);
  assert.equal(labelAt(again, "A").oy, -9);
  assert.notEqual(labelAt(again, "A")._autoOffset, true);

  const zero = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addLabel", pointId: "A", text: "A", ox: 0, oy: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  assert.equal(labelAt(zero, "A").ox, 0);
  assert.equal(labelAt(zero, "A").oy, 0);
  assert.equal(labelAt(zero, "A")._autoOffset, false);

  const partial = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addLabel", pointId: "A", text: "A", oy: 4 },
    { op: "addPoint", id: "B", x: 50, y: 10 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  assert.equal(labelAt(partial, "A").ox, 0);
  assert.equal(labelAt(partial, "A").oy, 4);
  assert.equal(labelAt(partial, "A")._autoOffset, false);

  const locked = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addLabel", pointId: "A", text: "A", ox: 3, oy: 1, auto: true, autoOffset: true },
    { op: "addPoint", id: "B", x: 90, y: 0 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  assert.equal(labelAt(locked, "A").ox, 3);
  assert.equal(labelAt(locked, "A").oy, 1);
  assert.equal(labelAt(locked, "A")._autoOffset, false);
});

test("hidden points skip label:true; a non-empty string still labels", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "H", x: 0, y: 0, hidden: true, label: true },
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 40, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 30 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "CD", a: "C", b: "A" },
    { op: "addMidpoint", a: "A", b: "B", id: "M", hidden: true, label: "M" },
    { op: "addRatioPoint", a: "A", b: "B", id: "R", t: 0.25, hidden: true, label: true },
    {
      op: "addIntersection",
      id: "X",
      of1: "AB",
      of2: { type: "line", a: "C", b: "B" },
      hidden: true,
      label: true,
    },
    {
      op: "addTriangleCenter",
      kind: "centroid",
      a: "A",
      b: "B",
      c: "C",
      id: "G",
      hidden: true,
      label: true,
    },
  ]);
  assert.equal(doc.labels.length, 1);
  assert.equal(doc.labels[0].pointId, "M");
  assert.equal(doc.labels[0].text, "M");
  for (const id of ["H", "M", "R", "X", "G"]) {
    const p = doc.points.find((q) => q.id === id);
    assert.ok(p, id);
    assert.equal(p.hidden, true, id);
  }
  assert.equal(validateDiagram(doc).ok, true);
});

test("inline label strings, circle outward, gap tie, and stored auto flag", () => {
  const mid = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addMidpoint", id: "M", segmentId: "AB", label: "M", markEqual: true },
  ]);
  assert.equal(labelAt(mid, "M").text, "M");
  assert.equal(labelAt(mid, "M").ox, 0);
  assert.equal(labelAt(mid, "M").oy, -16);

  const cir = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "P", x: 100, y: 0 },
    { op: "addCircle", centerId: "O", throughId: "P" },
    { op: "addLabel", pointId: "P", text: "P", offsetDist: 20 },
  ]);
  assert.equal(labelAt(cir, "P").ox, 20);
  assert.equal(labelAt(cir, "P").oy, 0);
  assert.equal(labelAt(cir, "P").offsetDist, 20);

  const rebuilt = JSON.parse(JSON.stringify(cir));
  delete rebuilt.labels[0]._autoOffset;
  rebuilt.labels[0].ox = 0;
  rebuilt.labels[0].oy = 0;
  const again = applyOps(rebuilt, []);
  assert.equal(labelAt(again, "P")._autoOffset, true);
  assert.equal(labelAt(again, "P").ox, 20);
  assert.equal(labelAt(again, "P").oy, 0);

  const sugar = applyOps(null, [
    { op: "addPoint", id: "A", x: 10, y: 10, label: true, labelOx: 4, labelOy: -3 },
    { op: "addPoint", id: "B", x: 80, y: 10 },
    { op: "addSegment", a: "A", b: "B" },
  ]);
  assert.equal(labelAt(sugar, "A").ox, 4);
  assert.equal(labelAt(sugar, "A").oy, -3);
  assert.equal(labelAt(sugar, "A")._autoOffset, false);

  const named = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 30, y: 0 },
    { op: "addRatioPoint", a: "A", b: "B", id: "R", t: 0.5, label: "R" },
  ]);
  assert.equal(labelAt(named, "R").text, "R");
  assert.equal(labelAt(named, "R")._autoOffset, true);
  assert.equal(docLabels(named), 1);
});

function docLabels(doc) {
  return doc.labels.length;
}
