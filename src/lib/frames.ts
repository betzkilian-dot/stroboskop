import type { VideoInfo } from './types';

export interface FrameSelection {
  startIndex: number;
  endIndex: number; // inklusive
  step: number;
  excluded: number[];
}

export function selectFrameIndices(sel: FrameSelection): number[] {
  const step = Math.max(1, Math.floor(sel.step));
  const excluded = new Set(sel.excluded);
  const out: number[] = [];
  for (let i = sel.startIndex; i <= sel.endIndex; i += step) {
    if (!excluded.has(i)) out.push(i);
  }
  return out;
}

/** Zeitabstand zweier gewählter Bilder in Sekunden. */
export function deltaT(step: number, captureFps: number): number {
  return step / captureFps;
}

/** Schrittweite für gewünschtes Δt, gerundet, mindestens 1. */
export function stepForDesiredDt(dtS: number, captureFps: number): number {
  return Math.max(1, Math.round(dtS * captureFps));
}

export function isUniform(indices: number[]): boolean {
  if (indices.length <= 2) return true;
  const d = indices[1] - indices[0];
  for (let i = 2; i < indices.length; i++) {
    if (indices[i] - indices[i - 1] !== d) return false;
  }
  return true;
}

/** n gleichmaessig ueber das ganze Video verteilte Bildindizes (ohne Duplikate). */
export function thumbnailIndices(frameCount: number, n: number): number[] {
  if (frameCount <= 0 || n <= 0) return [];
  if (n === 1 || frameCount === 1) return [0];
  const out = new Set<number>();
  for (let i = 0; i < n; i++) out.add(Math.round((i * (frameCount - 1)) / (n - 1)));
  return [...out];
}

/** Praesentationszeit eines Bildes in Sekunden. */
export function frameTimeS(info: Pick<VideoInfo, 'frameTimesS' | 'nominalFps'>, index: number): number {
  return info.frameTimesS?.[index] ?? index / info.nominalFps;
}

/** Bildindex, dessen Zeit der Medienzeit am naechsten liegt (geklemmt auf [0, frameCount-1]). */
export function nearestFrameIndex(
  info: Pick<VideoInfo, 'frameTimesS' | 'nominalFps' | 'frameCount'>,
  mediaTimeS: number,
): number {
  if (!Number.isFinite(mediaTimeS)) return 0; // z. B. <video> vor den Metadaten (NaN)
  const last = Math.max(0, info.frameCount - 1);
  const t = info.frameTimesS;
  if (!t || t.length === 0) return Math.min(last, Math.max(0, Math.round(mediaTimeS * info.nominalFps)));
  let lo = 0, hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < mediaTimeS) lo = mid + 1;
    else hi = mid;
  }
  // lo = erster Index mit t >= Zeit; mit Vorgaenger vergleichen
  const best = lo > 0 && mediaTimeS - t[lo - 1] <= t[lo] - mediaTimeS ? lo - 1 : lo;
  return Math.min(last, Math.max(0, best));
}

/** Toleranz fuer Gleitkomma-Ungenauigkeit beim Vergleich von Medienzeit und Zeitstempel. */
export const FRAME_TIME_EPS_S = 1e-4;

/**
 * Bildindex des Bildes, das der Browser bei dieser Medienzeit anzeigt:
 * groesstes i mit frameTimeS(i) <= Zeit + eps (geklemmt; nicht endlich -> 0).
 */
export function displayedFrameIndex(
  info: Pick<VideoInfo, 'frameTimesS' | 'nominalFps' | 'frameCount'>,
  mediaTimeS: number,
): number {
  if (!Number.isFinite(mediaTimeS)) return 0;
  const last = Math.max(0, info.frameCount - 1);
  const x = mediaTimeS + FRAME_TIME_EPS_S;
  const t = info.frameTimesS;
  if (!t || t.length === 0) return Math.min(last, Math.max(0, Math.floor(x * info.nominalFps)));
  // erster Index mit t > x, minus 1
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(last, Math.max(0, lo - 1));
}

/**
 * Versatz beim Springen auf ein Bild: Das Element wird etwas hinter den Zeitstempel gesetzt,
 * damit Safari sicher innerhalb des Bildes landet (min(1 ms, 1/4 Bilddauer)).
 */
export function frameSeekOffsetS(fps: number): number {
  return Number.isFinite(fps) && fps > 0 ? Math.min(0.001, 0.25 / fps) : 0.001;
}

const usable = (d: number) => Number.isFinite(d) && d > 0;

/** Player-Zeit (evtl. gestreckt, z. B. Zeitlupe) -> Medienzeit. */
export function playerToMediaTime(playerTimeS: number, playerDurationS: number, mediaDurationS: number): number {
  return usable(playerDurationS) ? (playerTimeS * mediaDurationS) / playerDurationS : playerTimeS;
}

/** Medienzeit -> Player-Zeit (Umkehrung). */
export function mediaToPlayerTime(mediaTimeS: number, playerDurationS: number, mediaDurationS: number): number {
  return usable(playerDurationS) && usable(mediaDurationS) ? (mediaTimeS * playerDurationS) / mediaDurationS : mediaTimeS;
}

/** Neuer Bereichsanfang; liegt er hinter dem Ende, rutscht das Ende ans Videoende. */
export function setRangeStart(
  sel: FrameSelection,
  index: number,
  frameCount: number,
): Pick<FrameSelection, 'startIndex' | 'endIndex'> {
  const last = frameCount - 1;
  if (index < sel.endIndex) return { startIndex: Math.max(0, index), endIndex: sel.endIndex };
  return { startIndex: Math.min(index, Math.max(0, last - 1)), endIndex: last };
}

/** Neues Bereichsende; liegt es vor dem Anfang, rutscht der Anfang ans Videoanfang. */
export function setRangeEnd(
  sel: FrameSelection,
  index: number,
  frameCount: number,
): Pick<FrameSelection, 'startIndex' | 'endIndex'> {
  const last = frameCount - 1;
  if (index > sel.startIndex) return { startIndex: sel.startIndex, endIndex: Math.min(index, last) };
  return { startIndex: 0, endIndex: Math.max(1, index) };
}

/** Ziehen der Anfangsmarkierung: naechstes Bild zur Zeit `t`, aber mindestens ein Bild vor dem Ende. */
export function dragStartIndex(info: Parameters<typeof nearestFrameIndex>[0], t: number, endIndex: number): number {
  return Math.min(nearestFrameIndex(info, t), endIndex - 1);
}

/** Ziehen der Endmarkierung: naechstes Bild zur Zeit `t`, aber mindestens ein Bild nach dem Anfang. */
export function dragEndIndex(info: Parameters<typeof nearestFrameIndex>[0], t: number, startIndex: number): number {
  return Math.max(nearestFrameIndex(info, t), startIndex + 1);
}
