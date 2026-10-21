import { CURRENT_FORMAT_VERSION } from "./empty-doc.mjs";

const LINE_STYLES = new Set(["solid", "dashed", "dotted", "dashdot"]);
const MARKERS = new Set(["x", "foot"]);
const GRID_MODES = new Set(["square", "triangle"]);
const CURVE_TYPES = new Set([
  "line",
  "quad",
  "log",
  "log10",
  "ln",
  "exp",
  "circle",
  "sin",
  "cos",
  "tan",
  "none",
]);

/**
 * @typedef {{ ok: boolean, errors: string[], warnings?: string[] }} ValidateResult
 */

/**
 * Validate a Simple Diagram JSON document.
 * Missing formatVersion is treated as v1 (legacy saves).
 * @param {unknown} doc
 * @returns {ValidateResult}
 */
export function validateDiagram(doc) {
  const errors = [];
  const warnings = [];

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["document must be a plain object"], warnings };
  }

  const d = /** @type {Record<string, unknown>} */ (doc);

  let formatVersion = CURRENT_FORMAT_VERSION;
  if (d.formatVersion == null || d.formatVersion === "") {
    warnings.push("formatVersion missing — treating as 1 (legacy)");
    formatVersion = 1;
  } else {
    const fv = Number(d.formatVersion);
    if (!Number.isFinite(fv) || fv < 1) {
      errors.push(`invalid formatVersion: ${JSON.stringify(d.formatVersion)}`);
    } else if (fv > CURRENT_FORMAT_VERSION) {
      errors.push(
        `unsupported formatVersion ${fv} (this tool supports ≤ ${CURRENT_FORMAT_VERSION})`
      );
    } else {
      formatVersion = fv;
    }
  }

  const arrayFields = [
    "points",
    "segments",
    "labels",
    "rightAngles",
    "angleArcs",
    "midTicks",
    "parallelMarks",
    "equalMarks",
    "lengthLabels",
    "circles",
    "ellipses",
    "sectors",
    "fills",
    "coordPlots",
  ];

  for (const key of arrayFields) {
    if (d[key] != null && !Array.isArray(d[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  /** @type {Map<string, object>} */
  const points = new Map();
  if (Array.isArray(d.points)) {
    for (let i = 0; i < d.points.length; i++) {
      const p = d.points[i];
      const path = `points[${i}]`;
      if (!p || typeof p !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      if (typeof p.id !== "string" || !p.id) {
        errors.push(`${path}.id must be a non-empty string`);
      } else if (points.has(p.id)) {
        errors.push(`duplicate point id: ${p.id}`);
      } else {
        points.set(p.id, p);
      }
      if (!Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
        errors.push(`${path} needs finite x,y`);
      }
      if (p.marker != null && !MARKERS.has(p.marker)) {
        warnings.push(`${path}.marker unknown: ${p.marker}`);
      }
    }
  }

  /** @type {Map<string, object>} */
  const segments = new Map();
  if (Array.isArray(d.segments)) {
    for (let i = 0; i < d.segments.length; i++) {
      const s = d.segments[i];
      const path = `segments[${i}]`;
      if (!s || typeof s !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      if (typeof s.id !== "string" || !s.id) errors.push(`${path}.id required`);
      else if (segments.has(s.id)) errors.push(`duplicate segment id: ${s.id}`);
      else segments.set(s.id, s);
      if (!points.has(s.a)) errors.push(`${path}.a missing point ref: ${s.a}`);
      if (!points.has(s.b)) errors.push(`${path}.b missing point ref: ${s.b}`);
      if (s.a === s.b) errors.push(`${path} a and b must differ`);
      if (s.style != null && !LINE_STYLES.has(s.style)) {
        errors.push(`${path}.style invalid: ${s.style}`);
      }
    }
  }

  function needPoint(ref, path) {
    if (typeof ref !== "string" || !ref) {
      errors.push(`${path} missing point id`);
      return;
    }
    if (!points.has(ref)) errors.push(`${path} missing point ref: ${ref}`);
  }

  function needSegment(ref, path) {
    if (typeof ref !== "string" || !ref) {
      errors.push(`${path} missing segment id`);
      return;
    }
    if (!segments.has(ref)) errors.push(`${path} missing segment ref: ${ref}`);
  }

  if (Array.isArray(d.labels)) {
    for (let i = 0; i < d.labels.length; i++) {
      const l = d.labels[i];
      const path = `labels[${i}]`;
      if (!l || typeof l !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(l.pointId, `${path}.pointId`);
      if (typeof l.text !== "string") errors.push(`${path}.text must be a string`);
    }
  }

  if (Array.isArray(d.rightAngles)) {
    for (let i = 0; i < d.rightAngles.length; i++) {
      const r = d.rightAngles[i];
      const path = `rightAngles[${i}]`;
      if (!r || typeof r !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(r.vertex, `${path}.vertex`);
      needPoint(r.arm1, `${path}.arm1`);
      needPoint(r.arm2, `${path}.arm2`);
    }
  }

  if (Array.isArray(d.angleArcs)) {
    for (let i = 0; i < d.angleArcs.length; i++) {
      const a = d.angleArcs[i];
      const path = `angleArcs[${i}]`;
      if (!a || typeof a !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(a.vertex, `${path}.vertex`);
      needPoint(a.arm1, `${path}.arm1`);
      needPoint(a.arm2, `${path}.arm2`);
    }
  }

  for (const key of ["parallelMarks", "equalMarks", "lengthLabels", "midTicks"]) {
    if (!Array.isArray(d[key])) continue;
    for (let i = 0; i < d[key].length; i++) {
      const m = d[key][i];
      const path = `${key}[${i}]`;
      if (!m || typeof m !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needSegment(m.segmentId, `${path}.segmentId`);
      if (key === "midTicks" && m.pointId != null) needPoint(m.pointId, `${path}.pointId`);
      if (key === "lengthLabels" && m.text != null && typeof m.text !== "string") {
        errors.push(`${path}.text must be a string`);
      }
    }
  }

  if (Array.isArray(d.circles)) {
    for (let i = 0; i < d.circles.length; i++) {
      const c = d.circles[i];
      const path = `circles[${i}]`;
      if (!c || typeof c !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(c.centerId, `${path}.centerId`);
      needPoint(c.throughId, `${path}.throughId`);
      if (c.style != null && !LINE_STYLES.has(c.style)) {
        errors.push(`${path}.style invalid: ${c.style}`);
      }
    }
  }

  if (Array.isArray(d.ellipses)) {
    for (let i = 0; i < d.ellipses.length; i++) {
      const e = d.ellipses[i];
      const path = `ellipses[${i}]`;
      if (!e || typeof e !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(e.centerId, `${path}.centerId`);
      needPoint(e.rxId, `${path}.rxId`);
      needPoint(e.ryId, `${path}.ryId`);
    }
  }

  if (Array.isArray(d.sectors)) {
    for (let i = 0; i < d.sectors.length; i++) {
      const s = d.sectors[i];
      const path = `sectors[${i}]`;
      if (!s || typeof s !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      needPoint(s.centerId, `${path}.centerId`);
      needPoint(s.startId, `${path}.startId`);
      needPoint(s.endId, `${path}.endId`);
      if (s.mode != null && s.mode !== "arc" && s.mode !== "sector") {
        errors.push(`${path}.mode must be "arc" or "sector"`);
      }
    }
  }

  if (Array.isArray(d.fills)) {
    for (let i = 0; i < d.fills.length; i++) {
      const f = d.fills[i];
      const path = `fills[${i}]`;
      if (!f || typeof f !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      if (typeof f.id !== "string" || !f.id) errors.push(`${path}.id required`);
      if (!Array.isArray(f.pointIds) || f.pointIds.length < 3) {
        errors.push(`${path}.pointIds must be an array of ≥3 ids`);
      } else {
        for (let j = 0; j < f.pointIds.length; j++) {
          needPoint(f.pointIds[j], `${path}.pointIds[${j}]`);
        }
      }
      if (f.opacity != null && !Number.isFinite(Number(f.opacity))) {
        errors.push(`${path}.opacity must be finite`);
      } else if (f.opacity != null) {
        const o = Number(f.opacity);
        if (o < 0 || o > 1) errors.push(`${path}.opacity must be in [0,1]`);
      }
      if (f.color != null && typeof f.color !== "string") {
        errors.push(`${path}.color must be a string`);
      }
    }
  }

  if (Array.isArray(d.coordPlots)) {
    for (let i = 0; i < d.coordPlots.length; i++) {
      const p = d.coordPlots[i];
      const path = `coordPlots[${i}]`;
      if (!p || typeof p !== "object") {
        errors.push(`${path} must be an object`);
        continue;
      }
      for (const n of ["ox", "oy", "unitPx", "xmin", "xmax", "ymin", "ymax"]) {
        if (p[n] != null && !Number.isFinite(Number(p[n]))) {
          errors.push(`${path}.${n} must be finite`);
        }
      }
      if (Array.isArray(p.curves)) {
        for (let j = 0; j < p.curves.length; j++) {
          const c = p.curves[j];
          const cp = `${path}.curves[${j}]`;
          if (!c || typeof c !== "object") {
            errors.push(`${cp} must be an object`);
            continue;
          }
          if (c.type != null && !CURVE_TYPES.has(c.type)) {
            errors.push(`${cp}.type unknown: ${c.type}`);
          }
          if (c.params != null && (typeof c.params !== "object" || Array.isArray(c.params))) {
            errors.push(`${cp}.params must be an object`);
          }
        }
      }
    }
  }

  if (d.view != null) {
    if (typeof d.view !== "object" || Array.isArray(d.view)) {
      errors.push("view must be an object");
    } else {
      const v = d.view;
      for (const k of ["x", "y", "scale"]) {
        if (v[k] != null && !Number.isFinite(Number(v[k]))) {
          errors.push(`view.${k} must be finite`);
        }
      }
      if (v.scale != null && Number(v.scale) <= 0) {
        errors.push("view.scale must be > 0");
      }
    }
  }

  if (d.gridMode != null && !GRID_MODES.has(d.gridMode)) {
    errors.push(`gridMode invalid: ${d.gridMode}`);
  }

  if (d.exportCrop != null) {
    if (typeof d.exportCrop !== "object") {
      errors.push("exportCrop must be an object or null");
    } else {
      for (const k of ["minX", "minY", "maxX", "maxY"]) {
        if (!Number.isFinite(Number(d.exportCrop[k]))) {
          errors.push(`exportCrop.${k} must be finite`);
        }
      }
    }
  }

  // Silence unused in case we expand formatVersion branching later
  void formatVersion;

  return { ok: errors.length === 0, errors, warnings };
}
