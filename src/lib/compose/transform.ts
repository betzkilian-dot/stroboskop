import type { RGBAImage } from '../types';

/** Erst zuschneiden (Rechteck in Quellpixeln, auf das Bild begrenzt), dann im Uhrzeigersinn drehen. */
export function cropRotate(
  img: RGBAImage,
  crop: { x: number; y: number; w: number; h: number } | null,
  rotation: 0 | 90 | 180 | 270,
): RGBAImage {
  let x0 = 0, y0 = 0, w = img.width, h = img.height;
  if (crop) {
    x0 = Math.min(img.width, Math.max(0, Math.round(crop.x)));
    y0 = Math.min(img.height, Math.max(0, Math.round(crop.y)));
    const x1 = Math.min(img.width, Math.max(x0, Math.round(crop.x + crop.w)));
    const y1 = Math.min(img.height, Math.max(y0, Math.round(crop.y + crop.h)));
    w = x1 - x0;
    h = y1 - y0;
  }
  const swap = rotation === 90 || rotation === 270;
  const ow = swap ? h : w, oh = swap ? w : h;
  const out = new Uint8ClampedArray(ow * oh * 4);
  const src = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx: number, dy: number;
      switch (rotation) {
        case 90: dx = h - 1 - y; dy = x; break;
        case 180: dx = w - 1 - x; dy = h - 1 - y; break;
        case 270: dx = y; dy = w - 1 - x; break;
        default: dx = x; dy = y;
      }
      const s = ((y0 + y) * img.width + x0 + x) * 4;
      const d = (dy * ow + dx) * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
    }
  }
  return { width: ow, height: oh, data: out };
}
