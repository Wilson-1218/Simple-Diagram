import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, documentToSvg, APP_VERSION } from "../src/diagram/index.mjs";

test("APP_VERSION bumped for keep-full-circles", () => {
  assert.equal(APP_VERSION, "13.5.30");
});

test("SVG keeps full circle when same-centre/same-radius arc exists", () => {
  // Minimal: circle O through A, plus arc on that circle A→B.
  const doc = applyOps(null, [
    { op: "addPoint", id: "O", x: 0, y: 0 },
    { op: "addPoint", id: "A", x: 50, y: 0 },
    { op: "addPoint", id: "B", x: 0, y: 50 },
    { op: "addCircle", id: "cO", centerId: "O", throughId: "A" },
    {
      op: "addSector",
      id: "arcAB",
      centerId: "O",
      startId: "A",
      endId: "B",
      mode: "arc",
    },
  ]);
  const svg = documentToSvg(doc, { scale: 1, pad: 0 });
  const circles = svg.match(/<circle\b/g) || [];
  assert.equal(circles.length, 1, "full circle must not be omitted for co-radius arc");
  assert.ok(/<path\b/.test(svg), "arc stroke should still export");
});

test("Part B Q2 style: three equilateral circles + arcs all export", () => {
  // Side 100; radius = half-side = 50. Centers A,B,C at equilateral vertices.
  const side = 100;
  const r = side / 2;
  const h = (Math.sqrt(3) / 2) * side;
  const Ax = 0;
  const Ay = 0;
  const Bx = side;
  const By = 0;
  const Cx = side / 2;
  const Cy = h;
  // Pairwise intersections (midpoints of sides for r = side/2).
  const MAB = { x: side / 2, y: 0 };
  const MBC = { x: (Bx + Cx) / 2, y: (By + Cy) / 2 };
  const MCA = { x: (Cx + Ax) / 2, y: (Cy + Ay) / 2 };

  const doc = applyOps(null, [
    { op: "addPoint", id: "A", x: Ax, y: Ay },
    { op: "addPoint", id: "B", x: Bx, y: By },
    { op: "addPoint", id: "C", x: Cx, y: Cy },
    { op: "addPoint", id: "rA", x: Ax + r, y: Ay },
    { op: "addPoint", id: "rB", x: Bx - r, y: By },
    { op: "addPoint", id: "rC", x: Cx, y: Cy - r },
    { op: "addPoint", id: "MAB", x: MAB.x, y: MAB.y },
    { op: "addPoint", id: "MBC", x: MBC.x, y: MBC.y },
    { op: "addPoint", id: "MCA", x: MCA.x, y: MCA.y },
    { op: "addCircle", id: "cA", centerId: "A", throughId: "rA" },
    { op: "addCircle", id: "cB", centerId: "B", throughId: "rB" },
    { op: "addCircle", id: "cC", centerId: "C", throughId: "rC" },
    {
      op: "addSector",
      id: "arcA",
      centerId: "A",
      startId: "MAB",
      endId: "MCA",
      mode: "arc",
    },
    {
      op: "addSector",
      id: "arcB",
      centerId: "B",
      startId: "MAB",
      endId: "MBC",
      mode: "arc",
    },
    {
      op: "addSector",
      id: "arcC",
      centerId: "C",
      startId: "MBC",
      endId: "MCA",
      mode: "arc",
    },
  ]);
  const svg = documentToSvg(doc, { scale: 1, pad: 0 });
  const circleCount = (svg.match(/<circle\b/g) || []).length;
  assert.equal(circleCount, 3, `expected 3 full circles, got ${circleCount}`);
  const arcPaths = (svg.match(/<path\b[^>]*\bA[0-9]/g) || []).length;
  assert.ok(arcPaths >= 3, `expected ≥3 arc paths, got ${arcPaths}`);
});
