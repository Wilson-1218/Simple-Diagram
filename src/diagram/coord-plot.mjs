/**
 * Headless coord-plot geometry + SVG helpers (mirrors editor paintCoordPlot).
 * Used by documentToSvg so formal paper export matches the canvas.
 */

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function coordWorldFromAxis(plot, u, v) {
  return { x: plot.ox + u * plot.unitPx, y: plot.oy - v * plot.unitPx };
}

export function coordPlotBounds(plot) {
  const pad = (plot.unitPx || 40) * 0.55;
  const corners = [
    coordWorldFromAxis(plot, plot.xmin, plot.ymin),
    coordWorldFromAxis(plot, plot.xmax, plot.ymin),
    coordWorldFromAxis(plot, plot.xmin, plot.ymax),
    coordWorldFromAxis(plot, plot.xmax, plot.ymax),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function addCoordPlotBounds(plot, add) {
  const b = coordPlotBounds(plot);
  add(b.minX, b.minY);
  add(b.maxX, b.maxY);
}

export function coordIntegerTicks(min, max) {
  const out = [];
  const a = Math.ceil(min - 1e-9);
  const b = Math.floor(max + 1e-9);
  for (let i = a; i <= b; i++) {
    if (i === 0) continue;
    out.push(i);
  }
  return out;
}

function coordNearZero(u) {
  return Math.abs(u) < 1e-9;
}

function coordLogBase(params) {
  const b = params && params.base;
  if (b === "e" || b === "E") return Math.E;
  const n = Number(b);
  if (Number.isFinite(n) && n > 0 && n !== 1) return n;
  return 10;
}

function coordCircleRadius(params) {
  const p = params || {};
  if (Number.isFinite(Number(p.r)) && Number(p.r) > 0) return Number(p.r);
  if (Number.isFinite(Number(p.r2)) && Number(p.r2) > 0) return Math.sqrt(Number(p.r2));
  return 1;
}

function coordIsDeg(plot) {
  return !!(plot && plot.xAngleUnit === "deg");
}

export function coordEvalY(curve, x, plot) {
  const p = curve.params || {};
  const type = curve.type || "none";
  if (type === "line") return (p.m ?? 1) * x + (p.c ?? 0);
  if (type === "quad") return (p.a ?? 1) * x * x + (p.b ?? 0) * x + (p.c ?? 0);
  if (type === "log" || type === "log10") {
    if (x <= 0) return NaN;
    const base = type === "log10" ? 10 : coordLogBase(p);
    const denom = Math.log(base);
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-15) return NaN;
    return (p.a ?? 1) * (Math.log(x) / denom);
  }
  if (type === "ln") {
    if (x <= 0) return NaN;
    return (p.a ?? 1) * Math.log(x);
  }
  if (type === "exp") {
    const a = p.a ?? 1;
    const b = p.b ?? Math.E;
    if (!(b > 0)) return NaN;
    return a * Math.pow(b, x);
  }
  if (type === "sin" || type === "cos" || type === "tan") {
    const A = p.A ?? 1;
    const B = p.B ?? 1;
    const C = p.C ?? 0;
    const D = p.D ?? 0;
    let arg = B * x + C;
    if (coordIsDeg(plot)) arg *= Math.PI / 180;
    if (type === "tan") {
      const c = Math.cos(arg);
      if (Math.abs(c) < 1e-3) return NaN;
      return A * Math.tan(arg) + D;
    }
    if (type === "sin") return A * Math.sin(arg) + D;
    return A * Math.cos(arg) + D;
  }
  return NaN;
}

export function coordSampleOneCurve(plot, curve) {
  const type = curve.type || "none";
  if (!type || type === "none") return [];
  const pts = [];
  if (type === "circle") {
    const p = curve.params || {};
    const h = p.h ?? 0;
    const k = p.k ?? 0;
    const r = coordCircleRadius(p);
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const u = h + r * Math.cos(ang);
      const v = k + r * Math.sin(ang);
      if (u < plot.xmin || u > plot.xmax || v < plot.ymin || v > plot.ymax) {
        pts.push(null);
      } else {
        pts.push(coordWorldFromAxis(plot, u, v));
      }
    }
    return pts;
  }
  const needsPosX = type === "log" || type === "log10" || type === "ln";
  const isTrig = type === "sin" || type === "cos" || type === "tan";
  const n = isTrig ? 280 : 160;
  const x0 = Math.max(plot.xmin, needsPosX ? 1e-4 : plot.xmin);
  const x1 = plot.xmax;
  if (x1 <= x0) return pts;
  let prevV = null;
  for (let i = 0; i <= n; i++) {
    const u = x0 + ((x1 - x0) * i) / n;
    const v = coordEvalY(curve, u, plot);
    if (!Number.isFinite(v) || v < plot.ymin || v > plot.ymax) {
      pts.push(null);
      prevV = null;
      continue;
    }
    if (type === "tan" && prevV != null && Math.abs(v - prevV) > (plot.ymax - plot.ymin) * 0.85) {
      pts.push(null);
    }
    pts.push(coordWorldFromAxis(plot, u, v));
    prevV = v;
  }
  return pts;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgOpenArrow(tipX, tipY, ang, size, lw) {
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.82;
  const x1 = tipX + Math.cos(a1) * size;
  const y1 = tipY + Math.sin(a1) * size;
  const x2 = tipX + Math.cos(a2) * size;
  const y2 = tipY + Math.sin(a2) * size;
  return `<path d="M${tipX.toFixed(2)},${tipY.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} M${tipX.toFixed(2)},${tipY.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" fill="none" />\n`;
}

/**
 * SVG markup for one coord plot in the same userUnit space as documentToSvg's toS.
 * @param {object} plot
 * @param {(x:number,y:number)=>{x:number,y:number}} toS
 * @param {{ stroke?: number, fontPx?: number, markStroke?: number }} inkish
 */
export function svgCoordPlot(plot, toS, inkish = {}) {
  if (!plot) return "";
  const lw = (inkish.stroke != null ? inkish.stroke : 1.2).toFixed(2);
  const fontPx = (inkish.fontPx != null ? inkish.fontPx : 12).toFixed(1);
  const unitPx = num(plot.unitPx, 40);
  const ox = num(plot.ox, 0);
  const oy = num(plot.oy, 0);
  const xmin = num(plot.xmin, -2);
  const xmax = num(plot.xmax, 6);
  const ymin = num(plot.ymin, -2);
  const ymax = num(plot.ymax, 6);

  const o = toS(ox, oy);
  const xNeg = toS(ox + xmin * unitPx, oy);
  const xPos = toS(ox + xmax * unitPx, oy);
  const yNeg = toS(ox, oy - ymin * unitPx);
  const yPos = toS(ox, oy - ymax * unitPx);

  let body = "";
  body += `<line x1="${xNeg.x.toFixed(2)}" y1="${xNeg.y.toFixed(2)}" x2="${xPos.x.toFixed(2)}" y2="${xPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
  body += `<line x1="${yNeg.x.toFixed(2)}" y1="${yNeg.y.toFixed(2)}" x2="${yPos.x.toFixed(2)}" y2="${yPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;

  const arrow = Math.max(7, Number(lw) * 3.2);
  body += svgOpenArrow(
    xPos.x,
    xPos.y,
    Math.atan2(xPos.y - o.y, xPos.x - o.x),
    arrow,
    lw
  );
  body += svgOpenArrow(
    yPos.x,
    yPos.y,
    Math.atan2(yPos.y - o.y, yPos.x - o.x),
    arrow,
    lw
  );

  const tickLen = Math.max(4, Number(lw) * 2.2);
  const showTickMarks = plot.showTicks !== false && plot.showTickLabels !== false;
  const fam =
    'font-family="STIX Two Text, Times New Roman, serif" font-style="italic"';

  if (showTickMarks) {
    for (const u of coordIntegerTicks(xmin, xmax)) {
      const p = toS(ox + u * unitPx, oy);
      body += `<line x1="${p.x.toFixed(2)}" y1="${(p.y - tickLen).toFixed(2)}" x2="${p.x.toFixed(2)}" y2="${(p.y + tickLen).toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      if (!coordNearZero(u)) {
        body += `<text x="${p.x.toFixed(2)}" y="${(p.y + tickLen + 1).toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(String(u))}</text>\n`;
      }
    }
    for (const v of coordIntegerTicks(ymin, ymax)) {
      const p = toS(ox, oy - v * unitPx);
      body += `<line x1="${(p.x - tickLen).toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${(p.x + tickLen).toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
      if (!coordNearZero(v)) {
        body += `<text x="${(p.x - tickLen - 2).toFixed(2)}" y="${p.y.toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="end" dominant-baseline="middle">${escapeXml(String(v))}</text>\n`;
      }
    }
  }

  if (plot.showOrigin !== false) {
    body += `<text x="${(o.x - 4).toFixed(2)}" y="${(o.y + 3).toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="end" dominant-baseline="hanging">O</text>\n`;
  }

  const lx = String(plot.axisLabelX != null ? plot.axisLabelX : "x").trim();
  const ly = String(plot.axisLabelY != null ? plot.axisLabelY : "y").trim();
  if (lx) {
    body += `<text x="${(xPos.x + 4).toFixed(2)}" y="${(xPos.y + 2).toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="start" dominant-baseline="hanging">${escapeXml(lx)}</text>\n`;
  }
  if (ly) {
    body += `<text x="${(yPos.x + 4).toFixed(2)}" y="${(yPos.y - 2).toFixed(2)}" fill="#111" ${fam} font-size="${fontPx}" text-anchor="start" dominant-baseline="auto">${escapeXml(ly)}</text>\n`;
  }

  const curves = Array.isArray(plot.curves) ? plot.curves : [];
  const samplePlot = { ...plot, ox, oy, unitPx, xmin, xmax, ymin, ymax };
  for (const curve of curves) {
    let d = "";
    let pen = false;
    for (const pt of coordSampleOneCurve(samplePlot, curve)) {
      if (!pt) {
        pen = false;
        continue;
      }
      const s = toS(pt.x, pt.y);
      if (!pen) {
        d += `M${s.x.toFixed(2)},${s.y.toFixed(2)}`;
        pen = true;
      } else d += `L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
    }
    if (d) {
      body += `<path d="${d}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />\n`;
    }
  }
  return body;
}
