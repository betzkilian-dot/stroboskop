/** Schöne Teilstriche: Schritt aus {1,2,5}·10^k, Bereich umfasst min..max. */
export function niceTicks(min: number, max: number, maxCount = 6): number[] {
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    if (min === 0) return niceTicks(0, 1, maxCount);
    return niceTicks(min - 1, max + 1, maxCount);
  }
  const raw = (max - min) / Math.max(1, maxCount - 1);
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  const mant = f <= 1 + 1e-9 ? 1 : f <= 2 + 1e-9 ? 2 : f <= 5 + 1e-9 ? 5 : 10;
  const step = mant * base;
  const first = Math.floor(min / step + 1e-9);
  const last = Math.ceil(max / step - 1e-9);
  const out: number[] = [];
  for (let k = first; k <= last; k++) {
    // Rundung gegen Gleitkommarauschen (0.1*3 = 0.30000000000000004)
    out.push(Number((k * step).toPrecision(12)) + 0);
  }
  return out;
}
