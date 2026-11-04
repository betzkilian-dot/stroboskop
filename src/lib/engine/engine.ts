import type { FrameSource, RGBAImage, VideoInfo } from '../types';
import { VideoError } from '../video/demux';
import { openElementSource } from '../video/open';
import { clearBackgroundCache, createBackgroundCache, renderStrobe } from './render';
import type { RenderResult, RenderSettings, RenderStage, WireError, WorkerRequest, WorkerResponse } from './protocol';

export type { RenderResult, RenderSettings, RenderStage } from './protocol';

/** Verdraengungs-Kanal: nur eine neuere Anfrage im SELBEN Kanal bricht die laufende ab (Ergebnis []). */
export type ThumbChannel = 'trim' | 'positions';

export interface StrobeEngine {
  /** wirft VideoError */
  open(file: Blob): Promise<{ info: VideoInfo; exact: boolean }>;
  render(s: RenderSettings, o: { maxSize: number; showMask: boolean; detect?: boolean }): Promise<RenderResult | 'superseded'>;
  /** Kleine Vorschaubilder der angegebenen Indizes (laengste Kante <= maxSize); laeuft hinter einem Render. */
  thumbnails(indices: number[], maxSize: number, channel: ThumbChannel): Promise<ImageBitmap[]>;
  onProgress(cb: (done: number, total: number, stage: RenderStage) => void): void;
  dispose(): void;
}

const BUDGET = 256 * 1024 * 1024;
// ImageData kopiert die Pixel nicht; die Daten stammen immer aus einem eigenen ArrayBuffer.
const bitmap = (img: RGBAImage) =>
  createImageBitmap(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height));

type WorkerFailure = Error & { noWebCodecs?: boolean };

function rebuild(e: WireError): WorkerFailure {
  const err: WorkerFailure = e.code ? new VideoError(e.code, e.message) : new Error(e.message);
  if (!e.code) err.name = e.name;
  err.noWebCodecs = e.noWebCodecs;
  return err;
}

interface Pending {
  resolve(r: WorkerResponse): void;
  reject(e: Error): void;
}

export function createStrobeEngine(): StrobeEngine {
  let worker: Worker | null = null;
  let mainSource: FrameSource | null = null; // Rueckfall im Hauptthread (Ruling R11)
  let nextId = 1;
  let workerDead = false;
  let openP: Promise<unknown> | null = null;
  let openGen = 0;
  const cache = createBackgroundCache();
  const pending = new Map<number, Pending>();
  let progressCb: (done: number, total: number, stage: RenderStage) => void = () => {};
  let progressId = -1;
  let current: AbortController | null = null;
  const thumbCtl: Record<ThumbChannel, AbortController | null> = { trim: null, positions: null };
  let inflight: Promise<unknown> | null = null;

  function ensureWorker(): Worker {
    if (worker) return worker;
    const w = new Worker(new URL('./strobe.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data;
      if (m.type === 'progress') {
        if (m.id === progressId) progressCb(m.done, m.total, m.stage);
        return;
      }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.type === 'error') p.reject(rebuild(m.error));
      else p.resolve(m);
    };
    w.onerror = (ev) => {
      const err: WorkerFailure = new Error(ev.message || 'Worker-Fehler');
      err.noWebCodecs = true; // Worker nicht startbar -> ebenfalls Hauptthread-Rueckfall
      w.terminate();
      if (worker === w) worker = null;
      workerDead = true;
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
    worker = w;
    return w;
  }
  function request(req: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      if (workerDead) {
        const err: WorkerFailure = new Error('Worker nicht verfuegbar');
        err.noWebCodecs = true;
        reject(err);
        return;
      }
      pending.set(req.id, { resolve, reject });
      try {
        ensureWorker().postMessage(req);
      } catch (e) {
        pending.delete(req.id);
        const err: WorkerFailure = e instanceof Error ? e : new Error(String(e));
        err.noWebCodecs = true;
        reject(err);
      }
    });
  }

  function open(file: Blob) {
    openGen++;
    // laufende Render/Miniaturen sofort verdraengen; das eigentliche Oeffnen erst nach einem vorherigen open()
    current?.abort();
    thumbCtl.trim?.abort();
    thumbCtl.positions?.abort();
    const prev = openP;
    // Fehler A: den laufenden Render JETZT merken; ein spaeter gestarteter Render wartet selbst auf openP
    const busy = inflight;
    const p = (async () => {
      if (prev) await prev.catch(() => {});
      return openImpl(file, busy);
    })();
    openP = p;
    return p;
  }
  async function openImpl(file: Blob, busy: Promise<unknown> | null) {
    if (busy) await busy.catch(() => {});
    mainSource?.close();
    mainSource = null;
    clearBackgroundCache(cache);
    try {
      const m = await request({ type: 'open', id: nextId++, file });
      if (m.type !== 'opened') throw new Error('Unerwartete Antwort');
      return { info: m.info, exact: m.exact };
    } catch (e) {
      if (!(e as WorkerFailure).noWebCodecs) throw e;
      mainSource = await openElementSource(file); // wirft VideoError bei Fehlern
      return { info: mainSource.info, exact: false };
    }
  }

  function render(s: RenderSettings, o: { maxSize: number; showMask: boolean; detect?: boolean }): Promise<RenderResult | 'superseded'> {
    current?.abort();
    const ctl = new AbortController();
    current = ctl;
    const op = openP;
    const prev = inflight; // nur ein Render gleichzeitig: erst den abgebrochenen beenden lassen
    const p = (async (): Promise<RenderResult | 'superseded'> => {
      if (prev) await prev.catch(() => {});
      if (op) await op.catch(() => {});
      if (ctl.signal.aborted) return 'superseded';
      try {
        if (mainSource) {
          progressId = -2;
          const r = await renderStrobe(mainSource, s, {
            ...o, budgetBytes: BUDGET, cache, signal: ctl.signal, onProgress: (d, t, st) => progressCb(d, t, st),
          });
          const image = await bitmap(r.image);
          const maskOverlay = r.maskOverlay ? await bitmap(r.maskOverlay) : null;
          if (ctl.signal.aborted) {
            image.close();
            maskOverlay?.close();
            return 'superseded';
          }
          return { ...r, image, maskOverlay };
        }
        const id = nextId++;
        progressId = id;
        const onAbort = () => worker?.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
        ctl.signal.addEventListener('abort', onAbort);
        try {
          const m = await request({ type: 'render', id, settings: s, maxSize: o.maxSize, showMask: o.showMask, detect: o.detect });
          if (m.type !== 'result') throw new Error('Unerwartete Antwort');
          const { type: _t, id: _i, ...result } = m;
          if (ctl.signal.aborted) {
            result.image.close();
            result.maskOverlay?.close();
            return 'superseded';
          }
          return result;
        } finally {
          ctl.signal.removeEventListener('abort', onAbort);
        }
      } catch (e) {
        if (ctl.signal.aborted) return 'superseded';
        throw e;
      }
    })();
    inflight = p;
    return p;
  }

  function thumbnails(indices: number[], maxSize: number, channel: ThumbChannel): Promise<ImageBitmap[]> {
    thumbCtl[channel]?.abort(); // eine neuere Anfrage im selben Kanal verdraengt die laufende (Ergebnis: [])
    const ctl = new AbortController();
    thumbCtl[channel] = ctl;
    const id = nextId++;
    const op = openP;
    const prev = inflight;
    const gen = openGen; // Indizes gehoeren zur Quelle von jetzt; ein spaeteres open() macht sie ungueltig
    const p = (async (): Promise<ImageBitmap[]> => {
      if (op) await op.catch(() => {});
      if (prev) await prev.catch(() => {});
      if (gen !== openGen || ctl.signal.aborted) return [];
      const src = mainSource;
      if (src) {
        const out: ImageBitmap[] = [];
        try {
          for await (const f of src.readFrames(indices, { maxSize })) {
            if (ctl.signal.aborted) break;
            out.push(await bitmap(f.image));
          }
        } catch (e) {
          out.forEach((b) => b.close());
          throw e;
        }
        if (ctl.signal.aborted) {
          out.forEach((b) => b.close());
          return [];
        }
        return out;
      }
      const onAbort = () => worker?.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
      ctl.signal.addEventListener('abort', onAbort);
      try {
        const m = await request({ type: 'thumbnails', id, indices, maxSize });
        if (m.type !== 'thumbnails') throw new Error('Unerwartete Antwort');
        if (ctl.signal.aborted) {
          m.images.forEach((b) => b.close());
          return [];
        }
        return m.images;
      } finally {
        ctl.signal.removeEventListener('abort', onAbort);
      }
    })();
    // ein folgender Render wartet auf die Miniaturen (Hauptthread-Pfad teilt sich die Quelle)
    inflight = p.catch(() => {});
    return p;
  }

  // Worker sofort anlegen: ein Deploy (autoUpdate) darf den alten Worker-Chunk nicht erst beim ersten open() 404en lassen.
  try {
    ensureWorker();
  } catch {
    // kein Worker verfuegbar (z. B. Testumgebung): request() meldet das beim ersten Aufruf
  }

  return {
    open,
    render,
    thumbnails,
    onProgress(cb) {
      progressCb = cb;
    },
    dispose() {
      current?.abort();
      thumbCtl.trim?.abort();
      thumbCtl.positions?.abort();
      worker?.terminate();
      worker = null;
      mainSource?.close();
      mainSource = null;
      for (const p of pending.values()) p.reject(new Error('disposed'));
      pending.clear();
    },
  };
}
