/** Compact angle-arc radius. World units, shared by ops tests and SVG export. */

export const DEFAULT_ARC_SIZE = 18;
export const ARC_TEXT_GAP = 11;
/** How far the label center should sit from each arm on a narrow angle, world units. */
export const NARROW_ARM_CLEARANCE = 10;

export function sweepDelta(a0, a1, reflex) {
  let delta = a1 - a0;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  if (reflex) {
    if (delta > 0) delta -= Math.PI * 2;
    else delta += Math.PI * 2;
  }
  return delta;
}

/**
 * Arc radius in world units.
 * `force` keeps a caller radius that is larger than the arm clamp.
 * @param {number} size
 * @param {number} minArmLen
 * @param {{ force?: boolean }} [opts]
 */
export function effectiveArcRadius(size, minArmLen, opts = {}) {
  const requested = Number(size);
  const r = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_ARC_SIZE;
  if (opts && opts.force) return r;
  const arm = Number(minArmLen);
  const cap = Number.isFinite(arm) && arm > 0 ? Math.max(10, arm * 0.3) : r;
  return Math.min(r, cap);
}

/**
 * Label radius along the bisector. Narrow angles (< 25°) with text are pushed
 * out until the center clears the arms.
 * @param {number} effectiveR
 * @param {number} sweepRad drawn sweep (signed)
 * @param {number|null|undefined} textRadiusOffset
 */
export function arcTextRadius(effectiveR, sweepRad, textRadiusOffset) {
  const off =
    textRadiusOffset != null && Number.isFinite(Number(textRadiusOffset))
      ? Number(textRadiusOffset)
      : 0;
  let textR = effectiveR + ARC_TEXT_GAP + off;
  const abs = Math.abs(Number(sweepRad) || 0);
  const deg = (abs * 180) / Math.PI;
  if (deg > 0.25 && deg < 25) {
    const sin = Math.sin(abs / 2);
    if (sin > 1e-4) {
      const need = NARROW_ARM_CLEARANCE / sin;
      if (need > textR) textR = need;
    }
  }
  return textR;
}

export function minArmLength(v, a1, a2) {
  return Math.min(Math.hypot(a1.x - v.x, a1.y - v.y), Math.hypot(a2.x - v.x, a2.y - v.y));
}

/**
 * @param {object} arc
 * @param {{x:number,y:number}} v
 * @param {{x:number,y:number}} a1
 * @param {{x:number,y:number}} a2
 */
export function arcDraw(arc, v, a1, a2) {
  const arm = minArmLength(v, a1, a2);
  const force = !!(arc && (arc.clamp === false || arc.forceRadius === true));
  const effectiveR = effectiveArcRadius(arc && arc.size, arm, { force });
  const a0 = Math.atan2(a1.y - v.y, a1.x - v.x);
  const a1ang = Math.atan2(a2.y - v.y, a2.x - v.x);
  const delta = sweepDelta(a0, a1ang, !!(arc && arc.reflex));
  const hasText = arc && String(arc.text || "").trim() !== "";
  const textR = hasText
    ? arcTextRadius(effectiveR, delta, arc.textRadiusOffset)
    : effectiveR + ARC_TEXT_GAP;
  return { effectiveR, a0, delta, textR, hasText };
}

/** Pie-center angle mark. `arcSize` overrides; otherwise round(clamp(r*0.19, 12, 16)). */
export function pieArcSize(r, arcSize) {
  if (arcSize != null && arcSize !== "" && Number.isFinite(Number(arcSize)) && Number(arcSize) > 0) {
    return Number(arcSize);
  }
  const radius = Number(r);
  return Math.round(Math.max(12, Math.min(16, radius * 0.19)));
}

/**
 * Bearing arc. Default 16, and never more than `northLen * 0.30`.
 * @param {number} northLen
 * @param {number|string|null|undefined} arcSize
 */
export function bearingArcSize(northLen, arcSize) {
  let requested = 16;
  if (arcSize != null && arcSize !== "" && Number.isFinite(Number(arcSize)) && Number(arcSize) > 0) {
    requested = Number(arcSize);
  }
  const cap = Number(northLen) * 0.3;
  if (!(cap > 0)) return requested;
  return Math.min(requested, cap);
}
