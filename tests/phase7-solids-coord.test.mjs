import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOps,
  documentToSvg,
  validateDiagram,
  APP_VERSION,
  OP_NAMES,
  coordCurveInk,
  COORD_CURVE_INK_PAPER,
  COORD_CURVE_INK_DARK,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for solids phase 7", () => {
  assert.equal(APP_VERSION, "13.5.57");
  assert.ok(OP_NAMES.includes("add3DPolyhedron"));
});

function curveStrokes(svg) {
  const paths = [...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="([^"]+)"/g)];
  return paths.filter((m) => (m[1].match(/L/g) || []).length > 5).map((m) => m[2]);
}

test("unlabeled single line exports #111111, not white", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 80,
      oy: 80,
      unitPx: 20,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 4,
      curves: [{ type: "line", params: { m: 0.5, c: 2 } }],
    },
  ]);
  const curve = doc.coordPlots[0].curves[0];
  assert.equal(curve.color, undefined);
  assert.equal(curve.label.show, false);
  assert.equal(coordCurveInk(curve, "paper"), COORD_CURVE_INK_PAPER);
  assert.equal(coordCurveInk(curve, "dark"), COORD_CURVE_INK_DARK);
  assert.notEqual(COORD_CURVE_INK_PAPER.toLowerCase(), "#ffffff");
  const strokes = curveStrokes(documentToSvg(doc));
  assert.ok(strokes.length >= 1);
  for (const s of strokes) {
    assert.equal(s, "#111111");
    assert.notEqual(s.toLowerCase(), "#ffffff");
  }
});

test("curve label text without kind renders custom subscript", () => {
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 40,
      oy: 160,
      unitPx: 24,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 4,
      curves: [
        {
          type: "line",
          params: { m: 1, c: 0 },
          label: { text: "L_1" },
        },
      ],
    },
  ]);
  const lab = doc.coordPlots[0].curves[0].label;
  assert.equal(lab.kind, "custom");
  assert.equal(lab.customText, "L_1");
  assert.equal(lab.show, true);
  const svg = documentToSvg(doc);
  assert.match(svg, /<tspan[^>]*font-style="italic"[^>]*>L<\/tspan>/);
  assert.match(svg, /<tspan[^>]*baseline-shift="sub"[^>]*>1<\/tspan>/);

  const formula = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 40,
      oy: 160,
      unitPx: 24,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 4,
      curves: [
        {
          type: "line",
          params: { m: 1, c: 0 },
          label: { kind: "formula", text: "L_1", show: true },
        },
      ],
    },
  ]);
  assert.equal(formula.coordPlots[0].curves[0].label.kind, "formula");
  const svgF = documentToSvg(formula);
  assert.match(svgF, /mx\+c/);
  assert.doesNotMatch(svgF, /baseline-shift="sub"/);
});

function spanY(doc) {
  const ys = doc.points.map((p) => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

test("omitted solid h matches legacy vertices; h changes height", () => {
  const cell = 20;
  const x0 = 10;
  const y0 = 20;
  const w = 80;
  const cuboid = [
    [-4, 2],
    [1, 3],
    [4, 1],
    [-1, 0],
    [-4, -1],
    [1, 0],
    [4, -2],
    [-1, -3],
  ];
  const cellW = 8;
  const scale = w / (cellW * cell);
  const legacy = cuboid.map(([ci, cj]) => [ci * cell * scale + x0, cj * cell * scale + y0]);
  const plain = applyOps(null, [{ op: "addShape", kind: "cuboid", x: x0, y: y0, w }]);
  assert.equal(plain.points.length, 8);
  for (let i = 0; i < legacy.length; i++) {
    assert.ok(Math.abs(plain.points[i].x - legacy[i][0]) < 1e-6, `x ${i}`);
    assert.ok(Math.abs(plain.points[i].y - legacy[i][1]) < 1e-6, `y ${i}`);
  }
  assert.ok(Math.abs(spanY(plain) - 60) < 1e-6);

  const tall = applyOps(null, [{ op: "addShape", kind: "cuboid", x: x0, y: y0, w, h: 120 }]);
  assert.ok(Math.abs(spanY(tall) - 120) < 1e-6);
  for (let i = 0; i < plain.points.length; i++) {
    assert.ok(Math.abs(tall.points[i].x - plain.points[i].x) < 1e-6);
  }
  assert.ok(Math.abs(tall.points[0].y - plain.points[0].y) > 1);
  assert.equal(validateDiagram(tall).ok, true);
});

test("apexOffset, includeBaseCenter KO, and dotted height", () => {
  const base = applyOps(null, [
    { op: "addShape", kind: "pyramid", x: 0, y: 0, w: 70, idPrefix: "K" },
  ]);
  const doc = applyOps(null, [
    {
      op: "addShape",
      kind: "pyramid",
      x: 0,
      y: 0,
      w: 70,
      idPrefix: "K",
      apexOffset: [30, -12],
      includeBaseCenter: true,
      drawHeight: true,
    },
  ]);
  const v0 = base.points.find((p) => p.id === "K4");
  const v1 = doc.points.find((p) => p.id === "K4");
  assert.ok(Math.abs(v1.x - v0.x - 30) < 1e-6);
  assert.ok(Math.abs(v1.y - v0.y - -12) < 1e-6);
  for (const id of ["K0", "K1", "K2", "K3"]) {
    const a = base.points.find((p) => p.id === id);
    const b = doc.points.find((p) => p.id === id);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
  }
  const o = doc.points.find((p) => p.id === "KO");
  assert.ok(o);
  const dotted = doc.segments.find(
    (s) =>
      s.style === "dotted" &&
      ((s.a === "KO" && s.b === "K4") || (s.a === "K4" && s.b === "KO"))
  );
  assert.ok(dotted);
  assert.equal(validateDiagram(doc).ok, true);

  const cone = applyOps(null, [
    {
      op: "addShape",
      kind: "cone",
      x: 0,
      y: 0,
      w: 80,
      idPrefix: "N",
      apexOffset: [16, 4],
    },
  ]);
  const coneBase = applyOps(null, [
    { op: "addShape", kind: "cone", x: 0, y: 0, w: 80, idPrefix: "N" },
  ]);
  const cv = cone.points.find((p) => p.id === "N4");
  const cv0 = coneBase.points.find((p) => p.id === "N4");
  assert.ok(Math.abs(cv.x - cv0.x - 16) < 1e-6);
  assert.ok(Math.abs(cv.y - cv0.y - 4) < 1e-6);
});

function polylineLens(svg) {
  const m = svg.match(/<polyline points="([^"]+)"/);
  assert.ok(m, "polyline");
  const nums = m[1].trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  assert.equal(pts.length, 3);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { d12: d(pts[0], pts[1]), d23: d(pts[1], pts[2]) };
}

test("addRightAngle mode 3d and skew draw the world parallelogram", () => {
  const pts = [
    { op: "addPoint", id: "V", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 60, y: 20 },
    { op: "addPoint", id: "B", x: 10, y: 50 },
  ];
  const flat = applyOps(null, [
    ...pts,
    { op: "addRightAngle", vertex: "V", arm1: "A", arm2: "B", size: 12 },
  ]);
  const skew = applyOps(null, [
    ...pts,
    { op: "addRightAngle", vertex: "V", arm1: "A", arm2: "B", mode: "3d", size: 12 },
  ]);
  const alias = applyOps(null, [
    ...pts,
    { op: "addRightAngle", vertex: "V", arm1: "A", arm2: "B", skew: true, size: 12 },
  ]);
  assert.equal(flat.rightAngles[0].mode, undefined);
  assert.equal(skew.rightAngles[0].mode, "3d");
  assert.equal(alias.rightAngles[0].mode, "3d");
  const d3 = polylineLens(documentToSvg(skew));
  const d2 = polylineLens(documentToSvg(flat));
  const dA = polylineLens(documentToSvg(alias));
  assert.ok(Math.abs(d3.d12 - d3.d23) < 0.25);
  assert.ok(Math.abs(d3.d12 - 12 * 2) < 0.2, `3d side ${d3.d12}`);
  assert.ok(Math.abs(dA.d12 - d3.d12) < 0.05);
  assert.ok(Math.abs(d2.d12 - d3.d12) > 8, `2d side ${d2.d12} vs 3d ${d3.d12}`);
});

test("add3DPolyhedron front edge is solid and back-only edge is dashed", () => {
  const doc = applyOps(null, [
    {
      op: "add3DPolyhedron",
      origin: [100, 100],
      scale: 30,
      yawDeg: 0,
      pitchDeg: 0,
      idPrefix: "K",
      vertices: {
        A: [0, 0, 1],
        B: [1, 0, 1],
        C: [1, 1, 1],
        D: [0, 1, 1],
        E: [0, 0, 0],
        H: [0, 1, 0],
        G: [1, 1, 0],
        F: [1, 0, 0],
      },
      faces: [
        ["A", "B", "C", "D"],
        ["E", "H", "G", "F"],
      ],
    },
  ]);
  const style = (a, b) => {
    const s = doc.segments.find(
      (seg) => (seg.a === a && seg.b === b) || (seg.a === b && seg.b === a)
    );
    return s && s.style;
  };
  assert.equal(style("KA", "KB"), "solid");
  assert.equal(style("KE", "KH"), "dashed");
  assert.ok(doc.points.some((p) => p.id === "KA"));
  assert.equal(doc.labels.find((l) => l.pointId === "KA").text, "A");
  assert.equal(doc.segments[0].id, "Ks0");
  const quiet = applyOps(null, [
    {
      op: "add3DPolyhedron",
      origin: [0, 0],
      scale: 10,
      yawDeg: 0,
      pitchDeg: 0,
      labels: false,
      vertices: {
        A: [0, 0, 1],
        B: [1, 0, 1],
        C: [0, 1, 1],
      },
      faces: [["A", "B", "C"]],
    },
  ]);
  assert.equal(quiet.labels.length, 0);
  assert.deepEqual(
    quiet.points.map((p) => p.id),
    ["A", "B", "C"]
  );
  assert.ok(quiet.segments.every((s) => s.style === "solid"));
  assert.equal(validateDiagram(doc).ok, true, validateDiagram(doc).errors.join("; "));
});

function ellipseCenter(doc, el) {
  return doc.points.find((p) => p.id === el.centerId);
}
function ellipseRadii(doc, el) {
  const c = ellipseCenter(doc, el);
  const rx = doc.points.find((p) => p.id === el.rxId);
  const ry = doc.points.find((p) => p.id === el.ryId);
  return {
    rx: Math.hypot(rx.x - c.x, rx.y - c.y),
    ry: Math.hypot(ry.x - c.x, ry.y - c.y),
  };
}

test("cylinder and cone waterLevel 0.5 split the ellipse", () => {
  const cyl = applyOps(null, [
    { op: "addShape", kind: "cylinder", x: 0, y: 0, w: 80, waterLevel: 0.5 },
  ]);
  assert.equal(cyl.ellipses.length, 3);
  const water = cyl.ellipses[2];
  assert.equal(water.backDashed, true);
  const c = ellipseCenter(cyl, water);
  assert.ok(Math.abs(c.x) < 1e-6);
  assert.ok(Math.abs(c.y) < 1e-6);
  const rad = ellipseRadii(cyl, water);
  assert.ok(Math.abs(rad.rx - 40) < 1e-6);
  assert.ok(Math.abs(rad.ry - 10) < 1e-6);

  const cone = applyOps(null, [
    {
      op: "addShape",
      kind: "cone",
      x: 0,
      y: 0,
      w: 80,
      waterLevel: 0.5,
      apexOffset: [20, 0],
    },
  ]);
  const cw = cone.ellipses[cone.ellipses.length - 1];
  assert.equal(cw.backDashed, true);
  const cc = ellipseCenter(cone, cw);
  assert.ok(Math.abs(cc.x - 10) < 1e-6);
  assert.ok(Math.abs(cc.y - -5) < 1e-6);
  const cr = ellipseRadii(cone, cw);
  assert.ok(Math.abs(cr.rx - 20) < 1e-6);
  assert.ok(Math.abs(cr.ry - 5) < 1e-6);

  const svg = documentToSvg(cyl);
  const arcs = [...svg.matchAll(/<path d="M[^"]*\sA[^"]*"[^>]*>/g)].map((m) => m[0]);
  const solid = arcs.filter((a) => !a.includes("stroke-dasharray"));
  const dashed = arcs.filter((a) => a.includes("stroke-dasharray"));
  assert.ok(solid.length >= 1);
  assert.ok(dashed.length >= 1);
  assert.equal(validateDiagram(cyl).ok, true);
  assert.equal(validateDiagram(cone).ok, true);
});
