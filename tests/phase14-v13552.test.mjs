import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  applyOps,
  curveLabelTExplicit,
  curveLabelWorld,
  documentToSvg,
  coordSampleOneCurve,
} from "../src/diagram/index.mjs";

test("APP_VERSION is 13.5.63", () => {
  assert.equal(APP_VERSION, "13.5.63");
});

function boxClearance(plot, lab) {
  const fs = 14;
  const w = Math.max(14, String(lab.text || "").length * fs * 0.56);
  const box = {
    x0: lab.x - w / 2,
    y0: lab.y - fs * 0.62,
    x1: lab.x + w / 2,
    y1: lab.y + fs * 0.48,
  };
  const axisX =
    box.y0 <= plot.oy && box.y1 >= plot.oy
      ? 0
      : Math.min(Math.abs(box.y0 - plot.oy), Math.abs(box.y1 - plot.oy));
  const axisY =
    box.x0 <= plot.ox && box.x1 >= plot.ox
      ? 0
      : Math.min(Math.abs(box.x0 - plot.ox), Math.abs(box.x1 - plot.ox));
  let curve = Infinity;
  for (const c of plot.curves) {
    for (const p of coordSampleOneCurve(plot, c)) {
      if (!p) continue;
      const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1);
      const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1);
      curve = Math.min(curve, Math.hypot(dx, dy));
    }
  }
  return { axis: Math.min(axisX, axisY), curve };
}

test("omitted t and t auto are not the 0.55 default", () => {
  assert.equal(curveLabelTExplicit(undefined), false);
  assert.equal(curveLabelTExplicit(""), false);
  assert.equal(curveLabelTExplicit("auto"), false);
  assert.equal(curveLabelTExplicit(0.55), true);
  const doc = applyOps(null, [
    {
      op: "addCoordPlot",
      id: "p",
      ox: 0,
      oy: 0,
      unitPx: 40,
      xmin: -1,
      xmax: 4,
      ymin: -2,
      ymax: 5,
      curves: [
        {
          id: "a",
          type: "quad",
          params: { a: 1, b: 0, c: 0 },
          label: { show: true, text: "y=x^2" },
        },
        {
          id: "b",
          type: "quad",
          params: { a: 1, b: -4, c: 3 },
          label: { show: true, text: "y=(x-2)^2-1", t: "auto" },
        },
      ],
    },
  ]);
  for (const curve of doc.coordPlots[0].curves) {
    assert.equal(curve.label.t, undefined);
    assert.equal(curve.label.show, true);
  }
});

test("2012-style parabolas and three lines keep labels off axes and curves", () => {
  const parabolas = {
    ox: 200,
    oy: 240,
    unitPx: 36,
    xUnitPx: 36,
    yUnitPx: 36,
    xmin: -1,
    xmax: 4,
    ymin: -2,
    ymax: 5,
    curves: [
      {
        id: "c1",
        type: "quad",
        params: { a: 1, b: 0, c: 0 },
        label: { show: true, text: "y=x^2" },
      },
      {
        id: "c2",
        type: "quad",
        params: { a: 1, b: -4, c: 3 },
        label: { show: true, text: "y=(x-2)^2-1" },
      },
    ],
  };
  const lines = {
    ox: 180,
    oy: 260,
    unitPx: 32,
    xmin: -1,
    xmax: 6,
    ymin: 0,
    ymax: 7,
    curves: [
      { id: "L1", type: "line", params: { m: 0, c: 3 }, label: { show: true, text: "y=3" } },
      { id: "L2", type: "line", params: { m: 1, c: 3 }, label: { show: true, text: "y=x+3" } },
      { id: "L3", type: "line", params: { m: -2, c: 6 }, label: { show: true, text: "y=6-2x" } },
    ],
  };
  for (const plot of [parabolas, lines]) {
    for (const curve of plot.curves) {
      const lab = curveLabelWorld(plot, curve);
      const pinned = curveLabelWorld(plot, {
        ...curve,
        label: { ...curve.label, t: 0.55 },
      });
      const clear = boxClearance(plot, lab);
      assert.ok(clear.axis > 8, `${curve.id} axis ${clear.axis}`);
      assert.ok(clear.curve > 6, `${curve.id} curve ${clear.curve}`);
      assert.ok(Math.hypot(lab.x - pinned.x, lab.y - pinned.y) > 1, curve.id);
    }
  }
});

test("solutionStep 2 is on compound SVG marks and hidden above solutionMaxStep", () => {
  const shown = applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "B", x: 90, y: 0 },
    { op: "addPoint", id: "P", x: 40, y: 50 },
    { op: "addSegment", id: "AB", a: "A", b: "B" },
    {
      op: "addFoot",
      pointId: "P",
      segmentId: "AB",
      footId: "F",
      altitudeId: "alt",
      role: "solution",
      solutionStep: 2,
    },
    {
      op: "addLengthLabel",
      id: "len",
      segmentId: "AB",
      text: "8",
      role: "solution",
      solutionStep: 2,
    },
    {
      op: "addRightAngle",
      id: "ra",
      vertex: "F",
      arm1: "P",
      arm2: "B",
      role: "solution",
      solutionStep: 2,
    },
    {
      op: "addAngleArc",
      id: "ang",
      vertex: "P",
      arm1: "F",
      arm2: "B",
      text: "θ",
      role: "solution",
      solutionStep: 2,
    },
    {
      op: "addCoordPlot",
      id: "plot",
      ox: 200,
      oy: 40,
      unitPx: 20,
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 4,
    },
    {
      op: "addPlotPoint",
      id: "Q",
      plotId: "plot",
      u: 2,
      v: 3,
      role: "solution",
      solutionStep: 2,
    },
    {
      op: "addCumulativeFrequency",
      id: "og",
      x: 20,
      y: 180,
      boundaries: [0, 10, 20],
      values: [0, 8, 20],
      projections: [{ y: 10, xLabel: "m", role: "solution", solutionStep: 2 }],
    },
  ]);
  assert.equal(shown.layers.solutionMaxStep, undefined);
  const svg = documentToSvg(shown, { hidePoints: false });
  for (const id of ["alt", "len", "ra", "ang", "Q", "og"]) {
    assert.match(svg, new RegExp(`data-id="${id}"[^>]*data-role="solution"`));
    assert.match(svg, new RegExp(`data-id="${id}"[^>]*data-step="2"`));
  }
  const hidden = applyOps(shown, [{ op: "setLayers", solutionShow: true, solutionMaxStep: 1 }]);
  assert.equal(hidden.layers.solutionMaxStep, 1);
  assert.equal(hidden.layers.solutionShow, true);
  const clipped = documentToSvg(hidden, { hidePoints: false });
  assert.equal(clipped.includes('data-step="2"'), false);
  assert.equal(clipped.includes('data-id="alt"'), false);
  assert.equal(clipped.includes('data-id="Q"'), false);
});

test("auto viewBox keeps at least 16px around a sphere", () => {
  const doc = applyOps(null, [{ op: "addShape", kind: "sphere", x: 120, y: 100, w: 48 }]);
  const svg = documentToSvg(doc, { scale: 2 });
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const cir = svg.match(/<circle cx="([0-9.]+)" cy="([0-9.]+)" r="([0-9.]+)" fill="none"/);
  assert.ok(vb && cir, svg.slice(0, 300));
  const w = Number(vb[1]);
  const h = Number(vb[2]);
  const cx = Number(cir[1]);
  const cy = Number(cir[2]);
  const r = Number(cir[3]);
  assert.ok(cx - r >= 16 && cy - r >= 16, `left/top ${cx - r},${cy - r}`);
  assert.ok(w - (cx + r) >= 16 && h - (cy + r) >= 16, `right/bottom ${w - cx - r},${h - cy - r}`);
});

test("hemisphere and sphere accept role solution", () => {
  const doc = applyOps(null, [
    {
      op: "addShape",
      kind: "hemisphere",
      x: 80,
      y: 80,
      w: 40,
      opening: "up",
      waterLevel: 0.6,
      includeBaseCenter: true,
      role: "solution",
      solutionStep: 2,
    },
  ]);
  assert.equal(doc.sectors[0].role, "solution");
  assert.equal(doc.sectors[0].solutionStep, 2);
  assert.ok(doc.ellipses.every((e) => e.role === "solution" && e.solutionStep === 2));
  const o = doc.points.find((p) => p.id === "O");
  assert.equal(o.role, "solution");
  const svg = documentToSvg(doc);
  assert.match(svg, /#dc2626/);
  assert.match(svg, /data-role="solution"/);
  assert.match(svg, /data-step="2"/);
  const plain = applyOps(null, [{ op: "addShape", kind: "square", x: 0, y: 0, w: 20, role: "solution" }]);
  assert.equal(plain.points.some((p) => p.role), false);
});
