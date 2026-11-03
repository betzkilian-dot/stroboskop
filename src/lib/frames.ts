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
