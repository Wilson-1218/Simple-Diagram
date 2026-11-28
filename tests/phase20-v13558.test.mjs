/**
 * v13.5.58 — PNG canvas cap, triangle-center markers, caption rotate.
 * Omitted fields keep vertex ids, coordinates, segments, and text positions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  MAX_PNG_AREA,
  MAX_PNG_DIM,
  applyOps,
  approxTextWidth,
  cappedPngScale,
  documentToSvg,
  pngTargetPixels,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION is 13.5.60", () => {
  assert.equal(APP_VERSION, "13.5.60");
});

function triangle(extra = {}, centerOp = "addIncircle") {
  return applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 300, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 400 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addSegment", id: "BC", a: "B", b: "C" },
    { op: "addSegment", id: "CA", a: "C", b: "A" },
    { op: centerOp, a: "A", b: "B", c: "C", id: "I", ...extra },
  ]);
}

function geom(doc) {
  return {
    points: doc.points.map((p) => [p.id, p.x, p.y]),
    segments: doc.segments.map((s) => [s.id, s.a, s.b, s.style || "solid"]),
    texts: (doc.texts || []).map((t) => [t.id, t.x, t.y, t.text]),
  };
}

function filledDots(svg) {
  return (svg.match(/<circle [^>]*fill="#111"/g) || []).length;
}

test("png scale is unchanged when the target already fits", () => {
  assert.equal(MAX_PNG_DIM, 4096);
  assert.equal(MAX_PNG_AREA, 12_000_000);
  assert.equal(cappedPngScale(2, 1600, 1000, 40), 2);
  assert.equal(cappedPngScale(2, 100, 80, 40), 2);
  assert.equal(cappedPngScale(1.5, 400, 300, 40), 1.5);
  const px = pngTargetPixels(2, 1600, 1000, 40);
  assert.ok(px.w <= 4096 && px.h <= 4096 && px.w * px.h <= 12_000_000);
});

test("large figures shrink the render scale and stay inside both png limits", () => {
  const tall = cappedPngScale(4, 1600, 1000, 40);
  assert.ok(tall < 4 && tall > 0);
  const tallPx = pngTargetPixels(tall, 1600, 1000, 40);
  assert.ok(tallPx.w <= MAX_PNG_DIM && tallPx.h <= MAX_PNG_DIM);
  assert.ok(tallPx.w * tallPx.h <= MAX_PNG_AREA);

  const wide = cappedPngScale(2, 3200, 1000, 40);
  assert.ok(wide < 2 && wide > 0);
  const widePx = pngTargetPixels(wide, 3200, 1000, 40);
  assert.ok(widePx.w <= MAX_PNG_DIM && widePx.h <= MAX_PNG_DIM);
  assert.ok(widePx.w * widePx.h <= MAX_PNG_AREA);

  const area = cappedPngScale(2, 2000, 1800, 40);
  const areaPx = pngTargetPixels(area, 2000, 1800, 40);
  assert.ok(areaPx.w * areaPx.h <= MAX_PNG_AREA);
  assert.ok(areaPx.w <= MAX_PNG_DIM && areaPx.h <= MAX_PNG_DIM);
});

test("documentToSvg is not capped by the png limits", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 3000, y: 1800 },
  ]);
  const svg = documentToSvg(doc, { scale: 2, hidePoints: false });
  const w = Number(svg.match(/width="(\d+)"/)[1]);
  const h = Number(svg.match(/height="(\d+)"/)[1]);
  assert.ok(w > MAX_PNG_DIM, `svg width ${w}`);
  assert.ok(h > 3000, `svg height ${h}`);
});

test("app png path caps the offscreen canvas and still rotates captions", () => {
  const app = readFileSync(resolve(root, "app.js"), "utf8");
  const standalone = readFileSync(resolve(root, "simple-diagram-standalone.html"), "utf8");
  for (const src of [app, standalone]) {
    assert.match(src, /const MAX_PNG_DIM = 4096/);
    assert.match(src, /const MAX_PNG_AREA = 12_000_000/);
    assert.match(
      src,
      /scale = cappedPngScale\(scale, raw\.maxX - raw\.minX, raw\.maxY - raw\.minY, padPx\)/
    );
    assert.match(src, /c\.rotate\(\(deg \* Math\.PI\) \/ 180\)/);
    assert.match(src, /exportLayout\(1\.5\)/);
    assert.equal((src.match(/cappedPngScale\(/g) || []).length, 2);
  }
});

test("omitted marker keeps the incentre dot, ids, and coordinates", () => {
  const plain = triangle();
  const marked = triangle({ marker: "x" });
  const none = triangle({ showDot: false });
  assert.deepEqual(geom(plain), geom(marked));
  assert.deepEqual(geom(plain), geom(none));
  const I0 = plain.points.find((p) => p.id === "I");
  assert.equal(I0.marker, undefined);
  assert.ok(Math.abs(I0.x - 100) < 1e-6 && Math.abs(I0.y - 100) < 1e-6);
  assert.equal(marked.points.find((p) => p.id === "I").marker, "x");
  assert.equal(none.points.find((p) => p.id === "I").marker, "none");
  assert.notEqual(none.points.find((p) => p.id === "I").hidden, true);
  assert.ok(marked.points.filter((p) => p.id !== "I").every((p) => p.marker !== "x"));

  const plainSvg = documentToSvg(plain, { hidePoints: false, scale: 2 });
  const xSvg = documentToSvg(marked, { hidePoints: false, scale: 2 });
  const noneSvg = documentToSvg(none, { hidePoints: false, scale: 2 });
  assert.equal(filledDots(xSvg), filledDots(plainSvg) - 1);
  assert.equal(filledDots(noneSvg), filledDots(plainSvg) - 1);
  assert.match(xSvg, /<path d="M[^"]+ L[^"]+ M[^"]+ L[^"]+" fill="none" stroke="#111"[^>]*data-id="I"/);
  const path = xSvg.match(
    /<path d="M([0-9.-]+),([0-9.-]+) L([0-9.-]+),([0-9.-]+) M([0-9.-]+),([0-9.-]+) L([0-9.-]+),([0-9.-]+)"/
  );
  assert.ok(path);
  const midX = (Number(path[1]) + Number(path[3]) + Number(path[5]) + Number(path[7])) / 4;
  const midY = (Number(path[2]) + Number(path[4]) + Number(path[6]) + Number(path[8])) / 4;
  const dot = plainSvg.match(/<circle cx="([0-9.]+)" cy="([0-9.]+)"[^>]*data-id="I"/);
  assert.ok(dot);
  assert.ok(Math.abs(midX - Number(dot[1])) < 0.05, `${midX} vs ${dot[1]}`);
  assert.ok(Math.abs(midY - Number(dot[2])) < 0.05, `${midY} vs ${dot[2]}`);
  assert.equal(noneSvg.includes('data-id="I"'), false);
});

test("marker is written on every triangle center and not on touch points", () => {
  const cases = [
    ["addIncircle", { marker: "foot" }, "foot"],
    ["addCircumcircle", { marker: "x" }, "x"],
    ["addTriangleCenter", { kind: "centroid", marker: "x" }, "x"],
    ["addTriangleCenter", { kind: "orthocentre", showDot: false }, "none"],
  ];
  for (const [op, extra, want] of cases) {
    const doc = triangle(extra, op);
    const plain = triangle(
      Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "marker" && k !== "showDot")),
      op
    );
    const center = doc.points.find((p) => p.id === "I");
    assert.equal(center.marker, want, op);
    assert.deepEqual(geom(doc), geom(plain), op);
  }

  const touch = triangle({
    marker: "x",
    markTouchPoints: true,
    touchIds: ["Tab", "Tbc", "Tca"],
  });
  assert.equal(touch.points.find((p) => p.id === "I").marker, "x");
  for (const id of ["Tab", "Tbc", "Tca"]) {
    assert.equal(touch.points.find((p) => p.id === id).marker, undefined, id);
  }
  const plainTouch = triangle({
    markTouchPoints: true,
    touchIds: ["Tab", "Tbc", "Tca"],
  });
  assert.deepEqual(geom(touch), geom(plainTouch));
});

function caption(rotate) {
  const op = { op: "addText", id: "t", x: 200, y: 220, text: "VerticalTitle", size: 16 };
  if (rotate !== undefined) op.rotate = rotate;
  return applyOps(null, [{ op: "setMeta", hideExportPoints: true }, op]);
}

test("omit and zero rotate keep horizontal text and the same viewBox", () => {
  const omit = caption();
  const zero = caption(0);
  const alias = applyOps(null, [
    { op: "setMeta", hideExportPoints: true },
    { op: "addCaption", id: "t", x: 200, y: 220, text: "VerticalTitle", size: 16 },
  ]);
  assert.equal("rotate" in omit.texts[0], false);
  assert.equal("rotate" in zero.texts[0], false);
  assert.equal(omit.texts[0].x, 200);
  assert.equal(omit.texts[0].y, 220);
  assert.equal(documentToSvg(omit), documentToSvg(zero));
  assert.equal(documentToSvg(omit), documentToSvg(alias));
  assert.equal(documentToSvg(omit).includes("transform="), false);
});

test("rotate -90 is bottom-to-top about the anchor and stays in the viewBox", () => {
  const doc = caption(-90);
  assert.equal(doc.texts[0].rotate, -90);
  assert.equal(doc.texts[0].x, 200);
  assert.equal(doc.texts[0].y, 220);
  const svg = documentToSvg(doc, { scale: 2 });
  const textEl = svg.match(
    /<text x="([0-9.]+)" y="([0-9.]+)"[^>]*transform="rotate\(-90, ([0-9.]+), ([0-9.]+)\)"/
  );
  assert.ok(textEl, svg.slice(svg.indexOf("<text"), svg.indexOf("<text") + 400));
  assert.equal(textEl[1], textEl[3]);
  assert.equal(textEl[2], textEl[4]);
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(vb);
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const sx = Number(textEl[1]);
  const sy = Number(textEl[2]);
  const tw = approxTextWidth("VerticalTitle", 16);
  const fs = 16;
  const scale = 2;
  const locals = [
    [tw / 2, -fs * 0.7],
    [tw / 2, fs * 0.45],
    [-tw / 2, -fs * 0.7],
    [-tw / 2, fs * 0.45],
  ];
  for (const [dx, dy] of locals) {
    const px = sx + dy * scale;
    const py = sy + -dx * scale;
    assert.ok(px >= 16 && py >= 16, `pad ${px},${py}`);
    assert.ok(w - px >= 16 && h - py >= 16, `edge ${w - px},${h - py} of ${w}x${h}`);
  }
  const flat = documentToSvg(caption(), { scale: 2 });
  assert.notEqual(svg.match(/viewBox="[^"]+"/)[0], flat.match(/viewBox="[^"]+"/)[0]);
});
