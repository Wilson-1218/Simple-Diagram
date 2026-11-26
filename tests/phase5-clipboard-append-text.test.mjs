import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  STABLE_TOP_LEVEL_KEYS,
  applyOps,
  documentToSvg,
  emptyDiagram,
  validateDiagram,
  summarizeDiagram,
  OP_NAMES,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for phase5 clipboard/append/addText", () => {
  assert.equal(APP_VERSION, "13.5.51");
});

test("stable top-level keys include texts (38)", () => {
  assert.equal(STABLE_TOP_LEVEL_KEYS.length, 38);
  assert.ok(STABLE_TOP_LEVEL_KEYS.includes("texts"));
  const doc = emptyDiagram();
  assert.ok(Array.isArray(doc.texts));
  assert.equal(doc.texts.length, 0);
  assert.equal(doc.version, APP_VERSION);
});

test("addText / addCaption free-floating; export + validate", () => {
  assert.ok(OP_NAMES.includes("addText"));
  assert.ok(OP_NAMES.includes("addCaption"));
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 100, y: 100 },
    { op: "addText", id: "cap", x: 200, y: 60, text: "圖一", align: "left", bold: true, size: 18 },
    { op: "addCaption", id: "cap2", x: 220, y: 90, text: "note" },
  ]);
  assert.equal(doc.texts.length, 2);
  const t0 = doc.texts.find((x) => x.id === "cap");
  assert.ok(t0);
  assert.equal(t0.x, 200);
  assert.equal(t0.y, 60);
  assert.equal(t0.text, "圖一");
  assert.equal(t0.align, "left");
  assert.equal(t0.bold, true);
  assert.equal(t0.size, 18);
  const t1 = doc.texts.find((x) => x.id === "cap2");
  assert.ok(t1);
  assert.equal(t1.align, "center");
  assert.equal(t1.bold, false);
  // not bound to a point
  assert.equal(t0.pointId, undefined);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, (v.errors || []).join("; "));
  const svg = documentToSvg(doc, { scale: 2 });
  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /圖一/);
  assert.match(svg, /text-anchor="start"/);
  assert.match(svg, /font-weight="bold"/);
  assert.match(svg, /note/);
  const sum = summarizeDiagram(doc);
  assert.equal(sum.counts.texts, 2);
});

test("append ops onto existing doc without clearing (batch applyOps)", () => {
  const base = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 80, y: 0 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
  ]);
  assert.equal(base.points.length, 2);
  assert.equal(base.segments.length, 1);
  const merged = applyOps(base, [
    { op: "addText", id: "title", x: 40, y: -20, text: "AB" },
    { op: "addPoint", id: "C", x: 40, y: 60 },
  ]);
  assert.equal(merged.points.length, 3);
  assert.equal(merged.segments.length, 1);
  assert.equal(merged.texts.length, 1);
  assert.equal(merged.texts[0].text, "AB");
  assert.ok(merged.points.find((p) => p.id === "A"));
  assert.ok(merged.points.find((p) => p.id === "C"));
});

test("remove type text", () => {
  const doc = applyOps(null, [
    { op: "addText", id: "t1", x: 1, y: 2, text: "x" },
    { op: "remove", type: "text", id: "t1" },
  ]);
  assert.equal(doc.texts.length, 0);
});
