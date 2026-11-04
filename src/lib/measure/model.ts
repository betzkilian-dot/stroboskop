// Messmodell: Objekte und gemessene Punkte (Schlüssel = Bildindex). Reine Funktionen, keine Klassen
// (das Ganze wird später in Svelte-$state gewickelt).
import { DEFAULT_COLUMNS } from './columns';
import type { FitKind } from '../physics/fit';
import type { Pt, Calibration, Axes, ArrowPos, SamplePoint } from '../physics/kinematics';

export const OBJECT_COLORS = ['#e2382b', '#1f9d55', '#0a8fb0'];
export const V_COLOR = '#007aff';
export const A_COLOR = '#af52de';
export const UNSURE_COLOR = '#ff9500';
export const MAX_OBJECTS = 3;

export interface MeasuredPoint { x: number; y: number; unsure: boolean }
export interface TrackedObject { id: number; name: string; color: string; points: Record<number, MeasuredPoint> }
export interface Overlays { numbers: boolean; path: boolean; v: boolean; a: boolean; scaleBar: boolean; dt: boolean; axes: boolean; components: boolean }
export interface ArrowSettings { vPos: ArrowPos; aPos: ArrowPos; vScale: number | null; aScale: number | null }
export type ChartQuantity = 'x' | 'y' | 's' | 'vx' | 'vy' | 'v' | 'ax' | 'ay' | 'a' | 'xy';
export interface ChartSettings { quantity: ChartQuantity; fit: FitKind; showEquation: boolean; showR2: boolean }
export interface TableSettings { columns: string[]; decimals: 2 | 3 }
export interface Measurement {
  calibration: Calibration | null;
  axes: Axes;
  objects: TrackedObject[];
  active: number;
  overlays: Overlays;
  arrows: ArrowSettings;
  /** Legende: linke obere Ecke als Anteil der sichtbaren Bildflaeche (0..1). */
  legendPos: { x: number; y: number };
  chart: ChartSettings;
  /** Für den PDF-Bericht gesammelte Diagramme (Reihenfolge = Berichtsreihenfolge). */
  reportCharts: ChartSettings[];
  /** Messtabelle: sichtbare Spalten und Nachkommastellen (auch für den PDF-Bericht). */
  table: TableSettings;
}

function newObject(id: number, slot: number): TrackedObject {
  return { id, name: `Objekt ${slot + 1}`, color: OBJECT_COLORS[slot], points: {} };
}

export function createMeasurement(): Measurement {
  return {
    calibration: null,
    axes: { origin: null, angle: 0, yUp: true, dims: 'xy' },
    objects: [newObject(1, 0)],
    active: 1,
    overlays: { numbers: true, path: true, v: false, a: false, scaleBar: true, dt: true, axes: false, components: false },
    arrows: { vPos: 'end', aPos: 'end', vScale: null, aScale: null },
    legendPos: { x: 0.02, y: 0.02 },
    chart: { quantity: 'x', fit: 'none', showEquation: true, showR2: true },
    reportCharts: [],
    table: { columns: [...DEFAULT_COLUMNS], decimals: 3 }
  };
}

export const MAX_REPORT_CHARTS = 8;

/** Aktuelle Diagrammeinstellung für den Bericht vormerken; false bei Doppelten (Größe + Ausgleich) oder voller Liste. */
export function addReportChart(m: Measurement): boolean {
  const c = m.chart;
  if (m.reportCharts.length >= MAX_REPORT_CHARTS) return false;
  if (m.reportCharts.some(r => r.quantity === c.quantity && r.fit === c.fit)) return false;
  m.reportCharts.push({ ...c });
  return true;
}

export function removeReportChart(m: Measurement, i: number): boolean {
  if (i < 0 || i >= m.reportCharts.length) return false;
  m.reportCharts.splice(i, 1);
  return true;
}

/** Diagramme des Berichts: gesammelte Liste, sonst das aktuell eingestellte Diagramm. */
export function reportChartList(m: Measurement): ChartSettings[] {
  return (m.reportCharts.length > 0 ? m.reportCharts : [m.chart]).map(c => ({ ...c }));
}

/** Fügt ein Objekt hinzu (erste freie Farbe); false, wenn schon MAX_OBJECTS vorhanden. */
export function addObject(m: Measurement): boolean {
  if (m.objects.length >= MAX_OBJECTS) return false;
  const slot = OBJECT_COLORS.findIndex(c => !m.objects.some(o => o.color === c));
  const id = m.objects.reduce((mx, o) => Math.max(mx, o.id), 0) + 1;
  m.objects.push(newObject(id, slot));
  return true;
}

/** Entfernt ein Objekt (nie das letzte); `active` bleibt gültig. */
export function removeObject(m: Measurement, id: number): boolean {
  const i = m.objects.findIndex(o => o.id === id);
  if (i < 0 || m.objects.length <= 1) return false;
  m.objects.splice(i, 1);
  if (m.active === id) m.active = m.objects[Math.min(i, m.objects.length - 1)].id;
  return true;
}

export function activeObject(m: Measurement): TrackedObject {
  return m.objects.find(o => o.id === m.active) ?? m.objects[0];
}

/** Messreihe über die gewählten Bildindizes; ausgeblendete Punkte (nicht gewählte Bilder) fehlen. */
export function seriesFor(obj: TrackedObject, indices: number[], captureFps: number): SamplePoint[] {
  const out: SamplePoint[] = [];
  indices.forEach((frame, nr) => {
    const p = obj.points[frame];
    if (p) out.push({ nr, frame, t: (frame - indices[0]) / captureFps, px: { x: p.x, y: p.y } });
  });
  return out;
}

/** Erste Position >= from ohne Punkt, sonst erste überhaupt, sonst null. */
export function nextOpenPosition(obj: TrackedObject, indices: number[], from = 0): number | null {
  for (let i = Math.max(0, from); i < indices.length; i++) if (!obj.points[indices[i]]) return i;
  for (let i = 0; i < Math.min(from, indices.length); i++) if (!obj.points[indices[i]]) return i;
  return null;
}

/** Sichtbare Bildfläche in Video-Pixeln (Zuschnitt, sonst ganzes Bild). */
export type ViewRect = { x: number; y: number; w: number; h: number };

/** Ursprung: gesetzter `axes.origin`, sonst Mitte der sichtbaren Bildfläche (für alle Objekte gleich). */
export function originFor(m: Measurement, view: ViewRect): Pt {
  if (m.axes.origin) return { ...m.axes.origin };
  return { x: view.x + view.w / 2, y: view.y + view.h / 2 };
}

/** Erster gemessener Punkt des Objekts in Positionsreihenfolge, sonst null. */
export function firstMeasuredPoint(obj: TrackedObject, indices: number[]): Pt | null {
  for (const f of indices) {
    const p = obj.points[f];
    if (p) return { x: p.x, y: p.y };
  }
  return null;
}

/** Positionsnummer des nächsten Punktes innerhalb des Radius (Video-Pixel), sonst null. */
export function hitPoint(obj: TrackedObject, indices: number[], p: Pt, radiusPx: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  indices.forEach((f, nr) => {
    const q = obj.points[f];
    if (!q) return;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= radiusPx && d < bestD) { best = nr; bestD = d; }
  });
  return best;
}
