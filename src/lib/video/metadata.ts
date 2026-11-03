export interface TrackTiming {
  timescale: number;
  sampleDurations: number[];
  mediaDuration: number;
  editDuration?: number;
  movieTimescale?: number;
}

export interface FpsInfo {
  nominalFps: number;
  captureFps: number;
  fpsCertain: boolean;
  slowMotion: boolean;
}

const STANDARD_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120, 240, 480, 960, 1000];

/** Rastet auf gaengige Bildraten ein (max. 1 % Abweichung), sonst auf 2 Nachkommastellen gerundet. */
export function snapFps(raw: number): number {
  let best = raw;
  let bestDev = Infinity;
  for (const s of STANDARD_FPS) {
    const dev = Math.abs(raw - s) / s;
    if (dev <= 0.01 && dev < bestDev) {
      best = s;
      bestDev = dev;
    }
  }
  return bestDev === Infinity ? Math.round(raw * 100) / 100 : best;
}

export function detectFps(t: TrackTiming): FpsInfo {
  const n = t.sampleDurations.length;
  const mediaS = t.mediaDuration / t.timescale;
  const nominalFps = snapFps(n / mediaS);

  const mean = t.sampleDurations.reduce((a, b) => a + b, 0) / n;
  const variance = t.sampleDurations.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const fpsCertain = mean > 0 && Math.sqrt(variance) / mean <= 0.05;

  let slowMotion = false;
  if (t.editDuration !== undefined && t.movieTimescale) {
    slowMotion = t.editDuration / t.movieTimescale > 1.5 * mediaS;
  }
  // Bei Zeitlupe ist die Sample-Rate die Aufnahmerate; sie entspricht nominalFps.
  return { nominalFps, captureFps: nominalFps, fpsCertain, slowMotion };
}

/** Dreht die ISO-BMFF-Matrix (16.16 Fixpunkt, zeilenweise a b u c d v x y w) in Grad. */
export function rotationFromMatrix(m: ArrayLike<number>): 0 | 90 | 180 | 270 {
  const a = m[0];
  const b = m[1];
  const angle = ((Math.round((Math.atan2(b, a) * 180) / Math.PI / 90) * 90) % 360 + 360) % 360;
  return angle as 0 | 90 | 180 | 270;
}
