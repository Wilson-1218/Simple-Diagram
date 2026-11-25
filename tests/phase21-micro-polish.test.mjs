import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
} from "../src/diagram/index.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION bumped for phase 2.1 micro-polish", () => {
  assert.equal(APP_VERSION, "13.5.41");
});

test("tool-rail button.tool overrides side padding (EN Sector/Shape)", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /\.tool-rail\s+button\.tool\s*\{[^}]*padding:\s*calc\(2px \* var\(--tb\)\)\s+0/s);
  assert.match(css, /--rail-width:\s*calc\(180px/);
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /tool_sector:\s*"Sector"/);
  assert.match(app, /tool_shape:\s*"Shape"/);
  assert.doesNotMatch(app, /"Sec…"/);
  assert.doesNotMatch(app, /"Sha…"/);
});

test("boxWhisker tick labels use larger font + paint-order halo in SVG", () => {
  const svg = documentToSvg(
    applyOps(null, [
      {
        op: "addBoxWhisker",
        id: "bw",
        y: 200,
        min: 50,
        q1: 80,
        median: 110,
        q3: 150,
        max: 190,
        ticks: [
          { pos: 100, label: "10" },
          { pos: 140, label: "20" },
          { pos: 180, label: "30" },
        ],
      },
    ])
  );
  assert.match(svg, />10</);
  assert.match(svg, />20</);
  assert.match(svg, />30</);
  assert.match(svg, /paint-order="stroke fill"/);
  assert.match(svg, /stroke="#ffffff"/);
  // fontForSize(14) — must not still be the old 13-sized floor alone
  const tickTexts = [...svg.matchAll(/<text[^>]*>10<\/text>/g)];
  assert.ok(tickTexts.length >= 1);
  assert.match(tickTexts[0][0], /font-size="[^"]+"/);
});
