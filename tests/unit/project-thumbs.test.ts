import { describe, it, expect, vi } from 'vitest';
import { Project, SELECTION_ERROR } from '../../src/lib/state/project.svelte';
import type { RenderResult } from '../../src/lib/engine/engine';
import type { VideoInfo } from '../../src/lib/types';

const info = { frameCount: 120, captureFps: 60, width: 10, height: 10 } as VideoInfo;
const bmp = () => ({ close: vi.fn(), width: 10, height: 10 }) as unknown as ImageBitmap;
const res = (): RenderResult => ({
  image: bmp(), maskOverlay: null, positions: 1, detections: [], cameraMoved: false, autoThreshold: 0.1, settingsKey: "", width: 10, height: 10,
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
const eight = () => Array.from({ length: 12 }, bmp);
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Project Miniaturen', () => {
  it('laedt 12 Miniaturen (maxSize 96) nach load', async () => {
    const { eng, thumbCalls } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(thumbCalls[0].indices).toEqual([0, 11, 22, 32, 43, 54, 65, 76, 87, 97, 108, 119]);
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
    expect(p.thumbs.length).toBe(12);
    expect(p.positionThumbs.length).toBe(20);
    p.dispose();
  });

  it('frameImage wartet auf die Zeitleisten-Miniaturen (gleicher Kanal) und verdraengt sie nicht', async () => {
    const { eng, thumbCalls } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    const trimCalls = () => eng.thumbnails.mock.calls.filter((c) => (c as unknown[])[2] === 'trim');
    const img = p.frameImage(5);
    await tick();
    expect(trimCalls().length).toBe(1); // noch nicht angefragt
    const t = eight();
    thumbCalls[0].resolve(t);
    await tick();
    await tick();
    expect(p.thumbs).toBe(t);
    const call = trimCalls()[1] as unknown[];
    expect(call[0]).toEqual([5]);
    expect(call[1]).toBe(1280);
    const frame = bmp();
    thumbCalls.find((c) => c.indices.length === 1 && c.indices[0] === 5)!.resolve([frame]);
    expect(await img).toBe(frame);
    p.dispose();
  });
});

describe('Project videoUrl', () => {
  it('erzeugt beim Laden eine Object-URL, gibt die alte frei, auch bei dispose', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const cs = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const u = `blob:${created.length}`;
      created.push(u);
      return u;
    });
    const rs = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => void revoked.push(u));
    const { eng } = fake();
    const p = new Project(eng);
    expect(p.videoUrl).toBeNull();
    await p.load(new File([], 'a.mp4'));
    expect(p.videoUrl).toBe('blob:0');
    await p.load(new File([], 'b.mp4'));
    expect(p.videoUrl).toBe('blob:1');
    expect(revoked).toEqual(['blob:0']);
    p.dispose();
    expect(revoked).toEqual(['blob:0', 'blob:1']);
    expect(p.videoUrl).toBeNull();
    cs.mockRestore();
    rs.mockRestore();
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
