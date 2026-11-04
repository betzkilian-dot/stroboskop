import { cropRotate } from '../compose/transform';
import { deltaT, isUniform, selectFrameIndices } from '../frames';
import { settingsKey, type RenderResult, type RenderSettings } from '../engine/protocol';
import { formatDt } from '../format';
import { buildScene, type Scene } from '../overlay/scene';
import { drawOverlay } from '../overlay/draw';
import { exportMap } from '../overlay/map';
import type { Pt } from '../physics/kinematics';
import { type StrobeImage } from './strobeCache';
import type { Project } from '../state/project.svelte';

export interface ImageExportOptions {
  format: 'png' | 'jpeg';
  quality: number;
  /** 'worksheet': lange Kante 1600 px (nie hochskaliert); 'original': unveraendert */
  size: 'original' | 'worksheet';
  infoLine: boolean;
  /** Messeinblendungen (Nummern, Bahn, Pfeile, Legende, Massstab, Δt) wie auf der Buehne. */
  overlays: boolean;
}

export const WORKSHEET_LONG_EDGE = 1600;

export function infoLineText(dt: number, uniform = true): string {
  return `Δt = ${formatDt(dt)}${uniform ? '' : ' (nicht gleichmäßig)'}`;
}

/** Export-Einstellungen: bei Auto-Schwelle den Wert der Vorschau nur nehmen, wenn diese mit denselben Einstellungen gerechnet wurde. */
export function exportSettings(s: RenderSettings, preview: Pick<RenderResult, 'autoThreshold' | 'settingsKey'> | null): RenderSettings {
  if (s.compose.threshold >= 0 || !preview || preview.settingsKey !== settingsKey(s)) return s;
  return { ...s, compose: { ...s.compose, threshold: preview.autoThreshold } };
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

/** Ausgabegröße des Exports (nach Zuschnitt und Drehung, dann Zielgröße); Kanten gerundet wie cropRotate. */
export function outputSize(
  info: { width: number; height: number }, crop: { x: number; y: number; w: number; h: number } | null,
  rotation: 0 | 90 | 180 | 270, size: 'original' | 'worksheet',
): { width: number; height: number } {
  const v = crop ?? { x: 0, y: 0, w: info.width, h: info.height };
  const w0 = Math.max(1, Math.round(v.x + v.w) - Math.round(v.x));
  const h0 = Math.max(1, Math.round(v.y + v.h) - Math.round(v.y));
  const swap = rotation === 90 || rotation === 270;
  return targetSize(swap ? h0 : w0, swap ? w0 : h0, size);
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

/** Szene, Abbildung (Video- -> Exportpixel) und Linienmass fuer die Einblendungen; null ohne `overlays`. w = Breite nach Zuschnitt/Drehung. */
export function exportOverlay(
  p: Project, o: ImageExportOptions, t: { width: number; height: number }, w: number,
): { scene: Scene; map: (q: Pt) => Pt; unit: number } | null {
  if (!o.overlays || !p.info) return null;
  const dtText = !o.infoLine && p.measure.overlays.dt
    ? infoLineText(deltaT(p.selection.step, p.captureFps), isUniform(p.measureIndices))
    : null;
  return {
    scene: buildScene(p.measure, p.measureIndices, p.captureFps, p.viewRect, { showCalibration: false, showAxes: p.measure.overlays.axes, highlight: null, dtText }),
    map: exportMap(p.crop, p.rotation, p.info.width, p.info.height, t.width / w),
    unit: Math.max(1, Math.max(t.width, t.height) / 1000),
  };
}

/** Voll aufgeloestes Stroboskopbild nach Zuschnitt/Drehung; wird je Projekt zwischengespeichert (Schluessel: Einstellungen, Schwelle, Zuschnitt, Drehung). */
async function renderFullImage(p: Project): Promise<StrobeImage> {
  const settings = exportSettings(p.renderSettings(), p.preview);
  const crop = p.crop && { ...p.crop };
  const rotation = p.rotation;
  const key = JSON.stringify([settings, crop, rotation]);
  return p.strobeCache.get(key, async () => {
    const r = await p.engine.render(settings, { maxSize: Infinity, showMask: false, detect: false });
    if (r === 'superseded') throw new Error('Export wurde unterbrochen.');
    try {
      const c = new OffscreenCanvas(r.image.width, r.image.height);
      const cctx = c.getContext('2d', { willReadFrequently: true })!;
      cctx.drawImage(r.image, 0, 0);
      const id = cctx.getImageData(0, 0, c.width, c.height);
      c.width = 0;
      return cropRotate({ width: id.width, height: id.height, data: id.data }, crop, rotation);
    } finally {
      r.image.close();
      r.maskOverlay?.close();
    }
  });
}

export async function renderExportImage(p: Project, o: ImageExportOptions): Promise<Blob> {
  const { width: w, height: h, data } = await renderFullImage(p);
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
  const ov = exportOverlay(p, o, t, w);
  if (ov) drawOverlay(ctx, ov.scene, ov.map, ov.unit, { width: t.width, height: t.height, screen: false });
  if (o.infoLine) drawInfoLine(ctx, t.width, t.height, infoLineText(deltaT(p.selection.step, p.captureFps), isUniform(selectFrameIndices(p.selection))));
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
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'AbortError') return 'cancelled';
      if (name !== 'NotAllowedError') throw e;
    }
  }
  download(blob, fileName);
  return 'downloaded';
}
