import { describe, it, expect } from 'vitest';
import type { RGBAImage } from '../../src/lib/types';
import { medianBackground, medianBackgroundBanded } from '../../src/lib/compose/background';
import { motionMask, autoThreshold } from '../../src/lib/compose/mask';
import { createCompositor, type ComposeOptions } from '../../src/lib/compose/compositor';
import { detectCameraMotion } from '../../src/lib/compose/motion';
import { cropRotate } from '../../src/lib/compose/transform';

type RGB = [number, number, number];
const W = 20, H = 20;
const GREY: RGB = [128, 128, 128];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

function solid(w: number, h: number, rgb: RGB): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}
function withSquare(img: RGBAImage, x: number, y: number, size: number, rgb: RGB): RGBAImage {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  for (let yy = y; yy < Math.min(y + size, img.height); yy++)
    for (let xx = x; xx < Math.min(x + size, img.width); xx++) {
      const i = (yy * img.width + xx) * 4;
      out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2]; out.data[i + 3] = 255;
    }
  return out;
}
function pixel(img: RGBAImage, x: number, y: number): RGB {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
const idx = (x: number, y: number) => y * W + x;
function stripes(w = W, h = H): RGBAImage {
  const img = solid(w, h, BLACK);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (Math.floor(x / 2) % 2 === 1) {
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    }
  return img;
}
function shift(img: RGBAImage, dx: number): RGBAImage {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.length) };
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const sx = (((x - dx) % img.width) + img.width) % img.width;
      const s = (y * img.width + sx) * 4, d = (y * img.width + x) * 4;
      for (let c = 0; c < 4; c++) out.data[d + c] = img.data[s + c];
    }
  return out;
}
const grey = solid(W, H, GREY);
const defaults: ComposeOptions = {
  mode: 'difference', threshold: 0.3, featherPx: 0, region: null,
  fade: 0, latestOnTop: true, background: 'median',
};

describe('medianBackground', () => {
  it('ignoriert ein durchlaufendes Objekt', () => {
    const bg = medianBackground([withSquare(grey, 0, 0, 4, WHITE), withSquare(grey, 10, 0, 4, WHITE), grey]);
    expect(pixel(bg, 1, 1)).toEqual(GREY);
  });
  it('gerade Anzahl: unteres mittleres Element', () => {
    const bg = medianBackground([solid(2, 2, [10, 10, 10]), solid(2, 2, [20, 20, 20])]);
    expect(pixel(bg, 0, 0)).toEqual([10, 10, 10]);
  });
});

describe('motionMask', () => {
  it('Schwelle auf max-Kanal-Differenz', () => {
    const m = motionMask(withSquare(grey, 5, 5, 4, WHITE), grey, 0.3, 0, null);
    expect(m[idx(6, 6)]).toBe(1);
    expect(m[idx(0, 0)]).toBe(0);
  });
  it('Region schließt außerhalb aus', () => {
    const m = motionMask(withSquare(grey, 5, 5, 4, WHITE), grey, 0.3, 0, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }]);
    expect(m[idx(6, 6)]).toBe(0);
  });
  it('weiche Kante erzeugt Zwischenwerte', () => {
    const m = motionMask(withSquare(grey, 5, 5, 4, WHITE), grey, 0.3, 2, null);
    expect(m[idx(4, 6)]).toBeGreaterThan(0);
    expect(m[idx(4, 6)]).toBeLessThan(1);
  });
});

describe('autoThreshold', () => {
  it('liegt im sinnvollen Bereich', () => {
    const t = autoThreshold(withSquare(grey, 5, 5, 4, WHITE), grey);
    expect(t).toBeGreaterThan(0.05);
    expect(t).toBeLessThan(0.6);
  });
});

describe('createCompositor', () => {
  it('difference: beide Quadrate, Hintergrund unverändert', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'difference', threshold: 0.3 }, 2);
    c.add(withSquare(grey, 0, 0, 4, WHITE), 0);
    c.add(withSquare(grey, 10, 0, 4, WHITE), 1);
    const r = c.result();
    expect(pixel(r, 1, 1)).toEqual(WHITE);
    expect(pixel(r, 11, 1)).toEqual(WHITE);
    expect(pixel(r, 6, 6)).toEqual(GREY);
    expect(r.data[3]).toBe(255);
  });
  it('fade 1: frühestes Bild unsichtbar, spätestes voll', () => {
    const c = createCompositor(grey, { ...defaults, fade: 1 }, 2);
    c.add(withSquare(grey, 0, 0, 4, WHITE), 0);
    c.add(withSquare(grey, 10, 0, 4, WHITE), 1);
    const r = c.result();
    expect(pixel(r, 1, 1)).toEqual(GREY);
    expect(pixel(r, 11, 1)).toEqual(WHITE);
  });
  it('Zeichenreihenfolge (latestOnTop): zuletzt hinzugefügtes Bild liegt oben', () => {
    const red: RGB = [255, 0, 0], blue: RGB = [0, 0, 255];
    const run = (latestOnTop: boolean, addOrder: number[]) => {
      const c = createCompositor(grey, { ...defaults, latestOnTop }, 2);
      for (const o of addOrder) c.add(withSquare(grey, 5, 5, 6, o === 0 ? red : blue), o);
      return pixel(c.result(), 6, 6);
    };
    expect(run(true, [0, 1])).toEqual(blue);
    expect(run(false, [1, 0])).toEqual(red);
  });
  it('lighten = Maximum', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'lighten' }, 2);
    c.add(solid(W, H, [10, 200, 50]), 0);
    c.add(solid(W, H, [100, 20, 60]), 1);
    expect(pixel(c.result(), 3, 3)).toEqual([100, 200, 60]);
  });
  it('darken = Minimum', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'darken' }, 2);
    c.add(solid(W, H, [10, 200, 50]), 0);
    c.add(solid(W, H, [100, 20, 60]), 1);
    expect(pixel(c.result(), 3, 3)).toEqual([10, 20, 50]);
  });
  it('average = Mittelwert', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'average' }, 2);
    c.add(solid(W, H, [10, 200, 50]), 0);
    c.add(solid(W, H, [100, 20, 60]), 1);
    expect(pixel(c.result(), 3, 3)).toEqual([55, 110, 55]);
  });
});

describe('detectCameraMotion', () => {
  it('erkennt verschobenes Muster', () => {
    const s = stripes();
    const samples = [s, shift(s, 6)];
    expect(detectCameraMotion(samples, medianBackground(samples)).moved).toBe(true);
  });
  it('bewegtes Objekt ist keine Kamerabewegung', () => {
    const s = stripes();
    expect(detectCameraMotion([withSquare(s, 0, 0, 4, GREY), s], s).moved).toBe(false);
  });
});

describe('medianBackgroundBanded', () => {
  it('entspricht unbandiertem Median bei 3 Streifen', async () => {
    const samples = [
      withSquare(solid(30, 30, GREY), 0, 0, 12, WHITE),
      withSquare(solid(30, 30, GREY), 10, 12, 12, BLACK),
      withSquare(solid(30, 30, [90, 40, 200]), 20, 20, 8, WHITE),
    ];
    let calls = 0;
    async function* read(rs: number, re: number) {
      calls++;
      for (const s of samples)
        yield { width: 30, height: re - rs, data: s.data.slice(rs * 30 * 4, re * 30 * 4) } as RGBAImage;
    }
    const banded = await medianBackgroundBanded(read, 30, 30, 3, 30 * 10 * 4 * 3);
    expect(calls).toBe(3);
    expect(banded).toEqual(medianBackground(samples));
  });
});

describe('cropRotate', () => {
  const img4x2: RGBAImage = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).map((_, i) => i) };
  it('rotiert 90 Grad', () => {
    expect(cropRotate(img4x2, null, 90)).toMatchObject({ width: 2, height: 4 });
  });
  it('90 Grad im Uhrzeigersinn: oben-links landet oben-rechts', () => {
    const r = cropRotate(img4x2, null, 90);
    expect(pixel(r, 1, 0)).toEqual(pixel(img4x2, 0, 0));
    expect(pixel(r, 0, 0)).toEqual(pixel(img4x2, 0, 1));
  });
  it('crop zuerst', () => {
    const r = cropRotate(img4x2, { x: 1, y: 0, w: 2, h: 1 }, 0);
    expect(r).toMatchObject({ width: 2, height: 1 });
    expect(pixel(r, 0, 0)).toEqual(pixel(img4x2, 1, 0));
  });
  it('0 ohne crop = Kopie', () => {
    expect(cropRotate(img4x2, null, 0)).toEqual(img4x2);
  });
});
