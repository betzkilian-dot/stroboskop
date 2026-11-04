import type { CropRect } from './state/project.svelte';
import type { Pt } from './physics/kinematics';

/** Werkzeug auf der Buehne (Massstab, Messen, Auswerten). p = Video-Pixel, client = Viewer-Box in CSS-px. */
export interface StageTool {
  /** true = das Werkzeug uebernimmt diesen Finger (Bewegungen gehen an drag) */
  press(p: Pt, client: Pt): boolean;
  drag(p: Pt, client: Pt): void;
  release(): void;
  tap(p: Pt): void;
  cancel(): void;
}

export interface ViewGeometry {
  /** Viewer-Groesse in CSS-Pixeln */
  cw: number;
  ch: number;
  zoom: number;
  panX: number;
  panY: number;
  rotation: 0 | 90 | 180 | 270;
  /** Videogroesse in Anzeigeorientierung (Video-Pixel) */
  videoWidth: number;
  videoHeight: number;
  crop: CropRect | null;
}

/** Rechnet einen Punkt im Viewer (CSS-Pixel relativ zur Viewer-Box) in Video-Pixel um (Inverse der Viewer-Zeichnung). */
export function viewerToVideo(vx: number, vy: number, g: ViewGeometry): { x: number; y: number } {
  const c = g.crop ?? { x: 0, y: 0, w: g.videoWidth, h: g.videoHeight };
  const swap = g.rotation === 90 || g.rotation === 270;
  const rw = swap ? c.h : c.w;
  const rh = swap ? c.w : c.h;
  const fit = Math.min(g.cw / rw, g.ch / rh) * g.zoom;
  const dx = (vx - g.cw / 2 - g.panX) / fit;
  const dy = (vy - g.ch / 2 - g.panY) / fit;
  // Inverse der Uhrzeigersinn-Drehung
  let x = dx;
  let y = dy;
  if (g.rotation === 90) [x, y] = [dy, -dx];
  else if (g.rotation === 180) [x, y] = [-dx, -dy];
  else if (g.rotation === 270) [x, y] = [-dy, dx];
  const px = c.x + c.w / 2 + x;
  const py = c.y + c.h / 2 + y;
  return {
    x: Math.max(0, Math.min(g.videoWidth, px)),
    y: Math.max(0, Math.min(g.videoHeight, py)),
  };
}

export const MIN_CROP = 8;

/** Zwei Eckpunkte (Video-Pixel) -> Zuschnitt; null, wenn zu klein. */
export function rectToCrop(a: { x: number; y: number }, b: { x: number; y: number }): CropRect | null {
  const x = Math.round(Math.min(a.x, b.x));
  const y = Math.round(Math.min(a.y, b.y));
  const w = Math.round(Math.max(a.x, b.x)) - x;
  const h = Math.round(Math.max(a.y, b.y)) - y;
  return w >= MIN_CROP && h >= MIN_CROP ? { x, y, w, h } : null;
}

/** Gegenstueck zu viewerToVideo: Video-Pixel -> Viewer (CSS-Pixel relativ zur Viewer-Box), ohne Klemmung. */
export function videoToViewer(px: number, py: number, g: ViewGeometry): { x: number; y: number } {
  const c = g.crop ?? { x: 0, y: 0, w: g.videoWidth, h: g.videoHeight };
  const swap = g.rotation === 90 || g.rotation === 270;
  const rw = swap ? c.h : c.w;
  const rh = swap ? c.w : c.h;
  const fit = Math.min(g.cw / rw, g.ch / rh) * g.zoom;
  const x = px - (c.x + c.w / 2);
  const y = py - (c.y + c.h / 2);
  let dx = x;
  let dy = y;
  if (g.rotation === 90) [dx, dy] = [-y, x];
  else if (g.rotation === 180) [dx, dy] = [-x, -y];
  else if (g.rotation === 270) [dx, dy] = [y, -x];
  return { x: g.cw / 2 + g.panX + dx * fit, y: g.ch / 2 + g.panY + dy * fit };
}

/** Begrenzt einen Video-Pixel-Punkt auf das sichtbare Bild (Zuschnitt oder ganzes Bild). */
export function clampToView(p: { x: number; y: number }, crop: CropRect | null, videoWidth: number, videoHeight: number) {
  const x0 = crop ? crop.x : 0;
  const y0 = crop ? crop.y : 0;
  const x1 = crop ? crop.x + crop.w : videoWidth;
  const y1 = crop ? crop.y + crop.h : videoHeight;
  return { x: Math.min(x1, Math.max(x0, p.x)), y: Math.min(y1, Math.max(y0, p.y)) };
}

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/** Verschiebt Griff/Rahmen um (dx, dy) Video-Pixel; bleibt im Bild und mindestens MIN_CROP gross. */
export function adjustCrop(
  c: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  videoW: number,
  videoH: number,
): CropRect {
  if (handle === 'move') {
    const x = Math.round(Math.max(0, Math.min(videoW - c.w, c.x + dx)));
    const y = Math.round(Math.max(0, Math.min(videoH - c.h, c.y + dy)));
    return { x, y, w: c.w, h: c.h };
  }
  let x0 = c.x;
  let y0 = c.y;
  let x1 = c.x + c.w;
  let y1 = c.y + c.h;
  if (handle.includes('w')) x0 = Math.max(0, Math.min(x1 - MIN_CROP, x0 + dx));
  if (handle.includes('e')) x1 = Math.min(videoW, Math.max(x0 + MIN_CROP, x1 + dx));
  if (handle.includes('n')) y0 = Math.max(0, Math.min(y1 - MIN_CROP, y0 + dy));
  if (handle.includes('s')) y1 = Math.min(videoH, Math.max(y0 + MIN_CROP, y1 + dy));
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  return { x: x0, y: y0, w: Math.round(x1) - x0, h: Math.round(y1) - y0 };
}
