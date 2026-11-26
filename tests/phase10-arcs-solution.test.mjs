import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  arcDraw,
  bearingArcSize,
  documentToSvg,
  effectiveArcRadius,
  emptyDiagram,
  pieArcSize,
  validateDiagram,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.51", () => {
  assert.equal(APP_VERSION, "13.5.51");
  assert.equal(emptyDiagram().layers.solutionShow, true);
});

function pt(doc, id) {
  return doc.points.find((p) => p.id === id);
}

test("angle arc default size is 18 and clamps to the shorter arm", () => {
  const open = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 100, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 100 },
    { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", text: "90°" },
    { op: "addReflex", vertex: "O", arm1: "A", arm2: "B" },
  ]);
  assert.equal(open.angleArcs[0].size, 18);
  assert.equal(open.angleArcs[1].size, 18);
  assert.equal("role" in open.angleArcs[0], false);
  assert.equal("role" in open.points[0], false);
  const g = arcDraw(open.angleArcs[0], pt(open, "O"), pt(open, "A"), pt(open, "B"));
  assert.equal(g.effectiveR, 18);
  assert.ok(Math.abs(g.textR - 29) < 1e-9);

  const tight = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 40, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 40 },
    { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", size: 26, text: "θ" },
  ]);
  const tg = arcDraw(tight.angleArcs[0], pt(tight, "O"), pt(tight, "A"), pt(tight, "B"));
  assert.equal(tight.angleArcs[0].size, 26);
  assert.equal(tg.effectiveR, effectiveArcRadius(26, 40));
  assert.equal(tg.effectiveR, 12);
  assert.ok(Math.abs(tg.textR - (12 + 11)) < 1e-9);
  const svg = documentToSvg(tight, { scale: 2 });
  assert.match(svg, /A24\.00,24\.00/);

  const forced = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 40, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 40 },
    { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", size: 26, forceRadius: true },
  ]);
  const fg = arcDraw(forced.angleArcs[0], pt(forced, "O"), pt(forced, "A"), pt(forced, "B"));
  assert.equal(fg.effectiveR, 26);

  const narrow = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 100, y: 0 },
    { op: "addPoint", id: "B", x: 100 * Math.cos((10 * Math.PI) / 180), y: 100 * Math.sin((10 * Math.PI) / 180) },
    { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", text: "10°" },
  ]);
  const ng = arcDraw(narrow.angleArcs[0], pt(narrow, "O"), pt(narrow, "A"), pt(narrow, "B"));
  assert.ok(ng.textR > ng.effectiveR + 11);
  assert.equal(validateDiagram(narrow).ok, true);
});

test("pie center arc size and the 0.70 label split", () => {
  assert.equal(pieArcSize(95), 16);
  assert.equal(pieArcSize(80), 15);
  assert.equal(pieArcSize(80, 22), 22);
  const doc = applyOps(null, [
    {
      op: "addPieChart",
      x: 200,
      y: 220,
      r: 80,
      slices: [
        { angle: 90, label: "Q1", angleText: "90°" },
        { angle: 270, label: "rest" },
      ],
    },
  ]);
  const arc = doc.angleArcs.find((a) => a.text === "90°");
  assert.equal(arc.size, 15);
  const v = pt(doc, arc.vertex);
  const a1 = pt(doc, arc.arm1);
  const a2 = pt(doc, arc.arm2);
  const g = arcDraw(arc, v, a1, a2);
  assert.equal(g.effectiveR, 15);
  assert.ok(Math.abs(g.textR - 26) < 1e-9);
  const q1 = doc.texts.find((t) => t.text === "Q1");
  const mid = Math.PI / 4;
  assert.ok(Math.abs(q1.x - (200 + 0.7 * 80 * Math.cos(mid))) < 1e-6);
  assert.ok(Math.abs(q1.y - (220 + 0.7 * 80 * Math.sin(mid))) < 1e-6);
  const rest = doc.texts.find((t) => t.text === "rest");
  assert.ok(Math.abs(Math.hypot(rest.x - 200, rest.y - 220) - 0.62 * 80) < 1e-6);
});

test("bearing arc is at most 16 and at most 0.3·northLen", () => {
  assert.equal(bearingArcSize(56), 16);
  assert.equal(bearingArcSize(30), 9);
  assert.equal(bearingArcSize(100, 40), 30);
  const doc = applyOps(null, [
    { op: "addPoint", id: "P", x: 0, y: 0 },
    { op: "addPoint", id: "Q", x: 40, y: -30 },
    { op: "addBearing", at: "P", to: "Q", northLen: 30, text: "θ" },
  ]);
  assert.equal(doc.angleArcs.length, 1);
  assert.ok(doc.angleArcs[0].size <= 16);
  assert.ok(doc.angleArcs[0].size <= 30 * 0.3 + 1e-9);
  assert.equal(doc.angleArcs[0].size, 9);
});

test("solution ink is #dc2626 on white, inherited by addFoot, hidden by solutionShow, and explicit color wins", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 120, y: 0 },
    { op: "addPoint", id: "C", x: 40, y: 80 },
    { op: "addSegment", id: "q", a: "A", b: "B" },
    { op: "addSegment", id: "s", a: "A", b: "C", solution: true },
    { op: "addFoot", pointId: "C", a: "A", b: "B", solution: true, footId: "H" },
    { op: "addFill", pointIds: ["A", "B", "C"], solution: true },
  ]);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
  assert.equal(doc.segments.find((s) => s.id === "s").role, "solution");
  assert.equal("color" in doc.segments.find((s) => s.id === "s"), false);
  assert.equal(pt(doc, "H").role, "solution");
  const alt = doc.segments.find((s) => s.a === "C" && s.b === "H" || s.a === "H" && s.b === "C");
  assert.equal(alt.role, "solution");
  assert.equal(doc.fills[0].role, "solution");
  assert.equal("color" in doc.fills[0], false);
  const svg = documentToSvg(doc);
  assert.match(svg, /#dc2626/);
  assert.match(svg, /rgba\(220,38,38,0\.25\)/);
  assert.match(svg, /stroke="#111"/);

  const hidden = applyOps(doc, [{ op: "setLayers", solutionShow: false }]);
  assert.equal(hidden.layers.solutionShow, false);
  assert.equal(hidden.segments.find((s) => s.id === "s").role, "solution");
  const svgOff = documentToSvg(hidden);
  assert.equal(svgOff.includes("#dc2626"), false);
  assert.equal(svgOff.includes("rgba(220,38,38"), false);
  assert.match(svgOff, /stroke="#111"/);

  const colored = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 80, y: 20 },
    { op: "addSegment", a: "A", b: "B", role: "solution", color: "#2563eb" },
  ]);
  const seg = colored.segments[0];
  assert.equal(seg.role, "solution");
  assert.equal(seg.color, "#2563eb");
  const painted = documentToSvg(colored);
  assert.match(painted, /#2563eb/);
  assert.equal(painted.includes("#dc2626"), false);
});
