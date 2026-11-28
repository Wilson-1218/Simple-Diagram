/**
 * Offscreen PNG canvas cap (copy-white-PNG and download PNG).
 * SVG export does not use this. A target that already fits keeps its scale.
 *
 * targetW/targetH are the ceiled canvas pixels at the requested scale
 * (world span × scale, plus the fixed output pad). When either side exceeds
 * MAX_PNG_DIM or the product exceeds MAX_PNG_AREA, the render scale is
 * multiplied by
 *   k = min(MAX_PNG_DIM/targetW, MAX_PNG_DIM/targetH, sqrt(MAX_PNG_AREA/(targetW*targetH)))
 * and repeated, because the pad is a fixed pixel margin and does not shrink
 * with k. The returned scale is the largest value ≤ the request whose ceiled
 * canvas stays inside both limits.
 */

export const MAX_PNG_DIM = 4096;
export const MAX_PNG_AREA = 12_000_000;

export function pngTargetPixels(scale, worldW, worldH, pad = 0) {
  const s = Number(scale);
  const wW = Number(worldW) || 0;
  const wH = Number(worldH) || 0;
  const p = Number(pad) || 0;
  const use = Number.isFinite(s) && s > 0 ? s : 1;
  return {
    w: Math.ceil(Math.max(40, wW * use + p * 2)),
    h: Math.ceil(Math.max(40, wH * use + p * 2)),
  };
}

function pixelsFit(w, h) {
  return w <= MAX_PNG_DIM && h <= MAX_PNG_DIM && w * h <= MAX_PNG_AREA;
}

export function cappedPngScale(requestedScale, worldW, worldH, pad = 0) {
  const s0 = Number(requestedScale);
  const scale0 = Number.isFinite(s0) && s0 > 0 ? s0 : 1;
  const wW = Number(worldW) || 0;
  const wH = Number(worldH) || 0;
  const p = Number.isFinite(Number(pad)) ? Number(pad) : 0;
  const first = pngTargetPixels(scale0, wW, wH, p);
  if (pixelsFit(first.w, first.h)) return scale0;
  let s = scale0;
  for (let i = 0; i < 8; i++) {
    const { w, h } = pngTargetPixels(s, wW, wH, p);
    if (pixelsFit(w, h)) return s;
    const k = Math.min(MAX_PNG_DIM / w, MAX_PNG_DIM / h, Math.sqrt(MAX_PNG_AREA / (w * h)));
    if (!(k > 0) || !(k < 1)) break;
    s *= k;
  }
  return s;
}
