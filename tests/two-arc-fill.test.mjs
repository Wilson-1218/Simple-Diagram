import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOps,
  documentToSvg,
  validateDiagram,
  chainPathFillEdges,
  APP_VERSION,
} from "../src/diagram/index.mjs";

test("APP_VERSION bumped for two-arc path fill", () => {
  assert.equal(APP_VERSION, "13.5.30");
});

/** Two arcs (centres O1, O2) + chord AC: classic slice A–arc–B–arc–C–line. */
function twoArcChordOps() {
  // Equilateral-ish: A=(0,0), C=(100,0), B apex; O1 centre of arc AB, O2 of arc BC
  const A = { x: 0, y: 0 };
  const C = { x: 100, y: 0 };
  const B = { x: 50, y: 40 };
  // Centres below the chord so minor arcs bulge upward through B
  const O1 = { x: 25, y: -30 };
  const O2 = { x: 75, y: -30 };
  return [
    { op: "addPoint", id: "A", ...A },
    { op: "addPoint", id: "B", ...B },
    { op: "addPoint", id: "C", ...C },
    { op: "addPoint", id: "O1", ...O1 },
    { op: "addPoint", id: "O2", ...O2 },
    { op: "addSegment", id: "AC", a: "A", b: "C" },
    { op: "addSector", id: "arcAB", centerId: "O1", startId: "A", endId: "B", mode: "arc" },
    { op: "addSector", id: "arcBC", centerId: "O2", startId: "B", endId: "C", mode: "arc" },
  ];
}

test("chainPathFillEdges orders two arcs + chord", () => {
  const edges = [
    { type: "arc", centerId: "O2", from: "B", to: "C" },
    { type: "line", a: "A", b: "C" },
    { type: "arc", centerId: "O1", from: "A", to: "B" },
  ];
  const chained = chainPathFillEdges(edges);
  assert.ok(chained);
  assert.equal(chained.length, 3);
  const arcCount = chained.filter((e) => e.type === "arc").length;
  const lineCount = chained.filter((e) => e.type === "line").length;
  assert.equal(arcCount, 2);
  assert.equal(lineCount, 1);
  // Closed: tip of last == start of first
  const first = chained[0].type === "line" ? chained[0].a : chained[0].from;
  const lastEnd = chained[2].type === "line" ? chained[2].b : chained[2].to;
  assert.equal(lastEnd, first);
});

test("addFill pathFill two arcs + chord validates and exports two SVG arcs", () => {
  const doc = applyOps(null, [
    ...twoArcChordOps(),
    {
      op: "addFill",
      id: "slice1",
      kind: "pathFill",
      // Intentionally scrambled order — ops should chain
      edges: [
        { type: "arc", centerId: "O2", from: "C", to: "B" },
        { type: "line", a: "C", b: "A" },
        { type: "arc", centerId: "O1", from: "B", to: "A" },
      ],
      opacity: 0.25,
    },
  ]);
  const v = validateDiagram(doc);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(doc.fills.length, 1);
  assert.equal(doc.fills[0].kind, "pathFill");
  assert.equal(doc.fills[0].edges.length, 3);
  const arcs = doc.fills[0].edges.filter((e) => e.type === "arc");
  const lines = doc.fills[0].edges.filter((e) => e.type === "line");
  assert.equal(arcs.length, 2);
  assert.equal(lines.length, 1);

  const svg = documentToSvg(doc, { scale: 1 });
  assert.ok(svg.includes("<path"), "SVG should paint pathFill");
  const fillPaths = [...svg.matchAll(/<path d="([^"]+)" fill="/g)].map((m) => m[1]);
  assert.ok(fillPaths.length >= 1);
  const d = fillPaths[0];
  const aCount = (d.match(/ A/g) || []).length;
  assert.equal(aCount, 2, "two-arc+chord fill must emit two SVG arc commands");
  assert.ok(/Z\s*$/.test(d.trim()) || d.includes("Z"), "closed path");
  // No opaque white punch-out required for this region
  assert.ok(!svg.includes('fill="rgba(255,255,255'));
});

test("pathFill two-arc survives validate signature like open→save", () => {
  const doc = applyOps(null, [
    ...twoArcChordOps(),
    {
      op: "addFill",
      kind: "pathFill",
      edges: [
        { type: "line", a: "A", b: "C" },
        { type: "arc", centerId: "O2", from: "C", to: "B" },
        { type: "arc", centerId: "O1", from: "B", to: "A" },
      ],
    },
  ]);
  const json = JSON.parse(JSON.stringify(doc));
  assert.equal(json.fills[0].kind, "pathFill");
  assert.equal(json.fills[0].edges.length, 3);
  assert.equal(validateDiagram(json).ok, true);
});
