/** Question / solution appearance shared by ops, canvas, and SVG export. */

export const SOLUTION_INK = "#dc2626";
export const SOLUTION_INK_DARK = "#f87171";
/** Solid solution fills with no explicit color. Hatch stays opaque red strokes. */
export const SOLUTION_FILL_OPACITY = 0.25;

/**
 * @param {object|null|undefined} op
 * @returns {"question"|"solution"}
 */
export function elementRole(op) {
  if (!op || typeof op !== "object") return "question";
  if (op.role != null && String(op.role).trim() !== "") {
    const r = String(op.role).trim().toLowerCase();
    if (r !== "question" && r !== "solution") {
      throw new Error(`invalid role: ${op.role}`);
    }
    return r;
  }
  if (op.solution === true || op.solution === "true") return "solution";
  return "question";
}

/**
 * Explicit color, or null. #RGB expands to #rrggbb. Other non-empty strings pass through.
 * @param {object|null|undefined} op
 * @returns {string|null}
 */
export function readExplicitColor(op) {
  if (!op || op.color == null || String(op.color).trim() === "") return null;
  const s = String(op.color).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  }
  return s;
}

/**
 * Persist role/color on a created element.
 * Omitted role stays off the object (question geometry stays compatible).
 * @param {object} row
 * @param {object} op
 */
/** Positive integer solution step, or null when omitted / not a positive integer. */
export function readSolutionStep(op) {
  if (!op || op.solutionStep == null || op.solutionStep === "") return null;
  const n = Number(op.solutionStep);
  if (!Number.isInteger(n) || !(n > 0)) return null;
  return n;
}

export function stampAppearance(row, op) {
  if (!row || !op) return row;
  const role = elementRole(op);
  const named =
    (op.role != null && String(op.role).trim() !== "") ||
    op.solution === true ||
    op.solution === false ||
    op.solution === "true" ||
    op.solution === "false";
  if (role === "solution") row.role = "solution";
  else if (named) row.role = "question";
  const color = readExplicitColor(op);
  if (color) row.color = color;
  const step = readSolutionStep(op);
  if (step != null) row.solutionStep = step;
  return row;
}

/**
 * Fields to spread into child ops so a compound constructor keeps solution/color.
 * @param {object} op
 */
export function appearanceFields(op) {
  const out = {};
  if (!op) return out;
  const role = elementRole(op);
  if (role === "solution") {
    out.role = "solution";
    out.solution = true;
  } else if (op.role != null && String(op.role).trim() !== "") {
    out.role = "question";
  }
  const color = readExplicitColor(op);
  if (color) out.color = color;
  const step = readSolutionStep(op);
  if (step != null) out.solutionStep = step;
  return out;
}

export function solutionLayerVisible(layers) {
  if (!layers || layers.solutionShow == null) return true;
  return !!layers.solutionShow;
}

export function elementShown(el, layers) {
  if (!el || el.role !== "solution") return true;
  if (!solutionLayerVisible(layers)) return false;
  const max = layers && layers.solutionMaxStep;
  if (max == null || max === "") return true;
  const k = Number(max);
  if (!Number.isInteger(k) || !(k > 0)) return true;
  if (el.solutionStep == null || el.solutionStep === "") return true;
  const step = Number(el.solutionStep);
  if (!Number.isInteger(step)) return true;
  return step <= k;
}

/**
 * @param {object|null|undefined} el
 * @param {{ dark?: boolean, fallback?: string }} [opts]
 */
export function elementStroke(el, opts = {}) {
  const fallback = opts.fallback != null ? opts.fallback : "#111";
  if (el && el.color != null && String(el.color).trim() !== "") return String(el.color).trim();
  if (el && el.role === "solution") return opts.dark ? SOLUTION_INK_DARK : SOLUTION_INK;
  return fallback;
}

/**
 * Fill paint. Explicit color wins. Solution without a color is red:
 * solid at low opacity, hatch as red strokes.
 * @param {object} fill
 * @param {{ dark?: boolean }} [opts]
 */
export function resolveFillPaint(fill, opts = {}) {
  const hatch = String(fill && fill.pattern ? fill.pattern : "").toLowerCase() === "hatch";
  const explicit = fill && fill.color != null && String(fill.color).trim() !== "";
  const opacityGiven = fill && fill.opacity != null && fill.opacity !== "" && Number.isFinite(Number(fill.opacity));
  if (explicit) {
    return {
      color: String(fill.color).trim(),
      opacity: opacityGiven ? Number(fill.opacity) : hatch ? 1 : 0.2,
      hatch,
    };
  }
  if (fill && fill.role === "solution") {
    return {
      color: opts.dark ? SOLUTION_INK_DARK : SOLUTION_INK,
      opacity: opacityGiven ? Number(fill.opacity) : hatch ? 1 : SOLUTION_FILL_OPACITY,
      hatch,
    };
  }
  return {
    color: hatch ? "#111111" : "#666666",
    opacity: opacityGiven ? Number(fill.opacity) : hatch ? 1 : 0.2,
    hatch,
  };
}
