import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertTemplateCatalogIntegrity,
  BUILTIN_TEMPLATES,
  TEMPLATE_CATALOG,
  TEMPLATE_UI_IDS,
  listBuiltinTemplates,
} from "../src/diagram/index.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("TEMPLATE_CATALOG covers every BUILTIN_TEMPLATES id", () => {
  assertTemplateCatalogIntegrity();
  assert.deepEqual(TEMPLATE_UI_IDS, [], "Templates menu has no builtin combos");
});

test("listBuiltinTemplates defaults to empty UI list (saved-only Templates)", () => {
  const rows = listBuiltinTemplates();
  assert.equal(rows.length, 0);
  const all = listBuiltinTemplates({ uiOnly: false });
  assert.ok(all.length > 0);
  assert.ok(all.every((r) => r.labelZh && r.labelEn));
});

test("app.js embed matches src/diagram/templates.mjs", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const cat = extractJson(app, "TEMPLATE_CATALOG_BEGIN", "TEMPLATE_CATALOG_END", "TEMPLATE_CATALOG");
  const specs = extractJson(app, "BUILTIN_TEMPLATES_BEGIN", "BUILTIN_TEMPLATES_END", "BUILTIN_TEMPLATES");
  assert.deepEqual(cat, TEMPLATE_CATALOG);
  assert.deepEqual(specs, BUILTIN_TEMPLATES);
});

function extractJson(src, beginTag, endTag, constName) {
  const begin = `/* @@${beginTag}@@ */`;
  const end = `/* @@${endTag}@@ */`;
  const i0 = src.indexOf(begin);
  const i1 = src.indexOf(end);
  assert.ok(i0 >= 0 && i1 > i0, `markers ${beginTag}`);
  const block = src.slice(i0 + begin.length, i1);
  const m = block.match(new RegExp(`const ${constName} = ([\\s\\S]*);\\s*$`));
  assert.ok(m, `const ${constName}`);
  return JSON.parse(m[1]);
}
