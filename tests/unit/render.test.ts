import { describe, it, expect } from 'vitest';
import type { FrameSource, RGBAImage, VideoInfo } from '../../src/lib/types';
import { createBackgroundCache, renderStrobe, sampleIndicesFor } from '../../src/lib/engine/render';
import type { RenderSettings } from '../../src/lib/engine/protocol';
import { solid, withSquare } from './helpers';

const W = 32, H = 16, FRAMES = 64;
const GREY: [number, number, number] = [128, 128, 128];
const WHITE: [number, number, number] = [255, 255, 255];

// Bild k: 4x4-Quadrat bei x = k/2, y = 4
const frameImage = (k: number) => withSquare(solid(W, H, GREY), k / 2, 4, 4, WHITE);

function crop(img: RGBAImage, rs: number, re: number): RGBAImage {
  return { width: img.width, height: re - rs, data: img.data.slice(rs * img.width * 4, re * img.width * 4) };
}

function fakeSource() {
  const calls: { count: number; rows?: [number, number]; maxSize: number }[] = [];
  const info = { width: W, height: H, frameCount: FRAMES } as VideoInfo;
  const src: FrameSource = {
    info,
    exact: true,
    async *readFrames(indices, opts) {
      calls.push({ count: indices.length, rows: opts.rows, maxSize: opts.maxSize });
      for (const index of indices) {
        const full = frameImage(index);
        yield { index, image: opts.rows ? crop(full, opts.rows[0], opts.rows[1]) : full };
      }
    },
    close() {},
  };
  return { src, calls };
}

const brightCount = (img: RGBAImage) => {
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i] > 200) n++;
  return n;
};

const settings = (over: Partial<RenderSettings['compose']> = {}): RenderSettings => ({
  selection: { startIndex: 0, endIndex: 63, step: 16, excluded: [] },
  compose: {
    mode: 'difference', threshold: 0.3, featherPx: 0, region: null,
    fade: 0, latestOnTop: true, background: 'median', ...over,
  },
  captureFps: 60,
});
const opts = (over = {}) => ({
  maxSize: 4096, showMask: false, budgetBytes: 256 * 1024 * 1024,
  signal: new AbortController().signal, onProgress: () => {}, ...over,
});

describe('sampleIndicesFor', () => {
  it('verteilt gleichmaessig, dedupliziert, begrenzt', () => {
    const idx = sampleIndicesFor(0, 99, 40);
    expect(idx).toHaveLength(40);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(99);
    expect(sampleIndicesFor(5, 9, 40)).toEqual([5, 6, 7, 8, 9]);
  });
});

describe('renderStrobe', () => {
  it('liefert 4 Positionen, Median aus <= 40 Stichproben, Fortschritt endet bei [n, n]', async () => {
    const { src, calls } = fakeSource();
    const events: [number, number][] = [];
    const r = await renderStrobe(src, settings(), opts({ onProgress: (d: number, t: number) => events.push([d, t]) }));
    expect(r.positions).toBe(4);
    expect(brightCount(r.image)).toBe(4 * 16);
    expect(r.width).toBe(W);
    expect(r.height).toBe(H);
    expect(r.cameraMoved).toBe(false);
    expect(r.maskOverlay).toBeNull();
    expect(Math.max(...calls.map((c) => c.count))).toBeLessThanOrEqual(40);
    expect(calls.some((c) => c.rows)).toBe(true);
    expect(events.at(-1)).toEqual([4, 4]);
  });

  it('first/last/frameIndex lesen den Hintergrund aus einem Einzelbild', async () => {
    for (const background of ['first', 'last', { frameIndex: 63 }] as const) {
      const { src, calls } = fakeSource();
      const r = await renderStrobe(src, settings({ background }), opts());
      expect(r.positions).toBe(4);
      expect(calls.filter((c) => c.count === 1 && !c.rows).length).toBeGreaterThanOrEqual(1);
      expect(calls.some((c) => c.rows)).toBe(false);
      // Hintergrund enthaelt sein eigenes Quadrat -> mindestens die 3 anderen Positionen sichtbar
      expect(brightCount(r.image)).toBeGreaterThanOrEqual(3 * 16);
    }
  });

  it('threshold < 0 nutzt autoThreshold, sonst wird der gegebene gemeldet', async () => {
    const auto = await renderStrobe(fakeSource().src, settings({ threshold: -1 }), opts());
    expect(auto.autoThreshold).toBeGreaterThanOrEqual(0.05);
    expect(auto.autoThreshold).toBeLessThanOrEqual(0.95);
    expect(brightCount(auto.image)).toBe(4 * 16);
    const fixed = await renderStrobe(fakeSource().src, settings({ threshold: 0.3 }), opts());
    expect(fixed.autoThreshold).toBe(0.3);
  });

  it('showMask: gruene Ueberlagerung nur auf Pixeln des mittleren Bildes', async () => {
    const r = await renderStrobe(fakeSource().src, settings(), opts({ showMask: true }));
    const o = r.maskOverlay!;
    expect(o).not.toBeNull();
    let n = 0;
    for (let i = 0; i < o.data.length; i += 4)
      if (o.data[i + 3] > 0) {
        n++;
        expect([o.data[i], o.data[i + 1], o.data[i + 2], o.data[i + 3]]).toEqual([0, 200, 80, 115]);
      }
    expect(n).toBe(16);
    // mittleres Bild = Index 32 -> x = 16
    const i = (4 * W + 16) * 4;
    expect(o.data[i + 3]).toBe(115);
  });

  it('bricht bei bereits abgebrochenem Signal mit "aborted" ab', async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(renderStrobe(fakeSource().src, settings(), opts({ signal: ctl.signal }))).rejects.toThrow('aborted');
  });

  it('bricht waehrend des Renderns ab (zwischen Bildern)', async () => {
    const ctl = new AbortController();
    const p = renderStrobe(fakeSource().src, settings(), opts({
      signal: ctl.signal,
      onProgress: (d: number) => { if (d === 2) ctl.abort(); },
    }));
    await expect(p).rejects.toThrow('aborted');
  });

  it('wirft bei leerer Auswahl', async () => {
    const s = settings();
    s.selection.excluded = [0, 16, 32, 48];
    await expect(renderStrobe(fakeSource().src, s, opts())).rejects.toThrow();
  });
  it('first/last beziehen sich auf den Zuschnitt (startIndex 10 / endIndex 50)', async () => {
    for (const [background, expected] of [['first', 10], ['last', 50]] as const) {
      const { src, calls } = fakeSource();
      const read: number[] = [];
      const orig = src.readFrames.bind(src);
      src.readFrames = (indices, o) => {
        if (indices.length === 1 && !o.rows) read.push(indices[0]);
        return orig(indices, o);
      };
      const s = settings({ background });
      s.selection = { startIndex: 10, endIndex: 50, step: 10, excluded: [] };
      await renderStrobe(src, s, opts());
      expect(read[0]).toBe(expected);
      expect(calls.some((c) => c.rows)).toBe(false);
    }
  });

  it('bricht waehrend der Median-Streifen ab', async () => {
    const ctl = new AbortController();
    const { src } = fakeSource();
    const orig = src.readFrames.bind(src);
    let n = 0;
    src.readFrames = (indices, o) => {
      if (o.rows && ++n === 2) ctl.abort();
      return orig(indices, o);
    };
    // budget fuer 1 Zeile je Streifen -> mehrere Streifen
    await expect(renderStrobe(src, settings(), opts({ signal: ctl.signal, budgetBytes: 1 }))).rejects.toThrow('aborted');
    expect(n).toBe(2);
  });

  it('Cache: gleicher Schluessel liest die Stichproben nur einmal, Aenderung des Schluessels erneut', async () => {
    const { src, calls } = fakeSource();
    const cache = createBackgroundCache();
    const r1 = await renderStrobe(src, settings(), opts({ cache }));
    const sampleReads = () => calls.filter((c) => c.rows || c.maxSize === 320).length;
    const first = sampleReads();
    expect(first).toBeGreaterThan(0);
    const s2 = settings({ threshold: 0.2, mode: 'lighten' });
    s2.selection = { startIndex: 0, endIndex: 63, step: 8, excluded: [16] };
    const r2 = await renderStrobe(src, s2, opts({ cache }));
    expect(sampleReads()).toBe(first);
    expect(r2.positions).toBeGreaterThan(r1.positions);
    // anderer Zuschnitt -> neu lesen
    const s3 = settings();
    s3.selection = { startIndex: 0, endIndex: 40, step: 10, excluded: [] };
    await renderStrobe(src, s3, opts({ cache }));
    expect(sampleReads()).toBeGreaterThan(first);
    // abgebrochene Berechnung fuellt den Cache nicht
    const c2 = createBackgroundCache();
    const ctl = new AbortController();
    ctl.abort();
    await renderStrobe(src, settings(), opts({ cache: c2, signal: ctl.signal })).catch(() => {});
    expect(c2.bg).toBeNull();
  });
});

describe('renderStrobe Region/Weiche Kante in Video-Pixeln (R17)', () => {
  const VW = 160, VH = 80;
  // Bild k (0..3): Quadrat A links (x = 10 + 8k), Quadrat B rechts (x = 90 + 8k); in Videopixeln, skaliert je nach maxSize
  function scaledSource() {
    const info = { width: VW, height: VH, frameCount: 4 } as VideoInfo;
    const src: FrameSource = {
      info,
      exact: true,
      async *readFrames(indices, o) {
        const s = Math.min(1, o.maxSize / VW);
        const w = Math.round(VW * s), h = Math.round(VH * s);
        for (const index of indices) {
          let img = solid(w, h, GREY);
          const sq = (x: number, y: number) => {
            img = withSquare(img, Math.round(x * s), Math.round(y * s), Math.round(10 * s), WHITE);
          };
          sq(10 + 8 * index, 10);
          sq(90 + 8 * index, 50);
          yield { index, image: o.rows ? crop(img, o.rows[0], o.rows[1]) : img };
        }
      },
      close() {},
    };
    return src;
  }
  const left = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: VH }, { x: 0, y: VH }];
  const sel = { startIndex: 0, endIndex: 3, step: 1, excluded: [] as number[] };
  const run = (maxSize: number, region: typeof left | null) =>
    renderStrobe(
      scaledSource(),
      {
        selection: sel,
        compose: { mode: 'difference', threshold: 0.3, featherPx: 0, region, fade: 0, latestOnTop: true, background: 'median' },
        captureFps: 60,
      },
      opts({ maxSize }),
    );
  const halves = (img: RGBAImage) => {
    let l = 0, r = 0;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++)
        if (img.data[(y * img.width + x) * 4] > 200) (x < img.width / 2 ? l++ : r++);
    return { l, r };
  };

  it('Region in Video-Pixeln waehlt bei maxSize 80 dasselbe Objekt wie bei Vollaufloesung', async () => {
    const full = halves((await run(4096, left)).image);
    const small = halves((await run(80, left)).image);
    expect(full.l).toBeGreaterThan(0);
    expect(full.r).toBe(0);
    expect(small.l).toBeGreaterThan(0);
    expect(small.r).toBe(0);
  });

  it('ohne Region erscheinen beide Objekte', async () => {
    const small = halves((await run(80, null)).image);
    expect(small.l).toBeGreaterThan(0);
    expect(small.r).toBeGreaterThan(0);
  });

  it('featherPx wird mit der Arbeitsaufloesung skaliert (gerundet, kann bei kleiner Vorschau auf 0 fallen)', async () => {
    // Video 160 breit; bei maxSize 80 ist scale 0.5: 4 px -> 2 px, 1 px -> round(0.5) = 1, 0 bleibt 0
    const grow = async (maxSize: number, featherPx: number) => {
      const r = await renderStrobe(
        scaledSource(),
        {
          selection: { startIndex: 0, endIndex: 3, step: 1, excluded: [] },
          compose: { mode: 'difference', threshold: 0.3, featherPx, region: null, fade: 0, latestOnTop: true, background: 'median' },
          captureFps: 60,
        },
        opts({ maxSize, showMask: true }),
      );
      let n = 0;
      for (let i = 3; i < r.maskOverlay!.data.length; i += 4) if (r.maskOverlay!.data[i] > 0) n++;
      return n;
    };
    const s0 = await grow(80, 0);
    expect(await grow(80, 4)).toBeGreaterThan(s0); // 4 px -> 2 px
    expect(await grow(80, 1)).toBe(await grow(80, 2)); // 1 px -> round(0.5) = 1 px, 2 px -> 1 px
    expect(await grow(80, 1)).toBeGreaterThan(s0);
    // Vorschau 40 px (scale 0.25): 1 px -> round(0.25) = 0 -> keine weiche Kante
    expect(await grow(40, 1)).toBe(await grow(40, 0));
  });
});
