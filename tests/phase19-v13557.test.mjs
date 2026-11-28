/**
 * v13.5.57 — box-whisker arrows, five-number guides, and tight tick-grid dots.
 * 2013 P1 Q15 set axisArrows:"none", guideStyle:"none", tickGridStyle:"dotted"
 * and both canvas and documentToSvg still drew both arrows and solid guides.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  applyOps,
  boxWhiskerDash,
  boxWhiskerParts,
  documentToSvg,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION is 13.5.61", () => {
  assert.equal(APP_VERSION, "13.5.61");
});

function q15(extra = {}) {
  return applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw",
      y: 40,
      min: 12,
      q1: 20,
      median: 28,
      q3: 36,
      max: 48,
      boxHeight: 24,
      ticks: [10, 20, 30, 40, 50],
      axisMin: 0,
      axisMax: 60,
      axisY: 80,
      axisArrows: "none",
      guideStyle: "none",
      tickGridStyle: "dotted",
      ...extra,
    },
  ]);
}

function lineEls(svg) {
  return [...svg.matchAll(/<line ([^>]*)\/>/g)].map((m) => {
    const attrs = Object.fromEntries(
      [...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])
    );
    return {
      x1: Number(attrs.x1),
      y1: Number(attrs.y1),
      x2: Number(attrs.x2),
      y2: Number(attrs.y2),
      dash: attrs["stroke-dasharray"] || "",
    };
  });
}

function diagonals(lines) {
  return lines.filter((l) => Math.abs(l.x1 - l.x2) > 0.5 && Math.abs(l.y1 - l.y2) > 0.5);
}

test("boxWhiskerDash dotted is the tight [2, 2] dot", () => {
  assert.deepEqual(boxWhiskerDash("dotted"), [2, 2]);
  assert.deepEqual(boxWhiskerDash("dashed"), [5, 4]);
  assert.deepEqual(boxWhiskerDash("solid"), []);
  assert.deepEqual(boxWhiskerDash("none"), []);
});

test("2013 P1 Q15: no arrows, no five-number guides, dotted tick grids on SVG", () => {
  const doc = q15();
  const bw = doc.boxWhiskers[0];
  assert.equal(bw.axisArrows, "none");
  assert.equal(bw.guideStyle, "none");
  assert.equal(bw.tickGridStyle, "dotted");
  const parts = boxWhiskerParts(bw);
  assert.equal(parts.arrows.length, 0);
  assert.equal(parts.guides.length, 0);
  assert.equal(parts.tickGrids.length, 5);
  assert.ok(parts.tickGrids.every((l) => l.tickGridStyle === "dotted"));

  const svg = documentToSvg(doc, { scale: 2 });
  const lines = lineEls(svg);
  assert.equal(diagonals(lines).length, 0);
  const dotted = lines.filter((l) => l.dash === "2 2");
  assert.equal(dotted.length, 5);
  assert.ok(dotted.every((l) => Math.abs(l.x1 - l.x2) < 0.05 && l.y2 - l.y1 > 40));
  const axis = lines
    .filter((l) => !l.dash && Math.abs(l.y1 - l.y2) < 0.05 && l.x2 - l.x1 > 40)
    .sort((a, b) => b.x2 - b.x1 - (a.x2 - a.x1))[0];
  assert.ok(axis);
  const solidGuides = lines.filter((l) => {
    if (l.dash) return false;
    if (Math.abs(l.x1 - l.x2) > 0.05) return false;
    const top = Math.min(l.y1, l.y2);
    const bot = Math.max(l.y1, l.y2);
    return Math.abs(bot - axis.y1) < 1.5 && axis.y1 - top > 20;
  });
  assert.equal(solidGuides.length, 0);

  const vertical = applyOps(null, [
    {
      op: "addBoxWhisker",
      id: "bw",
      orientation: "v",
      x: 40,
      min: 12,
      q1: 20,
      median: 28,
      q3: 36,
      max: 48,
      boxHeight: 24,
      ticks: [10, 30, 50],
      axisMin: 0,
      axisMax: 60,
      axisArrows: "none",
      guideStyle: "none",
      tickGridStyle: "dotted",
    },
  ]);
  const vParts = boxWhiskerParts(vertical.boxWhiskers[0]);
  assert.equal(vParts.arrows.length, 0);
  assert.equal(vParts.guides.length, 0);
  assert.equal(vParts.tickGrids.length, 3);
  const vSvg = documentToSvg(vertical, { scale: 2 });
  assert.equal(diagonals(lineEls(vSvg)).length, 0);
  assert.equal(lineEls(vSvg).filter((l) => l.dash === "2 2").length, 3);
});

test("axisArrows right keeps only the forward arrow; both and omitted keep both", () => {
  const right = lineEls(documentToSvg(q15({ axisArrows: "right" }), { scale: 2 }));
  const rightDiag = diagonals(right);
  assert.equal(rightDiag.length, 2);
  const axisRight = Math.max(
    ...right.filter((l) => !l.dash && Math.abs(l.y1 - l.y2) < 0.05).map((l) => Math.max(l.x1, l.x2))
  );
  assert.ok(rightDiag.every((l) => Math.max(l.x1, l.x2) >= axisRight - 1));

  const both = diagonals(lineEls(documentToSvg(q15({ axisArrows: "both" }), { scale: 2 })));
  assert.equal(both.length, 4);
  const omitted = diagonals(
    lineEls(documentToSvg(q15({ axisArrows: undefined, guideStyle: "dashed" }), { scale: 2 }))
  );
  assert.equal(omitted.length, 4);
});

test("dotted tick grids do not restyle dashed five-number guides into solid", () => {
  const doc = q15({ guideStyle: "dashed" });
  const parts = boxWhiskerParts(doc.boxWhiskers[0]);
  assert.equal(parts.guides.length, 5);
  assert.ok(parts.guides.every((g) => g.guideStyle === "dashed"));
  assert.ok(parts.tickGrids.every((l) => l.tickGridStyle === "dotted"));
  const lines = lineEls(documentToSvg(doc, { scale: 2 }));
  assert.equal(lines.filter((l) => l.dash === "2 2").length, 5);
  assert.equal(lines.filter((l) => l.dash === "5 4").length, 5);
  const axisY = lines
    .filter((l) => !l.dash && Math.abs(l.y1 - l.y2) < 0.05 && l.x2 - l.x1 > 40)
    .map((l) => l.y1)
    .sort((a, b) => b - a)[0];
  const solidGuides = lines.filter((l) => {
    if (l.dash) return false;
    if (Math.abs(l.x1 - l.x2) > 0.05) return false;
    const top = Math.min(l.y1, l.y2);
    const bot = Math.max(l.y1, l.y2);
    return Math.abs(bot - axisY) < 1.5 && axisY - top > 20;
  });
  assert.equal(solidGuides.length, 0);
});

test("canvas keeps axisArrows and guideStyle and uses the same [2, 2] dash", () => {
  const app = readFileSync(resolve(root, "app.js"), "utf8");
  const standalone = readFileSync(resolve(root, "simple-diagram-standalone.html"), "utf8");
  for (const src of [app, standalone]) {
    assert.match(src, /out\.axisArrows = a === "right" \|\| a === "none" \? a : "both"/);
    assert.match(src, /out\.guideStyle =/);
    assert.match(src, /if \(style === "dotted"\) return \[2, 2\]/);
    assert.match(src, /diagramMod\.boxWhiskerDash/);
    assert.match(src, /strokeStyled\(s, s\.tickGridStyle \|\| "dotted"\)/);
    assert.match(src, /strokeStyled\(s, s\.guideStyle \|\| "dashed"\)/);
  }
});
