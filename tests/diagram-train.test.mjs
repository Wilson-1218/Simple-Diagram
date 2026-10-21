/**
 * Mensuration AI train pack: each golden ops → validate → SVG.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trainDir = join(root, "examples/train");

function caseDirs() {
  const idxPath = join(trainDir, "index.json");
  if (existsSync(idxPath)) {
    const idx = JSON.parse(readFileSync(idxPath, "utf8"));
    return idx.cases || [];
  }
  return readdirSync(trainDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

test("train pack index has 10 cases + seed", () => {
  const idx = JSON.parse(readFileSync(join(trainDir, "index.json"), "utf8"));
  assert.equal(idx.seed, 20261021);
  assert.equal(idx.cases.length, 10);
  assert.ok(idx.sourcePdf.includes("Mensuration"));
});

test("train pack: each case ops validate + SVG", () => {
  const cases = caseDirs();
  assert.equal(cases.length, 10, `expected 10 cases, got ${cases.length}`);
  for (const id of cases) {
    const dir = join(trainDir, id);
    const raw = JSON.parse(readFileSync(join(dir, "ops.json"), "utf8"));
    const ops = Array.isArray(raw) ? raw : raw.ops;
    const doc = applyOps(null, ops);
    const v = validateDiagram(doc);
    assert.equal(v.ok, true, `${id}: ${v.errors.join("; ")}`);
    assert.ok(doc.points.length >= 3, `${id}: points`);
    const sum = summarizeDiagram(doc);
    assert.ok(sum.counts.points >= 3, `${id}: summary`);
    const svg = documentToSvg(doc, { scale: 2 });
    assert.ok(svg.includes("<svg"), `${id}: svg`);
    assert.ok(existsSync(join(dir, "prompt.md")), `${id}: prompt`);
    assert.ok(existsSync(join(dir, "meta.json")), `${id}: meta`);
    assert.ok(existsSync(join(dir, "target.svg")), `${id}: target.svg`);
  }
});
