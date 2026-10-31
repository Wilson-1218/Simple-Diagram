/**
 * Headless SVG export for agents (no DOM). White paper, black ink.
 * Covers points, segments, circles, ellipses, sectors (arc strokes),
 * polygon/sector/segment/polyArc/pathFill fills, labels, rightAngles, angleArcs (+ text),
 * lengthLabels (text|dim|arcs), equalMarks (ticks), parallelMarks (chevrons).
 *
 * Ink / marks use a **physical-frame** budget (default 54×40mm): stroke, fonts, and
 * mark geometry are sized in SVG userUnits so that when the viewBox is fitted into
 * that frame, ink stays ~0.4mm / ~8pt. Geometry still follows `scale`; raising
 * `scale` alone does not thicken paper ink (viewBox grows with it).
 */

import {
  normalizeLengthStyle,
  normalizeLengthOrient,
  normalizeLengthStroke,
  lengthStrokeDash,
  lengthOffsetFrame,
  dimMarkParts,
  arcsMarkParts,
  endsMarkParts,
  readableEdgeAngle,
} from "./length-mark.mjs";

/** Exam-figure default embed frame (Paper). */
export const DEFAULT_FRAME_WIDTH_MM = 54;
export const DEFAULT_FRAME_HEIGHT_MM = 40;
export const DEFAULT_MIN_STROKE_MM = 0.4;
export const DEFAULT_LABEL_PT = 8;

const PT_TO_MM = 25.4 / 72;

/** Dash lengths in millimetres (converted via uuPerMm). */
const STYLE_DASH_MM = {
  solid: [],
  dashed: [1.8, 1.35],
  dotted: [0.35, 0.85],
  dashdot: [1.8, 0.75, 0.35, 0.75],
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pointMap(doc) {
  const m = new Map();
  for (const p of doc.points || []) m.set(p.id, p);
  return m;
}

function boundsOf(doc, pad = 24) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const add = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const pts = pointMap(doc);
  for (const p of pts.values()) add(p.x, p.y);
  for (const lab of doc.labels || []) {
    const p = pts.get(lab.pointId);
    if (p) add(p.x + (lab.ox || 0), p.y + (lab.oy || 0));
  }
  for (const cir of doc.circles || []) {
    const c = pts.get(cir.centerId);
    const t = pts.get(cir.throughId);
    if (!c || !t) continue;
    const r = Math.hypot(t.x - c.x, t.y - c.y);
    add(c.x - r, c.y - r);
    add(c.x + r, c.y + r);
  }
  if (doc.exportCrop) {
    minX = doc.exportCrop.minX;
    minY = doc.exportCrop.minY;
    maxX = doc.exportCrop.maxX;
    maxY = doc.exportCrop.maxY;
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function hexToRgba(hex, opacity) {
  let h = String(hex || "#666666").replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Number.isFinite(Number(opacity)) ? Number(opacity) : 0.2;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * UserUnits per mm when viewBox (viewW×viewH) is fitted into frameWmm×frameHmm
 * with preserveAspectRatio (uniform scale = min of both axes).
 * Ink uu = physicalMm × uuPerMm.
 */
export function inkUserUnitsPerMm(viewW, viewH, frameWmm, frameHmm) {
  const fw = Math.max(1e-6, Number(frameWmm) || DEFAULT_FRAME_WIDTH_MM);
  const fh = Math.max(1e-6, Number(frameHmm) || DEFAULT_FRAME_HEIGHT_MM);
  const vw = Math.max(1e-6, Number(viewW) || 1);
  const vh = Math.max(1e-6, Number(viewH) || 1);
  return Math.max(vw / fw, vh / fh);
}

/**
 * @param {number} viewW
 * @param {number} viewH
 * @param {{ frameWidthMm?: number, frameHeightMm?: number, minStrokeMm?: number, labelPt?: number }} opts
 */
export function resolveInkBudget(viewW, viewH, opts = {}) {
  const frameWmm =
    opts.frameWidthMm != null ? Number(opts.frameWidthMm) : DEFAULT_FRAME_WIDTH_MM;
  const frameHmm =
    opts.frameHeightMm != null ? Number(opts.frameHeightMm) : DEFAULT_FRAME_HEIGHT_MM;
  const strokeMm =
    opts.minStrokeMm != null ? Number(opts.minStrokeMm) : DEFAULT_MIN_STROKE_MM;
  const labelPt = opts.labelPt != null ? Number(opts.labelPt) : DEFAULT_LABEL_PT;
  const uuPerMm = inkUserUnitsPerMm(viewW, viewH, frameWmm, frameHmm);
  const stroke = Math.max(0.05, strokeMm) * uuPerMm;
  const labelFs = Math.max(1, labelPt) * PT_TO_MM * uuPerMm;
  return {
    frameWmm,
    frameHmm,
    strokeMm,
    labelPt,
    uuPerMm,
    stroke,
    markStroke: stroke * 0.95,
    labelFs,
    /** Map doc label size (baseline 16) → font px in userUnits. */
    fontForSize(size) {
      const s = Number(size);
      const base = Number.isFinite(s) && s > 0 ? s : 16;
      return (base / 16) * labelFs;
    },
    mm(n) {
      return n * uuPerMm;
    },
    dash(style) {
      const mm = STYLE_DASH_MM[style] || [];
      return mm.map((d) => d * uuPerMm);
    },
  };
}

/** Layout slots along a segment so equal / parallel don't stack on midpoint (matches editor). */
function markTAlong(doc, kind, segmentId, group) {
  const hasEqual = (doc.equalMarks || []).some((m) => m.segmentId === segmentId);
  const hasParallel = (doc.parallelMarks || []).some((m) => m.segmentId === segmentId);
  let t = kind === "equal" ? 0.35 : kind === "parallel" ? 0.65 : 0.5;
  if (kind === "equal" && !hasParallel) t = 0.38;
  if (kind === "parallel" && !hasEqual) t = 0.62;
  if (kind === "equal" && hasParallel) t = 0.32;
  if (kind === "parallel" && hasEqual) t = 0.68;
  if ((group || 0) === 1) {
    if (kind === "equal") t -= 0.05;
    if (kind === "parallel") t += 0.05;
  }
  return Math.max(0.18, Math.min(0.82, t));
}

function segmentDrawBasis(seg, pts, tAlong, toS) {
  const a = pts.get(seg.a);
  const b = pts.get(seg.b);
  if (!a || !b) return null;
  const t = tAlong != null ? tAlong : 0.5;
  const wx = a.x + (b.x - a.x) * t;
  const wy = a.y + (b.y - a.y) * t;
  const p = toS(wx, wy);
  let wdx = b.x - a.x,
    wdy = b.y - a.y;
  const wlen = Math.hypot(wdx, wdy) || 1;
  wdx /= wlen;
  wdy /= wlen;
  const q = toS(wx + wdx, wy + wdy);
  let dx = q.x - p.x,
    dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  return { px: p.x, py: p.y, dx, dy, nx: -dy, ny: dx };
}

/** Textbook parallel chevrons — same geometry as editor drawParallelMark. */
function parallelMarkDrawChevrons(basis, group, side, size, gap) {
  const count = (group || 0) === 0 ? 1 : 2;
  const dir = side === -1 ? -1 : 1;
  const dx = basis.dx * dir;
  const dy = basis.dy * dir;
  const nx = basis.nx;
  const ny = basis.ny;
  const tipX = size * 0.52;
  const backX = -size * 0.42;
  const wingY = size * 0.58;
  const chevrons = [];
  for (let i = 0; i < count; i++) {
    const along = count === 1 ? 0 : (i - (count - 1) / 2) * gap;
    const ox = basis.px + dx * along;
    const oy = basis.py + dy * along;
    const local = [
      { lx: backX, ly: wingY },
      { lx: tipX, ly: 0 },
      { lx: backX, ly: -wingY },
    ];
    chevrons.push(
      local.map(({ lx, ly }) => ({
        x: ox + dx * lx + nx * ly,
        y: oy + dy * lx + ny * ly,
      }))
    );
  }
  return chevrons;
}

/** Equal-length ticks in SVG space (absolute size/gap). */
function equalMarkDrawStrokes(basis, group, side, halfLen, gap) {
  const count = (group || 0) === 0 ? 1 : 2;
  const dir = side === -1 ? -1 : 1;
  const strokes = [];
  for (let i = 0; i < count; i++) {
    const along = count === 1 ? 0 : (i - (count - 1) / 2) * gap;
    const cx = basis.px + basis.dx * along * dir;
    const cy = basis.py + basis.dy * along * dir;
    strokes.push({
      x0: cx - basis.nx * halfLen,
      y0: cy - basis.ny * halfLen,
      x1: cx + basis.nx * halfLen,
      y1: cy + basis.ny * halfLen,
    });
  }
  return strokes;
}

function svgArrowHead(tipX, tipY, dirX, dirY, size) {
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;
  const px = -uy;
  const py = ux;
  const back = size;
  const half = size * 0.45;
  const x1 = tipX - ux * back + px * half;
  const y1 = tipY - uy * back + py * half;
  const x2 = tipX - ux * back - px * half;
  const y2 = tipY - uy * back - py * half;
  return `<path d="M${tipX.toFixed(2)},${tipY.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="#111" stroke="none"/>\n`;
}

/**
 * Angle-number radius: prefer ~0.55× arc; when the arc is tiny vs font, sit outside.
 * @param {number} rad arc radius in userUnits
 * @param {number} fontPx
 * @returns {number}
 */
export function angleLabelRadius(rad, fontPx) {
  const r = Math.max(0, Number(rad) || 0);
  const fs = Math.max(1, Number(fontPx) || 1);
  const prefer = r * 0.55;
  // Half-glyph from prefer reaches/crosses the arc → sit outside (tiny arcs).
  if (prefer + fs * 0.5 >= r) return r + fs * 0.55;
  return prefer;
}

/**
 * @param {object} ll
 * @param {object} doc
 * @param {Map<string, object>} pts
 * @param {(x:number,y:number)=>{x:number,y:number}} toS
 * @param {ReturnType<typeof resolveInkBudget>} ink
 */
function svgLengthLabel(ll, doc, pts, toS, ink) {
  const seg = (doc.segments || []).find((s) => s.id === ll.segmentId);
  if (!seg) return "";
  const aw = pts.get(seg.a);
  const bw = pts.get(seg.b);
  if (!aw || !bw) return "";
  const a = toS(aw.x, aw.y);
  const b = toS(bw.x, bw.y);
  const style = normalizeLengthStyle(ll.style);
  const orient = normalizeLengthOrient(ll.orient);
  const fontPx = ink.fontForSize(ll.size);
  const side = ll.side === -1 ? -1 : 1;
  // Prefer explicit mm offsets for readability on paper.
  const offMm = style === "text" ? 2.2 : style === "ends" ? 1.6 : 2.8;
  const frame = lengthOffsetFrame(a, b, side, ink.mm(offMm));
  const ang = orient === "horizontal" ? 0 : frame.angle || readableEdgeAngle(frame.dx, frame.dy);
  const lw = Math.max(ink.markStroke, ink.mm(0.35)).toFixed(2);
  let out = "";
  let lx = frame.mx;
  let ly = frame.my;
  // dim/arcs/ends helpers size ticks relative to `sc` (old scale*0.75); 1 design unit ≈ 1mm.
  const designSc = ink.mm(1) / 0.75;
  if (style === "dim") {
    const parts = dimMarkParts(frame, fontPx, ll.text || "", designSc);
    const { tick0, tick1, lineA, lineB, arrow0, arrow1 } = parts;
    out += `<line x1="${tick0.x0.toFixed(2)}" y1="${tick0.y0.toFixed(2)}" x2="${tick0.x1.toFixed(2)}" y2="${tick0.y1.toFixed(2)}" stroke="#111" stroke-width="${lw}"/>\n`;
    out += `<line x1="${tick1.x0.toFixed(2)}" y1="${tick1.y0.toFixed(2)}" x2="${tick1.x1.toFixed(2)}" y2="${tick1.y1.toFixed(2)}" stroke="#111" stroke-width="${lw}"/>\n`;
    out += `<line x1="${lineA.x0.toFixed(2)}" y1="${lineA.y0.toFixed(2)}" x2="${lineA.x1.toFixed(2)}" y2="${lineA.y1.toFixed(2)}" stroke="#111" stroke-width="${lw}"/>\n`;
    out += `<line x1="${lineB.x0.toFixed(2)}" y1="${lineB.y0.toFixed(2)}" x2="${lineB.x1.toFixed(2)}" y2="${lineB.y1.toFixed(2)}" stroke="#111" stroke-width="${lw}"/>\n`;
    out += svgArrowHead(arrow0.tip.x, arrow0.tip.y, arrow0.dir.x, arrow0.dir.y, arrow0.size);
    out += svgArrowHead(arrow1.tip.x, arrow1.tip.y, arrow1.dir.x, arrow1.dir.y, arrow1.size);
    lx = parts.label.x;
    ly = parts.label.y;
  } else if (style === "arcs") {
    const parts = arcsMarkParts(frame, fontPx, ll.text || "", designSc);
    const dash = lengthStrokeDash(normalizeLengthStroke(ll.stroke), designSc);
    const dashAttr = dash.length
      ? ` stroke-dasharray="${dash.map((n) => n.toFixed(2)).join(" ")}"`
      : "";
    const qPath = (q) =>
      `M${q.x0.toFixed(2)},${q.y0.toFixed(2)} Q${q.cx.toFixed(2)},${q.cy.toFixed(2)} ${q.x1.toFixed(2)},${q.y1.toFixed(2)}`;
    out += `<path d="${qPath(parts.arcA)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round"${dashAttr}/>\n`;
    out += `<path d="${qPath(parts.arcB)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round"${dashAttr}/>\n`;
    lx = parts.label.x;
    ly = parts.label.y;
  } else if (style === "ends") {
    const onSeg = lengthOffsetFrame(a, b, side, 0);
    const parts = endsMarkParts(onSeg, fontPx, ll.text || "", designSc);
    const qPath = (q) =>
      `M${q.x0.toFixed(2)},${q.y0.toFixed(2)} Q${q.cx.toFixed(2)},${q.cy.toFixed(2)} ${q.x1.toFixed(2)},${q.y1.toFixed(2)}`;
    for (const mark of [parts.mark0, parts.mark1]) {
      out += `<path d="${qPath(mark.left)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round"/>\n`;
      out += `<path d="${qPath(mark.right)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round"/>\n`;
    }
    lx = parts.label.x;
    ly = parts.label.y;
  }
  const deg = (ang * 180) / Math.PI;
  const tf = `translate(${lx.toFixed(2)} ${ly.toFixed(2)}) rotate(${deg.toFixed(2)})`;
  const common =
    `transform="${tf}" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fontPx.toFixed(1)}"`;
  out += `<text ${common} fill="#111">${escapeXml(ll.text || "")}</text>\n`;
  return out;
}

/**
 * @param {object} doc
 * @param {{
 *   scale?: number,
 *   pad?: number,
 *   hidePoints?: boolean,
 *   frameWidthMm?: number,
 *   frameHeightMm?: number,
 *   minStrokeMm?: number,
 *   labelPt?: number,
 * }} [opts]
 * @returns {string} SVG markup
 */
export function documentToSvg(doc, opts = {}) {
  const scale = opts.scale != null ? Number(opts.scale) : 2;
  const pad = opts.pad != null ? Number(opts.pad) : 24;
  const hidePoints =
    opts.hidePoints != null ? !!opts.hidePoints : doc.hideExportPoints !== false;
  const b = boundsOf(doc, pad / scale);
  const w = Math.max(40, (b.maxX - b.minX) * scale);
  const h = Math.max(40, (b.maxY - b.minY) * scale);
  const toS = (x, y) => ({
    x: (x - b.minX) * scale,
    y: (y - b.minY) * scale,
  });
  const ink = resolveInkBudget(w, h, opts);
  const pts = pointMap(doc);
  const layers = doc.layers || {};
  const helpersShow = layers.helpersShow !== false;
  const sw = ink.stroke.toFixed(2);
  const markLw = ink.markStroke.toFixed(2);

  let body = "";

  for (const f of doc.fills || []) {
    const kind =
      f.kind === "sector" ||
      f.kind === "segment" ||
      f.kind === "polyArc" ||
      f.kind === "pathFill"
        ? f.kind
        : "polygon";
    const fill = hexToRgba(f.color, f.opacity);
    if (kind === "pathFill" && Array.isArray(f.edges) && f.edges.length >= 2) {
      let d = "";
      let ok = true;
      let started = false;
      for (const e of f.edges) {
        if (!e) {
          ok = false;
          break;
        }
        if (e.type === "line") {
          const a = pts.get(e.a);
          const bpt = pts.get(e.b);
          if (!a || !bpt) {
            ok = false;
            break;
          }
          const sa = toS(a.x, a.y);
          const sb = toS(bpt.x, bpt.y);
          if (!started) {
            d += `M${sa.x.toFixed(2)},${sa.y.toFixed(2)}`;
            started = true;
          }
          d += ` L${sb.x.toFixed(2)},${sb.y.toFixed(2)}`;
        } else if (e.type === "arc") {
          const c = pts.get(e.centerId);
          const s0 = pts.get(e.from);
          const s1 = pts.get(e.to);
          if (!c || !s0 || !s1) {
            ok = false;
            break;
          }
          const r = Math.hypot(s0.x - c.x, s0.y - c.y) || Math.hypot(s1.x - c.x, s1.y - c.y);
          const ang0 = Math.atan2(s0.y - c.y, s0.x - c.x);
          const ang1 = Math.atan2(s1.y - c.y, s1.x - c.x);
          let delta = ang1 - ang0;
          while (delta <= -Math.PI) delta += Math.PI * 2;
          while (delta > Math.PI) delta -= Math.PI * 2;
          const large = Math.abs(delta) > Math.PI ? 1 : 0;
          const sweep = delta < 0 ? 0 : 1;
          const p0 = toS(s0.x, s0.y);
          const p1 = toS(s1.x, s1.y);
          const sr = r * scale;
          if (!started) {
            d += `M${p0.x.toFixed(2)},${p0.y.toFixed(2)}`;
            started = true;
          }
          d += ` A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
        } else {
          ok = false;
          break;
        }
      }
      if (ok && started) body += `<path d="${d} Z" fill="${fill}" stroke="none" />\n`;
    } else if (kind === "polygon" && Array.isArray(f.pointIds) && f.pointIds.length >= 3) {
      const coords = [];
      let ok = true;
      for (const id of f.pointIds) {
        const p = pts.get(id);
        if (!p) {
          ok = false;
          break;
        }
        const s = toS(p.x, p.y);
        coords.push(`${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      }
      if (ok) body += `<polygon points="${coords.join(" ")}" fill="${fill}" stroke="none" />\n`;
    } else if (kind === "polyArc" && Array.isArray(f.pointIds) && f.pointIds.length >= 2) {
      const c = pts.get(f.centerId) || (f.circleId
        ? (() => {
            const cir = (doc.circles || []).find((x) => x.id === f.circleId);
            return cir ? pts.get(cir.centerId) : null;
          })()
        : null);
      const s0 = pts.get(f.startId);
      const s1 = pts.get(f.endId);
      if (c && s0 && s1) {
        const r = Math.hypot(s0.x - c.x, s0.y - c.y) || Math.hypot(s1.x - c.x, s1.y - c.y);
        const ang0 = Math.atan2(s0.y - c.y, s0.x - c.x);
        const ang1 = Math.atan2(s1.y - c.y, s1.x - c.x);
        let delta = ang1 - ang0;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI) delta -= Math.PI * 2;
        const large = Math.abs(delta) > Math.PI ? 1 : 0;
        const sweep = delta < 0 ? 0 : 1;
        const sr = r * scale;
        let d = "";
        let ok = true;
        for (let i = 0; i < f.pointIds.length; i++) {
          const p = pts.get(f.pointIds[i]);
          if (!p) {
            ok = false;
            break;
          }
          const s = toS(p.x, p.y);
          d += i === 0 ? `M${s.x.toFixed(2)},${s.y.toFixed(2)}` : ` L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
        }
        if (ok) {
          const a1 = toS(s1.x, s1.y);
          d += ` A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${a1.x.toFixed(2)},${a1.y.toFixed(2)} Z`;
          body += `<path d="${d}" fill="${fill}" stroke="none" />\n`;
        }
      }
    } else if (kind === "sector" || kind === "segment") {
      const c = pts.get(f.centerId) || (f.circleId
        ? (() => {
            const cir = (doc.circles || []).find((x) => x.id === f.circleId);
            return cir ? pts.get(cir.centerId) : null;
          })()
        : null);
      const s0 = pts.get(f.startId);
      const s1 = pts.get(f.endId);
      if (c && s0 && s1) {
        const r = Math.hypot(s0.x - c.x, s0.y - c.y) || Math.hypot(s1.x - c.x, s1.y - c.y);
        const sc = toS(c.x, c.y);
        const a0 = toS(s0.x, s0.y);
        const a1 = toS(s1.x, s1.y);
        const sr = r * scale;
        const ang0 = Math.atan2(s0.y - c.y, s0.x - c.x);
        const ang1 = Math.atan2(s1.y - c.y, s1.x - c.x);
        let delta = ang1 - ang0;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI) delta -= Math.PI * 2;
        const large = Math.abs(delta) > Math.PI ? 1 : 0;
        const sweep = delta < 0 ? 0 : 1;
        if (kind === "sector") {
          body += `<path d="M${sc.x.toFixed(2)},${sc.y.toFixed(2)} L${a0.x.toFixed(2)},${a0.y.toFixed(2)} A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${a1.x.toFixed(2)},${a1.y.toFixed(2)} Z" fill="${fill}" stroke="none" />\n`;
        } else {
          body += `<path d="M${a0.x.toFixed(2)},${a0.y.toFixed(2)} A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${a1.x.toFixed(2)},${a1.y.toFixed(2)} L${a0.x.toFixed(2)},${a0.y.toFixed(2)} Z" fill="${fill}" stroke="none" />\n`;
        }
      }
    }
  }

  // Full circles — skip if a sector/arc already uses the same centre+radius (exam figures often show arcs only)
  const sectorKeys = new Set();
  for (const sec of doc.sectors || []) {
    const c = pts.get(sec.centerId);
    const s0 = pts.get(sec.startId);
    if (c && s0) {
      const r = Math.hypot(s0.x - c.x, s0.y - c.y);
      sectorKeys.add(`${sec.centerId}:${r.toFixed(2)}`);
    }
  }
  for (const cir of doc.circles || []) {
    const c = pts.get(cir.centerId);
    const t = pts.get(cir.throughId);
    if (!c || !t) continue;
    const r = Math.hypot(t.x - c.x, t.y - c.y);
    if (sectorKeys.has(`${cir.centerId}:${r.toFixed(2)}`)) continue;
    const sc = toS(c.x, c.y);
    const rs = r * scale;
    const dash = ink.dash(cir.style);
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d.toFixed(2)).join(" ")}"`
      : "";
    body += `<circle cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" r="${rs.toFixed(2)}" fill="none" stroke="#111" stroke-width="${sw}"${da} />\n`;
  }

  for (const sec of doc.sectors || []) {
    const c = pts.get(sec.centerId);
    const s0 = pts.get(sec.startId);
    const s1 = pts.get(sec.endId);
    if (!c || !s0 || !s1) continue;
    const r = Math.hypot(s0.x - c.x, s0.y - c.y) || Math.hypot(s1.x - c.x, s1.y - c.y);
    const a0 = Math.atan2(s0.y - c.y, s0.x - c.x);
    const a1 = Math.atan2(s1.y - c.y, s1.x - c.x);
    let delta = a1 - a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    // Prefer the shorter arc unless reflex
    if (sec.reflex) {
      if (Math.abs(delta) < Math.PI) delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
    }
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta < 0 ? 0 : 1;
    const p0 = toS(s0.x, s0.y);
    const p1 = toS(s1.x, s1.y);
    const sr = r * scale;
    const dash = ink.dash(sec.style);
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d.toFixed(2)).join(" ")}"`
      : "";
    if (sec.mode === "sector") {
      const sc = toS(c.x, c.y);
      body += `<path d="M${sc.x.toFixed(2)},${sc.y.toFixed(2)} L${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Z" fill="none" stroke="#111" stroke-width="${sw}"${da} />\n`;
    } else {
      body += `<path d="M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"${da} />\n`;
    }
  }

  for (const el of doc.ellipses || []) {
    const c = pts.get(el.centerId);
    const rxP = pts.get(el.rxId);
    const ryP = pts.get(el.ryId);
    if (!c || !rxP || !ryP) continue;
    const sc = toS(c.x, c.y);
    const rx = Math.abs(rxP.x - c.x) * scale;
    const ry = Math.abs(ryP.y - c.y) * scale;
    body += `<ellipse cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" stroke="#111" stroke-width="${sw}" />\n`;
  }

  for (const seg of doc.segments || []) {
    const a = pts.get(seg.a);
    const bpt = pts.get(seg.b);
    if (!a || !bpt) continue;
    const sa = toS(a.x, a.y);
    const sb = toS(bpt.x, bpt.y);
    const dash = ink.dash(seg.style);
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d.toFixed(2)).join(" ")}"`
      : "";
    body += `<line x1="${sa.x.toFixed(2)}" y1="${sa.y.toFixed(2)}" x2="${sb.x.toFixed(2)}" y2="${sb.y.toFixed(2)}" stroke="#111" stroke-width="${sw}" stroke-linecap="round"${da} />\n`;
  }

  if (helpersShow) {
    for (const ra of doc.rightAngles || []) {
      const v = pts.get(ra.vertex);
      const a1 = pts.get(ra.arm1);
      const a2 = pts.get(ra.arm2);
      if (!v || !a1 || !a2) continue;
      const sv = toS(v.x, v.y);
      let u1x = a1.x - v.x,
        u1y = a1.y - v.y;
      let u2x = a2.x - v.x,
        u2y = a2.y - v.y;
      // Direction in SVG space (scale cancels for axis-aligned; general via toS delta).
      const s1 = toS(v.x + u1x, v.y + u1y);
      const s2 = toS(v.x + u2x, v.y + u2y);
      let dx1 = s1.x - sv.x,
        dy1 = s1.y - sv.y;
      let dx2 = s2.x - sv.x,
        dy2 = s2.y - sv.y;
      const n1 = Math.hypot(dx1, dy1) || 1;
      const n2 = Math.hypot(dx2, dy2) || 1;
      dx1 /= n1;
      dy1 /= n1;
      dx2 /= n2;
      dy2 /= n2;
      // size 10 → ~2.6mm on paper; scales with attribute.
      const sizeAttr = ra.size != null ? Number(ra.size) : 10;
      const sizeUu = ink.mm(Math.max(2.2, (sizeAttr / 10) * 2.6));
      const p1 = { x: sv.x + dx1 * sizeUu, y: sv.y + dy1 * sizeUu };
      const p2 = {
        x: sv.x + dx1 * sizeUu + dx2 * sizeUu,
        y: sv.y + dy1 * sizeUu + dy2 * sizeUu,
      };
      const p3 = { x: sv.x + dx2 * sizeUu, y: sv.y + dy2 * sizeUu };
      body += `<polyline points="${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} ${p3.x.toFixed(2)},${p3.y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${markLw}" />\n`;
    }
    for (const aa of doc.angleArcs || []) {
      const v = pts.get(aa.vertex);
      const a1 = pts.get(aa.arm1);
      const a2 = pts.get(aa.arm2);
      if (!v || !a1 || !a2) continue;
      const sizeAttr = aa.size != null ? Number(aa.size) : 22;
      // size 22 → ~4.5mm; size 10 → ~2.05mm (tiny) — label may sit outside.
      const rad = ink.mm(Math.max(1.6, (sizeAttr / 22) * 4.5));
      const t0 = Math.atan2(a1.y - v.y, a1.x - v.x);
      const t1 = Math.atan2(a2.y - v.y, a2.x - v.x);
      let delta = t1 - t0;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      while (delta > Math.PI) delta -= Math.PI * 2;
      if (aa.reflex) {
        if (Math.abs(delta) < Math.PI) delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
      }
      const large = Math.abs(delta) > Math.PI ? 1 : 0;
      const sweep = delta < 0 ? 0 : 1;
      const sv = toS(v.x, v.y);
      const p0 = {
        x: sv.x + Math.cos(t0) * rad,
        y: sv.y + Math.sin(t0) * rad,
      };
      const p1 = {
        x: sv.x + Math.cos(t1) * rad,
        y: sv.y + Math.sin(t1) * rad,
      };
      body += `<path d="M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${rad.toFixed(2)},${rad.toFixed(2)} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${markLw}" />\n`;
      if (aa.text) {
        const mid = t0 + delta / 2;
        const fs = ink.fontForSize(13);
        const tr = angleLabelRadius(rad, fs);
        const tx = sv.x + Math.cos(mid) * tr;
        const ty = sv.y + Math.sin(mid) * tr;
        body += `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(aa.text)}</text>\n`;
      }
    }
    for (const pm of doc.parallelMarks || []) {
      const seg = (doc.segments || []).find((s) => s.id === pm.segmentId);
      if (!seg) continue;
      const basis = segmentDrawBasis(
        seg,
        pts,
        markTAlong(doc, "parallel", pm.segmentId, pm.group),
        toS
      );
      if (!basis) continue;
      const chevrons = parallelMarkDrawChevrons(
        basis,
        pm.group,
        pm.side === -1 ? -1 : 1,
        ink.mm(2.2),
        ink.mm(1.8)
      );
      for (const tri of chevrons) {
        body += `<polyline points="${tri[0].x.toFixed(2)},${tri[0].y.toFixed(2)} ${tri[1].x.toFixed(2)},${tri[1].y.toFixed(2)} ${tri[2].x.toFixed(2)},${tri[2].y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${markLw}" stroke-linecap="round" stroke-linejoin="round" />\n`;
      }
    }
    for (const em of doc.equalMarks || []) {
      const seg = (doc.segments || []).find((s) => s.id === em.segmentId);
      if (!seg) continue;
      const basis = segmentDrawBasis(
        seg,
        pts,
        markTAlong(doc, "equal", em.segmentId, em.group),
        toS
      );
      if (!basis) continue;
      const strokes = equalMarkDrawStrokes(
        basis,
        em.group,
        em.side === -1 ? -1 : 1,
        ink.mm(1.6),
        ink.mm(0.95)
      );
      for (const s of strokes) {
        body += `<line x1="${s.x0.toFixed(2)}" y1="${s.y0.toFixed(2)}" x2="${s.x1.toFixed(2)}" y2="${s.y1.toFixed(2)}" stroke="#111" stroke-width="${markLw}" stroke-linecap="round" />\n`;
      }
    }
    for (const ll of doc.lengthLabels || []) {
      body += svgLengthLabel(ll, doc, pts, toS, ink);
    }
  }

  if (!hidePoints) {
    for (const p of pts.values()) {
      const s = toS(p.x, p.y);
      const pr = ink.mm(0.55).toFixed(2);
      body += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${pr}" fill="#111" />\n`;
    }
  }

  if (helpersShow) {
    for (const lab of doc.labels || []) {
      const p = pts.get(lab.pointId);
      if (!p) continue;
      const s = toS(p.x + (lab.ox || 0), p.y + (lab.oy || 0));
      const fs = ink.fontForSize(lab.size);
      const halo = Math.max(ink.mm(0.35), fs * 0.28);
      const common = `x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"`;
      body += `<text ${common} fill="none" stroke="#ffffff" stroke-width="${halo.toFixed(2)}" stroke-linejoin="round">${escapeXml(lab.text)}</text>\n`;
      body += `<text ${common} fill="#111">${escapeXml(lab.text)}</text>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">
<rect width="100%" height="100%" fill="#ffffff"/>
${body}</svg>
`;
}
