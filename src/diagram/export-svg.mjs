/**
 * Headless SVG export for agents (no DOM). White paper, black ink.
 * Covers points, segments, circles, ellipses, sectors (arc strokes),
 * polygon/sector/segment fills, labels, rightAngles, angleArcs (+ text),
 * lengthLabels (text|dim|arcs), equalMarks (ticks).
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

const STYLE_DASH = {
  solid: [],
  dashed: [12, 9],
  dotted: [2.2, 5.5],
  dashdot: [12, 5, 2.2, 5],
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
 * @param {object} ll
 * @param {object} doc
 * @param {Map<string, object>} pts
 * @param {(x:number,y:number)=>{x:number,y:number}} toS
 * @param {number} scale
 */
function svgLengthLabel(ll, doc, pts, toS, scale) {
  const seg = (doc.segments || []).find((s) => s.id === ll.segmentId);
  if (!seg) return "";
  const aw = pts.get(seg.a);
  const bw = pts.get(seg.b);
  if (!aw || !bw) return "";
  const a = toS(aw.x, aw.y);
  const b = toS(bw.x, bw.y);
  const style = normalizeLengthStyle(ll.style);
  const orient = normalizeLengthOrient(ll.orient);
  const fontPx = Math.min(48, Math.max(10, Number(ll.size) || 16)) * scale * 0.75;
  const side = ll.side === -1 ? -1 : 1;
  const sc = scale * 0.75;
  const off =
    (style === "text" ? 14 : style === "ends" ? 10 : 18) * sc;
  const frame = lengthOffsetFrame(a, b, side, off);
  const ang = orient === "horizontal" ? 0 : frame.angle || readableEdgeAngle(frame.dx, frame.dy);
  const lw = Math.max(1.1, 1.35 * sc).toFixed(2);
  let out = "";
  let lx = frame.mx;
  let ly = frame.my;
  if (style === "dim") {
    const parts = dimMarkParts(frame, fontPx, ll.text || "", sc);
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
    const parts = arcsMarkParts(frame, fontPx, ll.text || "", sc);
    const dash = lengthStrokeDash(normalizeLengthStroke(ll.stroke), sc);
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
    const parts = endsMarkParts(onSeg, fontPx, ll.text || "", sc);
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
 * @param {{ scale?: number, pad?: number, hidePoints?: boolean }} [opts]
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
  const pts = pointMap(doc);
  const layers = doc.layers || {};
  const helpersShow = layers.helpersShow !== false;

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
          const b = pts.get(e.b);
          if (!a || !b) {
            ok = false;
            break;
          }
          const sa = toS(a.x, a.y);
          const sb = toS(b.x, b.y);
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
    const dash = STYLE_DASH[cir.style] || [];
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d * scale * 0.75).join(" ")}"`
      : "";
    body += `<circle cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" r="${rs.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(1.6 * scale * 0.75).toFixed(2)}"${da} />\n`;
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
    const dash = STYLE_DASH[sec.style] || [];
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d * scale * 0.75).join(" ")}"`
      : "";
    const sw = (1.6 * scale * 0.75).toFixed(2);
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
    body += `<ellipse cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(1.6 * scale * 0.75).toFixed(2)}" />\n`;
  }

  for (const seg of doc.segments || []) {
    const a = pts.get(seg.a);
    const b = pts.get(seg.b);
    if (!a || !b) continue;
    const sa = toS(a.x, a.y);
    const sb = toS(b.x, b.y);
    const dash = STYLE_DASH[seg.style] || [];
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d * scale * 0.75).join(" ")}"`
      : "";
    body += `<line x1="${sa.x.toFixed(2)}" y1="${sa.y.toFixed(2)}" x2="${sb.x.toFixed(2)}" y2="${sb.y.toFixed(2)}" stroke="#111" stroke-width="${(1.6 * scale * 0.75).toFixed(2)}" stroke-linecap="round"${da} />\n`;
  }

  if (helpersShow) {
    for (const ra of doc.rightAngles || []) {
      const v = pts.get(ra.vertex);
      const a1 = pts.get(ra.arm1);
      const a2 = pts.get(ra.arm2);
      if (!v || !a1 || !a2) continue;
      const size = (ra.size || 10) * scale * 0.75;
      const u1x = a1.x - v.x,
        u1y = a1.y - v.y;
      const u2x = a2.x - v.x,
        u2y = a2.y - v.y;
      const n1 = Math.hypot(u1x, u1y) || 1;
      const n2 = Math.hypot(u2x, u2y) || 1;
      const p1 = toS(v.x + (u1x / n1) * (size / scale), v.y + (u1y / n1) * (size / scale));
      const p2 = toS(
        v.x + (u1x / n1) * (size / scale) + (u2x / n2) * (size / scale),
        v.y + (u1y / n1) * (size / scale) + (u2y / n2) * (size / scale)
      );
      const p3 = toS(v.x + (u2x / n2) * (size / scale), v.y + (u2y / n2) * (size / scale));
      const sv = toS(v.x, v.y);
      body += `<polyline points="${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} ${p3.x.toFixed(2)},${p3.y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(1.4 * scale * 0.75).toFixed(2)}" />\n`;
      void sv;
    }
    for (const aa of doc.angleArcs || []) {
      const v = pts.get(aa.vertex);
      const a1 = pts.get(aa.arm1);
      const a2 = pts.get(aa.arm2);
      if (!v || !a1 || !a2) continue;
      const rad = (aa.size != null ? Number(aa.size) : 22) * scale * 0.75;
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
      body += `<path d="M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${rad.toFixed(2)},${rad.toFixed(2)} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(1.3 * scale * 0.75).toFixed(2)}" />\n`;
      if (aa.text) {
        const mid = t0 + delta / 2;
        const tr = rad * 0.55;
        const tx = sv.x + Math.cos(mid) * tr;
        const ty = sv.y + Math.sin(mid) * tr;
        const fs = 13 * scale * 0.75;
        body += `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(aa.text)}</text>\n`;
      }
    }
    for (const em of doc.equalMarks || []) {
      const seg = (doc.segments || []).find((s) => s.id === em.segmentId);
      if (!seg) continue;
      const a = pts.get(seg.a);
      const b = pts.get(seg.b);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 6;
      const ny = (dx / len) * 6;
      const tick = 5;
      const px = (-dy / len) * tick;
      const py = (dx / len) * tick;
      const group = em.group ? 1 : 0;
      const offsets = group ? [-3, 3] : [0];
      for (const off of offsets) {
        const ox = (dx / len) * off;
        const oy = (dy / len) * off;
        const s0 = toS(mx + ox - px + nx * 0, my + oy - py);
        const s1 = toS(mx + ox + px, my + oy + py);
        // perpendicular tick across segment
        const q0 = toS(mx + ox - px, my + oy - py);
        const q1 = toS(mx + ox + px, my + oy + py);
        body += `<line x1="${q0.x.toFixed(2)}" y1="${q0.y.toFixed(2)}" x2="${q1.x.toFixed(2)}" y2="${q1.y.toFixed(2)}" stroke="#111" stroke-width="${(1.4 * scale * 0.75).toFixed(2)}" />\n`;
        void s0;
        void s1;
        void nx;
        void ny;
      }
    }
    for (const ll of doc.lengthLabels || []) {
      body += svgLengthLabel(ll, doc, pts, toS, scale);
    }
  }

  if (!hidePoints) {
    for (const p of pts.values()) {
      const s = toS(p.x, p.y);
      body += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${(3.2 * scale * 0.7).toFixed(2)}" fill="#111" />\n`;
    }
  }

  if (helpersShow) {
    for (const lab of doc.labels || []) {
      const p = pts.get(lab.pointId);
      if (!p) continue;
      const s = toS(p.x + (lab.ox || 0), p.y + (lab.oy || 0));
      const fs = (lab.size || 16) * scale * 0.75;
      const halo = Math.max(3, fs * 0.28);
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
