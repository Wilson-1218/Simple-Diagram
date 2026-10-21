/**
 * Built-in geometry template specs for the AI / ops layer.
 *
 * KEEP IN SYNC with app.js BUILTIN_TEMPLATES (browser IIFE — no ESM import).
 * Spec: { nextLetter, pts: [[x,y,label?,ox?,oy?,marker?],...], segs: [[i,j,style?],...],
 *         circles?, ellipses?, rightAngles? }
 * pts use GRID CELL offsets; world = (ci|cj) × CELL_SIZE × scale + (dx|dy).
 */

import { createIdFactory } from "./ids.mjs";

/** Cell → world scale matching app.js GRID_SIZE. */
export const TEMPLATE_CELL_SIZE = 20;
/** @deprecated alias — prefer TEMPLATE_CELL_SIZE */
export const TEMPLATE_CELL = TEMPLATE_CELL_SIZE;

/**
 * Copy of app.js BUILTIN_TEMPLATES (geometry only).
 * @type {Record<string, object>}
 */
export const BUILTIN_TEMPLATES = {
  rightTri: {
    nextLetter: "D",
    pts: [
      [-4, 3, "A", -14, 10],
      [4, 3, "B", 14, 10],
      [-4, -4, "C", -14, -14],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    rightAngles: [[0, 1, 2]],
  },
  isoTri: {
    nextLetter: "D",
    pts: [
      [0, -4, "A", 0, -18],
      [-4, 3, "B", -14, 10],
      [4, 3, "C", 14, 10],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },
  parallelogram: {
    nextLetter: "E",
    pts: [
      [-4, 2, "A", -14, 10],
      [3, 2, "B", 14, 10],
      [5, -2, "C", 14, -10],
      [-2, -2, "D", -14, -10],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },
  trapezoid: {
    nextLetter: "E",
    pts: [
      [-5, 3, "A", -14, 10],
      [5, 3, "B", 14, 10],
      [3, -2, "C", 14, -10],
      [-3, -2, "D", -14, -10],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },
  pentagon: (() => {
    const pts = [
      [0, -4, "A", 0, -18],
      [4, -1, "B", 14, -6],
      [2, 3, "C", 12, 10],
      [-2, 3, "D", -12, 10],
      [-4, -1, "E", -14, -6],
    ];
    const segs = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ];
    return { nextLetter: "F", pts, segs };
  })(),
  circleCenter: {
    nextLetter: "C",
    pts: [
      [0, 0, "O", 12, -12],
      [4, 0, "A", 14, 0],
    ],
    segs: [],
    circles: [[0, 1, "solid"]],
  },
  genTri: {
    nextLetter: "D",
    pts: [
      [-5, 3, "A", -14, 10],
      [4, 2, "B", 14, 10],
      [-1, -3, "C", 0, -16],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },
  circleGeom: {
    nextLetter: "D",
    pts: [
      [0, 0, "O", 12, -12],
      [4, 0, "A", 14, 0],
      [-4, 0, "B", -14, 0],
      [2, 3.464, "C", 12, 12],
      [-2, 3.464, "D", -12, 12],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [3, 4],
    ],
    circles: [[0, 1, "solid"]],
  },
  rectPrism: {
    nextLetter: "G",
    pts: [
      [-4, 2, "A", -14, 10],
      [2, 3, "B", 14, 10],
      [4, 0, "C", 16, 0],
      [-2, -1, "D", -16, -6],
      [-4, -2, "E", -14, -12],
      [2, -1, "F", 14, -12],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3, "dashed"],
      [3, 0],
      [0, 4],
      [1, 5],
      [4, 5],
      [2, 5],
      [3, 4, "dashed"],
    ],
  },
  frustum: {
    nextLetter: "I",
    pts: [
      [-5, 3, "A", -16, 10],
      [5, 3, "B", 16, 10],
      [3, -1, "C", 14, -6],
      [-3, -1, "D", -14, -6],
      [-3, -3, "E", -14, -14],
      [3, -3, "F", 14, -14],
      [2, -5, "G", 12, -18],
      [-2, -5, "H", -12, -18],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3, "dashed"],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7, "dashed"],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7, "dashed"],
    ],
  },
  tetra: {
    nextLetter: "E",
    pts: [
      [0, -4, "A", 0, -18],
      [-4, 1, "B", -16, 4],
      [0, 4, "C", 0, 18],
      [4, 1, "D", 16, 4],
    ],
    segs: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [2, 3],
      [1, 3, "dashed"],
    ],
  },
  pyramid: {
    nextLetter: "E",
    pts: [
      [-3, 3, "A", -14, 10],
      [2, 3, "B", 14, 10],
      [4, 0, "C", 16, 0],
      [-1, 0, "D", -16, -6],
      [0, -4, "V", 0, -18],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3, "dashed"],
      [3, 0],
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3, "dashed"],
    ],
  },
  altBase: {
    nextLetter: "E",
    pts: [
      [0, -4, "A", 0, -18],
      [-4, 1, "B", -16, 4],
      [0, 4, "C", 0, 18],
      [4, 1, "D", 16, 4],
      [0, 2, "H", 12, 8, "foot"],
    ],
    segs: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [2, 3],
      [1, 3, "dashed"],
      [0, 4, "dotted"],
    ],
    rightAngles: [[4, 0, 2]],
  },
  triPrism: {
    nextLetter: "G",
    pts: [
      [-4, 2, "A", -14, 10],
      [2, 3, "B", 14, 10],
      [-1, -1, "C", -10, -14],
      [-2, 0, "D", -16, -8],
      [4, 1, "E", 16, 0],
      [1, -3, "F", 10, -16],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3, "dashed"],
      [0, 3],
      [1, 4],
      [2, 5, "dashed"],
    ],
  },
  cuboid: {
    nextLetter: "I",
    pts: [
      [-4, 2, "A", -14, 10],
      [1, 3, "B", 14, 10],
      [4, 1, "C", 16, 0],
      [-1, 0, "D", -16, -6],
      [-4, -1, "E", -14, -10],
      [1, 0, "F", 14, -10],
      [4, -2, "G", 16, -12],
      [-1, -3, "H", -16, -14],
    ],
    segs: [
      [0, 1],
      [1, 2],
      [2, 3, "dashed"],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7, "dashed"],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7, "dashed"],
    ],
  },
  cylinder: {
    nextLetter: "C",
    pts: [
      [0, 3, "O", 12, 6],
      [4, 3],
      [0, 4],
      [-4, 3],
      [0, -3, "O′", 12, -14],
      [4, -3],
      [0, -2],
      [-4, -3],
    ],
    segs: [
      [1, 5],
      [3, 7],
      [0, 4, "dotted"],
    ],
    ellipses: [
      [0, 1, 2, "solid", true],
      [4, 5, 6, "solid", true],
    ],
  },
  cone: {
    nextLetter: "C",
    pts: [
      [0, 3, "O", 12, 6],
      [4, 3],
      [0, 4],
      [-4, 3],
      [0, -4, "V", 0, -18],
    ],
    segs: [
      [4, 1],
      [4, 3],
      [4, 0, "dotted"],
    ],
    ellipses: [[0, 1, 2, "solid", true]],
  },
};

/** @type {string[]} */
export const BUILTIN_TEMPLATE_IDS = Object.keys(BUILTIN_TEMPLATES);

const PLANE_IDS = new Set([
  "rightTri",
  "isoTri",
  "genTri",
  "parallelogram",
  "trapezoid",
  "pentagon",
  "circleCenter",
  "circleGeom",
]);

const SOLID_IDS = new Set([
  "tetra",
  "pyramid",
  "altBase",
  "triPrism",
  "rectPrism",
  "cuboid",
  "frustum",
  "cylinder",
  "cone",
]);

/**
 * @returns {{ id: string, group?: 'plane'|'solid' }[]}
 */
export function listBuiltinTemplates() {
  return BUILTIN_TEMPLATE_IDS.map((id) => {
    /** @type {{ id: string, group?: 'plane'|'solid' }} */
    const row = { id };
    if (PLANE_IDS.has(id)) row.group = "plane";
    else if (SOLID_IDS.has(id)) row.group = "solid";
    return row;
  });
}

/**
 * Apply a built-in template onto `doc` (mutates).
 * Remaps all entity ids via `options.nextId` or a fresh createIdFactory.
 *
 * @param {object} doc
 * @param {string} id  Template id (e.g. "rightTri")
 * @param {{
 *   dx?: number,
 *   dy?: number,
 *   scale?: number,
 *   cellSize?: number,
 *   nextId?: function,
 *   labelSize?: number,
 *   rightAngleSize?: number,
 * }} [options]
 * @returns {object} the same doc
 */
export function applyBuiltinTemplate(doc, id, options = {}) {
  const spec = BUILTIN_TEMPLATES[id];
  if (!spec) {
    throw new Error(
      `unknown builtin template "${id}". Known: ${BUILTIN_TEMPLATE_IDS.join(", ")}`
    );
  }
  if (!doc || typeof doc !== "object") {
    throw new Error("applyBuiltinTemplate: doc required");
  }

  const dx = Number(options.dx != null ? options.dx : 0) || 0;
  const dy = Number(options.dy != null ? options.dy : 0) || 0;
  const scale = Number(options.scale != null ? options.scale : 1);
  if (!(scale > 0) || !Number.isFinite(scale)) {
    throw new Error("applyBuiltinTemplate: scale must be a positive finite number");
  }
  const cell =
    options.cellSize != null ? Number(options.cellSize) : TEMPLATE_CELL_SIZE;
  if (!(cell > 0) || !Number.isFinite(cell)) {
    throw new Error("applyBuiltinTemplate: cellSize must be a positive finite number");
  }

  const nextId = options.nextId || createIdFactory(doc, "id");
  const labelSize =
    options.labelSize != null
      ? Number(options.labelSize)
      : doc.labelFontSize || 16;
  const raSize =
    options.rightAngleSize != null
      ? Number(options.rightAngleSize)
      : doc.rightAngleSize || 10;

  ensureArr(doc, "points");
  ensureArr(doc, "segments");
  ensureArr(doc, "labels");
  ensureArr(doc, "circles");
  ensureArr(doc, "ellipses");
  ensureArr(doc, "rightAngles");

  const pointIds = [];
  for (const row of spec.pts || []) {
    const [ci, cj, lab, ox, oy, marker] = row;
    const x = Number(ci) * cell * scale + dx;
    const y = Number(cj) * cell * scale + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`applyBuiltinTemplate(${id}): non-finite point`);
    }
    const pid = nextId("p");
    const p = { id: pid, x, y };
    if (marker) p.marker = marker;
    doc.points.push(p);
    pointIds.push(pid);
    if (lab != null && lab !== "") {
      doc.labels.push({
        id: nextId("lab"),
        pointId: pid,
        text: String(lab),
        ox: ox != null ? Number(ox) : 0,
        oy: oy != null ? Number(oy) : -14,
        size: labelSize,
      });
    }
  }

  for (const row of spec.segs || []) {
    const [i, j, st] = row;
    if (pointIds[i] == null || pointIds[j] == null) continue;
    doc.segments.push({
      id: nextId("s"),
      a: pointIds[i],
      b: pointIds[j],
      style: st || "solid",
    });
  }

  for (const row of spec.circles || []) {
    const [ci, ti, st] = row;
    if (pointIds[ci] == null || pointIds[ti] == null) continue;
    doc.circles.push({
      id: nextId("cir"),
      centerId: pointIds[ci],
      throughId: pointIds[ti],
      style: st || "solid",
    });
  }

  for (const row of spec.ellipses || []) {
    const [ci, rxi, ryi, st, back] = row;
    if (
      pointIds[ci] == null ||
      pointIds[rxi] == null ||
      pointIds[ryi] == null
    ) {
      continue;
    }
    const e = {
      id: nextId("ell"),
      centerId: pointIds[ci],
      rxId: pointIds[rxi],
      ryId: pointIds[ryi],
      style: st || "solid",
    };
    if (back) e.backDashed = true;
    doc.ellipses.push(e);
  }

  for (const row of spec.rightAngles || []) {
    const [v, a1, a2] = row;
    if (
      pointIds[v] == null ||
      pointIds[a1] == null ||
      pointIds[a2] == null
    ) {
      continue;
    }
    doc.rightAngles.push({
      id: nextId("ra"),
      vertex: pointIds[v],
      arm1: pointIds[a1],
      arm2: pointIds[a2],
      size: raSize,
    });
  }

  if (spec.nextLetter) {
    doc.nextLetter = spec.nextLetter;
  }

  return doc;
}

function ensureArr(doc, key) {
  if (!Array.isArray(doc[key])) doc[key] = [];
}
