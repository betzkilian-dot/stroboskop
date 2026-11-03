import { describe, it, expect, vi } from 'vitest';
import { Project, SELECTION_ERROR } from '../../src/lib/state/project.svelte';
import type { RenderResult } from '../../src/lib/engine/engine';
import type { VideoInfo } from '../../src/lib/types';

const info = { frameCount: 120, captureFps: 60, width: 10, height: 10 } as VideoInfo;
const bmp = () => ({ close: vi.fn(), width: 10, height: 10 }) as unknown as ImageBitmap;
const res = (): RenderResult => ({
  image: bmp(), maskOverlay: null, positions: 1, cameraMoved: false, autoThreshold: 0.1, width: 10, height: 10,
});

function fake() {
  const thumbCalls: { indices: number[]; maxSize: number; resolve(b: ImageBitmap[]): void }[] = [];
  const eng = {
    open: vi.fn(async () => ({ info, exact: true })),
    render: vi.fn(async () => res()),
    thumbnails: vi.fn(
      (indices: number[], maxSize: number) =>
        new Promise<ImageBitmap[]>((resolve) => thumbCalls.push({ indices, maxSize, resolve })),
    ),
    onProgress() {},
    dispose() {},
  };
  return { eng, thumbCalls };
}
const eight = () => Array.from({ length: 8 }, bmp);
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Project Miniaturen', () => {
  it('laedt 8 Miniaturen (maxSize 96) nach load', async () => {
    const { eng, thumbCalls } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(thumbCalls[0].indices).toEqual([0, 17, 34, 51, 68, 85, 102, 119]);
    expect(thumbCalls[0].maxSize).toBe(96);
    const t = eight();
    thumbCalls[0].resolve(t);
    await tick();
    expect(p.thumbs).toBe(t);
    p.dispose();
  });

  it('schliesst alte Miniaturen bei neuem load und bei dispose', async () => {
    const { eng, thumbCalls } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    const t1 = eight();
    thumbCalls[0].resolve(t1);
    await tick();
    await p.load(new File([], 'b.mp4'));
    t1.forEach((b) => expect(b.close).toHaveBeenCalled());
    expect(p.thumbs).toEqual([]);
    const t2 = eight();
    thumbCalls[1].resolve(t2);
    await tick();
    p.dispose();
    t2.forEach((b) => expect(b.close).toHaveBeenCalled());
  });

  it('veraltetes Ergebnis nach ueberholtem load bzw. nach dispose wird geschlossen', async () => {
    const { eng, thumbCalls } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    await p.load(new File([], 'b.mp4'));
    const stale = eight();
    thumbCalls[0].resolve(stale);
    await tick();
    stale.forEach((b) => expect(b.close).toHaveBeenCalled());
    expect(p.thumbs).toEqual([]);
    p.dispose();
    const late = eight();
    thumbCalls[1].resolve(late);
    await tick();
    late.forEach((b) => expect(b.close).toHaveBeenCalled());
    expect(p.thumbs).toEqual([]);
  });

  it('Fehler bei Miniaturen: Warnung, kein Absturz', async () => {
    const { eng } = fake();
    eng.thumbnails = vi.fn(async () => {
      throw new Error('x');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    await tick();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    p.dispose();
  });
});

describe('Project Miniaturen: getrennte Verdraengungs-Kanaele', () => {
  it('Positions-Anfrage verdraengt die Trimm-Miniaturen nicht', async () => {
    // Fake-Engine verhaelt sich wie die echte: nur eine neuere Anfrage im SELBEN Kanal bricht ab (-> [])
    const last: Record<string, { resolve(b: ImageBitmap[]): void } | undefined> = {};
    const eng = {
      open: vi.fn(async () => ({ info, exact: true })),
      render: vi.fn(async () => res()),
      thumbnails: vi.fn((indices: number[], _m: number, channel: 'trim' | 'positions') => {
        last[channel]?.resolve([]);
        return new Promise<ImageBitmap[]>((resolve) => {
          last[channel] = { resolve };
          // antwortet erst spaeter (hinter dem ersten Render)
          setTimeout(() => {
            if (last[channel]?.resolve === resolve) resolve(indices.map(bmp));
          }, 300);
        });
      }),
      onProgress() {},
      dispose() {},
    };
    const p = new Project(eng as never);
    await p.load(new File([], 'a.mp4'));
    await new Promise((r) => setTimeout(r, 600));
    expect(p.thumbs.length).toBe(8);
    expect(p.positionThumbs.length).toBe(20);
    p.dispose();
  });
});

describe('Project Auswahlpruefung (R16)', () => {
  it('weniger als 2 Positionen: Fehlertext, kein Render, Vorschau geleert', async () => {
    const { eng } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    await tick();
    expect(p.selectionError).toBeNull();
    expect(p.positionsCount).toBe(20);
    expect(p.preview).not.toBeNull();
    const calls = eng.render.mock.calls.length;
    p.selection.endIndex = p.selection.startIndex;
    expect(p.positionsCount).toBe(1);
    expect(p.selectionError).toBe(SELECTION_ERROR);
    p.requestPreview(true);
    await tick();
    expect(eng.render.mock.calls.length).toBe(calls);
    expect(p.preview).toBeNull();
    p.selection.endIndex = 59;
    expect(p.selectionError).toBeNull();
    p.requestPreview(true);
    await tick();
    expect(eng.render.mock.calls.length).toBe(calls + 1);
    p.dispose();
  });
});
