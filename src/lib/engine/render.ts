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

export interface RenderOptions {
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

  // Hintergrund in Vollaufloesung
  const sampleIdx = sampleIndicesFor(startIndex, endIndex, BACKGROUND_SAMPLES);
  const bgSrc = s.compose.background;
  let bg: RGBAImage;
  if (bgSrc === 'median') {
    bg = await medianBackgroundBanded(
      (rs, re) => images(guarded(src.readFrames(sampleIdx, { maxSize: o.maxSize, rows: [rs, re] }))),
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

  // Kamerabewegung aus kleinen Stichproben (nie Vollaufloesung im Speicher)
  const small: RGBAImage[] = [];
  for await (const f of guarded(src.readFrames(sampleIdx, { maxSize: CAMERA_SAMPLE_SIZE }))) small.push(f.image);
  const cameraMoved = detectCameraMotion(small, medianBackground(small)).moved;
  small.length = 0;
  check();

  // Schwellwert und Maskenueberlagerung am mittleren ausgewaehlten Bild
  let threshold = s.compose.threshold;
  let maskOverlay: RGBAImage | null = null;
  if (threshold < 0 || o.showMask) {
    const mid = await readOne(indices[Math.floor(indices.length / 2)], o.maxSize);
    if (threshold < 0) threshold = autoThreshold(mid, bg);
    if (o.showMask) {
      const mask = motionMask(mid, bg, threshold, s.compose.featherPx, s.compose.region);
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
  const comp = createCompositor(bg, { ...s.compose, threshold }, total);
  let done = 0;
  for await (const f of guarded(src.readFrames(indices, { maxSize: o.maxSize }))) {
    comp.add(f.image, done);
    done++;
    o.onProgress(done, total);
  }
  check();
  return { image: comp.result(), maskOverlay, positions: total, cameraMoved, autoThreshold: threshold, width, height };
}
