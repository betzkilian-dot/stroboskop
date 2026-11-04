export function formatDt(seconds: number): string {
  const nf = new Intl.NumberFormat('de-DE', {
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3,
    useGrouping: false,
  });
  return `${nf.format(seconds)} s`;
}

export function formatNumber(v: number, decimals: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(v);
}

/** Bildrate: bis zu 2 Nachkommastellen, ohne Nullen am Ende (60 -> "60", 59,94). */
export function formatFps(v: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(v);
}

/** Parst eine Bildrate aus Text (Komma oder Punkt); null = ungueltig (leer, <= 0, NaN, Infinity). */
export function parseFps(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Laenge aus Text (Komma oder Punkt); 0 = leer/ungueltig. */
export function parseLength(text: string): number {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return 0;
  const v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** toFixed ohne negative Null: Werte, die auf 0 runden, erhalten kein Vorzeichen. */
export function fixedNoNegZero(v: number, decimals: number): string {
  const s = v.toFixed(decimals);
  return Number(s) === 0 ? (0).toFixed(decimals) : s;
}

/** Tabellenzahl: Dezimalkomma, Minus als U+2212, kein Vorzeichen bei Rundung auf 0, null/NaN als „–“. */
export function formatCell(v: number | null, decimals: number): string {
  if (v === null || !Number.isFinite(v)) return '–';
  return fixedNoNegZero(v, decimals).replace('.', ',').replace('-', '−');
}
