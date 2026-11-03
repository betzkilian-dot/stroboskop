import type { RGBAImage } from '../types';

export type Polygon = Array<{ x: number; y: number }>;

/** Differenz je Pixel = max über R,G,B von |frame-bg| (0..255). */
function diffAt(a: Uint8ClampedArray, b: Uint8ClampedArray, o: number): number {
  const d0 = Math.abs(a[o] - b[o]);
  const d1 = Math.abs(a[o + 1] - b[o + 1]);
  const d2 = Math.abs(a[o + 2] - b[o + 2]);
  return d0 > d1 ? (d0 > d2 ? d0 : d2) : d1 > d2 ? d1 : d2;
}

/** Binäre Maske (1/0) aus Differenz > threshold (0..1). */
export function binaryDiffMask(
  frame: RGBAImage,
  bg: RGBAImage,
  threshold: number,
  target?: Float32Array,
): Float32Array {
  const n = frame.width * frame.height;
  const m = target ?? new Float32Array(n);
  const t = threshold * 255;
  for (let i = 0; i < n; i++) m[i] = diffAt(frame.data, bg.data, i * 4) > t ? 1 : 0;
  return m;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number, tmp: Float32Array, out: Float32Array): Float32Array {
  // horizontal (Fenster am Rand beschnitten, durch tatsächliche Fenstergröße geteilt)
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r), hi = Math.min(w - 1, x + r);
      tmp[row + x] = sum / (hi - lo + 1);
      if (x + r + 1 < w) sum += src[row + x + r + 1];
      if (x - r >= 0) sum -= src[row + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r), hi = Math.min(h - 1, y + r);
      out[y * w + x] = sum / (hi - lo + 1);
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x];
      if (y - r >= 0) sum -= tmp[(y - r) * w + x];
    }
  }
  return out;
}

function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface MaskScratch {
  bin: Float32Array;
  tmp: Float32Array;
  out: Float32Array;
}

export function createMaskScratch(pixels: number): MaskScratch {
  return { bin: new Float32Array(pixels), tmp: new Float32Array(pixels), out: new Float32Array(pixels) };
}

/** Wie motionMask, nutzt aber vorallokierte Puffer; das Ergebnis liegt in scratch.bin oder scratch.out. */
export function motionMaskScratch(
  frame: RGBAImage,
  bg: RGBAImage,
  threshold: number,
  featherPx: number,
  region: Polygon | null,
  scratch: MaskScratch,
): Float32Array {
  const { width: w, height: h } = frame;
  let m = binaryDiffMask(frame, bg, threshold, scratch.bin);
  const r = Math.round(featherPx);
  if (r > 0) m = boxBlur(m, w, h, r, scratch.tmp, scratch.out);
  if (region && region.length >= 3) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (m[y * w + x] !== 0 && !pointInPolygon(x + 0.5, y + 0.5, region)) m[y * w + x] = 0;
  }
  return m;
}

export function motionMask(
  frame: RGBAImage,
  bg: RGBAImage,
  threshold: number,
  featherPx: number,
  region: Polygon | null,
): Float32Array {
  const m = motionMaskScratch(frame, bg, threshold, featherPx, region, createMaskScratch(frame.width * frame.height));
  return new Float32Array(m);
}

/** Otsu auf 256-Bin-Histogramm der Differenz; bei Gleichstand Mitte des Bereichs; Ergebnis in [0.05, 0.95]. */
export function autoThreshold(frame: RGBAImage, bg: RGBAImage): number {
  const hist = new Float64Array(256);
  const n = frame.width * frame.height;
  for (let i = 0; i < n; i++) hist[diffAt(frame.data, bg.data, i * 4)]++;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0, sumB = 0, best = -1, first = 0, last = 0;
  for (let t = 0; t < 255; t++) {
    wB += hist[t];
    sumB += t * hist[t];
    const wF = n - wB;
    if (wB === 0 || wF === 0) continue;
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best * (1 + 1e-9)) { best = v; first = last = t; }
    else if (v >= best * (1 - 1e-9)) last = t;
  }
  // diff <= t gilt als Hintergrund (motionMask: diff > threshold*255)
  const t = (Math.floor((first + last) / 2) + 0.5) / 255; // +0.5: robust gegen Float-Randfehler
  return Math.min(0.95, Math.max(0.05, t));
}
