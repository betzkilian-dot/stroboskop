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
