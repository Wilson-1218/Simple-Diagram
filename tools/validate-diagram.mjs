#!/usr/bin/env node
/**
 * Validate a Simple Diagram JSON file.
 *   node tools/validate-diagram.mjs path/to/diagram.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateDiagram } from "../src/diagram/index.mjs";

const path = process.argv[2];
if (!path || path === "-h" || path === "--help") {
  console.error("Usage: node tools/validate-diagram.mjs <diagram.json>");
  process.exit(path ? 0 : 2);
}

const doc = JSON.parse(readFileSync(resolve(path), "utf8"));
const result = validateDiagram(doc);
if (result.warnings?.length) {
  for (const w of result.warnings) console.warn("warn:", w);
}
if (!result.ok) {
  for (const e of result.errors) console.error("error:", e);
  console.error("INVALID");
  process.exit(1);
}
console.log("OK");
process.exit(0);
