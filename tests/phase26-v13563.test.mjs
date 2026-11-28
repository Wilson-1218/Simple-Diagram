/**
 * v13.5.63 — foot label sits past the foot; dot rows can share a vertical center.
 * Omitted labelOx/labelOy place the letter distance 16 along point → foot.
 * One numeric axis freezes the other (addLabel: missing ox → 0, oy → -14).
 * verticalAlign "middle" shifts shorter groups; top/bottom/equal-row center do not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_VERSION, applyOps, documentToSvg, statChartParts } from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.64", () => {
  assert.equal(APP_VERSION, "13.5.64");
});

function footDoc(extra = {}) {
  return applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 0 },
    { op: "addPoint", id: "P", x: 40, y: 60 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addFoot", pointId: "P", segmentId: "AB", footId: "H", ...extra },
  ]);
}

function labelOf(doc) {
  assert.equal(doc.labels.length, 1);
  return doc.labels[0];
}

function close(a, b, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
}

test("omitted foot offsets sit on the far side of the base", () => {
  const doc = footDoc({ label: "N" });
  const H = doc.points.find((p) => p.id === "H");
  close(H.x, 40);
  close(H.y, 0);
  const lab = labelOf(doc);
  assert.equal(lab.text, "N");
  assert.equal(lab.pointId, "H");
  close(lab.ox, 0);
  close(lab.oy, -16);
  close(Math.hypot(lab.ox, lab.oy), 16);
  assert.ok(H.y + lab.oy < H.y);
  assert.ok(H.y + lab.oy < 0);
  assert.notEqual(lab.autoOffset, true);

  const above = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 80, y: 0 },
    { op: "addPoint", id: "P", x: 30, y: -40 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    { op: "addFoot", pointId: "P", segmentId: "AB", footId: "N", labelText: "N", drawSegment: false },
  ]);
  const n = labelOf(above);
  close(n.ox, 0);
  close(n.oy, 16);
  assert.equal(above.segments.length, 1);

  const slant = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 100 },
    { op: "addPoint", id: "P", x: 0, y: 100 },
    { op: "addFoot", pointId: "P", a: "A", b: "B", footId: "F", label: true },
  ]);
  const F = slant.points.find((p) => p.id === "F");
  const s = labelOf(slant);
  assert.equal(s.text, "H");
  const dx = F.x - 0;
  const dy = F.y - 100;
  const len = Math.hypot(dx, dy);
  close(s.ox, (dx / len) * 16);
  close(s.oy, (dy / len) * 16);
  close(Math.hypot(s.ox, s.oy), 16);
  const base = { x: 100, y: 100 };
  const cross = (px, py) => base.x * (py - 0) - base.y * (px - 0);
  assert.ok(cross(0, 100) * cross(F.x + s.ox, F.y + s.oy) < 0);

  const svg = documentToSvg(doc, { scale: 2, pad: 0 });
  const text = svg.match(/<text[^>]*x="([0-9.-]+)" y="([0-9.-]+)"[^>]*>N</);
  const mark = svg.match(/<path d="M([0-9.-]+),([0-9.-]+) /);
  assert.ok(text, "svg label");
  assert.ok(mark, "svg foot mark");
  const r = 5 * 2 * 0.7;
  const footX = Number(mark[1]) + r;
  const footY = Number(mark[2]) + r;
  close((Number(text[1]) - footX) / 2, lab.ox, 1e-6);
  close((Number(text[2]) - footY) / 2, lab.oy, 1e-6);
});

test("one foot offset axis freezes the other and aliases do not add a second label", () => {
  const onlyX = labelOf(footDoc({ label: "N", labelOx: 0 }));
  close(onlyX.ox, 0);
  close(onlyX.oy, -14);

  const onlyY = labelOf(footDoc({ labelText: "N", oy: 4 }));
  close(onlyY.ox, 0);
  close(onlyY.oy, 4);

  const both = labelOf(footDoc({ label: "N", ox: 3, labelOy: -6 }));
  close(both.ox, 3);
  close(both.oy, -6);

  const namedWins = labelOf(footDoc({ label: "N", labelOx: 1, ox: 9, labelOy: 2, oy: 8 }));
  close(namedWins.ox, 1);
  close(namedWins.oy, 2);

  const slant = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 100, y: 100 },
    { op: "addPoint", id: "P", x: 0, y: 100 },
    { op: "addFoot", pointId: "P", a: "A", b: "B", footId: "F", label: "N", labelOy: 3 },
  ]);
  const frozen = labelOf(slant);
  close(frozen.ox, 0);
  close(frozen.oy, 3);
  assert.notEqual(frozen.autoOffset, true);
});

function rowPattern(n) {
  return { rows: Array.from({ length: n }, () => 1) };
}

function dotChart(extra = {}) {
  return applyOps(null, [
    {
      op: "addDotPattern",
      x: 0,
      y: 100,
      dotGap: 16,
      patterns: [rowPattern(3), rowPattern(5), rowPattern(7)],
      ...extra,
    },
  ]).barCharts[0];
}

function contentGroups(parts) {
  const groups = new Map();
  for (const d of parts.dots) {
    if (d.ellipsis) continue;
    const key = d.x.toFixed(3);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  return [...groups.values()]
    .map((dots) => dots.slice().sort((a, b) => a.y - b.y))
    .sort((a, b) => a[0].x - b[0].x);
}

test("middle dot rows share midY; top, bottom, and equal-row center stay put", () => {
  const omitted = statChartParts(dotChart());
  const center = statChartParts(dotChart({ verticalAlign: "center" }));
  const top = statChartParts(dotChart({ verticalAlign: "top" }));
  const ys = (parts) => contentGroups(parts).map((g) => g.map((d) => d.y));
  assert.deepEqual(ys(center), ys(omitted));
  assert.deepEqual(ys(top), ys(omitted));
  const plain = ys(omitted);
  assert.equal(plain[0].length, 3);
  assert.equal(plain[1].length, 5);
  assert.equal(plain[2].length, 7);
  assert.ok(plain.every((group) => Math.abs(group[0] - 100) < 1e-9));

  const bottom = statChartParts(dotChart({ verticalAlign: "bottom" }));
  const bottomGroups = ys(bottom);
  const baseY = bottomGroups[2][6];
  assert.ok(bottomGroups.every((group) => Math.abs(group[group.length - 1] - baseY) < 1e-9));
  assert.ok(Math.abs(bottomGroups[0][0] - plain[0][0]) > 1);

  const equal = {
    op: "addDotPattern",
    x: 0,
    y: 80,
    patterns: [rowPattern(4), rowPattern(4)],
  };
  const equalNow = statChartParts(applyOps(null, [equal]).barCharts[0]);
  const equalCenter = statChartParts(
    applyOps(null, [{ ...equal, verticalAlign: "center" }]).barCharts[0]
  );
  assert.deepEqual(ys(equalCenter), ys(equalNow));

  const middle = statChartParts(dotChart({ verticalAlign: "middle" }));
  const viaCenter = statChartParts(dotChart({ verticalAlign: "center", centerRows: true }));
  const groups = ys(middle);
  assert.deepEqual(ys(viaCenter), groups);
  const gap = 16;
  for (const [index, shift] of [[0, 2], [1, 1], [2, 0]]) {
    groups[index].forEach((y, row) => close(y, 100 + (shift + row) * gap));
  }
  const midY = 100 + 3 * gap;
  for (const group of groups) close((group[0] + group[group.length - 1]) / 2, midY);
  assert.ok(shaftsShare(middle, midY));
  assert.ok(shaftsShare(viaCenter, midY));
  const ellipsis = middle.dots.filter((d) => d.ellipsis);
  assert.equal(ellipsis.length, 3);
  assert.ok(ellipsis.every((d) => Math.abs(d.y - midY) < 1e-9));
  assert.ok(groups[0][0] < groups[0][1]);

  const svg = documentToSvg(applyOps(null, [
    {
      op: "addDotPattern",
      x: 0,
      y: 100,
      dotGap: 16,
      verticalAlign: "middle",
      patterns: [rowPattern(3), rowPattern(5), rowPattern(7)],
    },
  ]), { scale: 2, pad: 0 });
  const circles = [...svg.matchAll(/<circle cx="([0-9.]+)" cy="([0-9.]+)" r="9\.00"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
  assert.equal(circles.length, 3 + 5 + 7);
  const byX = new Map();
  for (const c of circles) {
    const key = c.x.toFixed(2);
    if (!byX.has(key)) byX.set(key, []);
    byX.get(key).push(c.y);
  }
  const svgGroups = [...byX.values()].map((col) => col.slice().sort((a, b) => a - b));
  svgGroups.sort((a, b) => a.length - b.length);
  const tallTop = svgGroups[2][0];
  close(svgGroups[0][0] - tallTop, 2 * gap * 2, 0.05);
  close(svgGroups[1][0] - tallTop, gap * 2, 0.05);
  close(svgGroups[2][1] - svgGroups[2][0], gap * 2, 0.05);
  const ellipses = [...svg.matchAll(/<circle cx="[0-9.]+" cy="([0-9.]+)" r="3\.20"/g)].map((m) => Number(m[1]));
  assert.equal(ellipses.length, 3);
  assert.ok(ellipses.every((y) => Math.abs(y - (tallTop + 3 * gap * 2)) < 0.05));
});

function shaftsShare(parts, y) {
  const shafts = parts.lines.filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 8);
  assert.ok(shafts.length >= 1);
  return shafts.every((l) => Math.abs(l.y1 - y) < 1e-6);
}
