import { chartLayout, type ChartInput, type ChartLayout } from './layout';

export interface ChartTheme { bg: string; fg: string; muted: string; grid: string }
export const LIGHT_THEME: ChartTheme = { bg: '#ffffff', fg: '#1c1c1e', muted: '#6c6c70', grid: '#e3e3e8' };
/** Referenzbreite des Bildschirmdiagramms; alle Maße skalieren mit width / REF_WIDTH. */
export const REF_WIDTH = 800;
export const CHART_PNG_SIZE = { width: 1600, height: 1000 };

/** Diagrammtitel: sym mit Index-Zeichen (`t-v_x`), plain unverändert (Nutzertext). */
export type ChartTitle = string | { sym: string; plain: string };

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
const FAMILY = 'system-ui, sans-serif';

export function chartFileName(videoName: string, quantityId: string): string {
  const dot = videoName.lastIndexOf('.');
  const base = dot > 0 ? videoName.slice(0, dot) : videoName;
  return `${base}_diagramm_t-${quantityId}.png`;
}

/** Zerlegt `v_x` in Grundzeichen und Index-Zeichen (Canvas kennt keine tspans). */
function segments(text: string): { s: string; sub: boolean }[] {
  return text.split(/(_\w)/).filter((p) => p !== '').map((p) => (p.startsWith('_') ? { s: p[1], sub: true } : { s: p, sub: false }));
}

/** Zeichnet Text mit `_x`-Indizes (kleiner, tiefer) und liefert die Breite. Ohne Zeichnen (draw=false) nur Messung. */
export function drawSymText(
  ctx: Ctx, text: string, x: number, y: number, size: number, weight: string, align: 'left' | 'center' | 'right' = 'left', draw = true,
): number {
  const font = (px: number) => `${weight} ${px}px ${FAMILY}`;
  const segs = segments(text).map((g) => {
    ctx.font = font(g.sub ? size * 0.75 : size);
    return { ...g, w: ctx.measureText(g.s).width };
  });
  const total = segs.reduce((a, g) => a + g.w, 0);
  if (draw) {
    let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
    ctx.textAlign = 'left';
    for (const g of segs) {
      ctx.font = font(g.sub ? size * 0.75 : size);
      ctx.fillText(g.s, cx, g.sub ? y + size * 0.22 : y);
      cx += g.w;
    }
  }
  ctx.font = font(size);
  return total;
}

/** Zeichnet das Diagramm auf eine Fläche der Größe size; u = Skalierung gegenüber dem Bildschirmdiagramm. */
export function drawChart(
  ctx: Ctx, l: ChartLayout, theme: ChartTheme, title?: ChartTitle,
  opts: { width: number; height: number; xLabel?: string; yLabel?: string } = { width: 1600, height: 1000 },
): void {
  const { width: W, height: H } = opts;
  const u = W / REF_WIDTH;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const { plot } = l;
  ctx.lineWidth = u;
  ctx.strokeStyle = theme.grid;
  for (const t of l.xTicks) { ctx.beginPath(); ctx.moveTo(t.px, plot.y); ctx.lineTo(t.px, plot.y + plot.h); ctx.stroke(); }
  for (const t of l.yTicks) { ctx.beginPath(); ctx.moveTo(plot.x, t.px); ctx.lineTo(plot.x + plot.w, t.px); ctx.stroke(); }
  ctx.strokeStyle = theme.muted;
  ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);

  ctx.fillStyle = theme.muted;
  ctx.font = `${11 * u}px ${FAMILY}`;
  ctx.textAlign = 'center';
  for (const t of l.xTicks) ctx.fillText(t.text, t.px, plot.y + plot.h + 16 * u);
  ctx.textAlign = 'right';
  for (const t of l.yTicks) ctx.fillText(t.text, plot.x - 6 * u, t.px + 4 * u);

  ctx.fillStyle = theme.fg;
  if (opts.xLabel) drawSymText(ctx, opts.xLabel, plot.x + plot.w / 2, H - 6 * u, 12 * u, '', 'center');
  if (opts.yLabel) {
    ctx.save();
    ctx.translate(14 * u, plot.y + plot.h / 2);
    ctx.rotate(-Math.PI / 2);
    drawSymText(ctx, opts.yLabel, 0, 0, 12 * u, '', 'center');
    ctx.restore();
  }
  if (title) {
    const t = typeof title === 'string' ? { sym: title, plain: '' } : title;
    const w = drawSymText(ctx, t.plain ? `${t.sym} · ` : t.sym, plot.x, plot.y - 8 * u, 15 * u, '600');
    if (t.plain) {
      ctx.textAlign = 'left';
      ctx.fillText(t.plain, plot.x + w, plot.y - 8 * u);
    }
  }

  if (l.curve && l.curveColor) {
    ctx.strokeStyle = l.curveColor;
    ctx.lineWidth = 2 * u;
    ctx.setLineDash([6 * u, 4 * u]);
    ctx.beginPath();
    l.curve.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const p of l.points) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  const lines = [l.equation, l.r2].filter((s): s is string => s !== null);
  if (lines.length) {
    const w = Math.max(...lines.map((s) => drawSymText(ctx, s, 0, 0, 13 * u, '600', 'left', false))) + 16 * u;
    ctx.fillStyle = theme.bg;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(plot.x + 2 * u, plot.y + 2 * u, w, lines.length * 20 * u + 6 * u, 8 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.fg;
    lines.forEach((s, i) => drawSymText(ctx, s, plot.x + 8 * u, plot.y + (18 + 20 * i) * u, 13 * u, '600'));
  }
  if (l.hint) {
    ctx.fillStyle = theme.muted;
    drawSymText(ctx, l.hint, plot.x + plot.w / 2, plot.y + plot.h / 2, 13 * u, '', 'center');
  }
}

export async function renderChartPng(input: ChartInput, title?: ChartTitle): Promise<Blob> {
  const { width, height } = CHART_PNG_SIZE;
  const u = width / REF_WIDTH;
  const pad = { l: 52 * u, r: 14 * u, t: (title ? 32 : 14) * u, b: 44 * u };
  const layout = chartLayout(input, width, height, pad);
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  drawChart(ctx, layout, LIGHT_THEME, title, { width, height, xLabel: input.xLabel, yLabel: input.yLabel });
  try {
    return await c.convertToBlob({ type: 'image/png' });
  } finally {
    c.width = 0;
  }
}
