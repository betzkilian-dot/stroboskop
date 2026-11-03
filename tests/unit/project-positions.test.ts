import { describe, it, expect, vi } from 'vitest';
import { Project } from '../../src/lib/state/project.svelte';
import type { RenderResult } from '../../src/lib/engine/engine';
import type { VideoInfo } from '../../src/lib/types';

const info = { frameCount: 120, captureFps: 60, width: 10, height: 10 } as VideoInfo;
const bmp = () => ({ close: vi.fn(), width: 10, height: 10 }) as unknown as ImageBitmap;
const res = (): RenderResult => ({
  image: bmp(), maskOverlay: null, positions: 1, cameraMoved: false, autoThreshold: 0.1, width: 10, height: 10,
});
const tick = () => new Promise((r) => setTimeout(r, 0));

function fake() {
  const calls: { indices: number[]; maxSize: number; resolve(b: ImageBitmap[]): void }[] = [];
  const eng = {
    open: vi.fn(async () => ({ info, exact: true })),
    render: vi.fn(async () => res()),
    thumbnails: vi.fn(
      (indices: number[], maxSize: number) => new Promise<ImageBitmap[]>((resolve) => calls.push({ indices, maxSize, resolve })),
    ),
    onProgress() {},
    dispose() {},
  };
  return { eng, calls };
}

describe('Project Positionsleiste', () => {
  it('positionIndices ignoriert excluded', async () => {
    const { eng } = fake();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    p.selection.step = 30;
    p.selection.excluded = [30];
    expect(p.positionIndices).toEqual([0, 30, 60, 90]);
    p.dispose();
  });

  it('laedt entprellt Miniaturen (maxSize 96) der Positionen und schliesst alte', async () => {
    vi.useFakeTimers();
    try {
      const { eng, calls } = fake();
      const p = new Project(eng);
      await p.load(new File([], 'a.mp4'));
      p.selection.step = 40;
      p.requestPositionThumbs();
      p.selection.step = 30;
      p.requestPositionThumbs();
      await vi.advanceTimersByTimeAsync(400);
      const last = calls.at(-1)!;
      expect(last.indices).toEqual([0, 30, 60, 90]);
      expect(last.maxSize).toBe(96);
      const t1 = [bmp(), bmp(), bmp(), bmp()];
      last.resolve(t1);
      await vi.advanceTimersByTimeAsync(0);
      expect(p.positionThumbs).toBe(t1);
      p.selection.step = 60;
      p.requestPositionThumbs();
      await vi.advanceTimersByTimeAsync(400);
      const t2 = [bmp(), bmp()];
      calls.at(-1)!.resolve(t2);
      await vi.advanceTimersByTimeAsync(0);
      t1.forEach((b) => expect(b.close).toHaveBeenCalled());
      expect(p.positionThumbs).toBe(t2);
      p.dispose();
      t2.forEach((b) => expect(b.close).toHaveBeenCalled());
    } finally {
      vi.useRealTimers();
    }
  });

  it('veraltete Antwort wird geschlossen', async () => {
    vi.useFakeTimers();
    try {
      const { eng, calls } = fake();
      const p = new Project(eng);
      await p.load(new File([], 'a.mp4'));
      p.requestPositionThumbs();
      await vi.advanceTimersByTimeAsync(400);
      const first = calls.at(-1)!;
      p.selection.step = 60;
      p.requestPositionThumbs();
      await vi.advanceTimersByTimeAsync(400);
      const stale = [bmp()];
      first.resolve(stale);
      await vi.advanceTimersByTimeAsync(0);
      expect(stale[0].close).toHaveBeenCalled();
      expect(p.positionThumbs).not.toBe(stale);
      p.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Project.autoThreshold', () => {
  it('rendert mit Auto und uebernimmt den ermittelten Wert konkret', async () => {
    const { eng } = fake();
    let n = 0;
    eng.render = vi.fn(async (s: { compose: { threshold: number } }) => ({
      ...res(), autoThreshold: s.compose.threshold < 0 ? 0.37 : s.compose.threshold + 0 * n++,
    }));
    const p = new Project(eng as never);
    await p.load(new File([], 'a.mp4'));
    await new Promise((r) => setTimeout(r, 0));
    p.compose.threshold = 0.4;
    await p.autoThreshold();
    expect(p.compose.threshold).toBe(0.37);
    p.dispose();
  });
});
