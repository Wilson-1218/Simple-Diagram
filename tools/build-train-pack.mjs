#!/usr/bin/env node
/**
 * Build / refresh examples/train/* golden.json, target.svg, summary.json from ops.json.
 * Usage: node tools/build-train-pack.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trainDir = join(root, "examples/train");

function loadOps(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(raw) ? raw : raw.ops;
}

function buildCase(id) {
  const dir = join(trainDir, id);
  const opsPath = join(dir, "ops.json");
  const ops = loadOps(opsPath);
  const doc = applyOps(null, ops);
  const v = validateDiagram(doc);
  if (!v.ok) {
    throw new Error(`${id}: validate failed: ${v.errors.join("; ")}`);
  }
  const sum = summarizeDiagram(doc);
  const svg = documentToSvg(doc, { scale: 2 });
  writeFileSync(join(dir, "golden.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(join(dir, "summary.json"), JSON.stringify(sum, null, 2) + "\n");
  writeFileSync(join(dir, "target.svg"), svg);
  return { id, points: doc.points.length, ok: true };
}

const cases = readdirSync(trainDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort();

if (!cases.length) {
  console.error("No train case folders under examples/train/");
  process.exit(1);
}

const results = cases.map(buildCase);
writeFileSync(
  join(trainDir, "index.json"),
  JSON.stringify(
    {
      version: "1",
      description: "HKDSE-style AI train / eval pack (ops → SVG)",
      cases: results.map((r) => r.id),
    },
    null,
    2
  ) + "\n"
);
console.log(`Built ${results.length} cases:`);
for (const r of results) console.log(`  ${r.id} (${r.points} pts)`);
