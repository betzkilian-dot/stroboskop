import type { RGBAImage, VideoInfo } from '../types';

export function targetSize(w: number, h: number, maxSize: number): { width: number; height: number } {
  const s = Math.min(1, maxSize / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

export function clampRows(rows: [number, number] | undefined, height: number): [number, number] {
  if (!rows) return [0, height];
  const start = Math.max(0, Math.min(height, Math.floor(rows[0])));
  const end = Math.max(start, Math.min(height, Math.floor(rows[1])));
  return [start, end];
}

/**
 * Zeichnet eine Quelle in Codierungs-Orientierung gedreht (im Uhrzeigersinn) und skaliert
 * in outW x outH (bereits gedrehte Zielgroesse) und liefert das Zeilenband [rows[0], rows[1]).
 */
export function drawRotated(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  src: CanvasImageSource,
  rotation: VideoInfo['rotation'],
  outW: number,
  outH: number,
  rows: [number, number],
): RGBAImage {
  if (rows[1] <= rows[0]) return { width: outW, height: 0, data: new Uint8ClampedArray(0) };
  const swap = rotation === 90 || rotation === 270;
  const dw = swap ? outH : outW;
  const dh = swap ? outW : outH;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (rotation === 90) ctx.setTransform(0, 1, -1, 0, outW, 0);
  else if (rotation === 180) ctx.setTransform(-1, 0, 0, -1, outW, outH);
  else if (rotation === 270) ctx.setTransform(0, -1, 1, 0, 0, outH);
  ctx.drawImage(src, 0, 0, dw, dh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, rows[0], outW, rows[1] - rows[0]);
  return { width: img.width, height: img.height, data: img.data };
}
