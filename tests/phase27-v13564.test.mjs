/**
 * v13.5.64 — annular pathFill hatch follows each arc, and a later solid
 * sector paints above an earlier hatch.
 * Outer arc D→C is sampled at its own radius. Clockwise from→to stays on
 * the minor arc. The clip is that polyline, not the chord DC.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
  fillOutlinePoints,
  pointInPolygon,
  sampleMinorArc,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.65", () => {
  assert.equal(APP_VERSION, "13.5.65");
});

function polar(id, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { op: "addPoint", id, x: r * Math.cos(a), y: r * Math.sin(a) };
}

/** Concentric annular sector. Outer arc bulges past the chord AABB. */
function abdcDoc(pattern) {
  return applyOps(null, [
    polar("O", 0, 0),
    polar("D", 100, -40),
    polar("C", 100, 40),
    polar("A", 50, 40),
    polar("B", 50, -40),
    {
      op: "addFill",
      id: "ann",
      kind: "pathFill",
      pattern,
      hatchSpacing: 6,
      edges: [
        { type: "arc", centerId: "O", from: "D", to: "C" },
        { type: "line", a: "C", b: "A" },
        { type: "arc", centerId: "O", from: "A", to: "B" },
        { type: "line", a: "B", b: "D" },
      ],
    },
  ]);
}

function pt(id, doc) {
  return doc.points.find((p) => p.id === id);
}

function outlineOf(doc, fill) {
  return fillOutlinePoints(fill, (id) => pt(id, doc));
}

test("first arc uses its own radius and a clockwise from→to stays minor", () => {
  const doc = abdcDoc("hatch");
  const edges = doc.fills[0].edges;
  assert.equal(edges[0].type, "arc");
  assert.equal(edges[0].from, "D");
  assert.equal(edges[0].to, "C");
  const outer = sampleMinorArc(pt("O", doc), pt("D", doc), pt("C", doc));
  assert.ok(outer && outer.length >= 3);
  for (const p of outer) {
    const rad = Math.hypot(p.x, p.y);
    assert.ok(Math.abs(rad - 100) < 0.05, `outer sample radius ${rad}`);
  }
  assert.ok(
    outer.some((p) => Math.hypot(p.x - 100, p.y) < 1.5),
    "minor-arc midpoint, not the chord"
  );

  const cw = sampleMinorArc(pt("O", doc), pt("C", doc), pt("D", doc));
  assert.ok(cw && cw.length >= 3);
  assert.ok(
    cw.some((p) => Math.hypot(p.x - 100, p.y) < 1.5),
    "clockwise sweep is the minor arc"
  );
  for (const p of cw) {
    assert.ok(p.x > 50, "clockwise samples must not jump to the major arc");
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 100) < 0.05);
  }

  const outline = outlineOf(doc, doc.fills[0]);
  const innerSamples = outline.filter((p) => Math.abs(Math.hypot(p.x, p.y) - 50) < 0.2);
  assert.ok(innerSamples.length >= 3, "inner arc A→B is sampled at radius 50");
  const at = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };
  const lune = at(92, 12);
  const annulus = at(72, 12);
  const hole = at(30, 12);
  const outside = at(110, 12);
  assert.ok(pointInPolygon(lune.x, lune.y, outline), "lune between chord DC and the outer arc");
  assert.ok(pointInPolygon(annulus.x, annulus.y, outline), "annulus inside the chord");
  assert.equal(pointInPolygon(hole.x, hole.y, outline), false, "inside the inner arc is outside the ring");
  assert.equal(pointInPolygon(outside.x, outside.y, outline), false);
});

function pathPoints(d) {
  const pts = [];
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(d))) pts.push({ x: Number(m[1]), y: Number(m[2]) });
  return pts;
}

test("SVG clip and hatch reach the outer arc, not only chord DC", () => {
  const doc = abdcDoc("hatch");
  const svg = documentToSvg(doc, { scale: 1, pad: 0, hidePoints: true });
  const clip = svg.match(/<clipPath id="hatchclip0"><path d="([^"]+)"/);
  assert.ok(clip, "hatch clip");
  assert.equal(svg.includes("<defs>"), true);
  const pts = pathPoints(clip[1]);
  assert.ok(pts.length > 6, "clip samples the arc instead of the four corners");
  const chordX = pts[0].x;
  const maxX = Math.max(...pts.map((p) => p.x));
  assert.ok(maxX > chordX + 18, `clip max x ${maxX} should pass chord x ${chordX}`);
  const bulge = maxX - chordX;
  assert.ok(bulge > 20 && bulge < 28, `bulge ${bulge} is the outer arc, not a huge wrong radius`);

  const lineXs = [...svg.matchAll(/\bx[12]="(-?\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  const pastChord = lineXs.filter((x) => x > chordX + 15);
  assert.ok(pastChord.length > 0, "hatch strokes cover the lune outside chord DC");

  const outline = outlineOf(doc, doc.fills[0]);
  assert.ok(pointInPolygon(92, 0, outline));
});

test("a later solid sector paints above an earlier sector hatch", () => {
  const doc = applyOps(null, [
    polar("O", 0, 0),
    polar("D", 100, -30),
    polar("C", 100, 60),
    polar("B", 40, -30),
    polar("A", 40, 60),
    {
      op: "addFill",
      id: "hat",
      kind: "sector",
      pattern: "hatch",
      hatchSpacing: 6,
      centerId: "O",
      startId: "D",
      endId: "C",
    },
    {
      op: "addFill",
      id: "white",
      kind: "sector",
      color: "#ffffff",
      opacity: 1,
      centerId: "O",
      startId: "B",
      endId: "A",
    },
  ]);
  assert.equal(doc.fills[0].id, "hat");
  assert.equal(doc.fills[1].id, "white");
  const hat = outlineOf(doc, doc.fills[0]);
  const white = outlineOf(doc, doc.fills[1]);
  const bis = (15 * Math.PI) / 180;
  const lune = { x: 96 * Math.cos(bis), y: 96 * Math.sin(bis) };
  const inner = { x: 28 * Math.cos(bis), y: 28 * Math.sin(bis) };
  const arcSide = { x: 36 * Math.cos(bis), y: 36 * Math.sin(bis) };
  assert.ok(pointInPolygon(lune.x, lune.y, hat), "sector hatch includes the arc, not only the chord");
  assert.ok(pointInPolygon(inner.x, inner.y, hat), "inner point is inside the earlier hatch");
  assert.ok(pointInPolygon(inner.x, inner.y, white));
  assert.ok(pointInPolygon(arcSide.x, arcSide.y, white), "white sector includes its arc, not only the chord");

  const svg = documentToSvg(doc, { scale: 1, pad: 0, hidePoints: true });
  const hatchGroupEnd = svg.indexOf("</g>");
  const solidAt = svg.indexOf('data-id="white"');
  assert.ok(hatchGroupEnd > 0 && solidAt > hatchGroupEnd, "solid sector is painted after the hatch lines");
  assert.match(svg, /A40\.00,40\.00/);
  const clip = svg.match(/<clipPath id="hatchclip0"><path d="([^"]+)"/);
  assert.ok(clip);
  const clipPts = pathPoints(clip[1]);
  const c = clipPts[0];
  const nearBisector = clipPts.filter((p) => {
    const ang = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
    return Math.abs(ang - 15) < 8;
  });
  assert.ok(
    nearBisector.some((p) => Math.hypot(p.x - c.x, p.y - c.y) > 90),
    "sector clip follows the arc through the bisector"
  );
});
