import { createStrobeEngine, type RenderResult, type RenderSettings, type StrobeEngine } from '../engine/engine';
import { selectFrameIndices, stepForDesiredDt, thumbnailIndices, type FrameSelection } from '../frames';
import type { ComposeOptions } from '../compose/compositor';
import type { VideoInfo } from '../types';
import { VideoError } from '../video/demux';

export const ERROR_TEXTS = {
  'unsupported-format': 'Dieses Video kann nicht gelesen werden. Bitte als MP4 oder MOV speichern.',
  'no-video-track': 'Die Datei enthält kein Video.',
  'decode-failed': 'Das Video konnte nicht dekodiert werden.',
} as const;

export const SELECTION_ERROR = 'Für ein Stroboskopbild werden mindestens 2 Positionen benötigt.';
export const PREVIEW_DEBOUNCE_MS = 120;
export const PREVIEW_MAX_SIZE = 1280;
export const POSITION_THUMBS_DEBOUNCE_MS = 200;
/** R18: Miniaturen der Positionsleiste nur bis zu dieser Anzahl dekodieren. */
export const MAX_POSITION_THUMBS = 60;

/** Ausschnitt in VIDEO-Pixeln (Anzeigeorientierung, info.width x info.height); der Viewer skaliert auf die Vorschau. */
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
  thumbs = $state.raw<ImageBitmap[]>([]);
  /** Miniaturen der Positionen (positionIndices, in gleicher Reihenfolge) */
  positionThumbs = $state.raw<ImageBitmap[]>([]);
  /** Indizes (kommagetrennt), zu denen positionThumbs gehoeren */
  positionThumbsKey = $state('');
  preview = $state.raw<RenderResult | null>(null);
  rendering = $state(false);
  progress = $state(0);
  error = $state<string | null>(null);

  #exporting = $state(false);
  #pendingPreview = false;
  #engine: StrobeEngine;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #seq = 0;
  #loadSeq = 0;
  #posTimer: ReturnType<typeof setTimeout> | undefined;
  #posSeq = 0;
  #posInflight = false;

  constructor(engine?: StrobeEngine) {
    this.#engine = engine ?? createStrobeEngine();
    this.#engine.onProgress((done, total) => {
      this.progress = total > 0 ? done / total : 0;
    });
  }

  /** R19: Export-Render teilt sich die Engine mit der Vorschau; waehrenddessen werden Vorschauen nur vorgemerkt. */
  get exporting(): boolean {
    return this.#exporting;
  }
  set exporting(v: boolean) {
    if (v === this.#exporting) return;
    this.#exporting = v;
    if (v) {
      if (this.#timer !== undefined) this.#pendingPreview = true;
      clearTimeout(this.#timer);
      this.#timer = undefined;
    } else if (this.#pendingPreview) {
      this.#pendingPreview = false;
      this.requestPreview(true);
    }
  }

  /** Engine-Zugriff fuer den Export (gleiche Instanz wie die Vorschau, siehe R19). */
  get engine(): StrobeEngine {
    return this.#engine;
  }

  /** Render-Einstellungen als reine Kopie (fuer Vorschau und Export). */
  renderSettings(): RenderSettings {
    return {
      selection: $state.snapshot(this.selection),
      compose: $state.snapshot(this.compose),
      captureFps: this.captureFps,
    };
  }

  get positionsCount(): number {
    return selectFrameIndices(this.selection).length;
  }

  /** Gewaehlte Bildindizes OHNE Ausschluesse (ausgeschlossene bleiben in der Positionsleiste sichtbar). */
  get positionIndices(): number[] {
    return selectFrameIndices({ ...this.selection, excluded: [] });
  }

  get selectionError(): string | null {
    return this.info && this.positionsCount < 2 ? SELECTION_ERROR : null;
  }

  get captureFps(): number {
    return this.captureFpsOverride ?? this.info?.captureFps ?? 30;
  }

  async load(file: Blob): Promise<void> {
    clearTimeout(this.#timer);
    const seq = ++this.#loadSeq;
    this.error = null;
    const previous = this.file;
    try {
      const { info, exact } = await this.#engine.open(file);
      if (seq !== this.#loadSeq) return; // ueberholt: nur das neueste load() gilt
      this.#closePreview();
      this.#closeThumbs();
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
      if (seq !== this.#loadSeq) return;
      const message = errorText(e);
      if (previous) {
        // engine.open hat die alte Quelle schon verworfen: vorheriges Projekt wiederherstellen (R13)
        try {
          await this.#engine.open(previous);
          if (seq !== this.#loadSeq) return;
          this.error = message;
          this.requestPreview(true);
          return;
        } catch {
          if (seq !== this.#loadSeq) return;
          this.#closePreview();
          this.info = null;
          this.file = null;
          this.rendering = false;
        }
      }
      this.error = message;
      return;
    }
    this.requestPreview(true);
    if (this.info) {
      void this.#loadThumbs(seq, this.info);
      this.requestPositionThumbs();
    }
  }

  async #loadThumbs(seq: number, info: VideoInfo): Promise<void> {
    try {
      const t = await this.#engine.thumbnails(thumbnailIndices(info.frameCount, 8), 96);
      if (seq !== this.#loadSeq) t.forEach((b) => b.close());
      else this.thumbs = t;
    } catch (e) {
      console.warn('Miniaturen konnten nicht geladen werden', e); // nur Beiwerk
    }
  }

  /** Laedt die Miniaturen der Positionsleiste entprellt neu (Aufrufer nach Aenderung von Auswahl/Schritt). */
  requestPositionThumbs(): void {
    if (!this.info) return;
    clearTimeout(this.#posTimer);
    const seq = ++this.#posSeq;
    const loadSeq = this.#loadSeq;
    this.#posTimer = setTimeout(async () => {
      const indices = this.positionIndices;
      if (indices.length > MAX_POSITION_THUMBS) {
        // zu viele: keine Miniaturen (nur Nummern); eine laufende Dekodierung ueber eine leere Anfrage verdraengen
        this.positionThumbs.forEach((x) => x.close());
        this.positionThumbs = [];
        if (this.#posInflight) {
          this.#posInflight = false;
          void this.#engine.thumbnails([], 96).catch(() => {});
        }
        return;
      }
      this.#posInflight = true;
      try {
        const t = await this.#engine.thumbnails(indices, 96);
        if (seq !== this.#posSeq || loadSeq !== this.#loadSeq || t.length !== indices.length) {
          t.forEach((x) => x.close());
          return;
        }
        this.#posInflight = false;
        this.positionThumbs.forEach((x) => x.close());
        this.positionThumbs = t;
        this.positionThumbsKey = indices.join(',');
      } catch (e) {
        console.warn('Positions-Miniaturen konnten nicht geladen werden', e);
      }
    }, POSITION_THUMBS_DEBOUNCE_MS);
  }

  /** Einziger Weg fuer Aenderungen an Bereich/Schritt/Ausschluessen: stoesst Vorschau und (wenn noetig) Positionsleiste an. */
  setSelection(partial: Partial<FrameSelection>): void {
    const before = this.positionIndices.join(',');
    Object.assign(this.selection, partial);
    this.requestPreview();
    if (this.positionIndices.join(',') !== before) this.requestPositionThumbs();
  }

  #closeThumbs(): void {
    clearTimeout(this.#posTimer);
    this.#posSeq++;
    this.thumbs.forEach((b) => b.close());
    this.thumbs = [];
    this.positionThumbs.forEach((b) => b.close());
    this.positionThumbs = [];
    this.positionThumbsKey = '';
  }

  /**
   * Plant eine Vorschau (entprellt 120 ms; immediate = sofort). Aufrufer muessen das nach jeder
   * Aenderung an selection/compose/showMask/captureFpsOverride selbst tun (bewusst kein $effect).
   */
  requestPreview(immediate = false): void {
    if (!this.info) return;
    if (this.#exporting) {
      this.#pendingPreview = true;
      return;
    }
    clearTimeout(this.#timer);
    if (this.selectionError) {
      this.#seq++; // laufende Vorschau verwerfen
      this.#closePreview();
      this.rendering = false;
      return;
    }
    if (immediate) void this.#render();
    else this.#timer = setTimeout(() => void this.#render(), PREVIEW_DEBOUNCE_MS);
  }

  /** "Auto": Schwelle automatisch ermitteln lassen und danach als konkreten Wert uebernehmen. */
  async autoThreshold(): Promise<void> {
    if (!this.info || this.selectionError) return;
    clearTimeout(this.#timer);
    const before = this.preview;
    this.compose.threshold = -1;
    await this.#render();
    if (this.preview && this.preview !== before && this.compose.threshold < 0)
      this.compose.threshold = this.preview.autoThreshold;
  }

  async #render(): Promise<void> {
    const seq = ++this.#seq;
    this.rendering = true;
    this.progress = 0;
    try {
      const r = await this.#engine.render(
        this.renderSettings(),
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
    this.#loadSeq++;
    clearTimeout(this.#timer);
    this.#engine.dispose();
    this.#closePreview();
    this.#closeThumbs();
  }
}
