/**
 * Headless SVG export for agents (no DOM). White paper, black ink.
 * Covers points, segments, circles, ellipses, polygon fills, labels,
 * rightAngles, lengthLabels. Sector/segment fills approximated as chords+pie.
 */

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
    const kind = f.kind === "sector" || f.kind === "segment" ? f.kind : "polygon";
    const fill = hexToRgba(f.color, f.opacity);
    if (kind === "polygon" && Array.isArray(f.pointIds) && f.pointIds.length >= 3) {
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

  for (const cir of doc.circles || []) {
    const c = pts.get(cir.centerId);
    const t = pts.get(cir.throughId);
    if (!c || !t) continue;
    const sc = toS(c.x, c.y);
    const r = Math.hypot(t.x - c.x, t.y - c.y) * scale;
    const dash = STYLE_DASH[cir.style] || [];
    const da = dash.length
      ? ` stroke-dasharray="${dash.map((d) => d * scale * 0.75).join(" ")}"`
      : "";
    body += `<circle cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(1.6 * scale * 0.75).toFixed(2)}"${da} />\n`;
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
    for (const ll of doc.lengthLabels || []) {
      const seg = (doc.segments || []).find((s) => s.id === ll.segmentId);
      if (!seg) continue;
      const a = pts.get(seg.a);
      const b = pts.get(seg.b);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const s = toS(mx, my - 8);
      const fs = 14 * scale * 0.75;
      body += `<text x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle">${escapeXml(ll.text || "")}</text>\n`;
    }
  }

  if (!hidePoints) {
    for (const p of pts.values()) {
      const s = toS(p.x, p.y);
      body += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${(3.2 * scale * 0.7).toFixed(2)}" fill="#111" />\n`;
    }
  }

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

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">
<rect width="100%" height="100%" fill="#ffffff"/>
${body}</svg>
`;
}
