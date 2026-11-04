import { type Pt, niceNumber } from '../physics/kinematics';
import { V_COLOR, A_COLOR, UNSURE_COLOR } from '../measure/model';
import type { Rect } from './map';
import { type Scene, formatLength, axisTip, axisTipY } from './scene';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const ACC = '#007aff';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function arrowHead(ctx: Ctx, to: Pt, ang: number, len: number, color: string) {
  const w = Math.PI / 7;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(ang - w), to.y - len * Math.sin(ang - w));
  ctx.lineTo(to.x - len * Math.cos(ang + w), to.y - len * Math.sin(ang + w));
  ctx.closePath();
  ctx.fill();
}

function drawArrow(ctx: Ctx, a: Pt, b: Pt, color: string, unit: number, double: boolean) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 2 * unit) return;
  const head = Math.min(9 * unit, len);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const back = Math.min(double ? head * 1.6 : head * 0.8, len);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * unit;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x - back * Math.cos(ang), b.y - back * Math.sin(ang));
  ctx.stroke();
  arrowHead(ctx, b, ang, head, color);
  if (double) {
    arrowHead(ctx, { x: b.x - head * 0.8 * Math.cos(ang), y: b.y - head * 0.8 * Math.sin(ang) }, ang, head, color);
  }
}

function halo(ctx: Ctx, text: string, x: number, y: number, unit: number, color: string) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3 * unit;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function card(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

interface LegendRow { kind: 'v' | 'a' | 'bar'; len: number; text: string }

/** Inhalt und Groesse der Legende (Zielpixel); null ohne Inhalt. k = Zielpixel je Video-Pixel. */
function legendRows(ctx: Ctx, scene: Scene, k: number, unit: number, vis: Rect, mpp: number | null) {
  const rows: LegendRow[] = [];
  const maxLen = 0.3 * vis.w;
  if (mpp !== null && k > 0) {
    if (scene.vScale !== null) rows.push({ kind: 'v', len: Math.min(maxLen, (scene.vScale / mpp) * k), text: '≙ 1 m/s' });
    if (scene.aScale !== null) rows.push({ kind: 'a', len: Math.min(maxLen, (scene.aScale / mpp) * k), text: '≙ 1 m/s²' });
    if (scene.scaleBar) {
      const realM = niceNumber(0.15 * (vis.w / k) * mpp);
      if (realM > 0) rows.push({ kind: 'bar', len: (realM / mpp) * k, text: formatLength(realM) });
    }
  }
  if (!rows.length) return null;
  ctx.font = `${11 * unit}px ${FONT}`;
  const pad = 8 * unit, rowH = 20 * unit, gap = 8 * unit;
  const textW = Math.max(...rows.map(r => ctx.measureText(r.text).width));
  const innerW = Math.max(...rows.map(r => r.len)) + gap + textW;
  return { rows, k, w: innerW + 2 * pad, h: rows.length * rowH + 2 * pad };
}

/**
 * Rechteck der Legende in Zielpixeln; null ohne Legendeninhalt. `scene.legendPos` ist die linke obere
 * Ecke als Anteil von `imageRect` (sichtbare Bildflaeche); das Ergebnis bleibt vollstaendig darin.
 * Aenderung gegenueber dem Entwurf `legendRect(ctx, scene, target, unit)`: statt der Zielgroesse
 * kommen die Bildflaeche und k (Zielpixel je Video-Pixel, fuer die Pfeil-/Balkenlaengen) hinein.
 */
export function legendRect(ctx: Ctx, scene: Scene, imageRect: Rect, unit: number, k: number, bounds?: Rect): Rect | null {
  return legendPlace(ctx, scene, imageRect, unit, k, bounds)?.rect ?? null;
}

/** Schnitt von Bildflaeche und Zeichenflaeche (sichtbarer Teil des Bildes). */
function visibleOf(imageRect: Rect, bounds?: Rect): Rect {
  if (!bounds) return imageRect;
  const x = Math.max(imageRect.x, bounds.x), y = Math.max(imageRect.y, bounds.y);
  const x1 = Math.min(imageRect.x + imageRect.w, bounds.x + bounds.w);
  const y1 = Math.min(imageRect.y + imageRect.h, bounds.y + bounds.h);
  if (x1 <= x || y1 <= y) return imageRect;
  return { x, y, w: x1 - x, h: y1 - y };
}

function legendPlace(ctx: Ctx, scene: Scene, imageRect: Rect, unit: number, k: number, bounds?: Rect) {
  const vis = visibleOf(imageRect, bounds);
  const lg = legendRows(ctx, scene, k, unit, vis, scene.mpp);
  if (!lg) return null;
  const x = imageRect.x + scene.legendPos.x * imageRect.w;
  const y = imageRect.y + scene.legendPos.y * imageRect.h;
  const rect: Rect = {
    x: Math.max(vis.x, Math.min(vis.x + vis.w - lg.w, x)),
    y: Math.max(vis.y, Math.min(vis.y + vis.h - lg.h, y)),
    w: lg.w, h: lg.h,
  };
  return { rows: lg.rows, rect };
}

/** Zeichnet die Einblendungen; liefert das Legendenrechteck (Zielpixel) oder null. `imageRect` Standard: ganze Zeichenflaeche. */
export function drawOverlay(
  ctx: Ctx, scene: Scene, map: (p: Pt) => Pt, unit: number,
  target: { width: number; height: number; screen: boolean; imageRect?: Rect },
): Rect | null {
  const imageRect = target.imageRect ?? { x: 0, y: 0, w: target.width, h: target.height };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Bahn
  if (scene.showPath) {
    for (const o of scene.objects) {
      if (o.points.length < 2) continue;
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.5 * unit;
      ctx.setLineDash([4 * unit, 3 * unit]);
      ctx.beginPath();
      o.points.forEach((q, i) => {
        const t = map(q.p);
        if (i === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Pfeile
  for (const o of scene.objects) {
    for (const ar of o.v) drawArrow(ctx, map(ar.from), map(ar.to), V_COLOR, unit, false);
    for (const ar of o.a) drawArrow(ctx, map(ar.from), map(ar.to), A_COLOR, unit, true);
  }
  // Punkte
  for (const o of scene.objects) {
    for (const q of o.points) {
      const t = map(q.p);
      const unsure = target.screen && q.unsure;
      ctx.beginPath();
      ctx.arc(t.x, t.y, (unsure ? 4.5 : 3.5) * unit, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = unsure ? UNSURE_COLOR : o.color;
      ctx.lineWidth = 2 * unit;
      ctx.stroke();
    }
  }
  // Nummern (nach unten links versetzt)
  if (scene.showNumbers) {
    ctx.font = `bold ${11 * unit}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (const o of scene.objects) {
      for (const q of o.points) {
        const t = map(q.p);
        halo(ctx, String(q.nr), t.x - 6 * unit, t.y + 6 * unit, unit, o.color);
      }
    }
  }
  // Maßstabslinie
  if (scene.calibration) {
    const a = map(scene.calibration.a), b = map(scene.calibration.b);
    ctx.strokeStyle = ACC;
    ctx.lineWidth = 2.5 * unit;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (const e of [a, b]) {
      ctx.beginPath(); ctx.arc(e.x, e.y, 6 * unit, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = ACC; ctx.lineWidth = 2 * unit; ctx.stroke();
    }
    ctx.font = `bold ${11 * unit}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - 14 * unit;
    const tw = ctx.measureText(scene.calibration.label).width + 12 * unit;
    ctx.fillStyle = ACC;
    card(ctx, cx - tw / 2, cy - 9 * unit, tw, 18 * unit, 9 * unit);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(scene.calibration.label, cx, cy);
  }
  // Koordinatensystem
  if (scene.axes) {
    const ax = scene.axes;
    const o = map(ax.origin);
    ctx.font = `bold ${12 * unit}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shown = ([[axisTip(ax), 'x'], [axisTipY(ax), 'y']] as const).filter(([, l]) => ax.dims === 'xy' || ax.dims === l);
    for (const [tipPt, label] of shown) {
      const t = map(tipPt);
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? '#ffffff' : '#1c1c1e';
        ctx.lineWidth = (pass === 0 ? 4 : 2) * unit;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      }
      const ang = Math.atan2(t.y - o.y, t.x - o.x);
      arrowHead(ctx, t, ang, 9 * unit, '#1c1c1e');
      halo(ctx, label, t.x + 12 * unit * Math.cos(ang), t.y + 12 * unit * Math.sin(ang), unit, '#1c1c1e');
    }
    ctx.beginPath(); ctx.arc(o.x, o.y, 5 * unit, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = 2 * unit; ctx.stroke();
  }
  // Hervorhebung
  if (target.screen && scene.highlight) {
    const t = map(scene.highlight);
    ctx.beginPath(); ctx.arc(t.x, t.y, 9 * unit, 0, Math.PI * 2);
    ctx.fillStyle = ACC; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * unit; ctx.stroke();
  }
  // Legende
  const o0 = map({ x: 0, y: 0 }), o1 = map({ x: 1, y: 0 });
  const place = legendPlace(ctx, scene, imageRect, unit, Math.hypot(o1.x - o0.x, o1.y - o0.y), { x: 0, y: 0, w: target.width, h: target.height });
  const lrect = place?.rect ?? null;
  if (place && lrect) {
    const { rows } = place;
    ctx.font = `${11 * unit}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pad = 8 * unit, rowH = 20 * unit, gap = 8 * unit;
    const x0 = lrect.x, y0 = lrect.y;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    card(ctx, x0, y0, lrect.w, lrect.h, 8 * unit);
    ctx.globalAlpha = 1;
    rows.forEach((r, i) => {
      const cy = y0 + pad + rowH * i + rowH / 2;
      const ax = x0 + pad;
      if (r.kind === 'bar') {
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 2 * unit;
        ctx.beginPath();
        ctx.moveTo(ax, cy); ctx.lineTo(ax + r.len, cy);
        ctx.moveTo(ax, cy - 4 * unit); ctx.lineTo(ax, cy + 4 * unit);
        ctx.moveTo(ax + r.len, cy - 4 * unit); ctx.lineTo(ax + r.len, cy + 4 * unit);
        ctx.stroke();
      } else {
        drawArrow(ctx, { x: ax, y: cy }, { x: ax + r.len, y: cy }, r.kind === 'v' ? V_COLOR : A_COLOR, unit, r.kind === 'a');
      }
      ctx.fillStyle = '#000000';
      ctx.fillText(r.text, ax + r.len + gap, cy);
    });
  }
  // Δt
  if (scene.dtText) {
    ctx.font = `bold ${12 * unit}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    halo(ctx, scene.dtText, target.width - 10 * unit, target.height - 10 * unit, unit, '#000000');
  }
  ctx.restore();
  return lrect;
}
