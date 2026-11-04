import { describe, it, expect } from 'vitest';
import { viewerToVideo, videoToViewer, rectToCrop, MIN_CROP, type ViewGeometry } from '../../src/lib/viewer-coords';

// Video 200x100, kein Crop, Viewer 400x400, zoom 1 -> fit = 2 (Breite), Bild zentriert
const base: ViewGeometry = {
  cw: 400, ch: 400, zoom: 1, panX: 0, panY: 0, rotation: 0, videoWidth: 200, videoHeight: 100, crop: null,
};

describe('viewerToVideo', () => {
  it('Mitte -> Mitte des Videos', () => {
    expect(viewerToVideo(200, 200, base)).toEqual({ x: 100, y: 50 });
  });
  it('linke obere Ecke des Bildes', () => {
    expect(viewerToVideo(0, 100, base)).toEqual({ x: 0, y: 0 });
  });
  it('Drehung 90 Grad: Bild wird im Uhrzeigersinn gedreht angezeigt', () => {
    // gedrehte Anzeige 100x200, fit = 2; Anzeige-Punkt oben rechts der Mitte ... obere Mitte der Anzeige = linke Mitte des Videos
    const g = { ...base, rotation: 90 as const };
    // Video-Punkt (0,50) (links Mitte) liegt nach 90deg cw oben in der Mitte: (200, 200 - 100)
    const p = viewerToVideo(200, 0, g);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(50);
  });
  it('Drehung 180', () => {
    const p = viewerToVideo(0, 100, { ...base, rotation: 180 });
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
  });
  it('Drehung 270', () => {
    // Video-Punkt (200,50) (rechts Mitte) liegt nach 270 cw (=90 ccw) oben in der Mitte
    const p = viewerToVideo(200, 0, { ...base, rotation: 270 });
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(50);
  });
  it('mit Crop: Mitte der Anzeige = Mitte des Zuschnitts', () => {
    const g = { ...base, crop: { x: 100, y: 0, w: 100, h: 100 } };
    expect(viewerToVideo(200, 200, g)).toEqual({ x: 150, y: 50 });
  });
  it('mit Zoom und Pan', () => {
    const g = { ...base, zoom: 2, panX: 40 };
    // Mitte des Bildes liegt bei 240; fit = 4
    expect(viewerToVideo(240, 200, g)).toEqual({ x: 100, y: 50 });
  });
  it('klemmt auf das Video', () => {
    expect(viewerToVideo(-500, 900, base)).toEqual({ x: 0, y: 100 });
  });
});

describe('rectToCrop', () => {
  it('normalisiert zwei Eckpunkte und rundet', () => {
    expect(rectToCrop({ x: 50.4, y: 80 }, { x: 10, y: 20.6 })).toEqual({ x: 10, y: 21, w: 40, h: 59 });
  });
  it('zu kleine Rahmen ergeben null', () => {
    expect(rectToCrop({ x: 10, y: 10 }, { x: 12, y: 50 })).toBeNull();
  });
});

describe('videoToViewer', () => {
  it('ist die Inverse von viewerToVideo (alle Drehungen, Crop, Zoom)', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const g = { ...base, rotation, zoom: 1.5, panX: 12, panY: -7, crop: { x: 20, y: 10, w: 120, h: 80 } };
      const v = videoToViewer(70, 40, g);
      const back = viewerToVideo(v.x, v.y, g);
      expect(back.x).toBeCloseTo(70);
      expect(back.y).toBeCloseTo(40);
    }
  });
});

import { clampToView } from '../../src/lib/viewer-coords';
describe('clampToView', () => {
  it('begrenzt auf Zuschnitt bzw. ganzes Bild', () => {
    expect(clampToView({ x: -5, y: 900 }, null, 100, 50)).toEqual({ x: 0, y: 50 });
    expect(clampToView({ x: 5, y: 5 }, { x: 10, y: 20, w: 30, h: 40 }, 100, 50)).toEqual({ x: 10, y: 20 });
    expect(clampToView({ x: 25, y: 30 }, { x: 10, y: 20, w: 30, h: 40 }, 100, 50)).toEqual({ x: 25, y: 30 });
  });
});

import { adjustCrop } from '../../src/lib/viewer-coords';

describe('adjustCrop', () => {
  const c = { x: 20, y: 20, w: 100, h: 60 };
  it('se vergroessert um dx/dy', () => {
    expect(adjustCrop(c, 'se', 10, 5, 200, 100)).toEqual({ x: 20, y: 20, w: 110, h: 65 });
  });
  it('klemmt am Bildrand', () => {
    expect(adjustCrop(c, 'se', 500, 500, 200, 100)).toEqual({ x: 20, y: 20, w: 180, h: 80 });
    expect(adjustCrop(c, 'nw', -500, -500, 200, 100)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
  });
  it('nw ueber se hinaus behaelt Mindestgroesse', () => {
    const r = adjustCrop(c, 'nw', 500, 500, 200, 100);
    expect(r.w).toBe(MIN_CROP);
    expect(r.h).toBe(MIN_CROP);
    expect(r.x).toBe(112);
    expect(r.y).toBe(72);
  });
  it('Kanten veraendern nur eine Achse', () => {
    expect(adjustCrop(c, 'e', 10, 99, 200, 100)).toEqual({ x: 20, y: 20, w: 110, h: 60 });
    expect(adjustCrop(c, 'n', 99, -10, 200, 100)).toEqual({ x: 20, y: 10, w: 100, h: 70 });
  });
  it('move verschiebt und klemmt am Rand', () => {
    expect(adjustCrop(c, 'move', 10, 10, 200, 100)).toEqual({ x: 30, y: 30, w: 100, h: 60 });
    expect(adjustCrop(c, 'move', 500, 500, 200, 100)).toEqual({ x: 100, y: 40, w: 100, h: 60 });
    expect(adjustCrop(c, 'move', -500, -500, 200, 100)).toEqual({ x: 0, y: 0, w: 100, h: 60 });
  });
});
