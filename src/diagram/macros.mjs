/**
 * High-level drawing macros for agents.
 * Thin wrappers over insertTemplate + a few custom ops.
 */

import { applyOps } from "./ops.mjs";

/**
 * Right triangle with legs a (horizontal) and b (vertical), right angle at origin.
 * @param {{ a?: number, b?: number, origin?: {x?:number,y?:number}, labels?: boolean, style?: string }} [params]
 * @returns {{ ops: object[] }}
 */
export function drawRightTriangle(params = {}) {
  const a = Math.abs(Number(params.a != null ? params.a : 80));
  const b = Math.abs(Number(params.b != null ? params.b : 60));
  if (!(a > 1e-6) || !(b > 1e-6)) {
    throw new Error("drawRightTriangle: a and b must be > 0");
  }
  const ox = Number(params.origin?.x != null ? params.origin.x : 0) || 0;
  const oy = Number(params.origin?.y != null ? params.origin.y : 0) || 0;
  const style = params.style || "solid";
  const labels = params.labels !== false;
  /** @type {object[]} */
  const ops = [
    { op: "addPoint", id: "A", x: ox, y: oy },
    { op: "addPoint", id: "B", x: ox + a, y: oy },
    { op: "addPoint", id: "C", x: ox, y: oy - b },
    { op: "addSegment", id: "AB", a: "A", b: "B", style },
    { op: "addSegment", id: "BC", a: "B", b: "C", style },
    { op: "addSegment", id: "CA", a: "C", b: "A", style },
    { op: "addRightAngle", vertex: "A", arm1: "B", arm2: "C" },
  ];
  if (labels) {
    ops.push(
      { op: "addLabel", pointId: "A", text: "A", ox: -14, oy: 10 },
      { op: "addLabel", pointId: "B", text: "B", ox: 14, oy: 10 },
      { op: "addLabel", pointId: "C", text: "C", ox: -14, oy: -14 }
    );
  }
  return { ops };
}

/**
 * Frustum / truncated pyramid via built-in template.
 * @param {{ dx?: number, dy?: number, scale?: number }} [params]
 * @returns {{ ops: object[] }}
 */
export function drawFrustum(params = {}) {
  return {
    ops: [
      {
        op: "insertTemplate",
        id: "frustum",
        dx: params.dx,
        dy: params.dy,
        scale: params.scale,
      },
    ],
  };
}

/**
 * Circle with a tangent at the positive-x rim point.
 * @param {{
 *   r?: number,
 *   cx?: number,
 *   cy?: number,
 *   halfLen?: number,
 *   origin?: {x?:number,y?:number},
 * }} [params]
 * @returns {{ ops: object[] }}
 */
export function drawCircleWithTangent(params = {}) {
  const r = Math.abs(Number(params.r != null ? params.r : 40));
  if (!(r > 1e-6)) throw new Error("drawCircleWithTangent: r must be > 0");
  const cx =
    Number(
      params.cx != null
        ? params.cx
        : params.origin?.x != null
          ? params.origin.x
          : 0
    ) || 0;
  const cy =
    Number(
      params.cy != null
        ? params.cy
        : params.origin?.y != null
          ? params.origin.y
          : 0
    ) || 0;
  const halfLen = Math.abs(
    Number(params.halfLen != null ? params.halfLen : r)
  );
  return {
    ops: [
      { op: "addPoint", id: "O", x: cx, y: cy },
      { op: "addPoint", id: "A", x: cx + r, y: cy },
      { op: "addLabel", pointId: "O", text: "O", ox: 12, oy: -12 },
      { op: "addLabel", pointId: "A", text: "A", ox: 14, oy: 0 },
      { op: "addCircle", id: "c1", centerId: "O", throughId: "A" },
      {
        op: "addTangent",
        circleId: "c1",
        touchId: "A",
        halfLen,
        aId: "T0",
        bId: "T1",
      },
    ],
  };
}

/**
 * Cuboid (box) via built-in template. `size` maps to scale (relative to default).
 * @param {{ size?: number, scale?: number, dx?: number, dy?: number }} [params]
 * @returns {{ ops: object[] }}
 */
export function drawCuboid(params = {}) {
  const scale =
    params.scale != null
      ? Number(params.scale)
      : params.size != null
        ? Number(params.size) / 80
        : 1;
  return {
    ops: [
      {
        op: "insertTemplate",
        id: "cuboid",
        dx: params.dx,
        dy: params.dy,
        scale,
      },
    ],
  };
}

/** Alias: cube uses the same cuboid sketch template. */
export function drawCube(params = {}) {
  return drawCuboid(params);
}

const MACRO_BUILDERS = {
  drawRightTriangle,
  drawFrustum,
  drawCircleWithTangent,
  drawCube,
  drawCuboid,
};

/** @type {string[]} */
export const MACRO_NAMES = Object.keys(MACRO_BUILDERS).sort();

/**
 * Run a named macro.
 * @param {string} name
 * @param {{
 *   apply?: boolean,
 *   applyTo?: object|null,
 *   [k: string]: unknown,
 * }} [params]
 * @returns {{ ops: object[], doc?: object }}
 */
export function runMacro(name, params = {}) {
  const builder = MACRO_BUILDERS[name];
  if (!builder) {
    throw new Error(
      `unknown macro "${name}". Known: ${MACRO_NAMES.join(", ")}`
    );
  }
  const { ops } = builder(params);
  if (params.applyTo !== undefined) {
    return { ops, doc: applyOps(params.applyTo, ops) };
  }
  if (params.apply) {
    return { ops, doc: applyOps(null, ops) };
  }
  return { ops };
}
