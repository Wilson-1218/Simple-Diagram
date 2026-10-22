/**
 * HKDSE-style regression evals: macros/templates → validate → summarize → SVG.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
  runMacro,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "examples/eval-out");

function assertExamDoc(doc, label) {
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, `${label}: ${v.errors.join("; ")}`);
  assert.ok(doc.points.length >= 3, `${label}: points`);
  const sum = summarizeDiagram(doc);
  assert.ok(sum.counts.points >= 3);
  const svg = documentToSvg(doc, { scale: 2 });
  assert.ok(svg.includes("<svg"), `${label}: svg`);
  assert.ok(svg.includes("#111") || svg.includes("stroke"), `${label}: ink`);
  return { v, sum, svg };
}

test("eval: drawRightTriangle macro", () => {
  const { doc, ops } = runMacro("drawRightTriangle", {
    a: 120,
    b: 90,
    apply: true,
  });
  assert.ok(ops.length >= 7);
  assertExamDoc(doc, "right-tri");
});

test("eval: drawFrustum + drawCuboid templates", () => {
  const fru = runMacro("drawFrustum", { apply: true }).doc;
  assertExamDoc(fru, "frustum");
  assert.equal(fru.points.length, 8);
  const box = runMacro("drawCuboid", { apply: true }).doc;
  assertExamDoc(box, "cuboid");
});

test("eval: drawCircleWithTangent", () => {
  const { doc } = runMacro("drawCircleWithTangent", {
    r: 60,
    halfLen: 40,
    cx: 200,
    cy: 180,
    apply: true,
  });
  assert.equal(doc.circles.length, 1);
  assertExamDoc(doc, "circle-tan");
});

test("eval: insertTemplate plane+solid pack", () => {
  const doc = applyOps(null, [
    { op: "insertTemplate", id: "rightTri", dx: -120 },
    { op: "insertTemplate", id: "frustum", dx: 120 },
    { op: "setMeta", name: "eval-pack.json", hideExportPoints: true },
  ]);
  assert.ok(doc.points.length >= 3);
  assert.ok(doc.segments.length >= 3);
  assertExamDoc(doc, "pack");
});

test("eval: write demo SVG fixtures", () => {
  mkdirSync(outDir, { recursive: true });
  const demos = [
    ["demo-right-triangle", runMacro("drawRightTriangle", { a: 160, b: 120, apply: true }).doc],
    ["demo-frustum", runMacro("drawFrustum", { apply: true }).doc],
  ];
  for (const [name, doc] of demos) {
    const { svg } = assertExamDoc(doc, name);
    writeFileSync(resolve(outDir, `${name}.svg`), svg, "utf8");
    writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(doc, null, 2) + "\n", "utf8");
  }
});
