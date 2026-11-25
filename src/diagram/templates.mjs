/**
 * Built-in geometry template specs + shared catalog (UI Templates menu + MCP).
 *
 * Single source of truth. Browser `app.js` embeds a copy via:
 *   node tools/embed-templates.mjs
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
  /** Isometric cube (more equal extents than cuboid). */
  cube: {
    nextLetter: "I",
    pts: [
      [-3, 2, "A", -14, 10],
      [2, 3, "B", 14, 10],
      [4, 0, "C", 16, 0],
      [-1, -1, "D", -16, -6],
      [-3, -2, "E", -14, -12],
      [2, -1, "F", 14, -12],
      [4, -4, "G", 16, -14],
      [-1, -5, "H", -16, -16],
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

/**
 * Shared catalog: Templates UI (ui:true) + AI insertTemplate (all ids with specs).
 * Human Templates ▾ is saved-only (no ui:true combos); plane/solid stay Shape / addShape (ui:false).
 *
 * @typedef {{
 *   id: string,
 *   group: 'combo'|'plane'|'solid',
 *   ui: boolean,
 *   labelZh: string,
 *   labelEn: string,
 *   preview?: string,
 * }} TemplateCatalogEntry
 */

/** @type {TemplateCatalogEntry[]} */
export const TEMPLATE_CATALOG = [
  // Plane singles — Shape float / addShape; still insertTemplate for macros/AI
  {
    id: "rightTri",
    group: "plane",
    ui: false,
    labelZh: "直角三角形",
    labelEn: "Right triangle",
  },
  {
    id: "isoTri",
    group: "plane",
    ui: false,
    labelZh: "等腰三角形",
    labelEn: "Isosceles triangle",
  },
  {
    id: "genTri",
    group: "plane",
    ui: false,
    labelZh: "一般三角形",
    labelEn: "Scalene triangle",
  },
  {
    id: "parallelogram",
    group: "plane",
    ui: false,
    labelZh: "平行四邊形",
    labelEn: "Parallelogram",
  },
  {
    id: "trapezoid",
    group: "plane",
    ui: false,
    labelZh: "梯形",
    labelEn: "Trapezoid",
  },
  {
    id: "pentagon",
    group: "plane",
    ui: false,
    labelZh: "五邊形",
    labelEn: "Pentagon",
  },
  // Solids — Shape float / addShape
  {
    id: "cube",
    group: "solid",
    ui: false,
    labelZh: "立方體",
    labelEn: "Cube",
  },
  {
    id: "cuboid",
    group: "solid",
    ui: false,
    labelZh: "長方體",
    labelEn: "Cuboid",
  },
  {
    id: "rectPrism",
    group: "solid",
    ui: false,
    labelZh: "直方體",
    labelEn: "Rectangular prism",
  },
  {
    id: "frustum",
    group: "solid",
    ui: false,
    labelZh: "棱台",
    labelEn: "Frustum",
  },
  {
    id: "tetra",
    group: "solid",
    ui: false,
    labelZh: "四面體",
    labelEn: "Tetrahedron",
  },
  {
    id: "pyramid",
    group: "solid",
    ui: false,
    labelZh: "角錐",
    labelEn: "Pyramid",
  },
  {
    id: "triPrism",
    group: "solid",
    ui: false,
    labelZh: "三棱柱",
    labelEn: "Triangular prism",
  },
  {
    id: "cylinder",
    group: "solid",
    ui: false,
    labelZh: "圓柱",
    labelEn: "Cylinder",
  },
  {
    id: "cone",
    group: "solid",
    ui: false,
    labelZh: "圓錐",
    labelEn: "Cone",
  },
];

/** Solids promoted into the Shape float. */
export const SHAPE_SOLID_TEMPLATE_IDS = TEMPLATE_CATALOG.filter(
  (e) => e.group === "solid"
).map((e) => e.id);

/** Catalog ids shown in the Templates ▾ menu (and default MCP list_templates). */
export const TEMPLATE_UI_IDS = TEMPLATE_CATALOG.filter((e) => e.ui).map((e) => e.id);

/**
 * @param {{ uiOnly?: boolean }} [opts]
 *   uiOnly (default true): same entries as Templates menu.
 *   uiOnly:false: full catalog including AI-only plane/solid ids.
 * @returns {Array<{ id: string, group: string, ui: boolean, labelZh: string, labelEn: string, preview?: string }>}
 */
export function listBuiltinTemplates(opts = {}) {
  const uiOnly = opts.uiOnly !== false;
  return TEMPLATE_CATALOG.filter((e) => (uiOnly ? e.ui : true)).map((e) => {
    /** @type {{ id: string, group: string, ui: boolean, labelZh: string, labelEn: string, preview?: string }} */
    const row = {
      id: e.id,
      group: e.group,
      ui: !!e.ui,
      labelZh: e.labelZh,
      labelEn: e.labelEn,
    };
    if (e.preview) row.preview = e.preview;
    return row;
  });
}

/** Assert catalog ids ⊆ specs and every ui entry has a spec (call from tests / embed). */
export function assertTemplateCatalogIntegrity() {
  const specIds = new Set(BUILTIN_TEMPLATE_IDS);
  const catIds = new Set(TEMPLATE_CATALOG.map((e) => e.id));
  for (const e of TEMPLATE_CATALOG) {
    if (!specIds.has(e.id)) {
      throw new Error(`TEMPLATE_CATALOG id "${e.id}" missing from BUILTIN_TEMPLATES`);
    }
  }
  for (const id of BUILTIN_TEMPLATE_IDS) {
    if (!catIds.has(id)) {
      throw new Error(`BUILTIN_TEMPLATES id "${id}" missing from TEMPLATE_CATALOG`);
    }
  }
  // Empty ui:true is OK — Templates ▾ may be saved-only.
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
 *   scaleY?: number,
 *   cellSize?: number,
 *   nextId?: function,
 *   labelSize?: number,
 *   rightAngleSize?: number,
 *   idPrefix?: string,
 *   label?: boolean,
 *   labels?: boolean|string[],
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
  const scaleYRaw = options.scaleY != null ? Number(options.scaleY) : scale;
  const scaleY = scaleYRaw > 0 && Number.isFinite(scaleYRaw) ? scaleYRaw : scale;
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
  const idPrefix = options.idPrefix != null ? String(options.idPrefix) : "";
  // Explicit false on either flag suppresses vertex letters (addShape solids).
  const skipVertexLabels = options.labels === false || options.label === false;
  const labelOverrides = Array.isArray(options.labels) ? options.labels : null;

  function takeId(kind, hint) {
    if (hint) {
      if (typeof nextId.claim !== "function") {
        throw new Error("applyBuiltinTemplate: nextId.claim required when idPrefix is set");
      }
      return nextId.claim(hint);
    }
    return nextId(kind);
  }

  ensureArr(doc, "points");
  ensureArr(doc, "segments");
  ensureArr(doc, "labels");
  ensureArr(doc, "circles");
  ensureArr(doc, "ellipses");
  ensureArr(doc, "rightAngles");

  const pointIds = [];
  let pi = 0;
  for (const row of spec.pts || []) {
    const [ci, cj, lab, ox, oy, marker] = row;
    const x = Number(ci) * cell * scale + dx;
    const y = Number(cj) * cell * scaleY + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`applyBuiltinTemplate(${id}): non-finite point`);
    }
    const pid = takeId("p", idPrefix ? `${idPrefix}${pi}` : "");
    const p = { id: pid, x, y };
    if (marker) p.marker = marker;
    doc.points.push(p);
    pointIds.push(pid);
    let text = null;
    if (!skipVertexLabels) {
      if (labelOverrides && labelOverrides[pi] != null && String(labelOverrides[pi]) !== "") {
        text = String(labelOverrides[pi]);
      } else if (lab != null && lab !== "") {
        text = String(lab);
      }
    }
    // Shown letter when labels are on; template letter when they are suppressed.
    const aliasLetter = text != null ? text : lab != null && lab !== "" ? String(lab) : null;
    registerShapeVertexAlias(doc, idPrefix, aliasLetter, pid);
    if (text != null) {
      doc.labels.push({
        id: nextId("lab"),
        pointId: pid,
        text,
        ox: ox != null ? Number(ox) : 0,
        oy: oy != null ? Number(oy) : -14,
        size: labelSize,
      });
    }
    pi += 1;
  }

  let si = 0;
  for (const row of spec.segs || []) {
    const [i, j, st] = row;
    const segIndex = si;
    si += 1;
    if (pointIds[i] == null || pointIds[j] == null) continue;
    doc.segments.push({
      id: takeId("s", idPrefix ? `${idPrefix}s${segIndex}` : ""),
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

/**
 * Map a shown vertex letter onto the numeric point id.
 * `{prefix}{Letter}` (KC) always aliases when that id is not already a point.
 * A bare letter (C) aliases only when no point already owns that id, so a
 * caller-created point is never replaced. Letters are A–V (cuboid A–H, apex V).
 * Last free registration wins for a bare letter.
 */
export function registerShapeVertexAlias(doc, prefix, letter, pointId) {
  const lab = letter != null ? String(letter).trim() : "";
  if (!/^[A-V]$/.test(lab) || !pointId) return;
  const aliases = shapeAliasMap(doc);
  const taken = (id) => Array.isArray(doc.points) && doc.points.some((p) => p.id === id);
  if (!taken(lab)) aliases[lab] = pointId;
  if (prefix) {
    const prefixed = `${prefix}${lab}`;
    if (!taken(prefixed)) aliases[prefixed] = pointId;
  }
}

/** Runtime alias table. Not enumerable, so it is not part of the 38-key save. */
export function shapeAliasMap(doc) {
  const existing = doc.pointAliases;
  const ok = existing && typeof existing === "object" && !Array.isArray(existing);
  const desc = ok ? Object.getOwnPropertyDescriptor(doc, "pointAliases") : null;
  if (ok && desc && desc.enumerable === false) return existing;
  const value = ok ? existing : {};
  Object.defineProperty(doc, "pointAliases", {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return value;
}
