import { describe, it, expect } from 'vitest';
import type { RGBAImage } from '../../src/lib/types';
import { medianBackground, medianBackgroundBanded } from '../../src/lib/compose/background';
import { motionMask, autoThreshold } from '../../src/lib/compose/mask';
import { createCompositor, isMaskedMode, type ComposeOptions } from '../../src/lib/compose/compositor';
import { detectCameraMotion } from '../../src/lib/compose/motion';
import { cropRotate } from '../../src/lib/compose/transform';
import { solid, withSquare, type RGB } from './helpers';

const W = 20, H = 20;
const GREY: RGB = [128, 128, 128];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

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
  it('latestOnTop: gleiche add-Reihenfolge, Flag entscheidet über die Farbe bei Überlappung', () => {
    const red: RGB = [255, 0, 0], blue: RGB = [0, 0, 255];
    const run = (latestOnTop: boolean) => {
      const c = createCompositor(grey, { ...defaults, latestOnTop }, 2);
      c.add(withSquare(grey, 5, 5, 6, red), 0);
      c.add(withSquare(grey, 5, 5, 6, blue), 1);
      return pixel(c.result(), 6, 6);
    };
    expect(run(true)).toEqual(blue);
    expect(run(false)).toEqual(red);
  });
  it('latestOnTop=false: Hintergrund und Nicht-Überlappung bleiben korrekt', () => {
    const c = createCompositor(grey, { ...defaults, latestOnTop: false }, 2);
    c.add(withSquare(grey, 0, 0, 4, WHITE), 0);
    c.add(withSquare(grey, 10, 0, 4, WHITE), 1);
    const r = c.result();
    expect(pixel(r, 1, 1)).toEqual(WHITE);
    expect(pixel(r, 11, 1)).toEqual(WHITE);
    expect(pixel(r, 6, 6)).toEqual(GREY);
  });
  it('fade 0.5: frühestes Bild mit Deckkraft 0.5', () => {
    for (const latestOnTop of [true, false]) {
      const c = createCompositor(grey, { ...defaults, fade: 0.5, latestOnTop }, 2);
      c.add(withSquare(grey, 0, 0, 4, WHITE), 0);
      c.add(withSquare(grey, 10, 0, 4, WHITE), 1);
      const r = c.result();
      expect(Math.abs(pixel(r, 1, 1)[0] - 191.5)).toBeLessThanOrEqual(1);
      expect(pixel(r, 11, 1)).toEqual(WHITE);
    }
  });
  it('count=1: Deckkraft 1 auch bei fade 1', () => {
    const c = createCompositor(grey, { ...defaults, fade: 1 }, 1);
    c.add(withSquare(grey, 0, 0, 4, WHITE), 0);
    expect(pixel(c.result(), 1, 1)).toEqual(WHITE);
  });
  it('leere Region wie null', () => {
    const m = motionMask(withSquare(grey, 5, 5, 4, WHITE), grey, 0.3, 0, []);
    expect(m[idx(6, 6)]).toBe(1);
  });
  it('lighten = Maximum (Bereiche über der Schwelle)', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'lighten' }, 2);
    c.add(solid(W, H, [10, 250, 50]), 0);
    c.add(solid(W, H, [250, 20, 60]), 1);
    expect(pixel(c.result(), 3, 3)).toEqual([250, 250, 128]);
  });
  it('darken = Minimum (Bereiche über der Schwelle)', () => {
    const c = createCompositor(grey, { ...defaults, mode: 'darken' }, 2);
    c.add(solid(W, H, [10, 250, 50]), 0);
    c.add(solid(W, H, [250, 20, 60]), 1);
    expect(pixel(c.result(), 3, 3)).toEqual([10, 20, 50]);
  });
  function noisy(base: RGBAImage, amp: number, seed: number): RGBAImage {
    const out = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data) };
    let s = seed;
    for (let i = 0; i < out.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const d = (s % (2 * amp + 1)) - amp;
      for (let c = 0; c < 3; c++) out.data[i + c] = Math.max(0, Math.min(255, out.data[i + c] + d));
    }
    return out;
  }
  it('aufhellen mit Maske: Hintergrund ausserhalb des Objekts unverändert', () => {
    const bg = solid(W, H, [100, 100, 100]);
    const c = createCompositor(bg, { ...defaults, mode: 'lighten', threshold: 0.2 }, 2);
    c.add(withSquare(noisy(bg, 10, 1), 2, 2, 4, WHITE), 0);
    c.add(withSquare(noisy(bg, 10, 2), 12, 12, 4, WHITE), 1);
    const r = c.result();
    expect(pixel(r, 18, 2)).toEqual([100, 100, 100]);
    expect(pixel(r, 2, 18)).toEqual([100, 100, 100]);
    expect(pixel(r, 3, 3)).toEqual(WHITE);
    expect(pixel(r, 13, 13)).toEqual(WHITE);
  });
  it('abdunkeln mit Maske: dunkles Objekt an allen Positionen, Hintergrund unverändert', () => {
    const bg = solid(W, H, [200, 200, 200]);
    const c = createCompositor(bg, { ...defaults, mode: 'darken', threshold: 0.2 }, 2);
    c.add(withSquare(noisy(bg, 10, 1), 2, 2, 4, BLACK), 0);
    c.add(withSquare(noisy(bg, 10, 2), 12, 12, 4, BLACK), 1);
    const r = c.result();
    expect(pixel(r, 18, 2)).toEqual([200, 200, 200]);
    expect(pixel(r, 2, 18)).toEqual([200, 200, 200]);
    expect(pixel(r, 3, 3)).toEqual(BLACK);
    expect(pixel(r, 13, 13)).toEqual(BLACK);
  });
  it('aufhellen startet beim Hintergrund, nicht beim ersten Bild', () => {
    const bg = solid(W, H, [100, 100, 100]);
    const c = createCompositor(bg, { ...defaults, mode: 'lighten', threshold: 0.2 }, 1);
    c.add(solid(W, H, [105, 105, 105]), 0);
    const r = c.result();
    expect(pixel(r, 0, 0)).toEqual([100, 100, 100]);
    expect(pixel(r, 10, 10)).toEqual([100, 100, 100]);
  });
  it('isMaskedMode', () => {
    expect(isMaskedMode('difference')).toBe(true);
    expect(isMaskedMode('lighten')).toBe(true);
    expect(isMaskedMode('darken')).toBe(true);
    expect(isMaskedMode('average')).toBe(false);
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

describe('medianBackgroundBanded Validierung', () => {
  function mk(h: number) {
    return [solid(30, h, GREY), withSquare(solid(30, h, GREY), 0, 0, 5, WHITE), solid(30, h, BLACK)];
  }
  const readOf = (samples: RGBAImage[], tamper?: (i: RGBAImage) => RGBAImage, drop = false) =>
    async function* (rs: number, re: number) {
      const list = drop ? samples.slice(0, 2) : samples;
      for (const s of list) {
        const band = { width: 30, height: re - rs, data: s.data.slice(rs * 30 * 4, re * 30 * 4) } as RGBAImage;
        yield tamper ? tamper(band) : band;
      }
    };
  it('Höhe nicht durch Streifenhöhe teilbar (31 Zeilen)', async () => {
    const samples = mk(31);
    const banded = await medianBackgroundBanded(readOf(samples), 30, 31, 3, 30 * 10 * 4 * 3);
    expect(banded).toEqual(medianBackground(samples));
  });
  it('falsche Streifengröße wirft', async () => {
    const samples = mk(30);
    await expect(
      medianBackgroundBanded(readOf(samples, (i) => ({ ...i, width: 29 })), 30, 30, 3, 30 * 10 * 4 * 3),
    ).rejects.toThrow(/Streifen/);
    await expect(
      medianBackgroundBanded(readOf(samples, (i) => ({ ...i, height: i.height + 1 })), 30, 30, 3, 30 * 10 * 4 * 3),
    ).rejects.toThrow(/Streifen/);
  });
  it('falsche Stichprobenzahl wirft', async () => {
    await expect(
      medianBackgroundBanded(readOf(mk(30), undefined, true), 30, 30, 3, 30 * 10 * 4 * 3),
    ).rejects.toThrow(/Stichproben/);
  });
});

describe('autoThreshold Grenze', () => {
  it('Schwelle trennt die beiden Klassen exakt', () => {
    const f = withSquare(grey, 5, 5, 4, WHITE);
    const t = autoThreshold(f, grey);
    const m = motionMask(f, grey, t, 0, null);
    expect(m[idx(6, 6)]).toBe(1);
    expect(m[idx(0, 0)]).toBe(0);
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
  it('180 Grad', () => {
    const r = cropRotate(img4x2, null, 180);
    expect(r).toMatchObject({ width: 4, height: 2 });
    expect(pixel(r, 3, 1)).toEqual(pixel(img4x2, 0, 0));
    expect(pixel(r, 0, 0)).toEqual(pixel(img4x2, 3, 1));
  });
  it('270 Grad', () => {
    const r = cropRotate(img4x2, null, 270);
    expect(r).toMatchObject({ width: 2, height: 4 });
    expect(pixel(r, 0, 3)).toEqual(pixel(img4x2, 0, 0));
    expect(pixel(r, 1, 0)).toEqual(pixel(img4x2, 3, 1));
  });
  it('crop wird auf das Bild begrenzt', () => {
    const r = cropRotate(img4x2, { x: -2, y: -1, w: 4, h: 5 }, 0);
    expect(r).toMatchObject({ width: 2, height: 2 });
    expect(pixel(r, 1, 1)).toEqual(pixel(img4x2, 1, 1));
    const r2 = cropRotate(img4x2, { x: 3, y: 1, w: 10, h: 10 }, 0);
    expect(r2).toMatchObject({ width: 1, height: 1 });
    expect(pixel(r2, 0, 0)).toEqual(pixel(img4x2, 3, 1));
  });
});
