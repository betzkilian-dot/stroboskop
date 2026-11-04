import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrobeCache, type StrobeImage } from '../../src/lib/export/strobeCache';
import { renderExportImage, type ImageExportOptions } from '../../src/lib/export/image';
import type { Project } from '../../src/lib/state/project.svelte';

const img = (v: number): StrobeImage => ({ width: 1, height: 1, data: new Uint8ClampedArray([v, v, v, 255]) });

describe('StrobeCache', () => {
  it('teilt laufende Berechnung und liefert danach den Eintrag', async () => {
    const c = new StrobeCache();
    const build = vi.fn(async () => img(1));
    const [a, b] = await Promise.all([c.get('k', build), c.get('k', build)]);
    expect(a).toBe(b);
    expect(await c.get('k', build)).toBe(a);
    expect(build).toHaveBeenCalledTimes(1);
  });
  it('anderer Schluessel rechnet neu und ersetzt den Platz', async () => {
    const c = new StrobeCache();
    const build = vi.fn(async () => img(1));
    await c.get('a', build);
    await c.get('b', build);
    await c.get('a', build);
    expect(build).toHaveBeenCalledTimes(3);
  });
  it('Fehler/Abbruch wird nicht gecacht', async () => {
    const c = new StrobeCache();
    await expect(c.get('k', () => Promise.reject(new Error('x')))).rejects.toThrow();
    const build = vi.fn(async () => img(2));
    await c.get('k', build);
    expect(build).toHaveBeenCalledTimes(1);
  });
  it('clear verwirft den Eintrag', async () => {
    const c = new StrobeCache();
    const build = vi.fn(async () => img(1));
    await c.get('k', build);
    c.clear();
    await c.get('k', build);
    expect(build).toHaveBeenCalledTimes(2);
  });
  it('clear waehrend laufender Berechnung: Ergebnis wird nicht wiederverwendet', async () => {
    const c = new StrobeCache();
    let res!: (i: StrobeImage) => void;
    const first = c.get('k', () => new Promise<StrobeImage>((r) => (res = r)));
    c.clear();
    res(img(1));
    await first;
    const build = vi.fn(async () => img(2));
    await c.get('k', build);
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('renderExportImage mit Cache', () => {
  const closes: ReturnType<typeof vi.fn>[] = [];
  let converted: { w: number; h: number; px: number[] }[] = [];
  beforeEach(() => {
    converted = [];
    class FakeCanvas {
      px: number[] = [];
      constructor(public width: number, public height: number) {}
      getContext() {
        const self = this;
        return {
          drawImage() {},
          getImageData: () => ({ width: self.width, height: self.height, data: new Uint8ClampedArray(self.width * self.height * 4).map((_, i) => (i * 7) % 256) }),
          putImageData(d: { data: Uint8ClampedArray }) { self.px = Array.from(d.data); },
        };
      }
      async convertToBlob() {
        converted.push({ w: this.width, h: this.height, px: this.px });
        return new Blob(['x']);
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  function fake() {
    const render = vi.fn(async () => {
      const close = vi.fn();
      closes.push(close);
      return { image: { width: 4, height: 2, close }, maskOverlay: null };
    });
    const p = {
      engine: { render }, preview: null, crop: null as null | { x: number; y: number; w: number; h: number }, rotation: 0 as 0 | 90 | 180 | 270,
      strobeCache: new StrobeCache(),
      renderSettings: () => ({ selection: { startIndex: 0, endIndex: 3, step: 1, excluded: [] }, compose: { threshold: 0.2, mode: 'difference' }, captureFps: 60 }),
      measure: { overlays: {} }, selection: { startIndex: 0, endIndex: 3, step: 1, excluded: [] }, captureFps: 60, info: null,
    };
    return { p, render };
  }
  const o = (x: Partial<ImageExportOptions> = {}): ImageExportOptions => ({ format: 'png', quality: 0.9, size: 'original', infoLine: false, overlays: false, ...x });

  it('Formatwechsel rechnet nicht neu; Pixel identisch zum ungecachten Pfad', async () => {
    const { p, render } = fake();
    await renderExportImage(p as never as Project, o());
    await renderExportImage(p as never as Project, o({ format: 'jpeg', quality: 0.5 }));
    expect(render).toHaveBeenCalledTimes(1);
    const fresh = fake();
    await renderExportImage(fresh.p as never as Project, o());
    expect(converted[0]).toEqual(converted[2]);
    expect(converted[1].px).toEqual(converted[0].px);
  });
  it('Zuschnitt oder Drehung rechnen neu', async () => {
    const { p, render } = fake();
    await renderExportImage(p as never as Project, o());
    p.rotation = 90;
    await renderExportImage(p as never as Project, o());
    p.crop = { x: 0, y: 0, w: 2, h: 2 };
    await renderExportImage(p as never as Project, o());
    expect(render).toHaveBeenCalledTimes(3);
  });
  it('geaenderte Compose-Einstellung rechnet neu', async () => {
    const { p, render } = fake();
    await renderExportImage(p as never as Project, o());
    p.renderSettings = () => ({ selection: { startIndex: 0, endIndex: 3, step: 1, excluded: [] }, compose: { threshold: 0.3, mode: 'difference' }, captureFps: 60 });
    await renderExportImage(p as never as Project, o());
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('unterbrochener Render wird nicht gecacht', async () => {
    const { p, render } = fake();
    render.mockResolvedValueOnce('superseded' as never);
    await expect(renderExportImage(p as never as Project, o())).rejects.toThrow('unterbrochen');
    await renderExportImage(p as never as Project, o());
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('clear (neues Video) erzwingt neuen Render', async () => {
    const { p, render } = fake();
    await renderExportImage(p as never as Project, o());
    p.strobeCache.clear();
    await renderExportImage(p as never as Project, o());
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe('Project leert den Cache', () => {
  it('load und dispose verwerfen den Eintrag', async () => {
    const { Project: P } = await import('../../src/lib/state/project.svelte');
    const eng = {
      open: vi.fn(async () => ({ info: { frameCount: 10, captureFps: 60, width: 10, height: 10 }, exact: true })),
      render: vi.fn(() => new Promise(() => {})),
      onProgress() {}, dispose() {}, cancel() {},
    };
    const p = new P(eng as never);
    await p.load(new File([], 'a.mp4'));
    const build = vi.fn(async () => img(1));
    await p.strobeCache.get('k', build);
    await p.load(new File([], 'b.mp4'));
    await p.strobeCache.get('k', build);
    expect(build).toHaveBeenCalledTimes(2);
    p.dispose();
    await p.strobeCache.get('k', build);
    expect(build).toHaveBeenCalledTimes(3);
  });
});

describe('StrobeCache Mitnutzer', () => {
  it('Mitnutzer eines abgebrochenen Laufs rechnet selbst neu', async () => {
    const c = new StrobeCache();
    let rej!: (e: unknown) => void;
    const first = c.get('k', () => new Promise<StrobeImage>((_, r) => (rej = r)));
    const build = vi.fn(async () => img(3));
    const second = c.get('k', build);
    rej(new Error('abgebrochen'));
    await expect(first).rejects.toThrow();
    expect((await second).data[0]).toBe(3);
    expect(build).toHaveBeenCalledTimes(1);
  });
});
