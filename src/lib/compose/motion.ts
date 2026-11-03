import type { RGBAImage } from '../types';
import { binaryDiffMask } from './mask';

const MASK_THRESHOLD = 0.15;
const MOVED_FRACTION = 0.25;

/** Anzahl Pixel der größten 4-zusammenhängenden Komponente (Maske > 0). */
function largestComponent(mask: Float32Array, w: number, h: number): number {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let best = 0;
  for (let s = 0; s < mask.length; s++) {
    if (mask[s] === 0 || seen[s]) continue;
    let sp = 0, size = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w, y = (p - x) / w;
      if (x > 0 && mask[p - 1] !== 0 && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] !== 0 && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] !== 0 && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] !== 0 && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (size > best) best = size;
  }
  return best;
}

export function detectCameraMotion(samples: RGBAImage[], bg: RGBAImage): { moved: boolean; score: number } {
  if (samples.length === 0) return { moved: false, score: 0 };
  const { width: w, height: h } = bg;
  const fractions: number[] = [];
  for (const s of samples) {
    const mask = binaryDiffMask(s, bg, MASK_THRESHOLD);
    let total = 0;
    for (let i = 0; i < mask.length; i++) total += mask[i];
    const rest = total - largestComponent(mask, w, h);
    fractions.push(rest / (w * h));
  }
  fractions.sort((a, b) => a - b);
  const n = fractions.length;
  const score = n % 2 ? fractions[(n - 1) >> 1] : (fractions[n / 2 - 1] + fractions[n / 2]) / 2;
  return { moved: score > MOVED_FRACTION, score };
}
