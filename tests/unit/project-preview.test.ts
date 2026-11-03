import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from '../../src/lib/state/project.svelte';
import type { RenderResult } from '../../src/lib/engine/engine';
import type { VideoInfo } from '../../src/lib/types';
import { VideoError } from '../../src/lib/video/demux';

const info = { frameCount: 120, captureFps: 60, width: 10, height: 10 } as VideoInfo;
type R = RenderResult | 'superseded';

const bmp = () => ({ close: vi.fn(), width: 10, height: 10 }) as unknown as ImageBitmap;
const res = (): RenderResult => ({
  image: bmp(),
  maskOverlay: bmp(),
  positions: 1,
  cameraMoved: false,
  autoThreshold: 0.1,
  settingsKey: "",
  width: 10,
  height: 10,
});
const closed = (b: ImageBitmap | null) => expect(b!.close).toHaveBeenCalled();

function controllable(exact = true) {
  const renders: { resolve(r: R): void; reject(e: unknown): void }[] = [];
  const opens: Blob[] = [];
  const failOpen: boolean[] = [];
  const eng = {
    open: vi.fn(async (f: Blob) => {
      opens.push(f);
      if (failOpen.shift()) throw new VideoError('unsupported-format', 'x');
      return { info, exact };
    }),
    render: vi.fn(() => new Promise<R>((resolve, reject) => renders.push({ resolve, reject }))),
    onProgress() {},
    dispose() {},
  };
  return { eng, renders, opens, failOpen };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('Project Vorschau-Zustandsmaschine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('erste Vorschau nach load sofort, danach entprellt zu einem Render', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(eng.render).toHaveBeenCalledTimes(1);
    renders[0].resolve(res());
    await flush();
    p.requestPreview();
    await vi.advanceTimersByTimeAsync(50);
    p.requestPreview();
    await vi.advanceTimersByTimeAsync(119);
    expect(eng.render).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(eng.render).toHaveBeenCalledTimes(2);
    p.dispose();
  });

  it('superseded und Fehler setzen rendering zurueck; ersetzte Bitmaps werden geschlossen', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(p.rendering).toBe(true);
    renders[0].resolve('superseded');
    await flush();
    expect(p.rendering).toBe(false);
    expect(p.preview).toBeNull();

    p.requestPreview(true);
    const first = res();
    renders[1].resolve(first);
    await flush();
    expect(p.preview).toBe(first);
    p.requestPreview(true);
    const second = res();
    renders[2].resolve(second);
    await flush();
    closed(first.image);
    closed(first.maskOverlay);
    expect(p.preview).toBe(second);

    p.requestPreview(true);
    renders[3].reject(new Error('boom'));
    await flush();
    expect(p.rendering).toBe(false);
    expect(p.error).toBe('Das Video konnte nicht dekodiert werden.');
    p.dispose();
  });

  it('veraltetes Ergebnis wird geschlossen und verworfen', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    p.requestPreview(true); // zweiter Render ueberholt den ersten
    const stale = res();
    renders[0].resolve(stale);
    await flush();
    closed(stale.image);
    expect(p.preview).toBeNull();
    expect(p.rendering).toBe(true);
    renders[1].resolve('superseded');
    await flush();
    expect(p.rendering).toBe(false);
    p.dispose();
  });

  it('exact:false wird uebernommen', async () => {
    const { eng } = controllable(false);
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(p.exact).toBe(false);
    p.dispose();
  });

  it('R13: Fehler nach Erfolg stellt vorheriges Projekt wieder her', async () => {
    const { eng, opens, failOpen } = controllable();
    const p = new Project(eng);
    const a = new File([], 'a.mp4');
    await p.load(a);
    failOpen.push(true, false);
    await p.load(new File([], 'b.mp4'));
    expect(opens[opens.length - 1]).toBe(a);
    expect(p.info).not.toBeNull();
    expect(p.name).toBe('a.mp4');
    expect(p.error).toContain('MP4 oder MOV');
    expect(eng.render).toHaveBeenCalledTimes(2);
    p.dispose();
  });

  it('R13: scheitert auch das Wiederoeffnen, Startzustand mit Fehler', async () => {
    const { eng, renders, failOpen } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    const r = res();
    renders[0].resolve(r);
    await flush();
    failOpen.push(true, true);
    await p.load(new File([], 'b.mp4'));
    expect(p.info).toBeNull();
    expect(p.file).toBeNull();
    expect(p.preview).toBeNull();
    closed(r.image);
    expect(p.error).toContain('MP4 oder MOV');
    p.dispose();
  });

  it('ueberlappende loads: nur das letzte gilt', async () => {
    const { eng } = controllable();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const orig = eng.open.getMockImplementation()!;
    eng.open.mockImplementationOnce(async (f: Blob) => {
      await gate;
      return orig(f);
    });
    const p = new Project(eng);
    const l1 = p.load(new File([], 'alt.mp4'));
    await p.load(new File([], 'neu.mp4'));
    release();
    await l1;
    expect(p.name).toBe('neu.mp4');
    p.dispose();
  });
});

describe('R19: exporting unterdrueckt Vorschau', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('requestPreview waehrend exporting merkt nur vor; danach genau ein Render', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    renders[0].resolve(res());
    await flush();
    expect(eng.render).toHaveBeenCalledTimes(1);
    p.exporting = true;
    p.requestPreview();
    p.requestPreview(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(eng.render).toHaveBeenCalledTimes(1);
    p.exporting = false;
    await vi.advanceTimersByTimeAsync(0);
    expect(eng.render).toHaveBeenCalledTimes(2);
    p.dispose();
  });

  it('ohne Anfrage waehrend exporting kein Render danach', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    renders[0].resolve(res());
    await flush();
    p.exporting = true;
    p.exporting = false;
    await vi.advanceTimersByTimeAsync(500);
    expect(eng.render).toHaveBeenCalledTimes(1);
    p.dispose();
  });
});

describe('R19: laufende Vorschau beim Exportstart', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('wird als ausstehend gemerkt, rendering zurueckgesetzt, danach ein Render', async () => {
    const { eng, renders } = controllable();
    const p = new Project(eng);
    await p.load(new File([], 'a.mp4'));
    expect(p.rendering).toBe(true);
    p.exporting = true;
    expect(p.rendering).toBe(false);
    renders[0].resolve('superseded');
    await flush();
    expect(p.rendering).toBe(false);
    expect(eng.render).toHaveBeenCalledTimes(1);
    p.exporting = false;
    await vi.advanceTimersByTimeAsync(0);
    expect(eng.render).toHaveBeenCalledTimes(2);
    p.dispose();
  });
});
