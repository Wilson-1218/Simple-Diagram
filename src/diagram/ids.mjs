/** Deterministic ID allocation for diagram ops. */

const ARRAY_KEYS = [
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

/**
 * Collect every id currently used in the document (including curve ids).
 * @param {object} doc
 * @returns {Set<string>}
 */
export function collectIds(doc) {
  const used = new Set();
  if (!doc || typeof doc !== "object") return used;
  for (const key of ARRAY_KEYS) {
    const arr = doc[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && typeof item.id === "string") used.add(item.id);
      if (key === "coordPlots" && item && Array.isArray(item.curves)) {
        for (const c of item.curves) {
          if (c && typeof c.id === "string") used.add(c.id);
        }
      }
    }
  }
  return used;
}

/**
 * Create a deterministic next-id factory.
 * Same starting doc + same call order → same ids.
 * @param {object} doc
 * @param {string} [prefix="id"]
 * @returns {{ (kindPrefix?: string): string, claim: (id: string) => string }}
 */
export function createIdFactory(doc, prefix = "id") {
  const used = collectIds(doc);
  let seq = 0;
  for (const id of used) {
    const m = /_(\d+)$/.exec(id);
    if (m) seq = Math.max(seq, Number(m[1]));
  }

  function claim(id) {
    if (typeof id !== "string" || !id) throw new Error("id must be a non-empty string");
    if (used.has(id)) throw new Error(`duplicate id: ${id}`);
    used.add(id);
    return id;
  }

  function nextId(kindPrefix) {
    const p = kindPrefix || prefix;
    let id;
    do {
      seq += 1;
      id = `${p}_${String(seq).padStart(4, "0")}`;
    } while (used.has(id));
    used.add(id);
    return id;
  }

  nextId.claim = claim;
  return nextId;
}
