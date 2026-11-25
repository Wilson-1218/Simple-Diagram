/**
 * Oblique projection + hidden-line classification for add3DPolyhedron.
 *
 * 3D axes: +X right, +Y up, +Z toward the viewer (before rotation).
 * yawDeg rotates about +Y; pitchDeg then rotates about +X
 * (positive pitch tips +Y toward the viewer).
 * Canvas: x right, y down. Projected (0,0,0) lands on origin.
 *
 * Face winding may be clockwise or counterclockwise. Each face normal
 * is flipped when it points toward the vertex centroid, so the stored
 * normal is outward either way. After yaw/pitch, a face is front-facing
 * when that outward normal has positive view-space Z. An edge is solid
 * when it belongs to at least one front face (including the silhouette);
 * dashed when every face that owns it is back-facing.
 */

function finite(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Rotate into view space. +Z points toward the viewer. */
export function rotateSolidVertex(x, y, z, yawDeg, pitchDeg) {
  const yaw = (finite(yawDeg, 0) * Math.PI) / 180;
  const pitch = (finite(pitchDeg, 0) * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: x1,
    y: y1 * cp - z1 * sp,
    z: y1 * sp + z1 * cp,
  };
}

export function projectSolidVertex(x, y, z, opts) {
  const view = rotateSolidVertex(x, y, z, opts.yawDeg, opts.pitchDeg);
  const scale = opts.scale;
  return {
    x: opts.ox + scale * view.x,
    y: opts.oy - scale * view.y,
    z: view.z,
  };
}

function newellNormal(points) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  return { x: nx, y: ny, z: nz };
}

function edgeKey(a, b) {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function centroid(points) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = points.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

/**
 * Newell normal, then flip so it points from the vertex centroid G
 * toward the face center Fc. Either winding then yields an outward normal.
 */
function outwardNormal(facePts, g) {
  const n = newellNormal(facePts);
  const fc = centroid(facePts);
  const dot = (fc.x - g.x) * n.x + (fc.y - g.y) * n.y + (fc.z - g.z) * n.z;
  if (dot < 0) return { x: -n.x, y: -n.y, z: -n.z };
  return n;
}

/**
 * @param {object} op
 * @returns {{
 *   placed: Array<{ key: string, x: number, y: number, text: string|null, ox: number, oy: number }>,
 *   edges: Array<{ a: string, b: string, style: "solid"|"dashed" }>,
 * }}
 */
export function buildPolyhedron(op) {
  const raw = op && op.vertices;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("add3DPolyhedron: vertices must be an object of [x,y,z]");
  }
  const keys = Object.keys(raw);
  if (!keys.length) throw new Error("add3DPolyhedron: vertices is empty");
  const faces = op.faces;
  if (!Array.isArray(faces) || !faces.length) {
    throw new Error("add3DPolyhedron: faces must be a non-empty array");
  }
  const origin = Array.isArray(op.origin) ? op.origin : [0, 0];
  const ox = Number(origin[0]);
  const oy = Number(origin[1]);
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) {
    throw new Error("add3DPolyhedron: origin must be [ox, oy]");
  }
  const scale = op.scale != null ? Number(op.scale) : 40;
  if (!(scale > 0) || !Number.isFinite(scale)) {
    throw new Error("add3DPolyhedron: scale must be > 0");
  }
  const yawDeg = op.yawDeg != null ? Number(op.yawDeg) : 35;
  const pitchDeg = op.pitchDeg != null ? Number(op.pitchDeg) : 20;
  if (!Number.isFinite(yawDeg) || !Number.isFinite(pitchDeg)) {
    throw new Error("add3DPolyhedron: yawDeg and pitchDeg must be finite");
  }
  const opts = { ox, oy, scale, yawDeg, pitchDeg };

  /** @type {Map<string, { x:number, y:number, z:number }>} */
  const view = new Map();
  /** @type {Array<{ key: string, x: number, y: number }>} */
  const placed = [];
  for (const key of keys) {
    const row = raw[key];
    if (!Array.isArray(row) || row.length < 3) {
      throw new Error(`add3DPolyhedron: vertex ${key} must be [x,y,z]`);
    }
    const x = Number(row[0]);
    const y = Number(row[1]);
    const z = Number(row[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`add3DPolyhedron: vertex ${key} must be finite`);
    }
    const p = projectSolidVertex(x, y, z, opts);
    view.set(key, rotateSolidVertex(x, y, z, yawDeg, pitchDeg));
    placed.push({ key, x: p.x, y: p.y });
  }

  const g = centroid(keys.map((key) => view.get(key)));

  /** @type {Array<{ a: string, b: string, front: boolean }>} */
  const edgeOrder = [];
  /** @type {Map<string, { a: string, b: string, front: boolean }>} */
  const edges = new Map();

  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    if (!Array.isArray(face) || face.length < 3) {
      throw new Error(`add3DPolyhedron: face ${fi} needs at least 3 vertices`);
    }
    const pts = [];
    for (const name of face) {
      const key = String(name);
      if (!view.has(key)) {
        throw new Error(`add3DPolyhedron: face ${fi} references unknown vertex ${key}`);
      }
      pts.push(view.get(key));
    }
    const n = outwardNormal(pts, g);
    const front = n.z > 1e-8;
    for (let i = 0; i < face.length; i++) {
      const a = String(face[i]);
      const b = String(face[(i + 1) % face.length]);
      if (a === b) continue;
      const k = edgeKey(a, b);
      let row = edges.get(k);
      if (!row) {
        row = { a, b, front: false };
        edges.set(k, row);
        edgeOrder.push(row);
      }
      if (front) row.front = true;
    }
  }

  let cx = 0;
  let cy = 0;
  for (const p of placed) {
    cx += p.x;
    cy += p.y;
  }
  cx /= placed.length;
  cy /= placed.length;

  const skipLabels = op.labels === false || op.label === false;
  const labelMap =
    op.labels && typeof op.labels === "object" && !Array.isArray(op.labels) ? op.labels : null;
  const labelList = Array.isArray(op.labels) ? op.labels : null;

  const outPlaced = placed.map((p, i) => {
    let text = null;
    if (!skipLabels) {
      if (labelMap && labelMap[p.key] != null && String(labelMap[p.key]) !== "") {
        text = String(labelMap[p.key]);
      } else if (labelList && labelList[i] != null && String(labelList[i]) !== "") {
        text = String(labelList[i]);
      } else {
        text = p.key;
      }
    }
    let dx = p.x - cx;
    let dy = p.y - cy;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-6)) {
      dx = 12;
      dy = -14;
    } else {
      dx = (dx / len) * 16;
      dy = (dy / len) * 16;
    }
    return { key: p.key, x: p.x, y: p.y, text, ox: dx, oy: dy };
  });

  return {
    placed: outPlaced,
    edges: edgeOrder.map((e) => ({
      a: e.a,
      b: e.b,
      style: e.front ? "solid" : "dashed",
    })),
  };
}
