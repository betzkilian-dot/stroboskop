/// <reference lib="webworker" />
import type { FrameSource, RGBAImage } from '../types';
import { openFrameSource } from '../video/open';
import { VideoError } from '../video/demux';
import { clearBackgroundCache, createBackgroundCache, renderStrobe } from './render';
import type { WireError, WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let source: FrameSource | null = null;
const cache = createBackgroundCache();
const running = new Map<number, AbortController>();
const BUDGET = 256 * 1024 * 1024;

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(msg, transfer);
}
function wire(e: unknown, noWebCodecs = false): WireError {
  const err = e as { name?: string; message?: string };
  return {
    name: err?.name ?? 'Error',
    message: err?.message ?? String(e),
    code: e instanceof VideoError ? e.code : undefined,
    noWebCodecs,
  };
}
// ImageData kopiert die Pixel nicht; die Daten stammen immer aus einem eigenen ArrayBuffer.
const bitmap = (img: RGBAImage) =>
  createImageBitmap(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height));

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type === 'cancel') {
    running.get(req.id)?.abort();
    return;
  }
  if (req.type === 'open') {
    // open reiht sich in die Warteschlange ein (kein Ueberlappen mit Render/Miniaturen/weiteren open)
    queue = queue.then(() => handleOpen(req));
    return;
  }
  const ctl = new AbortController();
  running.set(req.id, ctl);
  // Render und Miniaturen laufen nacheinander (eine Quelle, ein Lesevorgang gleichzeitig).
  queue = queue.then(() => handle(req, ctl));
};

let queue: Promise<void> = Promise.resolve();

async function handleOpen(req: Extract<WorkerRequest, { type: 'open' }>) {
  try {
    source?.close(); // die zu ersetzende Quelle immer schliessen
    source = null;
    clearBackgroundCache(cache);
    source = await openFrameSource(req.file);
    post({ type: 'opened', id: req.id, info: source.info, exact: source.exact });
  } catch (e) {
    // Ohne nutzbares WebCodecs scheitert openFrameSource im Worker (kein DOM) mit decode-failed
    // -> Hauptthread-Rueckfall (Ruling R11).
    post({ type: 'error', id: req.id, error: wire(e, e instanceof VideoError && e.code === 'decode-failed') });
  }
}

async function handle(req: Exclude<WorkerRequest, { type: 'open' | 'cancel' }>, ctl: AbortController) {
  try {
    if (req.type === 'thumbnails') {
      if (!source) throw new Error('Kein Video geoeffnet');
      if (ctl.signal.aborted) {
        post({ type: 'thumbnails', id: req.id, images: [] });
        return;
      }
      const images: ImageBitmap[] = [];
      try {
        for await (const f of source.readFrames(req.indices, { maxSize: req.maxSize })) {
          if (ctl.signal.aborted) break;
          images.push(await bitmap(f.image));
        }
        if (ctl.signal.aborted) {
          images.forEach((b) => b.close());
          images.length = 0;
        }
      } catch (e) {
        images.forEach((b) => b.close());
        throw e;
      }
      post({ type: 'thumbnails', id: req.id, images }, images);
      return;
    }
    if (!source) throw new Error('Kein Video geoeffnet');
    const r = await renderStrobe(source, req.settings, {
      maxSize: req.maxSize,
      showMask: req.showMask,
      detect: req.detect,
      budgetBytes: BUDGET,
      cache,
      signal: ctl.signal,
      onProgress: (done, total, stage) => post({ type: 'progress', id: req.id, done, total, stage }),
    });
    const image = await bitmap(r.image);
    const maskOverlay = r.maskOverlay ? await bitmap(r.maskOverlay) : null;
    post(
      {
        type: 'result', id: req.id, image, maskOverlay, positions: r.positions, detections: r.detections, cameraMoved: r.cameraMoved,
        autoThreshold: r.autoThreshold, settingsKey: r.settingsKey, width: r.width, height: r.height,
      },
      maskOverlay ? [image, maskOverlay] : [image],
    );
  } catch (e) {
    post({ type: 'error', id: req.id, error: wire(e) });
  } finally {
    running.delete(req.id);
  }
}
