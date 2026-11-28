/**
 * pathFill edge helpers — chain line/arc edges into a closed loop
 * (exam pattern: two arcs + one chord).
 */

export function clonePathEdge(e) {
  if (!e || typeof e !== "object") return null;
  if (e.type === "line") {
    if (e.a == null || e.b == null) return null;
    return { type: "line", a: String(e.a), b: String(e.b) };
  }
  if (e.type === "arc") {
    if (e.centerId == null || e.from == null || e.to == null) return null;
    const out = {
      type: "arc",
      centerId: String(e.centerId),
      from: String(e.from),
      to: String(e.to),
    };
    if (e.circleId) out.circleId = String(e.circleId);
    return out;
  }
  return null;
}

export function flipPathEdge(e) {
  const c = clonePathEdge(e);
  if (!c) return null;
  if (c.type === "line") return { type: "line", a: c.b, b: c.a };
  const out = { type: "arc", centerId: c.centerId, from: c.to, to: c.from };
  if (c.circleId) out.circleId = c.circleId;
  return out;
}

export function pathEdgeEndpoints(e) {
  if (!e) return null;
  if (e.type === "line") return [e.a, e.b];
  if (e.type === "arc") return [e.from, e.to];
  return null;
}

/**
 * Orient & order edges into a closed chain. Returns null if no Hamiltonian cycle.
 */
export function chainPathFillEdges(rawEdges) {
  if (!Array.isArray(rawEdges) || rawEdges.length < 2) return null;
  const edges = rawEdges.map(clonePathEdge).filter(Boolean);
  if (edges.length < 2) return null;
  for (let si = 0; si < edges.length; si++) {
    for (const startFlip of [false, true]) {
      const pool = edges.filter((_, i) => i !== si).map(clonePathEdge);
      let cur = startFlip ? flipPathEdge(edges[si]) : clonePathEdge(edges[si]);
      if (!cur) continue;
      const ordered = [cur];
      let tip = pathEdgeEndpoints(cur)[1];
      let ok = true;
      while (pool.length) {
        let found = -1;
        let flip = false;
        for (let i = 0; i < pool.length; i++) {
          const ends = pathEdgeEndpoints(pool[i]);
          if (!ends) continue;
          if (ends[0] === tip) {
            found = i;
            flip = false;
            break;
          }
          if (ends[1] === tip) {
            found = i;
            flip = true;
            break;
          }
        }
        if (found < 0) {
          ok = false;
          break;
        }
        const next = flip ? flipPathEdge(pool[found]) : clonePathEdge(pool[found]);
        ordered.push(next);
        tip = pathEdgeEndpoints(next)[1];
        pool.splice(found, 1);
      }
      if (ok && tip === pathEdgeEndpoints(ordered[0])[0]) return ordered;
    }
  }
  return null;
}

/** Signed minor sweep in (-π, π]. Positive increases atan2 (clockwise on y-down). */
export function minorArcDelta(a0, a1) {
  const twoPi = Math.PI * 2;
  let delta = a1 - a0;
  delta -= twoPi * Math.floor((delta + Math.PI) / twoPi);
  if (delta <= -Math.PI) delta += twoPi;
  if (delta > Math.PI) delta -= twoPi;
  return delta;
}

/** True when offset t lies strictly inside the signed sweep from 0 to dTheta. */
function offsetOnMinorSweep(t, dTheta) {
  if (!(Math.abs(dTheta) > 1e-9)) return false;
  if (dTheta > 0) return t > 1e-5 && t < dTheta - 1e-5;
  return t < -1e-5 && t > dTheta + 1e-5;
}

/**
 * Minor-arc samples at this edge's own radius hypot(from − center).
 * dTheta is the signed minor arc in (-π, π]. Samples run
 * a0 + (i/steps)*dTheta with steps = max(16, ceil(|dTheta|*r/4)).
 * A negative sweep (A at +36° → B at −36°) stays on that circle through
 * angle 0. Do not sort offsets so a negative sweep runs backwards, and do
 * not mirror samples across the chord.
 * @returns {{x:number,y:number}[]|null}
 */
export function sampleMinorArc(center, from, to) {
  if (!center || !from || !to) return null;
  const r = Math.hypot(from.x - center.x, from.y - center.y);
  if (!(r > 1e-9)) return null;
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  const dTheta = minorArcDelta(a0, a1);
  const steps = Math.max(16, Math.ceil((Math.abs(dTheta) * r) / 4));
  const ts = [];
  for (let i = 0; i <= steps; i++) ts.push((i / steps) * dTheta);
  const twoPi = Math.PI * 2;
  for (let k = -2; k <= 4; k++) {
    for (const base of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      let t = base + k * twoPi - a0;
      t -= twoPi * Math.floor((t + Math.PI) / twoPi);
      if (t <= -Math.PI) t += twoPi;
      if (offsetOnMinorSweep(t, dTheta)) ts.push(t);
    }
  }
  if (dTheta < 0) ts.sort((a, b) => b - a);
  else ts.sort((a, b) => a - b);
  const pts = [];
  for (const t of ts) {
    const a = a0 + t;
    const x = center.x + r * Math.cos(a);
    const y = center.y + r * Math.sin(a);
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(prev.x - x, prev.y - y) < 1e-4) continue;
    pts.push({ x, y });
  }
  return pts.length >= 2 ? pts : null;
}

function fillKindOf(fill) {
  if (!fill) return "polygon";
  if (
    fill.kind === "sector" ||
    fill.kind === "segment" ||
    fill.kind === "polyArc" ||
    fill.kind === "pathFill"
  ) {
    return fill.kind;
  }
  return "polygon";
}

function appendArc(out, center, from, to) {
  const samples = sampleMinorArc(center, from, to);
  if (!samples) return false;
  const last = out[out.length - 1];
  let i0 = 0;
  if (last && Math.hypot(last.x - samples[0].x, last.y - samples[0].y) < 1e-4) i0 = 1;
  for (let i = i0; i < samples.length; i++) out.push(samples[i]);
  return true;
}

/**
 * Closed-outline samples in world space.
 * Arc edges use sampleMinorArc (own radius and sweep), never the chord.
 * @param {object} fill
 * @param {(id: string) => {x:number,y:number}|null|undefined} getPoint
 * @param {{ circle?: (id: string) => {centerId?: string}|null|undefined }} [opts]
 * @returns {{x:number,y:number}[]|null}
 */
export function fillOutlinePoints(fill, getPoint, opts = {}) {
  if (!fill || typeof getPoint !== "function") return null;
  const kind = fillKindOf(fill);
  const circleCenter = (circleId) => {
    if (!circleId || typeof opts.circle !== "function") return null;
    const cir = opts.circle(circleId);
    if (!cir || cir.centerId == null) return null;
    return getPoint(cir.centerId) || null;
  };
  if (kind === "pathFill" && Array.isArray(fill.edges) && fill.edges.length >= 2) {
    const out = [];
    for (const e of fill.edges) {
      if (!e) return null;
      if (e.type === "line") {
        const a = getPoint(e.a);
        const b = getPoint(e.b);
        if (!a || !b) return null;
        if (!out.length) out.push({ x: a.x, y: a.y });
        out.push({ x: b.x, y: b.y });
      } else if (e.type === "arc") {
        const c = getPoint(e.centerId);
        const from = getPoint(e.from);
        const to = getPoint(e.to);
        if (!c || !from || !to) return null;
        if (!appendArc(out, c, from, to)) return null;
      } else {
        return null;
      }
    }
    return out.length >= 3 ? out : null;
  }
  if (kind === "sector" || kind === "segment") {
    const c = circleCenter(fill.circleId) || (fill.centerId ? getPoint(fill.centerId) : null);
    const s = getPoint(fill.startId);
    const e = getPoint(fill.endId);
    if (!c || !s || !e) return null;
    const arc = sampleMinorArc(c, s, e);
    if (!arc) return null;
    if (kind === "sector") return [{ x: c.x, y: c.y }, ...arc];
    return arc;
  }
  if (kind === "polyArc" && Array.isArray(fill.pointIds) && fill.pointIds.length >= 2) {
    const c = circleCenter(fill.circleId) || (fill.centerId ? getPoint(fill.centerId) : null);
    const s = getPoint(fill.startId);
    const e = getPoint(fill.endId);
    if (!c || !s || !e) return null;
    const out = [];
    for (const id of fill.pointIds) {
      const p = getPoint(id);
      if (!p) return null;
      out.push({ x: p.x, y: p.y });
    }
    if (!appendArc(out, c, s, e)) return null;
    return out.length >= 3 ? out : null;
  }
  if (kind === "polygon" && Array.isArray(fill.pointIds) && fill.pointIds.length >= 3) {
    const out = [];
    for (const id of fill.pointIds) {
      const p = getPoint(id);
      if (!p) return null;
      out.push({ x: p.x, y: p.y });
    }
    return out;
  }
  return null;
}

/** Even-odd point in polygon. Outline is open (not repeated at the end). */
export function pointInPolygon(x, y, pts) {
  if (!pts || pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
