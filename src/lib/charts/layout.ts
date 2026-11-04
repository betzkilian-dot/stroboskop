import { niceTicks } from './ticks';
import { evalFit, fitEquation, fitPoints, formatR2, type FitKind } from '../physics/fit';

export type ChartSeries = { id: number; color: string; name: string; points: { t: number; y: number; nr: number }[] };
export interface ChartInput {
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  varName: string;
  fit: FitKind;
  showEquation: boolean;
  showR2: boolean;
  /** Aktives Objekt: nur dafür gilt der Ausgleich. */
  activeId: number;
}
export interface Pad { l: number; r: number; t: number; b: number }
export interface Tick { v: number; px: number; text: string }
export interface ChartLayout {
  xTicks: Tick[];
  yTicks: Tick[];
  points: { seriesId: number; nr: number; x: number; y: number; color: string }[];
  curve: { x: number; y: number }[] | null;
  curveColor: string | null;
  equation: string | null;
  r2: string | null;
  hint: string | null;
  plot: { x: number; y: number; w: number; h: number };
}

const TICK_NF = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3, useGrouping: false });
const tickText = (v: number) => TICK_NF.format(v).replace('-', '−');

function extent(vals: number[], include0: boolean): [number, number] {
  if (vals.length === 0) return [0, 1];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (include0) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  return [lo, hi];
}

/** Reine Berechnung der Diagramm-Geometrie (Pixel), gemeinsam für SVG und Canvas. */
export function chartLayout(input: ChartInput, width: number, height: number, pad: Pad): ChartLayout {
  const { series, fit, activeId } = input;
  const all = series.flatMap((s) => s.points);
  const xt = niceTicks(...extent(all.map((p) => p.t), true), 6);
  const yt = niceTicks(...extent(all.map((p) => p.y), false), 6);
  const x0 = xt[0] ?? 0;
  const x1 = xt[xt.length - 1] ?? 1;
  const y0 = yt[0] ?? 0;
  const y1 = yt[yt.length - 1] ?? 1;
  const plot = { x: pad.l, y: pad.t, w: Math.max(0, width - pad.l - pad.r), h: Math.max(0, height - pad.t - pad.b) };
  const px = (t: number) => plot.x + ((t - x0) / (x1 - x0 || 1)) * plot.w;
  const py = (y: number) => plot.y + plot.h - ((y - y0) / (y1 - y0 || 1)) * plot.h;

  const fitSeries = series[0] && series[0].id === activeId ? series[0] : undefined;
  const f = fit === 'none' || !fitSeries ? null : fitPoints(fitSeries.points, fit);

  let curve: { x: number; y: number }[] | null = null;
  if (f && fitSeries) {
    const ts = fitSeries.points.map((p) => p.t);
    const a = Math.min(...ts);
    const b = Math.max(...ts);
    const n = 60;
    curve = [];
    for (let i = 0; i <= n; i++) {
      const t = a + ((b - a) * i) / n;
      curve.push({ x: px(t), y: py(Math.min(y1, Math.max(y0, evalFit(f, t)))) });
    }
  }
  const hint =
    fit === 'none' ? null : !fitSeries ? 'Für dieses Objekt gibt es noch keine Punkte' : !f ? 'Zu wenige Punkte für den Ausgleich' : null;

  return {
    xTicks: xt.map((v) => ({ v, px: px(v), text: tickText(v) })),
    yTicks: yt.map((v) => ({ v, px: py(v), text: tickText(v) })),
    points: series.flatMap((s) => s.points.map((p) => ({ seriesId: s.id, nr: p.nr, x: px(p.t), y: py(p.y), color: s.color }))),
    curve,
    curveColor: f && fitSeries ? fitSeries.color : null,
    equation: f && input.showEquation ? fitEquation(f, input.varName) : null,
    r2: f && input.showR2 ? formatR2(f.r2) : null,
    hint,
    plot,
  };
}
