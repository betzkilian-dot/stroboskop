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
  /** Name der Abszissen-Variablen in der Gleichung (Standard „t“; beim x-y-Diagramm „x“). */
  argName?: string;
  /** Gleicher Maßstab auf beiden Achsen (x-y-Diagramm); die Nullstelle der Abszisse wird nicht erzwungen. */
  equalScale?: boolean;
  /** Dünne Verbindungslinie der Punkte je Reihe in Zeitreihenfolge. */
  connect?: boolean;
}
export interface Pad { l: number; r: number; t: number; b: number }
export interface Tick { v: number; px: number; text: string }
export interface ChartLayout {
  xTicks: Tick[];
  yTicks: Tick[];
  points: { seriesId: number; nr: number; x: number; y: number; color: string }[];
  curve: { x: number; y: number }[] | null;
  curveColor: string | null;
  lines: { color: string; pts: { x: number; y: number }[] }[];
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

function noFitHint(input: ChartInput, s: ChartSeries): string {
  if (input.equalScale && s.points.length >= 2) {
    const xs = s.points.map((p) => p.t);
    const ys = s.points.map((p) => p.y);
    const sx = Math.max(...xs) - Math.min(...xs);
    const sy = Math.max(...ys) - Math.min(...ys);
    if (sx <= 1e-3 * Math.max(sy, 1e-9)) return 'Für x-y ist kein Ausgleich möglich (x ändert sich kaum)';
  }
  return 'Zu wenige Punkte für den Ausgleich';
}

/** Reine Berechnung der Diagramm-Geometrie (Pixel), gemeinsam für SVG und Canvas. */
export function chartLayout(input: ChartInput, width: number, height: number, pad: Pad): ChartLayout {
  const { series, fit, activeId } = input;
  const all = series.flatMap((s) => s.points);
  let xt = niceTicks(...extent(all.map((p) => p.t), !input.equalScale), 6);
  let yt = niceTicks(...extent(all.map((p) => p.y), false), 6);
  let x0 = xt[0] ?? 0;
  let x1 = xt[xt.length - 1] ?? 1;
  let y0 = yt[0] ?? 0;
  let y1 = yt[yt.length - 1] ?? 1;
  const plot = { x: pad.l, y: pad.t, w: Math.max(0, width - pad.l - pad.r), h: Math.max(0, height - pad.t - pad.b) };
  if (input.equalScale && plot.w > 0 && plot.h > 0) {
    // Gleicher Maßstab: den Bereich mit dem größeren Pixelbedarf je Einheit um seine Mitte erweitern.
    const wx = x1 - x0 || 1;
    const wy = y1 - y0 || 1;
    const s = Math.min(plot.w / wx, plot.h / wy);
    const nx = plot.w / s;
    const ny = plot.h / s;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    [x0, x1] = [cx - nx / 2, cx + nx / 2];
    [y0, y1] = [cy - ny / 2, cy + ny / 2];
    // Teilstriche nach dem Erweitern: gleicher Schritt auf beiden Achsen, nur innerhalb des Bereichs
    const stepFor = (span: number, n: number) => {
      const t = niceTicks(0, span, n);
      return t.length > 1 ? t[1] - t[0] : 1;
    };
    // Die kürzere Achse soll mindestens zwei Teilstriche bekommen, die längere höchstens ~12.
    const step = Math.max(stepFor(Math.min(nx, ny), 7), stepFor(Math.max(nx, ny), 12));
    const within = (lo: number, hi: number) => {
      const out: number[] = [];
      for (let k = Math.ceil(lo / step - 1e-9); k <= Math.floor(hi / step + 1e-9); k++) out.push(Number((k * step).toPrecision(12)) + 0);
      return out;
    };
    xt = within(x0, x1);
    yt = within(y0, y1);
  }
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
  const lines = input.connect
    ? series.filter((s) => s.points.length > 1).map((s) => ({ color: s.color, pts: s.points.map((p) => ({ x: px(p.t), y: py(p.y) })) }))
    : [];
  const hint =
    fit === 'none' ? null : !fitSeries ? 'Für dieses Objekt gibt es noch keine Punkte' : !f ? noFitHint(input, fitSeries) : null;

  return {
    xTicks: xt.map((v) => ({ v, px: px(v), text: tickText(v) })),
    yTicks: yt.map((v) => ({ v, px: py(v), text: tickText(v) })),
    points: series.flatMap((s) => s.points.map((p) => ({ seriesId: s.id, nr: p.nr, x: px(p.t), y: py(p.y), color: s.color }))),
    curve,
    curveColor: f && fitSeries ? fitSeries.color : null,
    lines,
    equation: f && input.showEquation ? fitEquation(f, input.varName, input.argName) : null,
    r2: f && input.showR2 ? formatR2(f.r2) : null,
    hint,
    plot,
  };
}
