export interface GopSample {
  isKey: boolean;
  timestampUs: number;
}

/** Letzter Sync-Sample mit Dekodierindex <= pos und pts <= ptsUs (vermeidet fuehrende RASL-Bilder). */
export function keyframeFor(samples: readonly GopSample[], pos: number, ptsUs: number): number {
  let i = pos;
  while (i > 0 && !(samples[i].isKey && samples[i].timestampUs <= ptsUs)) i--;
  return i;
}

/**
 * Muss der Decoder neu gestartet werden? Ja, wenn das Bild schon ausgegeben wurde oder der noetige Keyframe
 * vor dem Beginn des laufenden Dekodierlaufs liegt (next < 0 = kein Lauf aktiv).
 */
export function needsRestart(emitted: boolean, next: number, runStart: number, kf: number): boolean {
  return emitted || (next >= 0 && kf < runStart);
}
