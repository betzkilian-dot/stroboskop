import { describe, it, expect } from 'vitest';
import { Project } from '../../src/lib/state/project.svelte';
import type { StrobeEngine } from '../../src/lib/engine/engine';
import type { VideoInfo } from '../../src/lib/types';

const info = { frameCount: 120, captureFps: 60, width: 10, height: 10 } as VideoInfo;
const fakeEngine = (exact = true): StrobeEngine => ({
  open: async () => ({ info, exact }),
  render: async () => 'superseded',
  onProgress() {},
  dispose() {},
  cancel() {},
});

describe('Project', () => {
  it('setzt Standards nach load()', async () => {
    const p = new Project(fakeEngine());
    await p.load(new File([], 'a.mp4'));
    expect(p.name).toBe('a.mp4');
    expect(p.selection).toEqual({ startIndex: 0, endIndex: 119, step: 6, excluded: [] });
    expect(p.compose.mode).toBe('difference');
    expect(p.compose.threshold).toBe(-1);
    expect(p.compose.background).toBe('median');
    expect(p.rotation).toBe(0);
    expect(p.crop).toBeNull();
    expect(p.showMask).toBe(false);
    expect(p.captureFps).toBe(60);
    expect(p.exact).toBe(true);
  });
  it('captureFpsOverride hat Vorrang', async () => {
    const p = new Project(fakeEngine());
    await p.load(new File([], 'a.mp4'));
    p.captureFpsOverride = 240;
    expect(p.captureFps).toBe(240);
  });
  it('Fehlertext nach Code', async () => {
    const { VideoError } = await import('../../src/lib/video/demux');
    const eng = fakeEngine();
    eng.open = async () => { throw new VideoError('no-video-track', 'x'); };
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(p.error).toBe('Die Datei enthält kein Video.');
    expect(p.info).toBeNull();
  });
  it('loading ist waehrend load() true, danach false (auch bei Fehler)', async () => {
    let release!: () => void;
    const eng = fakeEngine();
    eng.open = () => new Promise((r) => (release = () => r({ info, exact: true })));
    const p = new Project(eng);
    expect(p.loading).toBe(false);
    const l = p.load(new File([], 'a.mp4'));
    expect(p.loading).toBe(true);
    release();
    await l;
    expect(p.loading).toBe(false);
    eng.open = async () => { throw new Error('x'); };
    await p.load(new File([], 'b.mp4'));
    expect(p.loading).toBe(false);
  });
});
