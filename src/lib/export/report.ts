import type { ChartQuantity } from '../measure/model';
import { measuredObjects } from '../measure/objectRows';
import type { FitKind } from '../physics/fit';
import { deltaT } from '../frames';
import { formatCell, formatDt, formatFps, formatNumber } from '../format';
import { buildScene, formatScaleLabel } from '../overlay/scene';
import { COLUMNS, DEFAULT_COLUMNS } from '../measure/columns';
import { chartLayout } from '../charts/layout';
import { drawChart, drawSymText, ellipsize, LIGHT_THEME, REF_WIDTH } from '../charts/drawChart';
import { chartInputFor } from '../charts/input';
import { renderExportImage } from './image';
import { jpegPagesToPdf } from './pdf';
import type { Project } from '../state/project.svelte';

export interface ReportOptions {
  title: string;
  name: string;
  date: string;
  image: boolean;
  facts: boolean;
  tables: boolean;
  charts: ChartQuantity[];
  fit: FitKind;
  showEquation: boolean;
  showR2: boolean;
  /** Sichtbare Tabellenspalten und Nachkommastellen (wie im Auswerten-Tab). */
  columns: string[];
  decimals: 2 | 3;
}
export const DEFAULT_REPORT_COLUMNS = DEFAULT_COLUMNS;

// ---------- Seitenaufteilung (rein) ----------
export interface PBlock {
  kind: 'header' | 'image' | 'facts' | 'tableHead' | 'row' | 'chart';
  h: number;
  keepWithNext?: boolean;
}

/** Blockindizes je Seite. Bild/Diagramme werden nie geteilt; ein Tabellenkopf wird vor die erste Zeile einer Seite wiederholt. */
export function paginate(blocks: PBlock[], pageContentH: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  let lastHead = -1;
  let i = 0;
  while (i < blocks.length) {
    let j = i;
    while (blocks[j].keepWithNext && j + 1 < blocks.length) j++;
    const unit = Array.from({ length: j - i + 1 }, (_, k) => i + k);
    const unitH = unit.reduce((a, k) => a + blocks[k].h, 0);
    if (pages[pages.length - 1].length > 0 && used + unitH > pageContentH) {
      pages.push([]);
      used = 0;
    }
    const page = pages[pages.length - 1];
    if (page.length === 0 && blocks[i].kind === 'row' && lastHead >= 0) {
      page.push(lastHead);
      used += blocks[lastHead].h;
    }
    for (const k of unit) {
      page.push(k);
      used += blocks[k].h;
      if (blocks[k].kind === 'tableHead') lastHead = k;
    }
    i = j + 1;
  }
  return pages;
}

export function reportFileName(videoName: string): string {
  const dot = videoName.lastIndexOf('.');
  return `${dot > 0 ? videoName.slice(0, dot) : videoName}_bericht.pdf`;
}

/** page ist 1-basiert. */
export function footerText(page: number, total: number): string {
  return `Seite ${page} von ${total}`;
}

// ---------- Maße (px bei 200 dpi) ----------
const PAGE_W = 1654;
const PAGE_H = 2339;
const MARGIN = 118;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_H = 60;
const PAGE_CONTENT_H = PAGE_H - 2 * MARGIN - FOOTER_H;
const TITLE_PX = 50;
const BODY_PX = 28;
const HEADER_H = 150;
const FACT_LINE_H = 38;
const HEAD_H = 130;
const ROW_H = 40;
const CHART_H = 551;
const GAP = 24;
export const IMAGE_MAX_H = Math.round(PAGE_H * 0.4);

export function planBlocks(i: {
  image: { w: number; h: number } | null; factsCount: number; tables: { rows: number }[]; charts: number;
}): PBlock[] {
  const out: PBlock[] = [{ kind: 'header', h: HEADER_H }];
  if (i.image) {
    const f = Math.min(CONTENT_W / i.image.w, IMAGE_MAX_H / i.image.h);
    out.push({ kind: 'image', h: Math.round(i.image.h * f) + GAP });
  }
  if (i.factsCount > 0) out.push({ kind: 'facts', h: i.factsCount * FACT_LINE_H + GAP });
  for (const t of i.tables) {
    out.push({ kind: 'tableHead', h: HEAD_H, keepWithNext: true });
    for (let r = 0; r < t.rows; r++) out.push({ kind: 'row', h: ROW_H });
  }
  for (let c = 0; c < i.charts; c++) out.push({ kind: 'chart', h: CHART_H + GAP });
  return out;
}

/** Kennzahlen als [Beschriftung, Wert]. */
export function factsLines(f: {
  fps: number; slowMotion: boolean; dt: number; positions: number;
  calibration: { length: number; unit: string; pixels: number } | null; vScale: number | null; aScale: number | null;
}): [string, string][] {
  const l: [string, string][] = [
    ['Bildrate', `${f.slowMotion ? 'Zeitlupe, ' : ''}${formatFps(f.fps)} Bilder/s`],
    ['Δt', formatDt(f.dt)],
    ['Positionen', String(f.positions)],
  ];
  if (f.calibration) {
    const dec = f.calibration.unit === 'm' ? 2 : f.calibration.unit === 'cm' ? 1 : 0;
    l.push(['Maßstab', `${formatNumber(f.calibration.length, dec)} ${f.calibration.unit} ≙ ${Math.round(f.calibration.pixels)} Pixel`]);
  } else l.push(['Maßstab', 'kein Maßstab']);
  if (f.vScale !== null) l.push(['Pfeilmaßstab v', formatScaleLabel(f.vScale, 'v')]);
  if (f.aScale !== null) l.push(['Pfeilmaßstab a', formatScaleLabel(f.aScale, 'a')]);
  return l;
}

// ---------- Rendern ----------
const FAMILY = '-apple-system, system-ui, sans-serif';

type Ctx = OffscreenCanvasRenderingContext2D;
type Draw = (ctx: Ctx, y: number) => void;

/** Nutzertext unverändert (keine Index-Zeichen). */
function plain(
  ctx: Ctx, s: string, x: number, y: number, size: number, color: string, weight = '', align: CanvasTextAlign = 'left', maxW = Infinity,
): void {
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;
  ctx.fillText(ellipsize((t) => ctx.measureText(t).width, s, maxW), x, y);
}

function text(
  ctx: Ctx, s: string, x: number, y: number, size: number, color: string, weight = '', align: 'left' | 'center' | 'right' = 'left',
): void {
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  drawSymText(ctx, s, x, y, size, weight, align);
}

export async function renderReport(p: Project, o: ReportOptions): Promise<Blob> {
  const m = p.measure;
  const th = LIGHT_THEME;
  const cols = COLUMNS.filter((c) => o.columns.includes(c.id));
  const tables = o.tables ? measuredObjects(p) : [];

  let bitmap: ImageBitmap | null = null;
  try {
    if (o.image) {
      const blob = await renderExportImage(p, { format: 'jpeg', quality: 0.9, size: 'worksheet', infoLine: false, overlays: true });
      bitmap = await createImageBitmap(blob);
    }
    let lines: [string, string][] = [];
    if (o.facts && p.info) {
      const scene = buildScene(m, p.measureIndices, p.captureFps, p.viewRect, { showCalibration: false, showAxes: false, highlight: null, dtText: null });
      const c = m.calibration;
      lines = factsLines({
        fps: p.captureFps, slowMotion: p.info.slowMotion, dt: deltaT(p.selection.step, p.captureFps), positions: p.positionsCount,
        calibration: c ? { length: c.length, unit: c.unit, pixels: Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) } : null,
        vScale: scene.vScale, aScale: scene.aScale,
      });
    }

    const blocks = planBlocks({
      image: bitmap ? { w: bitmap.width, h: bitmap.height } : null,
      factsCount: lines.length, tables: tables.map((t) => ({ rows: t.rows.length })), charts: o.charts.length,
    });
    // Zeichner je Block, gleiche Reihenfolge wie planBlocks.
    const draws: Draw[] = [];
    draws.push((ctx, y) => {
      plain(ctx, o.title, MARGIN, y + TITLE_PX, TITLE_PX, th.fg, '600', 'left', CONTENT_W);
      const dateW = o.date ? (plain(ctx, o.date, PAGE_W - MARGIN, y + TITLE_PX + 48, BODY_PX, th.muted, '', 'right'), ctx.measureText(o.date).width) : 0;
      if (o.name) plain(ctx, `Name: ${o.name}`, MARGIN, y + TITLE_PX + 48, BODY_PX, th.muted, '', 'left', CONTENT_W - dateW - 40);
      ctx.fillStyle = th.grid;
      ctx.fillRect(MARGIN, y + HEADER_H - 20, CONTENT_W, 2);
    });
    if (bitmap) {
      const bm = bitmap;
      const f = Math.min(CONTENT_W / bm.width, IMAGE_MAX_H / bm.height);
      draws.push((ctx, y) => {
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bm, MARGIN, y, bm.width * f, bm.height * f);
      });
    }
    if (lines.length) {
      draws.push((ctx, y) => lines.forEach(([k, v], i) => {
        plain(ctx, k, MARGIN, y + (i + 1) * FACT_LINE_H - 10, BODY_PX, th.muted);
        plain(ctx, v, MARGIN + 380, y + (i + 1) * FACT_LINE_H - 10, BODY_PX, th.fg, '', 'left', CONTENT_W - 380);
      }));
    }
    const colW = CONTENT_W / (cols.length + 1);
    const cx = (k: number) => MARGIN + colW * (k + 0.5);
    for (const t of tables) {
      draws.push((ctx, y) => {
        plain(ctx, `Messtabelle · ${t.name}`, MARGIN, y + 36, BODY_PX + 4, th.fg, '600', 'left', CONTENT_W);
        const by = y + HEAD_H - 48;
        plain(ctx, 'Nr.', cx(0), by, BODY_PX - 4, th.muted, '600', 'center');
        cols.forEach((c, k) => {
          const label = c.sub ? `${c.head}_${c.sub}` : c.head;
          const unit = `in ${c.unit}`;
          // Schrift verkleinern, bis Beschriftung und Einheit in die Spalte passen (min. 18 px)
          let size = BODY_PX - 4;
          const wOf = (sz: number) => Math.max(
            drawSymText(ctx, label, 0, 0, sz, '600', 'left', false),
            (ctx.font = `${sz}px ${FAMILY}`, ctx.measureText(unit).width),
          );
          while (size > 18 && wOf(size) > colW - 8) size -= 1;
          text(ctx, label, cx(k + 1), by, size, th.muted, '600', 'center');
          plain(ctx, unit, cx(k + 1), by + 32, size, th.muted, '', 'center');
        });
        ctx.fillStyle = th.muted;
        ctx.fillRect(MARGIN, y + HEAD_H - 6, CONTENT_W, 2);
      });
      for (const r of t.rows) {
        draws.push((ctx, y) => {
          text(ctx, String(r.nr), cx(0), y + 30, BODY_PX, th.fg, '', 'center');
          cols.forEach((c, k) => {
            const d = c.kind === 'base' ? o.decimals : Math.max(1, o.decimals - 1);
            text(ctx, formatCell(r[c.id] as number | null, d), cx(k + 1), y + 30, BODY_PX, th.fg, '', 'center');
          });
          ctx.fillStyle = th.grid;
          ctx.fillRect(MARGIN, y + ROW_H - 1, CONTENT_W, 1);
        });
      }
    }
    const u = CONTENT_W / REF_WIDTH;
    for (const q of o.charts) {
      draws.push((ctx, y) => {
        const { input, title } = chartInputFor(p, q, o.fit, o.showEquation, o.showR2);
        const pad = { l: 52 * u, r: 14 * u, t: 32 * u, b: 44 * u };
        const layout = chartLayout(input, CONTENT_W, CHART_H, pad);
        ctx.save();
        ctx.translate(MARGIN, y);
        ctx.beginPath();
        ctx.rect(0, 0, CONTENT_W, CHART_H);
        ctx.clip();
        drawChart(ctx, layout, th, title, { width: CONTENT_W, height: CHART_H, xLabel: input.xLabel, yLabel: input.yLabel });
        ctx.restore();
      });
    }

    const pages = paginate(blocks, PAGE_CONTENT_H);
    const out: { jpeg: Uint8Array; widthPx: number; heightPx: number }[] = [];
    for (let n = 0; n < pages.length; n++) {
      const c = new OffscreenCanvas(PAGE_W, PAGE_H);
      try {
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = th.bg;
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);
        let y = MARGIN;
        for (const bi of pages[n]) {
          draws[bi](ctx, y);
          y += blocks[bi].h;
        }
        plain(ctx, 'Erstellt mit Stroboskop', MARGIN, PAGE_H - MARGIN + 30, 24, th.muted);
        plain(ctx, footerText(n + 1, pages.length), PAGE_W - MARGIN, PAGE_H - MARGIN + 30, 24, th.muted, '', 'right');
        const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
        out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), widthPx: PAGE_W, heightPx: PAGE_H });
      } finally {
        c.width = 0;
      }
    }
    return new Blob([jpegPagesToPdf(out) as BlobPart], { type: 'application/pdf' });
  } finally {
    bitmap?.close();
  }
}
