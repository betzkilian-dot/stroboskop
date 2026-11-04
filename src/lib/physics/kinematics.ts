// Kinematik: Maßstab, Achsen, Geschwindigkeit/Beschleunigung, Pfeile.
// Bildkoordinaten: Video-Pixel, y wächst nach unten. Zeiten in Sekunden, Weltwerte in Metern.

export type Pt = { x: number; y: number };
export type Unit = 'mm' | 'cm' | 'm';

export function toMeters(v: number, u: Unit): number {
  return u === 'mm' ? v / 1000 : u === 'cm' ? v / 100 : v;
}

export interface Calibration { a: Pt; b: Pt; length: number; unit: Unit }
/** angle: Drehung der x-Achse in Rad, positiv = im Bild gegen den Uhrzeigersinn. */
export interface Axes { origin: Pt | null; angle: number; yUp: boolean; dims: 'xy' | 'x' | 'y' }

/** Meter je Pixel; null bei zu kurzer Strecke (< 4 px) oder ungültiger Länge. */
export function metersPerPixel(c: Calibration | null): number | null {
  if (!c) return null;
  const d = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
  if (!Number.isFinite(d) || d < 4) return null;
  if (!Number.isFinite(c.length) || c.length <= 0) return null;
  const m = toMeters(c.length, c.unit) / d;
  return Number.isFinite(m) && m > 0 ? m : null;
}

export interface SamplePoint { nr: number; frame: number; t: number; px: Pt }
export interface Row {
  nr: number; frame: number; t: number;
  x: number | null; y: number | null; s: number | null;
  vx: number | null; vy: number | null; v: number | null;
  ax: number | null; ay: number | null; a: number | null;
}

/** Bildpunkt -> Weltkoordinaten (Meter) relativ zum Ursprung. */
export function toWorld(p: Pt, origin: Pt, c: Calibration, axes: Axes): Pt {
  const mpp = metersPerPixel(c);
  if (mpp === null) return { x: NaN, y: NaN };
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  // Mathematische Koordinaten (y nach oben), dann Drehung um −angle
  const mx = dx, my = -dy;
  const cos = Math.cos(axes.angle), sin = Math.sin(axes.angle);
  const x = mx * cos + my * sin;
  const y = -mx * sin + my * cos;
  return { x: x * mpp, y: (axes.yUp ? y : -y) * mpp };
}

const consecutive = (a: SamplePoint, b: SamplePoint) => b.nr === a.nr + 1;

export function computeRows(samples: SamplePoint[], origin: Pt, c: Calibration | null, axes: Axes): Row[] {
  const valid = metersPerPixel(c) !== null;
  const w = samples.map((p) => (valid ? toWorld(p.px, origin, c as Calibration, axes) : null));
  const n = samples.length;
  // Geschwindigkeit der Zeile i: aus Nachbar i+1 (nur wenn nr direkt folgt)
  const vel: ({ x: number; y: number } | null)[] = samples.map((p, i) => {
    const wi = w[i];
    const wn = w[i + 1];
    if (!wi || !wn || i + 1 >= n || !consecutive(p, samples[i + 1])) return null;
    const dt = samples[i + 1].t - p.t;
    if (!(dt > 0)) return null;
    return { x: (wn.x - wi.x) / dt, y: (wn.y - wi.y) / dt };
  });
  let s = 0;
  return samples.map((p, i) => {
    const wi = w[i];
    if (!wi) {
      return { nr: p.nr, frame: p.frame, t: p.t, x: null, y: null, s: null, vx: null, vy: null, v: null, ax: null, ay: null, a: null };
    }
    const prev = w[i - 1];
    if (i > 0 && prev) s += Math.hypot(wi.x - prev.x, wi.y - prev.y);
    const v = vel[i];
    const vn = vel[i + 1];
    let ax: number | null = null;
    let ay: number | null = null;
    if (v && vn && i + 2 < n) {
      const denom = (samples[i + 2].t - p.t) / 2;
      if (denom > 0) {
        ax = (vn.x - v.x) / denom;
        ay = (vn.y - v.y) / denom;
      }
    }
    return {
      nr: p.nr, frame: p.frame, t: p.t, x: wi.x, y: wi.y, s,
      vx: v ? v.x : null, vy: v ? v.y : null, v: v ? Math.hypot(v.x, v.y) : null,
      ax, ay, a: ax !== null && ay !== null ? Math.hypot(ax, ay) : null,
    };
  });
}

export interface Arrow { from: Pt; to: Pt }
export type ArrowPos = 'start' | 'mid' | 'end';

// Geschwindigkeiten in px/s je Segment i -> i+1 (nur direkt aufeinanderfolgende Nummern)
function pxVelocities(samples: SamplePoint[]): ({ x: number; y: number } | null)[] {
  return samples.map((p, i) => {
    const q = samples[i + 1];
    if (!q || !consecutive(p, q)) return null;
    const dt = q.t - p.t;
    if (!(dt > 0)) return null;
    return { x: (q.px.x - p.px.x) / dt, y: (q.px.y - p.px.y) / dt };
  });
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function velocityArrows(samples: SamplePoint[], pos: ArrowPos, scaleS: number): Arrow[] {
  const v = pxVelocities(samples);
  const out: Arrow[] = [];
  v.forEach((vi, i) => {
    if (!vi) return;
    const p = samples[i].px;
    const q = samples[i + 1].px;
    const from = pos === 'start' ? p : pos === 'mid' ? mid(p, q) : q;
    out.push({ from: { ...from }, to: { x: from.x + vi.x * scaleS, y: from.y + vi.y * scaleS } });
  });
  return out;
}

// Beschleunigung in px/s² je Dreiergruppe i, i+1, i+2
function pxAccels(samples: SamplePoint[]): { i: number; x: number; y: number }[] {
  const v = pxVelocities(samples);
  const out: { i: number; x: number; y: number }[] = [];
  for (let i = 0; i + 2 < samples.length; i++) {
    const v0 = v[i];
    const v1 = v[i + 1];
    if (!v0 || !v1) continue;
    const denom = (samples[i + 2].t - samples[i].t) / 2;
    if (!(denom > 0)) continue;
    out.push({ i, x: (v1.x - v0.x) / denom, y: (v1.y - v0.y) / denom });
  }
  return out;
}

export function accelArrows(samples: SamplePoint[], pos: ArrowPos, scaleS2: number): Arrow[] {
  return pxAccels(samples).map(({ i, x, y }) => {
    // wie bei v im Intervall i: Anfang = P_i, Mitte = Mitte P_i/P_i+1, Ende = P_i+1
    const p0 = samples[i].px;
    const p1 = samples[i + 1].px;
    const from = pos === 'start' ? p0 : pos === 'mid' ? mid(p0, p1) : p1;
    return { from: { ...from }, to: { x: from.x + x * scaleS2, y: from.y + y * scaleS2 } };
  });
}

export function maxSpeedPx(samples: SamplePoint[]): number {
  let m = 0;
  for (const v of pxVelocities(samples)) if (v) m = Math.max(m, Math.hypot(v.x, v.y));
  return m;
}

export function maxAccelPx(samples: SamplePoint[]): number {
  let m = 0;
  for (const a of pxAccels(samples)) m = Math.max(m, Math.hypot(a.x, a.y));
  return m;
}

/** Größter Wert aus {1,2,5}·10^k, der ≤ x ist; x ≤ 0 -> 0. */
export function niceNumber(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 0;
  const k = Math.floor(Math.log10(x));
  const base = Math.pow(10, k);
  const m = x / base;
  const f = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return f * base;
}

/** Pfeilmaßstab L (s bzw. s²): Pfeil in Pixeln = Rate_px · L; größter Pfeil ≈ 18 % der langen Bildkante. */
export function autoArrowScale(maxPxRate: number, imageLongEdgePx: number): number {
  if (!(maxPxRate > 0)) return 0;
  return niceNumber((0.18 * imageLongEdgePx) / maxPxRate);
}
