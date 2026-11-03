import type { VideoInfo } from '../types';
import type { FrameSelection } from '../frames';
import type { ComposeOptions } from '../compose/compositor';
import type { VideoErrorCode } from '../video/demux';

export interface RenderSettings {
  selection: FrameSelection;
  compose: ComposeOptions;
  captureFps: number;
}

export interface RenderResult {
  image: ImageBitmap;
  maskOverlay: ImageBitmap | null;
  positions: number;
  cameraMoved: boolean;
  autoThreshold: number;
  width: number;
  height: number;
}

export type WorkerRequest =
  | { type: 'open'; id: number; file: Blob }
  | { type: 'render'; id: number; settings: RenderSettings; maxSize: number; showMask: boolean }
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
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'thumbnails'; id: number; images: ImageBitmap[] }
  | ({ type: 'result'; id: number } & RenderResult)
  | { type: 'error'; id: number; error: WireError };
