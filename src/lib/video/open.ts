import type { FrameSource } from '../types';
import { demux } from './demux';
import { createElementSource } from './element-source';
import { createWebCodecsSource } from './webcodecs-source';

export type { FrameSource } from '../types';

/** WebCodecs (bildgenau), falls vorhanden und die Konfiguration unterstuetzt wird, sonst <video>-Rueckfall. */
export async function openFrameSource(file: Blob): Promise<FrameSource> {
  const track = await demux(file);
  if (typeof VideoDecoder !== 'undefined') {
    try {
      const support = await VideoDecoder.isConfigSupported(track.config);
      if (support.supported) return createWebCodecsSource(track);
    } catch {
      // unbekannte Konfiguration -> Rueckfall
    }
  }
  return createElementSource(file, track);
}

/** Erzwingt die Element-Quelle (Tests, Rueckfall). Nur im Hauptthread. */
export async function openElementSource(file: Blob): Promise<FrameSource> {
  const track = await demux(file);
  return createElementSource(file, track);
}
