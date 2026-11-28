import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  documentToSvg,
  OP_NAMES,
  validateDiagram,
} from "../src/diagram/index.mjs";

function distToLine(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function withWarns(fn) {
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => {
    warns.push(args.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  };
  try {
    return { doc: fn(), warns };
  } finally {
    console.warn = orig;
  }
}

test("APP_VERSION is 13.5.62", () => {
  assert.equal(APP_VERSION, "13.5.62");
});

test("OP_NAMES includes triangle, bearing, and pie ops", () => {
  for (const name of [
    "addTriangleCenter",
    "addIncircle",
    "addCircumcircle",
    "addBearing",
    "addCompass",
    "addPieChart",
    "addPie",
  ]) {
    assert.ok(OP_NAMES.includes(name), name);
  }
});

test("incentre circle is within 1e-6 of all three sides", () => {
  const doc = applyOps(null, [
    { op: "addShape", kind: "rightTri", x: 0, y: 0, w: 300, h: 400, idPrefix: "K" },
    { op: "addIncircle", a: "KA", b: "B", c: "C", id: "I", circleId: "inc" },
  ]);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
  const I = doc.points.find((p) => p.id === "I");
  const A = doc.points.find((p) => p.id === "K0");
  const B = doc.points.find((p) => p.id === "K1");
  const C = doc.points.find((p) => p.id === "K2");
  assert.ok(Math.abs(I.x - 100) < 1e-6 && Math.abs(I.y - 100) < 1e-6);
  const cir = doc.circles.find((c) => c.id === "inc");
  assert.ok(cir);
  assert.equal(cir.centerId, "I");
  const through = doc.points.find((p) => p.id === cir.throughId);
  assert.equal(through.hidden, true);
  assert.ok(Math.abs(through.x - 100) < 1e-6 && Math.abs(through.y - 0) < 1e-6);
  const radius = dist(I, through);
  for (const [p, q] of [
    [A, B],
    [B, C],
    [C, A],
  ]) {
    assert.ok(Math.abs(distToLine(I, p, q) - radius) < 1e-6);
  }
  assert.ok(documentToSvg(doc).includes("<circle"));
});

test("incentre touch points lie on AB, BC, and CA", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 300, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 400 },
    {
      op: "addTriangleCenter",
      kind: "incenter",
      a: "A",
      b: "B",
      c: "C",
      id: "I",
      drawCircle: true,
      markTouchPoints: true,
      touchIds: ["Tab", "Tbc", "Tca"],
    },
  ]);
  const want = {
    Tab: { x: 100, y: 0 },
    Tbc: { x: 180, y: 160 },
    Tca: { x: 0, y: 100 },
  };
  for (const [id, xy] of Object.entries(want)) {
    const p = doc.points.find((q) => q.id === id);
    assert.ok(p, id);
    assert.notEqual(p.hidden, true);
    assert.ok(Math.abs(p.x - xy.x) < 1e-6 && Math.abs(p.y - xy.y) < 1e-6, id);
  }
  const cir = doc.circles[0];
  assert.equal(cir.throughId, "Tab");
});

test("circumcircle passes through the three vertices", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 300, y: 0 },
    { op: "addPoint", id: "C", x: 0, y: 400 },
    { op: "addCircumcircle", a: "A", b: "B", c: "C", id: "O" },
  ]);
  const O = doc.points.find((p) => p.id === "O");
  assert.ok(Math.abs(O.x - 150) < 1e-6 && Math.abs(O.y - 200) < 1e-6);
  const cir = doc.circles[0];
  assert.equal(cir.throughId, "A");
  const r = dist(O, doc.points.find((p) => p.id === "A"));
  for (const id of ["A", "B", "C"]) {
    assert.ok(Math.abs(dist(O, doc.points.find((p) => p.id === id)) - r) < 1e-6, id);
  }
});

test("centroid and orthocentre match a known acute triangle", () => {
  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 4, y: 0 },
    { op: "addPoint", id: "C", x: 1, y: 3 },
    { op: "addTriangleCenter", kind: "centroid", a: "A", b: "B", c: "C", id: "G", label: "G" },
    { op: "addTriangleCenter", kind: "orthocenter", a: "A", b: "B", c: "C", id: "H", label: "H", ox: 8, oy: -6 },
  ]);
  const G = doc.points.find((p) => p.id === "G");
  const H = doc.points.find((p) => p.id === "H");
  assert.ok(Math.abs(G.x - 5 / 3) < 1e-6 && Math.abs(G.y - 1) < 1e-6);
  assert.ok(Math.abs(H.x - 1) < 1e-6 && Math.abs(H.y - 1) < 1e-6);
  assert.equal(doc.circles.length, 0);
  assert.equal(doc.labels.find((l) => l.pointId === "H").ox, 8);
  assert.equal(validateDiagram(doc).ok, true);
});

test("collinear triangle warns and adds no circle", () => {
  const { doc, warns } = withWarns(() =>
    applyOps(null, [
      { op: "addPoint", id: "A", x: 0, y: 0 },
      { op: "addPoint", id: "B", x: 2, y: 0 },
      { op: "addPoint", id: "C", x: 5, y: 0 },
      { op: "addIncircle", a: "A", b: "B", c: "C", id: "I" },
      { op: "addCircumcircle", a: "A", b: "B", c: "C", id: "O" },
      { op: "addTriangleCenter", kind: "orthocentre", a: "A", b: "B", c: "C", id: "H" },
    ])
  );
  assert.equal(doc.circles.length, 0);
  assert.equal(doc.points.length, 3);
  assert.ok(warns.length >= 3);
  assert.ok(warns.every((w) => w.includes("skipped")));
});

test("addBearing draws the north segment, N, and an arc; cw over 180 uses reflex", () => {
  const ang = -Math.PI / 2 + (52 * Math.PI) / 180;
  const doc = applyOps(null, [
    { op: "addPoint", id: "P", x: 200, y: 200 },
    { op: "addPoint", id: "Q", x: 200 + Math.cos(ang) * 80, y: 200 + Math.sin(ang) * 80 },
    { op: "addBearing", at: "P", to: "Q", text: "52°" },
  ]);
  const tip = doc.points.find((p) => p.hidden === true && Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 144) < 1e-6);
  assert.ok(tip);
  const north = doc.segments.find(
    (s) =>
      s.style === "solid" &&
      ((s.a === "P" && s.b === tip.id) || (s.b === "P" && s.a === tip.id))
  );
  assert.ok(north);
  assert.equal(dist(doc.points.find((p) => p.id === "P"), tip), 56);
  const wings = doc.segments.filter((s) => s.a === tip.id || s.b === tip.id);
  assert.equal(wings.length, 3);
  assert.equal(doc.labels.find((l) => l.pointId === tip.id).text, "N");
  assert.equal(doc.angleArcs.length, 1);
  assert.equal(doc.angleArcs[0].vertex, "P");
  assert.equal(doc.angleArcs[0].arm2, "Q");
  assert.equal(doc.angleArcs[0].text, "52°");
  assert.equal(doc.angleArcs[0].reflex, false);
  assert.equal(doc.angleArcs[0].size, 16);
  assert.equal(doc.segments.some((s) => s.style === "dashed"), false);
  const svg = documentToSvg(doc);
  assert.ok(svg.includes("52"));
  assert.ok(svg.includes(">N<") || svg.includes(">N</text>"));

  const cw = applyOps(null, [
    { op: "addPoint", id: "P", x: 0, y: 0 },
    { op: "addPoint", id: "W", x: -100, y: 0 },
    { op: "addCompass", pointId: "P", to: "W", mode: "cw" },
  ]);
  assert.equal(cw.angleArcs.length, 1);
  assert.equal(cw.angleArcs[0].reflex, true);
  assert.equal(cw.labels.some((l) => l.text === "N"), true);

  const asTrue = applyOps(null, [
    { op: "addPoint", id: "P", x: 0, y: 0 },
    { op: "addPoint", id: "W", x: -40, y: 10 },
    { op: "addBearing", at: "P", to: "W", mode: "true", northLabel: false },
  ]);
  assert.equal(asTrue.angleArcs[0].reflex, true);
  assert.equal(asTrue.labels.length, 0);
  assert.equal(validateDiagram(cw).ok, true);
});

test("addPieChart splits by angle and by value, places a label, and marks a right angle", () => {
  const doc = applyOps(null, [
    {
      op: "addPieChart",
      x: 200,
      y: 220,
      slices: [
        { angle: 90, label: "Q1", rightAngle: true, angleText: "90°" },
        { angle: 270, angleText: "270°" },
      ],
    },
  ]);
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
  const r = 95;
  const ratio = 0.68;
  const mid = Math.PI / 4;
  const label = doc.texts.find((t) => t.text === "Q1");
  assert.ok(label);
  assert.ok(Math.abs(label.x - (200 + ratio * r * Math.cos(mid))) < 1e-6);
  assert.ok(Math.abs(label.y - (220 + ratio * r * Math.sin(mid))) < 1e-6);
  assert.equal(doc.rightAngles.length, 1);
  const center = doc.points.find((p) => Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 220) < 1e-6);
  assert.equal(center.hidden, true);
  assert.equal(doc.rightAngles[0].vertex, center.id);
  const arm1 = doc.points.find((p) => p.id === doc.rightAngles[0].arm1);
  const arm2 = doc.points.find((p) => p.id === doc.rightAngles[0].arm2);
  assert.ok(Math.abs(dist(center, arm1) - r) < 1e-6);
  assert.ok(Math.abs(dist(center, arm2) - r) < 1e-6);
  const dot = ((arm1.x - center.x) * (arm2.x - center.x) + (arm1.y - center.y) * (arm2.y - center.y)) / (r * r);
  assert.ok(Math.abs(dot) < 1e-6);
  assert.equal(doc.circles.length, 1);
  assert.equal(doc.fills.length, 3);
  const arc90 = doc.angleArcs.find((a) => a.text === "90°");
  const arc270 = doc.angleArcs.find((a) => a.text === "270°");
  assert.equal(arc90.reflex, false);
  assert.equal(arc270.reflex, true);
  assert.ok(documentToSvg(doc).includes("Q1"));

  const byValue = applyOps(null, [
    {
      op: "addPie",
      x: 100,
      y: 100,
      r: 80,
      slices: [
        { value: 1, label: "A" },
        { value: 1 },
        { value: 2 },
      ],
    },
  ]);
  assert.equal(byValue.texts.length, 1);
  assert.equal(byValue.texts[0].text, "A");
  const vr = 80;
  assert.ok(Math.abs(byValue.texts[0].x - (100 + 0.62 * vr * Math.cos(Math.PI / 4))) < 1e-6);
  assert.ok(Math.abs(byValue.texts[0].y - (100 + 0.62 * vr * Math.sin(Math.PI / 4))) < 1e-6);
  assert.equal(byValue.rightAngles.length, 0);
  assert.equal(byValue.fills.length, 3);
  assert.equal(byValue.circles.length, 1);
  const rim = [
    [180, 100],
    [100, 180],
    [20, 100],
  ];
  for (const [x, y] of rim) {
    assert.ok(
      byValue.points.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6),
      `${x},${y}`
    );
  }
  assert.equal(validateDiagram(byValue).ok, true);
});
