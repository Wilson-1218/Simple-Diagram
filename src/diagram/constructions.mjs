/**
 * Recorded constructions (midpoint, ratio, foot, intersection, triangle
 * centre, tangent). Omitting `point.construction` leaves the point free.
 * Dragging a base point recomputes dependents that are not themselves dragged.
 */

import {
  circumcenter,
  centroid,
  footOnLine,
  incenter,
  isDegenerate,
  orthocenter,
} from "./exam-ops.mjs";

/**
 * @param {{x:number,y:number}} center
 * @param {{x:number,y:number}} touch
 * @param {number} half
 * @param {string} [order]
 */
export function tangentEndpoints(center, touch, half, order) {
  const ang = Math.atan2(touch.y - center.y, touch.x - center.x);
  const tx = -Math.sin(ang);
  const ty = Math.cos(ang);
  let ax = touch.x - half * tx;
  let ay = touch.y - half * ty;
  let bx = touch.x + half * tx;
  let by = touch.y + half * ty;
  if (String(order || "leftToRight").trim().toLowerCase() !== "ccw") {
    const swap = Math.abs(ax - bx) > 1e-3 ? ax > bx : ay > by;
    if (swap) {
      const sx = ax;
      const sy = ay;
      ax = bx;
      ay = by;
      bx = sx;
      by = sy;
    }
  }
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
  };
}

/** Orthogonal projection of `from` onto the infinite line ab. Null if degenerate. */
export function perpendicularFoot(from, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 1e-18)) return null;
  const t = ((from.x - a.x) * dx + (from.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

function pointById(doc, id) {
  if (id == null) return null;
  return (doc.points || []).find((p) => p.id === id) || null;
}

function lineLineIntersection(a, b, c, d) {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), t, u };
}

function lineCircleIntersections(a, b, c, r) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  if (!(A > 1e-18)) return [];
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < -1e-12) return [];
  if (Math.abs(disc) <= 1e-12) {
    const t = -B / (2 * A);
    return [{ x: a.x + t * dx, y: a.y + t * dy, t }];
  }
  const s = Math.sqrt(disc);
  const t0 = (-B - s) / (2 * A);
  const t1 = (-B + s) / (2 * A);
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy, t: t0 },
    { x: a.x + t1 * dx, y: a.y + t1 * dy, t: t1 },
  ];
}

function circleCircleIntersections(c0, r0, c1, r1) {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-12)) return [];
  if (d > r0 + r1 + 1e-9) return [];
  if (d < Math.abs(r0 - r1) - 1e-9) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - a * a;
  const h = h2 < 0 && h2 > -1e-12 ? 0 : Math.sqrt(Math.max(0, h2));
  const mx = c0.x + (a * dx) / d;
  const my = c0.y + (a * dy) / d;
  if (h < 1e-9) return [{ x: mx, y: my }];
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  return [
    { x: mx + rx, y: my + ry },
    { x: mx - rx, y: my - ry },
  ];
}

function tOnSegment(t, extendLines) {
  if (extendLines) return true;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

function sortHitsStable(hits) {
  return hits.slice().sort((p, q) => {
    if (Math.abs(p.x - q.x) > 1e-4) return p.x - q.x;
    return p.y - q.y;
  });
}

function resolveStoredGeom(doc, of) {
  if (!of || typeof of !== "object") return null;
  if (of.kind === "line") {
    const a = pointById(doc, of.a);
    const b = pointById(doc, of.b);
    if (!a || !b || a.id === b.id) return null;
    return { kind: "line", a, b };
  }
  const id = of.id != null ? String(of.id) : "";
  const seg = (doc.segments || []).find((s) => s.id === id);
  if (seg) {
    const a = pointById(doc, seg.a);
    const b = pointById(doc, seg.b);
    if (!a || !b) return null;
    return { kind: "line", a, b };
  }
  const cir = (doc.circles || []).find((c) => c.id === id);
  if (cir) {
    const c = pointById(doc, cir.centerId);
    const thr = pointById(doc, cir.throughId);
    if (!c || !thr) return null;
    const r = Math.hypot(thr.x - c.x, thr.y - c.y);
    if (!(r > 1e-9)) return null;
    return { kind: "circle", c, r };
  }
  return null;
}

function computeHits(g1, g2, extendLines) {
  if (!g1 || !g2) return [];
  if (g1.kind === "line" && g2.kind === "line") {
    const hit = lineLineIntersection(g1.a, g1.b, g2.a, g2.b);
    if (!hit) return [];
    if (!tOnSegment(hit.t, extendLines) || !tOnSegment(hit.u, extendLines)) return [];
    return [hit];
  }
  if (g1.kind === "line" && g2.kind === "circle") {
    return lineCircleIntersections(g1.a, g1.b, g2.c, g2.r).filter((h) =>
      tOnSegment(h.t, extendLines)
    );
  }
  if (g1.kind === "circle" && g2.kind === "line") {
    return lineCircleIntersections(g2.a, g2.b, g1.c, g1.r).filter((h) =>
      tOnSegment(h.t, extendLines)
    );
  }
  if (g1.kind === "circle" && g2.kind === "circle") {
    return circleCircleIntersections(g1.c, g1.r, g2.c, g2.r);
  }
  return [];
}

function disambiguate(hits, rec, doc) {
  const sorted = sortHitsStable(hits);
  if (sorted.length <= 1) return sorted[0] || null;
  if (rec.avoidPointId) {
    const ref = pointById(doc, rec.avoidPointId);
    if (ref) {
      let best = sorted[0];
      let bestD = -1;
      for (const h of sorted) {
        const d = Math.hypot(h.x - ref.x, h.y - ref.y);
        if (d > bestD) {
          bestD = d;
          best = h;
        }
      }
      return best;
    }
  }
  if (rec.nearPointId) {
    const ref = pointById(doc, rec.nearPointId);
    if (ref) {
      let best = sorted[0];
      let bestD = Infinity;
      for (const h of sorted) {
        const d = Math.hypot(h.x - ref.x, h.y - ref.y);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      return best;
    }
  }
  const pick = rec.pick != null ? String(rec.pick).toLowerCase() : "first";
  if (pick === "left") return sorted.slice().sort((p, q) => p.x - q.x || p.y - q.y)[0];
  if (pick === "right") return sorted.slice().sort((p, q) => q.x - p.x || p.y - q.y)[0];
  if (pick === "top" || pick === "above") return sorted.slice().sort((p, q) => p.y - q.y || p.x - q.x)[0];
  if (pick === "bottom" || pick === "below") return sorted.slice().sort((p, q) => q.y - p.y || p.x - q.x)[0];
  if (pick === "1" || pick === "second") return sorted[1] || null;
  return sorted[0];
}

function circleGeom(doc, circleId) {
  const cir = (doc.circles || []).find((c) => c.id === circleId);
  if (!cir) return null;
  const c = pointById(doc, cir.centerId);
  const thr = pointById(doc, cir.throughId);
  if (!c || !thr) return null;
  const r = Math.hypot(thr.x - c.x, thr.y - c.y);
  if (!(r > 1e-9)) return null;
  return { c, r };
}

function moveTo(point, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (Math.abs(point.x - x) < 1e-9 && Math.abs(point.y - y) < 1e-9) return false;
  point.x = x;
  point.y = y;
  return true;
}

function centerPos(kind, A, B, C) {
  if (kind === "incentre") return incenter(A, B, C);
  if (kind === "circumcentre") return circumcenter(A, B, C);
  if (kind === "centroid") return centroid(A, B, C);
  if (kind === "orthocentre") return orthocenter(A, B, C);
  return null;
}

function applyOne(doc, point, pinned) {
  const rec = point.construction;
  if (!rec || typeof rec !== "object") return false;
  const kind = rec.kind;
  if (kind === "midpoint") {
    const a = pointById(doc, rec.a);
    const b = pointById(doc, rec.b);
    if (!a || !b) return false;
    return moveTo(point, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  if (kind === "ratio") {
    const a = pointById(doc, rec.a);
    const b = pointById(doc, rec.b);
    const t = Number(rec.t);
    if (!a || !b || !Number.isFinite(t)) return false;
    return moveTo(point, a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
  }
  if (kind === "foot") {
    const from = pointById(doc, rec.from);
    const a = pointById(doc, rec.a);
    const b = pointById(doc, rec.b);
    if (!from || !a || !b) return false;
    const foot = perpendicularFoot(from, a, b);
    if (!foot) return false;
    return moveTo(point, foot.x, foot.y);
  }
  if (kind === "intersection") {
    const g1 = resolveStoredGeom(doc, rec.of1);
    const g2 = resolveStoredGeom(doc, rec.of2);
    const hits = computeHits(g1, g2, rec.extendLines !== false);
    if (!hits.length) return false;
    const sorted = sortHitsStable(hits);
    let chosen = null;
    if (rec.slot != null && rec.slot !== "") {
      const slot = Number(rec.slot);
      if (!Number.isInteger(slot) || !sorted[slot]) return false;
      chosen = sorted[slot];
    } else {
      chosen = disambiguate(sorted, rec, doc);
    }
    if (!chosen) return false;
    return moveTo(point, chosen.x, chosen.y);
  }
  if (kind === "triangleCenter") {
    const A = pointById(doc, rec.a);
    const B = pointById(doc, rec.b);
    const C = pointById(doc, rec.c);
    if (!A || !B || !C) return false;
    const ck = rec.centerKind;
    if (ck !== "centroid" && isDegenerate(A, B, C)) return false;
    const pos = centerPos(ck, A, B, C);
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    let moved = moveTo(point, pos.x, pos.y);
    if (ck === "incentre" && Array.isArray(rec.touchIds)) {
      const feet = [footOnLine(pos, A, B), footOnLine(pos, B, C), footOnLine(pos, C, A)];
      rec.touchIds.forEach((id, i) => {
        const t = pointById(doc, id);
        if (!t || pinned.has(t.id) || !feet[i]) return;
        if (moveTo(t, feet[i].x, feet[i].y)) moved = true;
      });
    }
    return moved;
  }
  if (kind === "tangent") {
    const geom = circleGeom(doc, rec.circleId);
    const touch = pointById(doc, rec.touchId);
    const half = Number(rec.halfLen);
    if (!geom || !touch || !(half > 1e-9)) return false;
    const ends = tangentEndpoints(geom.c, touch, half, rec.order);
    const end = rec.end === "b" ? ends.b : ends.a;
    return moveTo(point, end.x, end.y);
  }
  return false;
}

/**
 * Recompute recorded dependents. `pinned` ids keep the position the drag set.
 * @param {object} doc
 * @param {Iterable<string>|null|undefined} pinned
 */
export function recomputeConstructions(doc, pinned) {
  if (!doc || !Array.isArray(doc.points)) return doc;
  const hold = pinned instanceof Set ? pinned : new Set(pinned || []);
  const list = doc.points.filter((p) => p && p.construction && !hold.has(p.id));
  const rounds = Math.max(1, doc.points.length);
  for (let n = 0; n < rounds; n++) {
    let moved = false;
    for (const p of list) {
      if (applyOne(doc, p, hold)) moved = true;
    }
    if (!moved) break;
  }
  return doc;
}
