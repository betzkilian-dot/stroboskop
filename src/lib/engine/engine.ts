import type { FrameSource, RGBAImage, VideoInfo } from '../types';
import { VideoError } from '../video/demux';
import { openElementSource } from '../video/open';
import { clearBackgroundCache, createBackgroundCache, renderStrobe } from './render';
import type { RenderResult, RenderSettings, WireError, WorkerRequest, WorkerResponse } from './protocol';

export type { RenderResult, RenderSettings } from './protocol';

export interface StrobeEngine {
  /** wirft VideoError */
  open(file: Blob): Promise<{ info: VideoInfo; exact: boolean }>;
  render(s: RenderSettings, o: { maxSize: number; showMask: boolean }): Promise<RenderResult | 'superseded'>;
  /** Kleine Vorschaubilder der angegebenen Indizes (laengste Kante <= maxSize); laeuft hinter einem Render. */
  thumbnails(indices: number[], maxSize: number): Promise<ImageBitmap[]>;
  onProgress(cb: (done: number, total: number) => void): void;
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
  const cache = createBackgroundCache();
  const pending = new Map<number, Pending>();
  let progressCb: (done: number, total: number) => void = () => {};
  let progressId = -1;
  let current: AbortController | null = null;
  let inflight: Promise<unknown> | null = null;

  function ensureWorker(): Worker {
    if (worker) return worker;
    const w = new Worker(new URL('./strobe.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data;
      if (m.type === 'progress') {
        if (m.id === progressId) progressCb(m.done, m.total);
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
    const p = openImpl(file);
    openP = p;
    return p;
  }
  async function openImpl(file: Blob) {
    current?.abort();
    if (inflight) await inflight.catch(() => {});
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

  function render(s: RenderSettings, o: { maxSize: number; showMask: boolean }): Promise<RenderResult | 'superseded'> {
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
            ...o, budgetBytes: BUDGET, cache, signal: ctl.signal, onProgress: (d, t) => progressCb(d, t),
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
          const m = await request({ type: 'render', id, settings: s, maxSize: o.maxSize, showMask: o.showMask });
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

  function thumbnails(indices: number[], maxSize: number): Promise<ImageBitmap[]> {
    const op = openP;
    const prev = inflight;
    const p = (async (): Promise<ImageBitmap[]> => {
      if (op) await op.catch(() => {});
      if (prev) await prev.catch(() => {});
      if (mainSource) {
        const out: ImageBitmap[] = [];
        for await (const f of mainSource.readFrames(indices, { maxSize })) out.push(await bitmap(f.image));
        return out;
      }
      const m = await request({ type: 'thumbnails', id: nextId++, indices, maxSize });
      if (m.type !== 'thumbnails') throw new Error('Unerwartete Antwort');
      return m.images;
    })();
    // ein folgender Render wartet auf die Miniaturen (Hauptthread-Pfad teilt sich die Quelle)
    inflight = p.catch(() => {});
    return p;
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
      worker?.terminate();
      worker = null;
      mainSource?.close();
      mainSource = null;
      for (const p of pending.values()) p.reject(new Error('disposed'));
      pending.clear();
    },
  };
}
