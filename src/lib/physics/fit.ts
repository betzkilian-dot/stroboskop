export type FitKind = 'none' | 'line' | 'origin' | 'parabola';

/** coef: line [m, b]; origin [m]; parabola [a, b, c] (y = a t² + b t + c). */
export interface Fit {
  kind: Exclude<FitKind, 'none'>;
  coef: number[];
  r2: number;
}

type Pt = { t: number; y: number };

/** Gauß-Elimination mit Pivotsuche; null bei (nahezu) singulärem System. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const scale = Math.max(...a.flat().map(Math.abs), 1e-300);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-12 * scale) return null;
    [a[i], a[p]] = [a[p], a[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i];
      for (let c = i; c < n; c++) a[r][c] -= f * a[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= a[i][c] * x[c];
    x[i] = s / a[i][i];
  }
  return x;
}

export function evalFit(f: Fit, t: number): number {
  if (f.kind === 'origin') return f.coef[0] * t;
  if (f.kind === 'line') return f.coef[0] * t + f.coef[1];
  return (f.coef[0] * t + f.coef[1]) * t + f.coef[2];
}

/**
 * Kleinste Quadrate. R² = 1 − SS_res/SS_tot mit SS_tot = Σ(y − ȳ)² (auch für 'origin',
 * dort ebenfalls mit dem Mittelwert von y). Ist SS_tot = 0 (alle y gleich), gilt R² = 1,
 * wenn SS_res ≈ 0, sonst 0.
 */
export function fitPoints(pts: Pt[], kind: Exclude<FitKind, 'none'>): Fit | null {
  const deg = kind === 'parabola' ? 2 : kind === 'line' ? 1 : 0;
  const need = kind === 'origin' ? 1 : deg + 1;
  if (pts.length < need) return null;

  let coef: number[] | null;
  if (kind === 'origin') {
    const stt = pts.reduce((s, p) => s + p.t * p.t, 0);
    if (stt === 0) return null;
    coef = [pts.reduce((s, p) => s + p.t * p.y, 0) / stt];
  } else {
    const n = deg + 1;
    // Potenzen t^(deg..0)
    const pw = (t: number, i: number) => t ** (deg - i);
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => pts.reduce((s, p) => s + pw(p.t, i) * pw(p.t, j), 0)),
    );
    const B = Array.from({ length: n }, (_, i) => pts.reduce((s, p) => s + pw(p.t, i) * p.y, 0));
    coef = solve(A, B);
  }
  if (!coef || coef.some((c) => !Number.isFinite(c))) return null;

  const f: Fit = { kind, coef, r2: 0 };
  const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const ssTot = pts.reduce((s, p) => s + (p.y - mean) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.y - evalFit(f, p.t)) ** 2, 0);
  if (ssTot === 0) f.r2 = ssRes < 1e-12 ? 1 : 0;
  else f.r2 = 1 - ssRes / ssTot;
  return f;
}

function sig3(v: number): string {
  return new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3, useGrouping: false }).format(v);
}

/** z. B. „x = 1,52·t + 0,01“, „y = −4,91·t² + 2,03·t − 0,05“, „v = 9,81·t“. */
export function fitEquation(f: Fit, varName: string): string {
  const suffix =
    f.kind === 'origin' ? ['·t'] : f.kind === 'line' ? ['·t', ''] : ['·t²', '·t', ''];
  let s = `${varName} =`;
  f.coef.forEach((c, i) => {
    const neg = c < 0 || Object.is(c, -0);
    const txt = sig3(Math.abs(c)) + suffix[i];
    if (i === 0) s += ` ${neg ? '−' : ''}${txt}`;
    else s += ` ${neg ? '−' : '+'} ${txt}`;
  });
  return s;
}

export function formatR2(r2: number): string {
  return `R² = ${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(r2)}`;
}
