import type { VideoInfo } from '../types';
import type { FrameSelection } from '../frames';
import type { ComposeOptions } from '../compose/compositor';
import type { FrameCandidates } from '../measure/detect';
import type { VideoErrorCode } from '../video/demux';

/** Rechenschritt eines Renders (fuer die Fortschrittsanzeige) */
export type RenderStage = 'open' | 'background' | 'motion' | 'compose';

export interface RenderSettings {
  selection: FrameSelection;
  compose: ComposeOptions;
  captureFps: number;
}

/** Schluessel der Einstellungen ohne Schwelle (Auto-Schwelle gehoert zum Schluessel). */
export function settingsKey(s: RenderSettings): string {
  const { threshold: _t, ...compose } = s.compose;
  return JSON.stringify([s.selection, compose, s.captureFps]);
}

export interface RenderResult {
  image: ImageBitmap;
  maskOverlay: ImageBitmap | null;
  positions: number;
  /** Bewegungs-Kandidaten je gewaehltem Bild (Video-Pixel), Zeitreihenfolge */
  detections: FrameCandidates[];
  cameraMoved: boolean;
  autoThreshold: number;
  /** Einstellungen (ohne Schwelle), mit denen gerechnet wurde */
  settingsKey: string;
  width: number;
  height: number;
}

export type WorkerRequest =
  | { type: 'open'; id: number; file: Blob }
  | { type: 'render'; id: number; settings: RenderSettings; maxSize: number; showMask: boolean; detect?: boolean }
  | { type: 'thumbnails'; id: number; indices: number[]; maxSize: number }
  | { type: 'cancel'; id: number };

export interface WireError {
  name: string;
  message: string;
  code?: VideoErrorCode;
  /** nur bei open: WebCodecs nicht nutzbar -> Hauptthread-Rueckfall (Ruling R11) */
  noWebCodecs?: boolean;
}

export type WorkerResponse =
  | { type: 'opened'; id: number; info: VideoInfo; exact: boolean }
  | { type: 'progress'; id: number; done: number; total: number; stage: RenderStage }
  | { type: 'thumbnails'; id: number; images: ImageBitmap[] }
  | ({ type: 'result'; id: number } & RenderResult)
  | { type: 'error'; id: number; error: WireError };
