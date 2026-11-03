import type { RGBAImage } from '../types';
import { motionMask, type Polygon } from './mask';

export type ComposeMode = 'difference' | 'lighten' | 'darken' | 'average';
export type BackgroundSource = 'median' | 'first' | 'last' | { frameIndex: number };

export interface ComposeOptions {
  mode: ComposeMode;
  threshold: number; // 0..1
  featherPx: number;
  region: Polygon | null; // Polygon in Bildpixeln
  fade: number; // 0..1: Deckkraft frühestes Bild = 1-fade
  latestOnTop: boolean;
  background: BackgroundSource;
}

/**
 * Streaming-Compositor: add() behält keine Frame-Referenz. Frames werden in der Reihenfolge
 * der add()-Aufrufe gezeichnet (der Aufrufer liefert sie aufsteigend nach `order`, wenn
 * latestOnTop, sonst absteigend, damit das früheste oben liegt). `order` (0..count-1) steuert
 * nur die Deckkraft.
 */
export function createCompositor(
  bg: RGBAImage,
  opts: ComposeOptions,
  count: number,
): { add(frame: RGBAImage, order: number): void; result(): RGBAImage } {
  const { width, height } = bg;
  const n = width * height;
  const out = new Uint8ClampedArray(bg.data);
  const mode = opts.mode;
  let seen = 0;
  const acc = mode === 'average' ? new Float32Array(n * 3) : null;

  function add(frame: RGBAImage, order: number): void {
    const f = frame.data;
    if (mode === 'difference') {
      const mask = motionMask(frame, bg, opts.threshold, opts.featherPx, opts.region);
      const rel = count > 1 ? order / (count - 1) : 1;
      const opacity = count > 1 ? 1 - opts.fade * (1 - rel) : 1;
      for (let p = 0; p < n; p++) {
        const a = mask[p] * opacity;
        if (a === 0) continue;
        const o = p * 4;
        out[o] = out[o] + (f[o] - out[o]) * a;
        out[o + 1] = out[o + 1] + (f[o + 1] - out[o + 1]) * a;
        out[o + 2] = out[o + 2] + (f[o + 2] - out[o + 2]) * a;
      }
    } else if (mode === 'lighten' || mode === 'darken') {
      const light = mode === 'lighten';
      if (seen === 0) {
        out.set(f);
      } else {
        for (let p = 0; p < n; p++) {
          const o = p * 4;
          for (let c = 0; c < 3; c++) {
            const v = f[o + c];
            if (light ? v > out[o + c] : v < out[o + c]) out[o + c] = v;
          }
        }
      }
    } else if (acc) {
      for (let p = 0; p < n; p++) {
        const o = p * 4, q = p * 3;
        acc[q] += f[o]; acc[q + 1] += f[o + 1]; acc[q + 2] += f[o + 2];
      }
    }
    seen++;
  }

  function result(): RGBAImage {
    const res = new Uint8ClampedArray(n * 4);
    if (mode === 'average' && acc) {
      if (seen === 0) res.set(bg.data);
      else
        for (let p = 0; p < n; p++) {
          const o = p * 4, q = p * 3;
          res[o] = acc[q] / seen; res[o + 1] = acc[q + 1] / seen; res[o + 2] = acc[q + 2] / seen;
        }
    } else {
      res.set(out);
    }
    for (let p = 0; p < n; p++) res[p * 4 + 3] = 255;
    return { width, height, data: res };
  }

  return { add, result };
}
