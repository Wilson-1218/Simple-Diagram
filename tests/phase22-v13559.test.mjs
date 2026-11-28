/**
 * v13.5.59 — × / foot markers survive hideExportPoints.
 * addText rotate is kept through editor normalize and applied to
 * plain text and math text on the canvas and in documentToSvg.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, applyOps, approxTextWidth, documentToSvg } from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION is 13.5.63", () => {
  assert.equal(APP_VERSION, "13.5.63");
});

function triangle(extra = {}) {
  return applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 300, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 400 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "BC", a: "B", b: "C" },
    { op: "addSegment", id: "CA", a: "C", b: "A" },
    { op: "addIncircle", a: "A", b: "B", c: "C", id: "I", ...extra },
  ]);
}

function crossPaths(svg) {
  return svg.match(/<path d="M[^"]+ L[^"]+ M[^"]+ L[^"]+"[^>]*fill="none"[^>]*>/g) || [];
}

function filledDots(svg) {
  return (svg.match(/<circle [^>]*fill="#111"/g) || []).length;
}

test("hideExportPoints keeps the incentre × and drops only the default dots", () => {
  const marked = triangle({ marker: "x" });
  const foot = triangle({ marker: "foot" });
  const plain = triangle();
  const hidden = triangle({ marker: "x", hidden: true });
  const none = triangle({ showDot: false });
  assert.equal(marked.hideExportPoints, true);
  assert.equal(marked.points.find((p) => p.id === "I").marker, "x");
  assert.notEqual(marked.points.find((p) => p.id === "I").hidden, true);

  const xSvg = documentToSvg(marked, { scale: 2 });
  const footSvg = documentToSvg(foot, { scale: 2 });
  const plainSvg = documentToSvg(plain, { scale: 2 });
  const hiddenSvg = documentToSvg(hidden, { scale: 2 });
  const noneSvg = documentToSvg(none, { scale: 2 });
  const forced = documentToSvg(applyOps(marked, [{ op: "setMeta", hideExportPoints: false }]), {
    hidePoints: true,
    scale: 2,
  });

  for (const svg of [xSvg, footSvg, forced]) {
    assert.equal(filledDots(svg), 0, svg.slice(svg.indexOf("<circle"), svg.indexOf("<circle") + 80));
    const crosses = crossPaths(svg).filter((p) => p.includes('data-id="I"'));
    assert.equal(crosses.length, 1);
  }
  assert.equal(filledDots(plainSvg), 0);
  assert.equal(crossPaths(plainSvg).some((p) => p.includes('data-id="I"')), false);
  assert.equal(hiddenSvg.includes('data-id="I"'), false);
  assert.equal(noneSvg.includes('data-id="I"'), false);

  const shown = documentToSvg(marked, { hidePoints: false, scale: 2 });
  assert.equal(filledDots(shown), 3);
  assert.equal(crossPaths(shown).filter((p) => p.includes('data-id="I"')).length, 1);
});

test("a foot marker still draws × when export points are hidden", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 200, y: 0 },
    { op: "addPoint", id: "P", x: 80, y: 70 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addFoot", pointId: "P", segmentId: "AB", footId: "F" },
    { op: "addPoint", id: "H", x: 40, y: 40, marker: "x", hidden: true },
  ]);
  assert.equal(doc.points.find((p) => p.id === "F").marker, "foot");
  assert.notEqual(doc.points.find((p) => p.id === "F").hidden, true);
  assert.equal(doc.points.find((p) => p.id === "H").hidden, true);
  const svg = documentToSvg(doc, { scale: 2 });
  assert.equal(filledDots(svg), 0);
  assert.equal(crossPaths(svg).filter((p) => p.includes('data-id="F"')).length, 1);
  assert.equal(svg.includes('data-id="H"'), false);
});

function sliceFn(src, start, end) {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, start);
  return src.slice(i, j);
}

test("canvas keeps rotate through normalize and draws × outside hideExportPoints", () => {
  const app = readFileSync(resolve(root, "app.js"), "utf8");
  const standalone = readFileSync(resolve(root, "simple-diagram-standalone.html"), "utf8");
  const svg = readFileSync(resolve(root, "src/diagram/export-svg.mjs"), "utf8");
  for (const src of [app, standalone]) {
    const norm = sliceFn(src, "function normalizeTextRecord", "function nearestTextHit");
    assert.match(norm, /deg !== 0/);
    assert.match(norm, /row\.rotate = deg/);
    const paint = sliceFn(src, "function paintFloatingText", "function drawText");
    const rot = paint.indexOf("c.rotate((deg * Math.PI) / 180)");
    const plain = paint.indexOf("c.fillText(text, 0, 0)");
    const math = paint.indexOf("paintMathRuns(");
    assert.ok(rot >= 0 && rot < plain && rot < math, "rotate before plain and math branches");
    const png = sliceFn(src, "function buildExportCanvas", "async function exportPng");
    const cross = png.indexOf('p.marker === "x" || p.marker === "foot"');
    const hide = png.indexOf("hideExportPoints");
    assert.ok(cross >= 0 && hide > cross, "× is not gated by hideExportPoints");
    const exp = sliceFn(src, "async function exportSvg", "function buildProjectData");
    const crossSvg = exp.indexOf('p.marker === "x" || p.marker === "foot"');
    const hideSvg = exp.indexOf("hideExportPoints");
    assert.ok(crossSvg >= 0 && hideSvg > crossSvg);
  }
  assert.match(svg, /const cross = p\.marker === "x" \|\| p\.marker === "foot"/);
  assert.match(svg, /if \(!cross && \(hidePoints/);
  const text = sliceFn(svg, 'if (!tx || typeof tx !== "object" || !shown(tx))', "return `<?xml");
  const rot = text.indexOf('transform="rotate(');
  const inner = text.indexOf("svgTextInner(tx.text");
  assert.ok(inner >= 0 && rot > inner, "plain and math text share the rotate transform");
});

function town(rotate, text = "Distance from town X (km)") {
  const op = { op: "addText", x: 112, y: 180, text, size: 13 };
  if (rotate !== undefined) op.rotate = rotate;
  return applyOps(null, [op]);
}

function viewBox(svg) {
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(vb);
  return { w: Number(vb[1]), h: Number(vb[2]) };
}

test("rotate -90 turns the town caption and keeps both ends inside the viewBox", () => {
  const text = "Distance from town X (km)";
  const doc = town(-90, text);
  const alias = applyOps(null, [
    { op: "addCaption", x: 112, y: 180, text, size: 13, rotate: -90 },
  ]);
  const flat = town();
  const zero = town(0);
  assert.equal(doc.texts[0].rotate, -90);
  assert.equal(alias.texts[0].rotate, -90);
  assert.equal(doc.texts[0].x, 112);
  assert.equal(doc.texts[0].y, 180);
  assert.equal("rotate" in flat.texts[0], false);
  assert.equal("rotate" in zero.texts[0], false);

  const svg = documentToSvg(doc, { scale: 2 });
  const flatSvg = documentToSvg(flat, { scale: 2 });
  const textEl = svg.match(
    /<text x="([0-9.]+)" y="([0-9.]+)"[^>]*transform="rotate\(-90, ([0-9.]+), ([0-9.]+)\)"/
  );
  assert.ok(textEl, svg.slice(svg.indexOf("<text"), svg.indexOf("<text") + 500));
  assert.equal(textEl[1], textEl[3]);
  assert.equal(textEl[2], textEl[4]);
  assert.equal(flatSvg.includes("transform="), false);
  assert.equal(documentToSvg(zero, { scale: 2 }), flatSvg);

  const { w, h } = viewBox(svg);
  const flatBox = viewBox(flatSvg);
  assert.ok(w < flatBox.w - 40, `rotated width ${w} vs horizontal ${flatBox.w}`);
  const sx = Number(textEl[1]);
  const sy = Number(textEl[2]);
  const tw = approxTextWidth(text, 13);
  const fs = 13;
  const scale = 2;
  for (const dx of [-tw / 2, tw / 2]) {
    for (const dy of [-fs * 0.7, fs * 0.45]) {
      const px = sx + dy * scale;
      const py = sy + -dx * scale;
      assert.ok(px >= 16 && py >= 16, `pad ${px},${py}`);
      assert.ok(w - px >= 16 && h - py >= 16, `edge ${w - px},${h - py} of ${w}x${h}`);
    }
  }
});

test("math text uses the same rotate transform", () => {
  const doc = applyOps(null, [
    { op: "addText", x: 112, y: 180, text: "x^{2}", size: 13, rotate: -90 },
  ]);
  assert.equal(doc.texts[0].rotate, -90);
  const svg = documentToSvg(doc, { scale: 2 });
  const textEl = svg.match(
    /<text x="([0-9.]+)" y="([0-9.]+)"[^>]*transform="rotate\(-90, ([0-9.]+), ([0-9.]+)\)"[^>]*>/
  );
  assert.ok(textEl, svg.slice(svg.indexOf("<text"), svg.indexOf("<text") + 600));
  assert.equal(textEl[1], textEl[3]);
  assert.equal(textEl[2], textEl[4]);
  assert.match(svg, /<tspan/);
  const { w, h } = viewBox(svg);
  const sx = Number(textEl[1]);
  const sy = Number(textEl[2]);
  const tw = approxTextWidth("x^{2}", 13);
  const fs = 13;
  const scale = 2;
  for (const dx of [-tw / 2, tw / 2]) {
    for (const dy of [-fs * 0.7, fs * 0.45]) {
      const px = sx + dy * scale;
      const py = sy + -dx * scale;
      assert.ok(px >= 16 && py >= 16 && w - px >= 16 && h - py >= 16);
    }
  }
});
