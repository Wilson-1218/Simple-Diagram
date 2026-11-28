import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION, applyOps, documentToSvg, statChartParts, svgStatChart } from "../src/diagram/index.mjs";

const GAP = 20;
const WIDTH = 27;
const CLEARANCE = 18;
const RADIUS = 4.5;
const ELLIPSIS_R = 1.6;

test("APP_VERSION is 13.5.61", () => {
  assert.equal(APP_VERSION, "13.5.61");
});

function chartOf(op) {
  const doc = applyOps(null, [op]);
  const raw = doc.barCharts[0];
  return { doc, raw, parts: statChartParts(raw) };
}

function content(parts) {
  return parts.dots.filter((d) => !d.ellipsis);
}

function ellipsis(parts) {
  return parts.dots.filter((d) => d.ellipsis);
}

function shafts(parts) {
  return parts.lines
    .filter((l) => l.y1 === l.y2 && Math.abs(l.x2 - l.x1) > 10)
    .map((l) => ({
      x1: Math.min(l.x1, l.x2),
      tip: Math.max(l.x1, l.x2),
      y: l.y1,
    }));
}

function blocks(parts) {
  return parts.polygons.map((poly) => {
    let x1 = Infinity;
    let tip = -Infinity;
    let y = 0;
    for (const p of poly.points) {
      if (p.x < x1) x1 = p.x;
      if (p.x > tip) {
        tip = p.x;
        y = p.y;
      }
    }
    return { x1, tip, y, points: poly.points, fill: poly.fill };
  });
}

function groupsOf(parts) {
  const dots = content(parts).slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const groups = [];
  for (const d of dots) {
    const last = groups[groups.length - 1];
    if (!last || d.x - last.right > 40) {
      groups.push({ left: d.x, right: d.x, dots: [d] });
    } else {
      last.right = Math.max(last.right, d.x);
      last.left = Math.min(last.left, d.x);
      last.dots.push(d);
    }
  }
  return groups;
}

function assertSideGaps(arrow, leftCenter, rightCenter, radius, minGap) {
  const left = arrow.x1 - (leftCenter + radius);
  const right = rightCenter - radius - arrow.tip;
  assert.ok(left + 1e-6 >= minGap, `left pad ${left}`);
  assert.ok(right + 1e-6 >= minGap, `right pad ${right}`);
  assert.ok(Math.abs(arrow.tip - arrow.x1 - WIDTH) < 1e-6 || arrow.tip - arrow.x1 + 1e-6 >= WIDTH * 0.5);
}

test("omitted arrow fields use gap 20, width 27, and a trailing arrow", () => {
  const { raw, parts } = chartOf({
    op: "addDotPattern",
    x: 0,
    y: 40,
    patterns: [[[0, 0]], [[0, 0]]],
  });
  assert.equal(raw.arrowGap, undefined);
  assert.equal(raw.arrowWidth, undefined);
  assert.equal(raw.trailingArrow, undefined);
  assert.equal(raw.arrowAlign, undefined);
  const arrows = shafts(parts);
  assert.equal(arrows.length, 2);
  const groups = groupsOf(parts);
  assert.equal(groups.length, 2);
  assert.ok(Math.abs(groups[1].left - groups[0].right - (RADIUS + GAP + WIDTH + GAP + RADIUS)) < 1e-6);
  assertSideGaps(arrows[0], groups[0].right, groups[1].left, RADIUS, CLEARANCE);
  assert.ok(Math.abs(arrows[0].tip - arrows[0].x1 - WIDTH) < 1e-6);
  assert.ok(Math.abs(arrows[0].x1 - (groups[0].right + RADIUS + GAP)) < 1e-6);
  const dots = ellipsis(parts);
  assert.equal(dots.length, 3);
  assert.ok(Math.abs(arrows[1].x1 - (groups[1].right + RADIUS + GAP)) < 1e-6);
  assert.ok(Math.abs(arrows[1].tip - arrows[1].x1 - WIDTH) < 1e-6);
  assert.ok(Math.abs(dots[0].x - (arrows[1].tip + GAP + ELLIPSIS_R)) < 1e-6);
  assert.ok(arrows[1].tip < dots[0].x);
  assert.ok(dots.every((d, i) => Math.abs(d.x - (arrows[1].tip + GAP + ELLIPSIS_R + i * 8)) < 1e-6));
  assert.ok(arrows.every((a) => a.tip < Math.min(...dots.map((d) => d.x))));
});

test("trailingArrow false keeps the ellipsis and drops the arrow after the last stage", () => {
  const { raw, parts } = chartOf({
    op: "addDotPattern",
    x: 0,
    y: 40,
    trailingArrow: false,
    patterns: [[[0, 0]], [[0, 0]]],
  });
  assert.equal(raw.trailingArrow, false);
  const arrows = shafts(parts);
  assert.equal(arrows.length, 1);
  const groups = groupsOf(parts);
  const dots = ellipsis(parts);
  assert.equal(dots.length, 3);
  assert.ok(dots.every((d, i) => Math.abs(d.x - (groups[1].right + 18 + i * 8)) < 1e-6));
  assert.ok(arrows[0].tip < dots[0].x);
});

test("bottom align seats arrows and the ellipsis on baseY - 0.25 * pitchY", () => {
  const base = {
    op: "addDotPattern",
    x: 0,
    y: 80,
    patterns: [[[0, 0]], [[0, 0], [0, 1], [0, 2]], { rows: [2, 3] }],
  };
  const plain = chartOf(base);
  const center = chartOf({ ...base, verticalAlign: "center" });
  const top = chartOf({ ...base, verticalAlign: "top" });
  assert.deepEqual(
    content(plain.parts).map((d) => d.y),
    content(center.parts).map((d) => d.y)
  );
  assert.deepEqual(shafts(plain.parts).map((a) => a.y), shafts(center.parts).map((a) => a.y));
  const topArrows = shafts(top.parts);
  assert.ok(topArrows.every((a) => Math.abs(a.y - shafts(plain.parts)[0].y) < 1e-6));
  const topDots = content(top.parts);
  assert.ok(Math.abs(Math.min(...topDots.map((d) => d.y)) - 80) < 1e-9);

  const bottom = chartOf({ ...base, verticalAlign: "bottom" });
  const dots = content(bottom.parts);
  const baseY = Math.max(...dots.map((d) => d.y));
  const pitchY = 16;
  const arrowY = baseY - 0.25 * pitchY;
  const arrows = shafts(bottom.parts);
  assert.equal(arrows.length, 3);
  assert.ok(arrows.every((a) => Math.abs(a.y - arrowY) < 1e-6));
  assert.ok(ellipsis(bottom.parts).every((d) => Math.abs(d.y - arrowY) < 1e-6));
  const oneRow = dots.filter((d) => Math.abs(d.x - Math.min(...dots.map((p) => p.x))) < 1e-6);
  assert.equal(oneRow.length, 1);
  assert.ok(Math.abs(oneRow[0].y - baseY) < 1e-6);
  const head = oneRow[0].y - oneRow[0].r;
  assert.ok(arrowY > head - 1e-6);
  assert.ok(arrowY < baseY);
  const midY = shafts(plain.parts)[0].y;
  assert.ok(arrowY > midY);

  const middle = chartOf({ ...base, verticalAlign: "bottom", arrowAlign: "middle" });
  assert.ok(shafts(middle.parts).every((a) => Math.abs(a.y - midY) < 1e-6));
  assert.ok(ellipsis(middle.parts).every((d) => Math.abs(d.y - midY) < 1e-6));

  const shifted = chartOf({ ...base, verticalAlign: "bottom", arrowYOffset: 6 });
  assert.equal(shifted.raw.arrowYOffset, 6);
  assert.ok(shafts(shifted.parts).every((a) => Math.abs(a.y - (arrowY + 6)) < 1e-6));

  const grown = bottom.parts;
  const byX = new Map();
  for (const d of dots) {
    const key = d.x.toFixed(4);
    if (!byX.has(key)) byX.set(key, []);
    byX.get(key).push(d.y);
  }
  for (const ys of byX.values()) {
    ys.sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[0]);
  }
  assert.ok(grown);
});

test("DSE-style fourth group keeps one block arrow before the ellipsis and none after it", () => {
  const { raw, parts } = chartOf({
    op: "addDotPattern",
    x: 10,
    y: 100,
    verticalAlign: "bottom",
    arrowStyle: "block",
    patterns: [{ rows: [1] }, { rows: [1, 2] }, { rows: [1, 2, 3] }, { rows: [1, 2, 3, 4] }],
  });
  assert.equal(raw.arrowStyle, "block");
  const arrows = blocks(parts);
  assert.equal(arrows.length, 4);
  assert.ok(arrows.every((a) => a.points.length === 7 && a.fill === "none"));
  const groups = groupsOf(parts);
  assert.equal(groups.length, 4);
  for (let i = 0; i < 3; i++) {
    assertSideGaps(arrows[i], groups[i].right, groups[i + 1].left, RADIUS, CLEARANCE);
    assert.ok(Math.abs(arrows[i].tip - arrows[i].x1 - WIDTH) < 1e-6);
  }
  const dots = ellipsis(parts);
  assert.equal(dots.length, 3);
  assert.ok(Math.abs(arrows[3].x1 - (groups[3].right + RADIUS + GAP)) < 1e-6);
  assert.ok(Math.abs(dots[0].x - (arrows[3].tip + GAP + ELLIPSIS_R)) < 1e-6);
  const baseY = Math.max(...content(parts).map((d) => d.y));
  const arrowY = baseY - 0.25 * 16;
  assert.ok(arrows.every((a) => Math.abs(a.y - arrowY) < 1e-6));
  assert.ok(dots.every((d) => Math.abs(d.y - arrowY) < 1e-6));
  const past = arrows.filter((a) => a.x1 > dots[dots.length - 1].x);
  assert.equal(past.length, 0);
  const inLast = content(parts).filter((d) => d.x >= groups[3].left - 1e-6 && d.x <= groups[3].right + 1e-6);
  const topY = Math.min(...inLast.map((d) => d.y));
  const botY = Math.max(...inLast.map((d) => d.y));
  assert.ok(botY - topY > 16);
  assert.equal(inLast.filter((d) => Math.abs(d.y - topY) < 1e-6).length, 1);

  const stopped = chartOf({
    op: "addDotPattern",
    x: 10,
    y: 100,
    arrowStyle: "block",
    trailingArrow: false,
    patterns: [{ rows: [1] }, { rows: [1, 2] }, { rows: [1, 2, 3] }, { rows: [1, 2, 3, 4] }],
  });
  assert.equal(blocks(stopped.parts).length, 3);
  assert.equal(ellipsis(stopped.parts).length, 3);
});

test("line and block arrows share endpoints, and canvas parts match documentToSvg", () => {
  const op = {
    op: "addDotPattern",
    x: 0,
    y: 40,
    arrowStyle: "block",
    patterns: [[[0, 0]], [[1, 0], [0, 0]]],
  };
  const block = chartOf(op);
  const line = chartOf({ ...op, arrowStyle: "line" });
  const b = blocks(block.parts);
  const s = shafts(line.parts);
  assert.equal(b.length, s.length);
  for (let i = 0; i < b.length; i++) {
    assert.ok(Math.abs(b[i].x1 - s[i].x1) < 1e-6);
    assert.ok(Math.abs(b[i].tip - s[i].tip) < 1e-6);
    assert.ok(Math.abs(b[i].y - s[i].y) < 1e-6);
  }

  const svg = svgStatChart(block.raw, (x, y) => ({ x, y }), { stroke: 1.2, scale: 1 });
  for (const poly of block.parts.polygons) {
    const pts = poly.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    assert.ok(svg.includes(pts), pts);
  }
  for (const d of block.parts.dots) {
    assert.ok(svg.includes(`cx="${d.x.toFixed(2)}"`));
    assert.ok(svg.includes(`cy="${d.y.toFixed(2)}"`));
  }
  const lineSvg = svgStatChart(line.raw, (x, y) => ({ x, y }), { stroke: 1.2, scale: 1 });
  for (const ln of line.parts.lines) {
    assert.ok(lineSvg.includes(`x1="${ln.x1.toFixed(2)}"`));
    assert.ok(lineSvg.includes(`y1="${ln.y1.toFixed(2)}"`));
    assert.ok(lineSvg.includes(`x2="${ln.x2.toFixed(2)}"`));
    assert.ok(lineSvg.includes(`y2="${ln.y2.toFixed(2)}"`));
  }

  const exported = documentToSvg(block.doc, { scale: 2 });
  const polys = [...exported.matchAll(/<polygon points="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(polys.length, block.parts.polygons.length);
  polys.forEach((spec, i) => {
    const pts = spec.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
    const world = block.parts.polygons[i].points;
    assert.equal(pts.length, world.length);
    for (let k = 1; k < pts.length; k++) {
      const dx = (pts[k][0] - pts[0][0]) / 2;
      const dy = (pts[k][1] - pts[0][1]) / 2;
      assert.ok(Math.abs(dx - (world[k].x - world[0].x)) < 0.02);
      assert.ok(Math.abs(dy - (world[k].y - world[0].y)) < 0.02);
    }
  });
  assert.equal(exported.includes("<polygon"), true);
  assert.equal(svgStatChart(block.raw, (x, y) => ({ x, y }), { stroke: 1.2, scale: 1 }).includes('fill="none"'), true);
});

test("arrowGap and arrowWidth move the pad, and a tight gap is raised to 18", () => {
  function pads(extra) {
    const { raw, parts } = chartOf({
      op: "addDotPattern",
      x: 0,
      y: 0,
      patterns: [[[0, 0]], [[0, 0]]],
      ...extra,
    });
    const arrows = shafts(parts);
    const groups = groupsOf(parts);
    return {
      raw,
      left: arrows[0].x1 - (groups[0].right + RADIUS),
      right: groups[1].left - RADIUS - arrows[0].tip,
      width: arrows[0].tip - arrows[0].x1,
      span: groups[1].left - groups[0].right,
    };
  }
  const wider = pads({ arrowGap: 22 });
  assert.equal(wider.raw.arrowGap, 22);
  assert.ok(Math.abs(wider.left - 22) < 1e-6);
  assert.ok(Math.abs(wider.right - 22) < 1e-6);
  assert.ok(Math.abs(wider.width - WIDTH) < 1e-6);

  const narrow = pads({ arrowWidth: 26 });
  assert.equal(narrow.raw.arrowWidth, 26);
  assert.ok(Math.abs(narrow.width - 26) < 1e-6);
  assert.ok(narrow.left + 1e-6 >= CLEARANCE);
  assert.ok(narrow.right + 1e-6 >= CLEARANCE);

  const floored = pads({ arrowGap: 10 });
  assert.equal(floored.raw.arrowGap, 10);
  assert.ok(Math.abs(floored.left - CLEARANCE) < 1e-6);
  assert.ok(Math.abs(floored.right - CLEARANCE) < 1e-6);

  const roomy = pads({ patternGap: 120 });
  assert.ok(Math.abs(roomy.span - 120) < 1e-6);
  assert.ok(Math.abs(roomy.width - WIDTH) < 1e-6);
  assert.ok(roomy.left > GAP && roomy.right > GAP);
  assert.ok(Math.abs(roomy.left - roomy.right) < 1e-6);

  const quiet = chartOf({
    op: "addDotPattern",
    x: 0,
    y: 0,
    showArrows: false,
    patterns: [[[0, 0]], [[0, 0]]],
  });
  assert.equal(shafts(quiet.parts).length, 0);
  assert.equal(ellipsis(quiet.parts).length, 0);
  const quietGroups = groupsOf(quiet.parts);
  assert.ok(Math.abs(quietGroups[1].left - quietGroups[0].right - 64) < 1e-6);
});
