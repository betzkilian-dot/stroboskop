import type { FrameSource, RGBAImage } from '../types';
import { selectFrameIndices } from '../frames';
import { medianBackground, medianBackgroundBanded } from '../compose/background';
import { createCompositor } from '../compose/compositor';
import { autoThreshold, motionMask } from '../compose/mask';
import { detectCameraMotion } from '../compose/motion';
import { targetSize } from '../video/draw';
import type { RenderResult, RenderSettings } from './protocol';

export const BACKGROUND_SAMPLES = 40;
export const CAMERA_SAMPLE_SIZE = 320;

/**
 * Cache fuer Hintergrund und Kamerabewegung.
 * - Hintergruende: kleiner LRU mit zwei Plaetzen (Schluessel = Zuschnitt, Hintergrundquelle, maxSize),
 *   damit Vorschau und Export einander nicht verdraengen.
 * - Kamerabewegung: unabhaengig von maxSize (Schluessel = Zuschnitt), da sie aus festen 320-px-Stichproben stammt.
 */
export interface BackgroundCache {
  slots: { key: string; bg: RGBAImage }[]; // zuletzt benutzt zuerst
  motion: { key: string; moved: boolean } | null;
}
export const BACKGROUND_SLOTS = 2;
export function createBackgroundCache(): BackgroundCache {
  return { slots: [], motion: null };
}
export function clearBackgroundCache(c: BackgroundCache): void {
  c.slots = [];
  c.motion = null;
}

export interface RenderOptions {
  /** optional: Hintergrund wiederverwenden, solange der Schluessel gleich bleibt */
  cache?: BackgroundCache;
  maxSize: number;
  showMask: boolean;
  budgetBytes: number;
  signal: AbortSignal;
  onProgress(done: number, total: number): void;
}

export type RawRenderResult = Omit<RenderResult, 'image' | 'maskOverlay'> & {
  image: RGBAImage;
  maskOverlay: RGBAImage | null;
};

/** Gleichmaessig verteilte, eindeutige Indizes in [start, end] (hoechstens count). */
export function sampleIndicesFor(start: number, end: number, count: number): number[] {
  const len = end - start + 1;
  if (len <= count) return Array.from({ length: len }, (_, i) => start + i);
  const out = new Set<number>();
  for (let i = 0; i < count; i++) out.add(start + Math.round((i * (len - 1)) / (count - 1)));
  return [...out];
}

/**
 * Hinweis: BackgroundSource 'first'/'last' beziehen sich auf den Zuschnitt (startIndex/endIndex der Auswahl),
 * nicht auf das ganze Video.
 */
export async function renderStrobe(src: FrameSource, s: RenderSettings, o: RenderOptions): Promise<RawRenderResult> {
  const check = () => {
    if (o.signal.aborted) throw new Error('aborted');
  };
  check();
  const indices = selectFrameIndices(s.selection);
  if (indices.length === 0) throw new Error('Keine Bilder ausgewaehlt');
  const total = indices.length;
  const { startIndex, endIndex } = s.selection;
  const { width, height } = targetSize(src.info.width, src.info.height, o.maxSize);
  o.onProgress(0, total);

  // R17: Region und weiche Kante sind in VIDEO-Pixeln gespeichert; auf die Arbeitsaufloesung umrechnen
  const scale = width / src.info.width;
  const region = s.compose.region
    ? s.compose.region.map((p) => ({ x: p.x * scale, y: p.y * scale }))
    : null;
  const featherPx = Math.max(0, Math.round(s.compose.featherPx * scale));

  async function* guarded(gen: AsyncGenerator<{ index: number; image: RGBAImage }>) {
    try {
      for await (const f of gen) {
        check();
        yield f;
      }
    } finally {
      await gen.return(undefined);
    }
  }
  async function* images(gen: AsyncGenerator<{ index: number; image: RGBAImage }>) {
    for await (const f of gen) yield f.image;
  }
  async function readOne(index: number, maxSize: number): Promise<RGBAImage> {
    for await (const f of guarded(src.readFrames([index], { maxSize }))) return f.image;
    throw new Error(`Bild ${index} konnte nicht gelesen werden`);
  }

  // Hintergrund in Vollaufloesung; Fortschritt gewichtet: Median 0-60 %, Kamera 60-65 %, Zusammensetzen 65-100 %
  const key = JSON.stringify([startIndex, endIndex, s.compose.background, o.maxSize]);
  const motionKey = JSON.stringify([startIndex, endIndex]);
  const sampleIdx = sampleIndicesFor(startIndex, endIndex, BACKGROUND_SAMPLES);
  const bgSrc = s.compose.background;
  const hit = o.cache?.slots.find((x) => x.key === key);
  const cachedMotion = o.cache?.motion?.key === motionKey ? o.cache.motion : null;
  const prepared = !hit || !cachedMotion; // false: nichts zu berechnen -> Zusammensetzen belegt 0-100 %
  const BG_END = 0.6, CAM_END = 0.65;
  let reported = 0;
  const report = (frac: number) => {
    reported = Math.max(reported, Math.min(1, frac));
    o.onProgress(reported * total, total);
  };
  let bg: RGBAImage;
  if (hit) {
    bg = hit.bg;
    o.cache!.slots = [hit, ...o.cache!.slots.filter((x) => x !== hit)];
  } else {
    if (bgSrc === 'median') {
      bg = await medianBackgroundBanded(
        (rs, re) => {
          report((BG_END * rs) / height);
          return images(guarded(src.readFrames(sampleIdx, { maxSize: o.maxSize, rows: [rs, re] })));
        },
        width,
        height,
        sampleIdx.length,
        o.budgetBytes,
      );
    } else {
      const idx = bgSrc === 'first' ? startIndex : bgSrc === 'last' ? endIndex : bgSrc.frameIndex;
      bg = await readOne(idx, o.maxSize);
    }
    check();
    report(BG_END);
  }

  // Kamerabewegung aus kleinen Stichproben (nie Vollaufloesung im Speicher)
  let cameraMoved: boolean;
  if (cachedMotion) {
    cameraMoved = cachedMotion.moved;
  } else {
    const small: RGBAImage[] = [];
    for await (const f of guarded(src.readFrames(sampleIdx, { maxSize: CAMERA_SAMPLE_SIZE }))) small.push(f.image);
    cameraMoved = detectCameraMotion(small, medianBackground(small)).moved;
    small.length = 0;
    check();
    report(CAM_END);
  }
  if (o.cache) {
    // erst nach erfolgreicher Berechnung eintragen (abgebrochene Laeufe fuellen den Cache nicht)
    if (!hit) o.cache.slots = [{ key, bg }, ...o.cache.slots].slice(0, BACKGROUND_SLOTS);
    if (!cachedMotion) o.cache.motion = { key: motionKey, moved: cameraMoved };
  }

  // Schwellwert und Maskenueberlagerung am mittleren ausgewaehlten Bild
  let threshold = s.compose.threshold;
  let maskOverlay: RGBAImage | null = null;
  if (threshold < 0 || o.showMask) {
    const mid = await readOne(indices[Math.floor(indices.length / 2)], o.maxSize);
    if (threshold < 0) threshold = autoThreshold(mid, bg);
    if (o.showMask) {
      const mask = motionMask(mid, bg, threshold, featherPx, region);
      const data = new Uint8ClampedArray(width * height * 4);
      for (let p = 0; p < mask.length; p++)
        if (mask[p] > 0) {
          data[p * 4 + 1] = 200;
          data[p * 4 + 2] = 80;
          data[p * 4 + 3] = Math.round(0.45 * 255);
        }
      maskOverlay = { width, height, data };
    }
    check();
  }

  // Frames aufsteigend in Zeitreihenfolge (Compositor-Vertrag)
  const comp = createCompositor(bg, { ...s.compose, threshold, region, featherPx }, total);
  let done = 0;
  for await (const f of guarded(src.readFrames(indices, { maxSize: o.maxSize }))) {
    comp.add(f.image, done);
    done++;
    report((prepared ? CAM_END : 0) + ((1 - (prepared ? CAM_END : 0)) * done) / total);
  }
  check();
  o.onProgress(total, total);
  return { image: comp.result(), maskOverlay, positions: total, cameraMoved, autoThreshold: threshold, width, height };
}
