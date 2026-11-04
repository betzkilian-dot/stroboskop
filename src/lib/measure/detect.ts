// Positions-Kandidaten aus der binären Bewegungsmaske (zusammenhängende Flächen) und deren
// Zuordnung zu einer Bahn über die Zeit („Vorschlagen“). Reine Funktionen; findCandidates läuft
// im Worker je Bild und ist daher iterativ und sparsam mit Speicher (Puffer werden wiederverwendet).
import type { MeasuredPoint } from './model';
import type { Pt } from '../physics/kinematics';

/** x,y in Video-Pixeln; area als Anteil 0..1 am Raster. */
export interface Candidate { x: number; y: number; area: number }
export interface FrameCandidates { index: number; candidates: Candidate[] }

export const DETECT_GRID = 320;
export const MIN_AREA = 0.0002;
export const MAX_CANDIDATES = 5;

let cellBuf = new Uint8Array(0);   // 0 = leer, 1 = Bewegung, 2 = schon gelabelt
let countBuf = new Uint32Array(0);
let stackBuf = new Int32Array(0);

function ensure(n: number): void {
  if (cellBuf.length < n) {
    cellBuf = new Uint8Array(n);
    countBuf = new Uint32Array(n);
    stackBuf = new Int32Array(n);
  }
}

export function findCandidates(mask: Float32Array, w: number, h: number, scaleToVideo: number): Candidate[] {
  const f = Math.max(1, Math.ceil(Math.max(w, h) / DETECT_GRID));
  const gw = Math.ceil(w / f);
  const gh = Math.ceil(h / f);
  const n = gw * gh;
  ensure(n);
  const cells = cellBuf, counts = countBuf, stack = stackBuf;
  counts.fill(0, 0, n);

  // Bewegungspixel je Zelle zählen.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const crow = ((y / f) | 0) * gw;
    for (let x = 0; x < w; x++) {
      if (mask[row + x] > 0.5) counts[crow + ((x / f) | 0)]++;
    }
  }
  // Zelle = Bewegung, wenn ≥ 50 % ihrer (im Bild liegenden) Pixel Bewegung sind.
  for (let cy = 0; cy < gh; cy++) {
    const ph = Math.min(f, h - cy * f);
    for (let cx = 0; cx < gw; cx++) {
      const pw = Math.min(f, w - cx * f);
      const i = cy * gw + cx;
      cells[i] = 2 * counts[i] >= pw * ph && counts[i] > 0 ? 1 : 0;
    }
  }

  const out: Candidate[] = [];
  for (let start = 0; start < n; start++) {
    if (cells[start] !== 1) continue;
    let sp = 0, size = 0, sx = 0, sy = 0;
    cells[start] = 2;
    stack[sp++] = start;
    while (sp > 0) {
      const i = stack[--sp];
      const cx = i % gw, cy = (i - cx) / gw;
      size++;
      // Zellmitte in Maskenpixeln (Randzellen können schmaler sein).
      sx += (cx * f + Math.min((cx + 1) * f, w)) / 2;
      sy += (cy * f + Math.min((cy + 1) * f, h)) / 2;
      if (cx > 0 && cells[i - 1] === 1) { cells[i - 1] = 2; stack[sp++] = i - 1; }
      if (cx < gw - 1 && cells[i + 1] === 1) { cells[i + 1] = 2; stack[sp++] = i + 1; }
      if (cy > 0 && cells[i - gw] === 1) { cells[i - gw] = 2; stack[sp++] = i - gw; }
      if (cy < gh - 1 && cells[i + gw] === 1) { cells[i + gw] = 2; stack[sp++] = i + gw; }
    }
    const area = size / n;
    if (area < MIN_AREA) continue;
    out.push({ x: (sx / size) * scaleToVideo, y: (sy / size) * scaleToVideo, area });
  }
  out.sort((a, b) => b.area - a.area);
  if (out.length > MAX_CANDIDATES) out.length = MAX_CANDIDATES;
  return out;
}

interface Anchor { index: number; x: number; y: number }

function predict(hist: Anchor[], index: number): Pt | null {
  const k = hist.length;
  if (k === 0) return null;
  const b = hist[k - 1];
  if (k === 1) return { x: b.x, y: b.y };
  const a = hist[k - 2];
  const t = (index - b.index) / (b.index - a.index);
  return { x: b.x + (b.x - a.x) * t, y: b.y + (b.y - a.y) * t };
}

function median(v: number[]): number {
  const s = [...v].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Ordnet die Kandidaten der Bilder (in Zeitreihenfolge) einer Bahn zu. Sichere vorhandene Punkte
 * bleiben stehen (Anker, nicht im Ergebnis); fehlende oder unsichere werden neu bestimmt.
 * Bilder ohne (freien) Kandidaten bekommen keinen Eintrag.
 */
export function assignTrack(
  frames: FrameCandidates[],
  existing: Record<number, MeasuredPoint>,
  taken: Record<number, Pt[]>,
  imageLongEdge: number
): Record<number, MeasuredPoint> {
  const result: Record<number, MeasuredPoint> = {};
  const chosenArea: Record<number, number> = {};
  const hist: Anchor[] = [];
  const takenR = 0.02 * imageLongEdge;
  const farR = 0.25 * imageLongEdge;

  for (const fr of frames) {
    const ex = existing[fr.index];
    if (ex && !ex.unsure) { hist.push({ index: fr.index, x: ex.x, y: ex.y }); continue; }

    const others = taken[fr.index] ?? [];
    const free = fr.candidates.filter(
      (c) => !others.some((p) => Math.hypot(c.x - p.x, c.y - p.y) <= takenR)
    );
    if (free.length === 0) continue;

    const pred = predict(hist, fr.index);
    let best: Candidate;
    let unsure = false;
    if (!pred) {
      best = free.reduce((m, c) => (c.area > m.area ? c : m));
    } else {
      let d1 = Infinity, d2 = Infinity;
      best = free[0];
      for (const c of free) {
        const d = Math.hypot(c.x - pred.x, c.y - pred.y);
        if (d < d1) { d2 = d1; d1 = d; best = c; } else if (d < d2) d2 = d;
      }
      if (d1 > farR) unsure = true;
      if (d1 > 1e-9 && d2 < 1.3 * d1) unsure = true;
    }
    result[fr.index] = { x: best.x, y: best.y, unsure };
    chosenArea[fr.index] = best.area;
    hist.push({ index: fr.index, x: best.x, y: best.y });
  }

  // Zweiter Durchgang: Flächenausreißer gegenüber dem Median der übrigen gewählten Flächen.
  const keys = Object.keys(chosenArea).map(Number);
  if (keys.length > 1) {
    for (const k of keys) {
      const m = median(keys.filter((j) => j !== k).map((j) => chosenArea[j]));
      const a = chosenArea[k];
      if (m > 0 && (a > 2.5 * m || a < m / 2.5)) result[k].unsure = true;
    }
  }
  return result;
}
