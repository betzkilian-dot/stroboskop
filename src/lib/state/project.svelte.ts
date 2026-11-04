import { createStrobeEngine, type RenderResult, type RenderSettings, type RenderStage, type StrobeEngine } from '../engine/engine';
import { selectFrameIndices, stepForDesiredDt, thumbnailIndices, type FrameSelection } from '../frames';
import type { ComposeOptions } from '../compose/compositor';
import type { VideoInfo } from '../types';
import { VideoError } from '../video/demux';
import { settingsKey } from '../engine/protocol';
import { activeObject, createMeasurement, type Measurement } from '../measure/model';
import { assignTrack } from '../measure/detect';
import { metersPerPixel, type Pt } from '../physics/kinematics';

export const ERROR_TEXTS = {
  'unsupported-format': 'Dieses Video kann nicht gelesen werden. Bitte als MP4 oder MOV speichern.',
  'no-video-track': 'Die Datei enthält kein Video.',
  'decode-failed': 'Das Video konnte nicht dekodiert werden.',
} as const;

export const FPS_UNCERTAIN_TEXT = 'Bildrate nicht eindeutig – bitte Aufnahme-fps prüfen.';
export const LOADING_TEXT = 'Video wird geladen…';
export const BUSY_TEXT = {
  open: 'Video wird geöffnet …',
  preview: 'Bild wird berechnet …',
  export: 'Export wird erstellt …',
} as const;
export const STAGE_TEXT: Record<RenderStage, string> = {
  open: 'Video lesen',
  background: 'Hintergrund ermitteln',
  motion: 'Kamerabewegung prüfen',
  compose: 'Bild zusammensetzen',
};
export const SELECTION_ERROR = 'Für ein Stroboskopbild werden mindestens 2 Positionen benötigt.';
export const PREVIEW_DEBOUNCE_MS = 120;
export const PREVIEW_MAX_SIZE = 1280;
export const POSITION_THUMBS_DEBOUNCE_MS = 200;
/** R18: Miniaturen der Positionsleiste nur bis zu dieser Anzahl dekodieren. */
export const MAX_POSITION_THUMBS = 60;
/** Miniaturen der Zeitleiste (Phase Video) */
export const TIMELINE_THUMBS = 12;
/** Groesse des Standbilds fuer den Zuschnitt in der Phase Video */
export const FRAME_IMAGE_SIZE = 1280;

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
  /** Object-URL von file fuer den Player (Phase Video); wird beim Laden ersetzt und in dispose freigegeben */
  videoUrl = $state<string | null>(null);
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
  /** aktueller Rechenschritt; null, wenn nichts laeuft */
  stage = $state<RenderStage | null>(null);
  error = $state<string | null>(null);
  /** true, solange ein Video geoeffnet wird (load() laeuft) */
  loading = $state(false);
  /** Messung (Maßstab, Objekte, Punkte); wird mit jedem neuen Video zurückgesetzt */
  measure = $state<Measurement>(createMeasurement());
  /** true, solange "Vorschlagen" auf Vorschau/Zuordnung wartet */
  suggesting = $state(false);

  #exporting = $state(false);
  #pendingPreview = false;
  #engine: StrobeEngine;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #seq = 0;
  #loadSeq = 0;
  #posTimer: ReturnType<typeof setTimeout> | undefined;
  #posSeq = 0;
  #posInflight = false;
  /** laufende Anfrage der Zeitleisten-Miniaturen (Kanal 'trim'); frameImage wartet darauf */
  #thumbsP: Promise<void> | null = null;

  constructor(engine?: StrobeEngine) {
    this.#engine = engine ?? createStrobeEngine();
    this.#engine.onProgress((done, total, stage) => {
      this.progress = total > 0 ? done / total : 0;
      this.stage = stage;
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
      this.progress = 0; // Fortschritt der vorigen Berechnung (100 %) nicht aufblitzen lassen
      if (this.#timer !== undefined) this.#pendingPreview = true;
      if (this.rendering) {
        // laufende Vorschau wird vom Export verdraengt: verwerfen, nach dem Export einmal neu rendern
        this.#pendingPreview = true;
        this.#seq++;
        this.rendering = false;
        this.stage = null;
      }
      clearTimeout(this.#timer);
      this.#timer = undefined;
    } else {
      this.stage = null; // Export-Render hat stage gesetzt; nichts laeuft mehr
      if (this.#pendingPreview) {
        this.#pendingPreview = false;
        this.requestPreview(true);
      }
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

  /** Bildindizes der Messpositionen (gewählt, ohne Ausschlüsse), in Zeitreihenfolge. */
  get measureIndices(): number[] {
    return selectFrameIndices(this.selection);
  }

  get metersPerPixel(): number | null {
    return metersPerPixel(this.measure.calibration);
  }

  setPoint(nr: number, p: Pt): void {
    const f = this.measureIndices[nr];
    if (f === undefined) return;
    activeObject(this.measure).points[f] = { x: p.x, y: p.y, unsure: false };
  }

  deletePoint(nr: number): void {
    const f = this.measureIndices[nr];
    if (f === undefined) return;
    delete activeObject(this.measure).points[f];
  }

  clearPoints(): void {
    activeObject(this.measure).points = {};
  }

  /** Schlägt Positionen für das aktive Objekt aus den Bewegungs-Kandidaten der Vorschau vor. */
  async suggestPositions(): Promise<void> {
    if (!this.info || this.suggesting) return;
    const loadSeq = this.#loadSeq;
    this.suggesting = true;
    try {
      let preview: RenderResult | null = null;
      for (let i = 0; i < 4; i++) {
        if (loadSeq !== this.#loadSeq || this.selectionError) return;
        if (this.rendering) {
          await this.#waitRenderIdle();
          continue;
        }
        const p = this.preview;
        if (p && p.settingsKey === settingsKey(this.renderSettings())) {
          preview = p;
          break;
        }
        clearTimeout(this.#timer);
        await this.#render();
      }
      if (!preview || loadSeq !== this.#loadSeq || !this.info) return;
      const wanted = new Set(this.measureIndices);
      const frames = preview.detections.filter((d) => wanted.has(d.index));
      const active = activeObject(this.measure);
      const taken: Record<number, Pt[]> = {};
      for (const o of this.measure.objects) {
        if (o.id === active.id) continue;
        for (const [k, pt] of Object.entries(o.points)) {
          if (!pt.unsure) (taken[Number(k)] ??= []).push({ x: pt.x, y: pt.y });
        }
      }
      const result = assignTrack(
        frames,
        $state.snapshot(active.points),
        taken,
        Math.max(this.info.width, this.info.height),
      );
      Object.assign(active.points, result);
    } finally {
      this.suggesting = false;
    }
  }

  async #waitRenderIdle(): Promise<void> {
    while (this.rendering) await new Promise((r) => setTimeout(r, 20));
  }

  get selectionError(): string | null {
    return this.info && this.positionsCount < 2 ? SELECTION_ERROR : null;
  }

  get captureFps(): number {
    return this.captureFpsOverride ?? this.info?.captureFps ?? 30;
  }

  async load(file: Blob): Promise<void> {
    const seq = ++this.#loadSeq;
    this.loading = true;
    this.stage = 'open';
    try {
      await this.#load(file, seq);
    } finally {
      if (seq === this.#loadSeq) {
        this.loading = false;
        if (!this.rendering) this.stage = null;
      }
    }
  }

  async #load(file: Blob, seq: number): Promise<void> {
    clearTimeout(this.#timer);
    this.error = null;
    const previous = this.file;
    try {
      const { info, exact } = await this.#engine.open(file);
      if (seq !== this.#loadSeq) return; // ueberholt: nur das neueste load() gilt
      this.#closePreview();
      this.#closeThumbs();
      this.file = file;
      this.#setVideoUrl(URL.createObjectURL(file));
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
      this.measure = createMeasurement();
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
          this.#setVideoUrl(null);
          this.rendering = false;
          this.stage = null;
        }
      }
      this.error = message;
      return;
    }
    this.requestPreview(true);
    if (this.info) {
      const p = this.#loadThumbs(seq, this.info);
      this.#thumbsP = p;
      void p.finally(() => {
        if (this.#thumbsP === p) this.#thumbsP = null;
      });
      this.requestPositionThumbs();
    }
  }

  async #loadThumbs(seq: number, info: VideoInfo): Promise<void> {
    try {
      const t = await this.#engine.thumbnails(thumbnailIndices(info.frameCount, TIMELINE_THUMBS), 96, 'trim');
      if (seq !== this.#loadSeq) t.forEach((b) => b.close());
      else this.thumbs = t;
    } catch (e) {
      console.warn('Miniaturen konnten nicht geladen werden', e); // nur Beiwerk
    }
  }

  /**
   * Einzelbild in Vorschaugroesse (Zuschnitt in der Phase Video). Teilt sich den Kanal 'trim' mit den
   * Zeitleisten-Miniaturen: wartet erst deren Anfrage ab, damit sie nicht verdraengt wird. null = verdraengt/fehlgeschlagen.
   * Der Aufrufer schliesst das Bild.
   */
  async frameImage(index: number): Promise<ImageBitmap | null> {
    if (!this.info) return null;
    const loadSeq = this.#loadSeq;
    if (this.#thumbsP) await this.#thumbsP;
    if (loadSeq !== this.#loadSeq) return null;
    const [img, ...rest] = await this.#engine.thumbnails([index], FRAME_IMAGE_SIZE, 'trim');
    rest.forEach((b) => b.close());
    if (loadSeq !== this.#loadSeq) {
      img?.close();
      return null;
    }
    return img ?? null;
  }

  #setVideoUrl(url: string | null): void {
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
    this.videoUrl = url;
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
          void this.#engine.thumbnails([], 96, 'positions').catch(() => {});
        }
        return;
      }
      this.#posInflight = true;
      try {
        const t = await this.#engine.thumbnails(indices, 96, 'positions');
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
      this.stage = null;
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
    this.stage = null;
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
        this.stage = null;
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
    this.#setVideoUrl(null);
  }
}
