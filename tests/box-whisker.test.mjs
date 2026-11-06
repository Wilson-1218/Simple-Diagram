import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  documentToSvg,
  APP_VERSION,
  STABLE_TOP_LEVEL_KEYS,
  OP_NAMES,
  normalizeBoxWhisker,
  boxWhiskerParts,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for box-whisker", () => {
  assert.equal(APP_VERSION, "13.5.31");
});

test("stable top-level keys include boxWhiskers (36)", () => {
  assert.equal(STABLE_TOP_LEVEL_KEYS.length, 36);
  assert.ok(STABLE_TOP_LEVEL_KEYS.includes("boxWhiskers"));
  const doc = emptyDiagram();
  assert.ok(Array.isArray(doc.boxWhiskers));
  assert.equal(doc.boxWhiskers.length, 0);
  assert.equal(doc.version, APP_VERSION);
});

test("OP_NAMES includes addBoxWhisker and addBoxPlot alias", () => {
  assert.ok(OP_NAMES.includes("addBoxWhisker"));
  assert.ok(OP_NAMES.includes("addBoxPlot"));
});

test("addBoxWhisker persists five-number + caller ticks (unequal spacing)", () => {
  const ticks = [40, 55, 90, 140, 200]; // deliberately unequal gaps
  const doc = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw1",
      y: 200,
      min: 50,
      q1: 80,
      median: 110,
      q3: 150,
      max: 190,
      outliers: [40, 210],
      ticks,
      boxHeight: 40,
    },
  ]);
  assert.equal(doc.boxWhiskers.length, 1);
  const bw = doc.boxWhiskers[0];
  assert.equal(bw.id, "bw1");
  assert.equal(bw.orientation, "h");
  assert.equal(bw.min, 50);
  assert.equal(bw.q1, 80);
  assert.equal(bw.median, 110);
  assert.equal(bw.q3, 150);
  assert.equal(bw.max, 190);
  assert.deepEqual(bw.outliers, [40, 210]);
  assert.deepEqual(bw.ticks, ticks);
  assert.equal(bw.showAxis, true);

  const v = validateDiagram(doc);
  assert.equal(v.ok, true, v.errors && v.errors.join("; "));

  const parts = boxWhiskerParts(bw);
  assert.equal(parts.tickMarks.length, ticks.length);
  // Tick x positions are exactly caller values — no equal-spacing invent
  const tickXs = parts.tickMarks.map((t) => t.x1).sort((a, b) => a - b);
  assert.deepEqual(tickXs, [...ticks].sort((a, b) => a - b));

  const svg = documentToSvg(doc);
  assert.match(svg, /<rect\b/);
  assert.match(svg, /<circle\b/); // outliers
  // median + whiskers + caps + axis + ticks → many lines
  assert.ok((svg.match(/<line\b/g) || []).length >= 6);
});

test("addBoxPlot alias + vertical orientation", () => {
  const doc = applyOps(null, [
    {
      op: "addBoxPlot",
      id: "bwv",
      orientation: "v",
      x: 120,
      min: 30,
      q1: 60,
      median: 90,
      q3: 130,
      max: 160,
      ticks: [30, 60, 160],
    },
  ]);
  const bw = doc.boxWhiskers[0];
  assert.equal(bw.orientation, "v");
  assert.equal(bw.x, 120);
  const parts = boxWhiskerParts(bw);
  assert.equal(parts.tickMarks.length, 3);
  assert.equal(parts.axis.x1, parts.axis.x2);
});

test("addBoxWhisker rejects unordered summary", () => {
  assert.throws(
    () =>
      applyOps(null, [
        {
          op: "addBoxWhisker",
          y: 100,
          min: 10,
          q1: 40,
          median: 30,
          q3: 50,
          max: 60,
        },
      ]),
    /min≤q1≤median≤q3≤max/
  );
});

test("normalizeBoxWhisker: no ticks ⇒ showAxis false by default", () => {
  const bw = normalizeBoxWhisker({
    id: "n",
    y: 10,
    min: 1,
    q1: 2,
    median: 3,
    q3: 4,
    max: 5,
  });
  assert.equal(bw.showAxis, false);
  assert.deepEqual(bw.ticks, []);
  assert.equal(boxWhiskerParts(bw).tickMarks.length, 0);
  assert.equal(boxWhiskerParts(bw).axis, null);
});

test("remove boxWhisker", () => {
  const doc = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "rm",
      y: 50,
      min: 1,
      q1: 2,
      median: 3,
      q3: 4,
      max: 5,
    },
    { op: "remove", type: "boxWhisker", id: "rm" },
  ]);
  assert.equal(doc.boxWhiskers.length, 0);
});
