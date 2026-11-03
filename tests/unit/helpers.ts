import type { RGBAImage } from '../../src/lib/types';

export type RGB = [number, number, number];

export function solid(w: number, h: number, rgb: RGB): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}
export function withSquare(img: RGBAImage, x: number, y: number, size: number, rgb: RGB): RGBAImage {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  for (let yy = y; yy < Math.min(y + size, img.height); yy++)
    for (let xx = x; xx < Math.min(x + size, img.width); xx++) {
      const i = (yy * img.width + xx) * 4;
      out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2]; out.data[i + 3] = 255;
    }
  return out;
}
