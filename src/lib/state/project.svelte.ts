import { createStrobeEngine, type RenderResult, type StrobeEngine } from '../engine/engine';
import { stepForDesiredDt, type FrameSelection } from '../frames';
import type { ComposeOptions } from '../compose/compositor';
import type { VideoInfo } from '../types';
import { VideoError } from '../video/demux';

export const ERROR_TEXTS = {
  'unsupported-format': 'Dieses Video kann nicht gelesen werden. Bitte als MP4 oder MOV speichern.',
  'no-video-track': 'Die Datei enthält kein Video.',
  'decode-failed': 'Das Video konnte nicht dekodiert werden.',
} as const;

export const PREVIEW_DEBOUNCE_MS = 120;
export const PREVIEW_MAX_SIZE = 1280;

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function errorText(e: unknown): string {
  if (e instanceof VideoError && e.code in ERROR_TEXTS) return ERROR_TEXTS[e.code];
  return ERROR_TEXTS['decode-failed'];
}

const defaultCompose = (): ComposeOptions => ({
  mode: 'difference',
  threshold: -1,
  featherPx: 1,
  region: null,
  fade: 0,
  latestOnTop: true,
  background: 'median',
});

export class Project {
  file = $state.raw<Blob | null>(null);
  name = $state('');
  info = $state.raw<VideoInfo | null>(null);
  exact = $state(true);
  captureFpsOverride = $state<number | null>(null);
  selection = $state<FrameSelection>({ startIndex: 0, endIndex: 0, step: 1, excluded: [] });
  compose = $state<ComposeOptions>(defaultCompose());
  crop = $state<CropRect | null>(null);
  rotation = $state<0 | 90 | 180 | 270>(0);
  showMask = $state(false);
  preview = $state.raw<RenderResult | null>(null);
  rendering = $state(false);
  progress = $state(0);
  error = $state<string | null>(null);

  #engine: StrobeEngine;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #seq = 0;

  constructor(engine?: StrobeEngine) {
    this.#engine = engine ?? createStrobeEngine();
    this.#engine.onProgress((done, total) => {
      this.progress = total > 0 ? done / total : 0;
    });
  }

  get captureFps(): number {
    return this.captureFpsOverride ?? this.info?.captureFps ?? 30;
  }

  async load(file: Blob): Promise<void> {
    clearTimeout(this.#timer);
    this.error = null;
    try {
      const { info, exact } = await this.#engine.open(file);
      this.#closePreview();
      this.file = file;
      this.name = file instanceof File ? file.name : 'Video';
      this.info = info;
      this.exact = exact;
      this.captureFpsOverride = null;
      this.selection = {
        startIndex: 0,
        endIndex: Math.max(0, info.frameCount - 1),
        step: stepForDesiredDt(0.1, info.captureFps),
        excluded: [],
      };
      this.compose = defaultCompose();
      this.crop = null;
      this.rotation = 0;
      this.showMask = false;
    } catch (e) {
      this.error = errorText(e);
      return;
    }
    this.requestPreview();
  }

  requestPreview(): void {
    if (!this.info) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#render(), PREVIEW_DEBOUNCE_MS);
  }

  async #render(): Promise<void> {
    const seq = ++this.#seq;
    this.rendering = true;
    this.progress = 0;
    try {
      const r = await this.#engine.render(
        {
          selection: $state.snapshot(this.selection),
          compose: $state.snapshot(this.compose),
          captureFps: this.captureFps,
        },
        { maxSize: PREVIEW_MAX_SIZE, showMask: this.showMask },
      );
      if (r === 'superseded') return;
      if (seq !== this.#seq) {
        r.image.close();
        r.maskOverlay?.close();
        return;
      }
      this.#closePreview();
      this.preview = r;
      this.error = null;
    } catch (e) {
      if (seq === this.#seq) this.error = errorText(e);
    } finally {
      if (seq === this.#seq) {
        this.rendering = false;
        this.progress = 1;
      }
    }
  }

  #closePreview(): void {
    this.preview?.image.close();
    this.preview?.maskOverlay?.close();
    this.preview = null;
  }

  dispose(): void {
    clearTimeout(this.#timer);
    this.#engine.dispose();
    this.#closePreview();
  }
}
