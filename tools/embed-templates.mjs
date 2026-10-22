#!/usr/bin/env node
/**
 * Embed TEMPLATE_CATALOG + BUILTIN_TEMPLATES from src/diagram/templates.mjs into app.js
 * (browser IIFE cannot import ESM). Run after editing templates.mjs:
 *   node tools/embed-templates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertTemplateCatalogIntegrity,
  BUILTIN_TEMPLATES,
  TEMPLATE_CATALOG,
} from "../src/diagram/templates.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "..", "app.js");

const BEGIN_CAT = "/* @@TEMPLATE_CATALOG_BEGIN@@ */";
const END_CAT = "/* @@TEMPLATE_CATALOG_END@@ */";
const BEGIN_SPEC = "/* @@BUILTIN_TEMPLATES_BEGIN@@ */";
const END_SPEC = "/* @@BUILTIN_TEMPLATES_END@@ */";

assertTemplateCatalogIntegrity();

function jsLiteral(value, indent = 2) {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : " ".repeat(indent) + line))
    .join("\n");
}

function replaceMarked(src, begin, end, body) {
  const i0 = src.indexOf(begin);
  const i1 = src.indexOf(end);
  if (i0 < 0 || i1 < 0 || i1 < i0) {
    throw new Error(`Missing markers ${begin} … ${end} in app.js`);
  }
  return src.slice(0, i0) + begin + "\n" + body + "\n  " + end + src.slice(i1 + end.length);
}

const catalogBody = `  const TEMPLATE_CATALOG = ${jsLiteral(TEMPLATE_CATALOG)};`;
const specsBody =
  `  /**\n` +
  `   * Built-in templates in GRID CELLS (integer). Edges are 2–5 cells so both\n` +
  `   * 方格 and 三角格 lattice vertices line up when grid is on.\n` +
  `   * Embedded from src/diagram/templates.mjs — do not edit by hand; run\n` +
  `   * \`node tools/embed-templates.mjs\`.\n` +
  `   */\n` +
  `  const BUILTIN_TEMPLATES = ${jsLiteral(BUILTIN_TEMPLATES)};`;

let app = fs.readFileSync(appPath, "utf8");
app = replaceMarked(app, BEGIN_CAT, END_CAT, catalogBody);
app = replaceMarked(app, BEGIN_SPEC, END_SPEC, specsBody);
fs.writeFileSync(appPath, app);
console.log(
  `embed-templates: wrote ${TEMPLATE_CATALOG.length} catalog entries, ` +
    `${Object.keys(BUILTIN_TEMPLATES).length} specs → app.js`
);
