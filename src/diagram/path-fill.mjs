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
