import { cropRotate } from '../compose/transform';
import { deltaT } from '../frames';
import { formatDt } from '../format';
import type { Project } from '../state/project.svelte';

export interface ImageExportOptions {
  format: 'png' | 'jpeg';
  quality: number;
  /** 'worksheet': lange Kante 1600 px (nie hochskaliert); 'original': unveraendert */
  size: 'original' | 'worksheet';
  infoLine: boolean;
  /** Plan 1: ohne Wirkung (die Infozeile steuert `infoLine`). Plan 2 haengt hier Nummern, Bahn und Pfeile an. */
  overlays: boolean;
}

export const WORKSHEET_LONG_EDGE = 1600;

export function infoLineText(dt: number): string {
  return `Δt = ${formatDt(dt)}`;
}

export function exportFileName(videoName: string, ext: 'png' | 'jpg'): string {
  const dot = videoName.lastIndexOf('.');
  const base = dot > 0 ? videoName.slice(0, dot) : videoName;
  return `${base}_stroboskop.${ext}`;
}

export function targetSize(w: number, h: number, size: 'original' | 'worksheet'): { width: number; height: number } {
  const long = Math.max(w, h);
  if (size === 'original' || long <= WORKSHEET_LONG_EDGE) return { width: w, height: h };
  const f = WORKSHEET_LONG_EDGE / long;
  return { width: Math.max(1, Math.round(w * f)), height: Math.max(1, Math.round(h * f)) };
}

function drawInfoLine(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, text: string): void {
  const fontPx = Math.max(12, Math.round(h * 0.025));
  const pad = Math.round(fontPx * 0.5);
  ctx.font = `${fontPx}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const boxW = Math.ceil(ctx.measureText(text).width) + 2 * pad;
  const boxH = fontPx + 2 * pad;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(0, h - boxH, boxW, boxH);
  ctx.fillStyle = '#111';
  ctx.fillText(text, pad, h - pad - Math.round(fontPx * 0.2));
}

export async function renderExportImage(p: Project, o: ImageExportOptions): Promise<Blob> {
  const r = await p.engine.render(
    p.renderSettings(),
    { maxSize: Infinity, showMask: false },
  );
  if (r === 'superseded') throw new Error('Export wurde unterbrochen.');
  let w: number, h: number, data: Uint8ClampedArray;
  try {
    const c = new OffscreenCanvas(r.image.width, r.image.height);
    const cctx = c.getContext('2d', { willReadFrequently: true })!;
    cctx.drawImage(r.image, 0, 0);
    const id = cctx.getImageData(0, 0, c.width, c.height);
    c.width = 0;
    const out = cropRotate({ width: id.width, height: id.height, data: id.data }, p.crop, p.rotation);
    w = out.width;
    h = out.height;
    data = out.data;
  } finally {
    r.image.close();
    r.maskOverlay?.close();
  }
  const t = targetSize(w, h, o.size);
  const dst = new OffscreenCanvas(t.width, t.height);
  const ctx = dst.getContext('2d')!;
  const imageData = new ImageData(data as Uint8ClampedArray<ArrayBuffer>, w, h);
  if (t.width === w && t.height === h) {
    ctx.putImageData(imageData, 0, 0);
  } else {
    const src = new OffscreenCanvas(w, h);
    src.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, t.width, t.height);
    src.width = 0;
  }
  if (o.infoLine) drawInfoLine(ctx, t.width, t.height, infoLineText(deltaT(p.selection.step, p.captureFps)));
  try {
    return await dst.convertToBlob(
      o.format === 'png' ? { type: 'image/png' } : { type: 'image/jpeg', quality: o.quality },
    );
  } finally {
    dst.width = 0;
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Muss direkt im Klick-Handler aufgerufen werden (iPad verlangt eine Benutzeraktion fuer share).
 * Abbruch durch den Nutzer (AbortError) ist kein Fehler; NotAllowedError faellt auf den Download zurueck.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  download: (blob: Blob, fileName: string) => void = downloadBlob,
): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'AbortError') return;
      if (name !== 'NotAllowedError') throw e;
    }
  }
  download(blob, fileName);
}
