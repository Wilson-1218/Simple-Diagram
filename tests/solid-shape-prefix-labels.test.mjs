import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, validateDiagram, APP_VERSION } from "../src/diagram/index.mjs";

const CUBE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

test("APP_VERSION bumped for solid shape prefix/labels", () => {
  assert.equal(APP_VERSION, "13.5.40");
});

test("addShape cube default still emits A..H on auto ids", () => {
  const doc = applyOps(null, [{ op: "addShape", kind: "cube", x: 0, y: 0, w: 40 }]);
  assert.deepEqual(
    doc.labels.map((l) => l.text),
    CUBE_LETTERS
  );
  assert.ok(doc.points.every((p) => /^p_/.test(p.id)));
  assert.ok(doc.segments.every((s) => /^s_/.test(s.id)));
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("addShape solid idPrefix prefixes vertex and segment ids", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "cube", x: 40, y: 40, w: 100, idPrefix: "K" },
  ]);
  assert.deepEqual(
    doc.points.map((p) => p.id),
    ["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7"]
  );
  assert.deepEqual(
    doc.segments.map((s) => s.id),
    Array.from({ length: 12 }, (_, i) => `Ks${i}`)
  );
  assert.deepEqual(
    doc.labels.map((l) => l.text),
    CUBE_LETTERS
  );
  assert.ok(doc.labels.every((l, i) => l.pointId === `K${i}`));
  assert.ok(doc.labels.every((l) => /^lab_/.test(l.id)));
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

test("addShape solid labels:false or label:false skips vertex letters", () => {
  const byLabels = applyOps(null, [
    { op: "addShape", kind: "cube", x: 0, y: 0, w: 80, labels: false },
  ]);
  assert.equal(byLabels.labels.length, 0);
  assert.equal(byLabels.points.length, 8);
  assert.ok(byLabels.segments.some((s) => s.style === "dashed"));
  assert.ok(byLabels.points.every((p) => /^p_/.test(p.id)));

  const byLabel = applyOps(null, [
    { op: "addShape", kind: "frustum", x: 10, y: 10, w: 90, label: false },
  ]);
  assert.equal(byLabel.labels.length, 0);
  assert.equal(byLabel.points.length, 8);
  assert.ok(byLabel.segments.length >= 8);

  const falseWins = applyOps(null, [
    {
      op: "addShape",
      kind: "tetra",
      x: 0,
      y: 0,
      w: 70,
      idPrefix: "T",
      label: false,
      labels: ["P", "Q", "R", "S"],
    },
  ]);
  assert.equal(falseWins.labels.length, 0);
  assert.deepEqual(
    falseWins.points.map((p) => p.id),
    ["T0", "T1", "T2", "T3"]
  );

  const labelsFalseWins = applyOps(null, [
    {
      op: "addShape",
      kind: "cube",
      x: 0,
      y: 0,
      w: 60,
      idPrefix: "A",
      labels: false,
      label: true,
    },
  ]);
  assert.equal(labelsFalseWins.labels.length, 0);
  assert.equal(labelsFalseWins.points[0].id, "A0");
  assert.equal(labelsFalseWins.segments[0].id, "As0");
});

test("addShape cylinder idPrefix covers construction points; letters stay until opted out", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "cylinder", x: 0, y: 0, w: 80, idPrefix: "Y" },
  ]);
  assert.deepEqual(
    doc.points.map((p) => p.id),
    ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"]
  );
  assert.deepEqual(
    doc.segments.map((s) => s.id),
    ["Ys0", "Ys1", "Ys2"]
  );
  assert.equal(doc.labels.length, 2);
  assert.equal(doc.labels[0].text, "O");
  assert.equal(doc.labels[0].pointId, "Y0");
  assert.equal(doc.labels[1].pointId, "Y4");
  assert.equal(doc.ellipses.length, 2);
  assert.equal(doc.ellipses[0].centerId, "Y0");
  assert.equal(doc.ellipses[0].rxId, "Y1");
  assert.equal(doc.ellipses[1].centerId, "Y4");
  assert.ok(/^ell_/.test(doc.ellipses[0].id));

  const quiet = applyOps(null, [
    { op: "addShape", kind: "cylinder", x: 0, y: 0, w: 80, labels: false },
    { op: "addShape", kind: "cone", x: 200, y: 0, w: 80, label: false, idPrefix: "N" },
  ]);
  assert.equal(quiet.labels.length, 0);
  assert.ok(quiet.points.some((p) => p.id === "N0"));
  assert.ok(quiet.segments.some((s) => s.id === "Ns0"));
  assert.equal(validateDiagram(quiet).ok, true, validateDiagram(quiet).errors.join("; "));
});

test("addShape solid labels array overrides template letters", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "cube", x: 0, y: 0, w: 50, idPrefix: "C", labels: ["P", "Q"] },
  ]);
  assert.deepEqual(doc.labels.map((l) => l.text), ["P", "Q", "C", "D", "E", "F", "G", "H"]);
  assert.equal(doc.labels[0].pointId, "C0");
});

test("insertTemplate ignores addShape idPrefix and label flags", () => {
  const doc = applyOps(null, [{ op: "insertTemplate", id: "cube" }]);
  assert.equal(doc.labels.length, 8);
  assert.ok(doc.points.every((p) => /^p_/.test(p.id)));
  assert.ok(doc.segments.every((s) => /^s_/.test(s.id)));
});
