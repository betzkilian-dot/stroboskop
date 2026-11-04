import { describe, it, expect } from 'vitest';
import { exportMap, imageRectOf } from '../../src/lib/overlay/map';
import { toWorld } from '../../src/lib/physics/kinematics';
import { buildScene, axisTip, axisTipY, formatScaleLabel } from '../../src/lib/overlay/scene';
import { drawOverlay, legendRect } from '../../src/lib/overlay/draw';
import { cropRotate } from '../../src/lib/compose/transform';
import { createMeasurement } from '../../src/lib/measure/model';

describe('exportMap', () => {
  it('skaliert ohne Zuschnitt', () => {
    expect(exportMap(null, 0, 100, 50, 2)({ x: 10, y: 5 })).toEqual({ x: 20, y: 10 });
  });
  it('crop + 90°', () => {
    const f = exportMap({ x: 10, y: 20, w: 100, h: 50 }, 90, 200, 200, 2);
    expect(f({ x: 10, y: 20 })).toEqual({ x: 100, y: 0 });
    expect(f({ x: 110, y: 70 })).toEqual({ x: 0, y: 200 });
  });
  it('stimmt mit cropRotate überein', () => {
    const crop = { x: 10, y: 20, w: 100, h: 50 };
    for (const rot of [0, 90, 180, 270] as const) {
      const W = 150, H = 120, mx = 37, my = 41;
      const data = new Uint8ClampedArray(W * H * 4);
      data[(my * W + mx) * 4] = 255;
      const out = cropRotate({ width: W, height: H, data }, crop, rot);
      const i = out.data.findIndex((v, j) => j % 4 === 0 && v === 255);
      const px = (i / 4) % out.width, py = Math.floor(i / 4 / out.width);
      const m = exportMap(crop, rot, W, H, 1)({ x: mx + 0.5, y: my + 0.5 });
      expect(Math.floor(m.x)).toBe(px);
      expect(Math.floor(m.y)).toBe(py);
    }
  });
});

function measured() {
  const m = createMeasurement();
  const idx = [0, 1, 2, 3];
  idx.forEach((f, i) => { m.objects[0].points[f] = { x: 100 + i * 50, y: 100, unsure: i === 1 }; });
  return { m, idx };
}
const opts = { showCalibration: false, showAxes: false, highlight: null, dtText: 'Δt = 0,1 s' };

describe('buildScene', () => {
  it('ohne Maßstab keine Pfeile', () => {
    const { m, idx } = measured();
    m.overlays.v = true;
    const s = buildScene(m, idx, 10, 1000, opts);
    expect(s.vScale).toBeNull();
    expect(s.objects[0].v).toHaveLength(0);
  });
  it('mit Maßstab Pfeile = Punkte - 1', () => {
    const { m, idx } = measured();
    m.overlays.v = true;
    m.calibration = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' };
    const s = buildScene(m, idx, 10, 1000, opts);
    expect(s.vScale).toBeGreaterThan(0);
    expect(s.objects[0].v).toHaveLength(3);
    expect(s.aScale).toBeNull();
  });
  it('Hervorhebung und Maßstabslinie', () => {
    const { m, idx } = measured();
    m.calibration = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' };
    const s = buildScene(m, idx, 10, 1000, { showCalibration: true, showAxes: false, highlight: { object: 0, nr: 2 }, dtText: null });
    expect(s.highlight).toEqual({ x: 200, y: 100 });
    expect(s.calibration?.label).toBe('1,00 m');
  });
});

describe('formatScaleLabel', () => {
  it('Beispiele', () => {
    expect(formatScaleLabel(0.1, 'v')).toBe('1 m/s ≙ 10 cm');
    expect(formatScaleLabel(0.025, 'a')).toBe('1 m/s² ≙ 2,5 cm');
    expect(formatScaleLabel(1.5, 'v')).toBe('1 m/s ≙ 1,5 m');
  });
});

function fakeCtx() {
  const log: string[] = [];
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get(t, k: string) {
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      return (...a: unknown[]) => { log.push(`${k}(${a.join(',')})`); };
    },
    set(t, k: string, v) { t[k] = v; log.push(`${k}=${v}`); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

describe('drawOverlay', () => {
  const setup = () => {
    const { m, idx } = measured();
    m.overlays.v = true;
    m.calibration = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' };
    return buildScene(m, idx, 10, 1000, opts);
  };
  const target = { width: 1000, height: 600 };
  it('Bildschirm enthält Unsicher-Orange, Export nicht', () => {
    const scene = setup();
    const a = fakeCtx();
    drawOverlay(a.ctx, scene, p => p, 1, { ...target, screen: true });
    expect(a.log.join('\n')).toContain('#ff9500');
    const b = fakeCtx();
    drawOverlay(b.ctx, scene, p => p, 1, { ...target, screen: false });
    expect(b.log.join('\n')).not.toContain('#ff9500');
  });
  it('Nummern, Legende, Kreise', () => {
    const f = fakeCtx();
    drawOverlay(f.ctx, setup(), p => p, 1, { ...target, screen: false });
    const log = f.log.join('\n');
    for (const n of ['0', '1', '2', '3']) expect(log).toContain(`fillText(${n},`);
    expect(log).toContain('fillText(≙ 1 m/s,');
    expect(f.log.filter(l => l.startsWith('arc(')).length).toBe(4);
  });
});

describe('Koordinatensystem', () => {
  const sceneWithAxes = (angle = 0) => {
    const { m, idx } = measured();
    m.axes.angle = angle;
    return buildScene(m, idx, 10, 1000, { ...opts, showAxes: true });
  };
  it('buildScene: axes nur mit showAxes', () => {
    const { m, idx } = measured();
    expect(buildScene(m, idx, 10, 1000, opts).axes).toBeNull();
    const s = sceneWithAxes();
    expect(s.axes).not.toBeNull();
    expect(s.axes!.lengthPx).toBeCloseTo(120, 9);
  });
  it('axisTip folgt dem Winkel (Bild-y nach unten)', () => {
    const s = sceneWithAxes(Math.PI / 2);
    const tip = axisTip(s.axes!);
    expect(tip.x).toBeCloseTo(s.axes!.origin.x, 6);
    expect(tip.y).toBeCloseTo(s.axes!.origin.y - 120, 6);
  });
  it('zeichnet x und y', () => {
    const f = fakeCtx();
    drawOverlay(f.ctx, sceneWithAxes(), p => p, 1, { width: 1000, height: 600, screen: true });
    const log = f.log.join('\n');
    expect(log).toContain('fillText(x,');
    expect(log).toContain('fillText(y,');
  });
});

describe('Achsenzeichnung passt zu toWorld', () => {
  for (const yUp of [true, false]) for (const angle of [0, Math.PI / 2, Math.PI / 6]) {
    it(`angle ${angle.toFixed(2)}, yUp ${yUp}`, () => {
      const { m, idx } = measured();
      m.axes.angle = angle; m.axes.yUp = yUp;
      m.calibration = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' };
      const ax = buildScene(m, idx, 10, 1000, { ...opts, showAxes: true }).axes!;
      const L = ax.lengthPx * 0.01;
      const wx = toWorld(axisTip(ax), ax.origin, m.calibration, m.axes);
      const wy = toWorld(axisTipY(ax), ax.origin, m.calibration, m.axes);
      expect(wx.x).toBeCloseTo(L, 9); expect(wx.y).toBeCloseTo(0, 9);
      expect(wy.x).toBeCloseTo(0, 9); expect(wy.y).toBeCloseTo(L, 9);
    });
  }
});

describe('Legende verschiebbar', () => {
  const sceneAt = (x: number, y: number) => {
    const { m, idx } = measured();
    m.overlays.v = true;
    m.calibration = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' };
    m.legendPos = { x, y };
    return buildScene(m, idx, 10, 1000, opts);
  };
  const img = { x: 100, y: 50, w: 800, h: 500 };
  it('Standardposition 0,02 und buildScene gibt legendPos weiter', () => {
    expect(createMeasurement().legendPos).toEqual({ x: 0.02, y: 0.02 });
    expect(sceneAt(0.3, 0.4).legendPos).toEqual({ x: 0.3, y: 0.4 });
  });
  it('Position ist relativ zur Bildfläche', () => {
    const r = legendRect(fakeCtx().ctx, sceneAt(0.5, 0.5), img, 1, 1)!;
    expect(r.x).toBeCloseTo(100 + 400, 6);
    expect(r.y).toBeCloseTo(50 + 250, 6);
  });
  it('bei 0,98 bleibt die Legende vollständig im Bild', () => {
    const r = legendRect(fakeCtx().ctx, sceneAt(0.98, 0.98), img, 1, 1)!;
    expect(r.x + r.w).toBeLessThanOrEqual(900 + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(550 + 1e-9);
    expect(r.x).toBeGreaterThanOrEqual(100);
  });
  it('ohne Legendeninhalt null; drawOverlay liefert dasselbe Rechteck', () => {
    const { m, idx } = measured();
    expect(legendRect(fakeCtx().ctx, buildScene(m, idx, 10, 1000, opts), img, 1, 1)).toBeNull();
    const sc = sceneAt(0.98, 0.98);
    const r = legendRect(fakeCtx().ctx, sc, { x: 0, y: 0, w: 1000, h: 600 }, 1, 1);
    const d = drawOverlay(fakeCtx().ctx, sc, p => p, 1, { width: 1000, height: 600, screen: false });
    expect(d).toEqual(r);
  });
  it('imageRectOf: Hüllrechteck der abgebildeten Bildecken', () => {
    const map = (p: { x: number; y: number }) => ({ x: 10 + p.y * 2, y: 5 + p.x * 2 }); // Drehung/Spiegelung
    expect(imageRectOf(map, { x: 20, y: 10, w: 100, h: 50 }, 320, 240)).toEqual({ x: 30, y: 45, w: 100, h: 200 });
    expect(imageRectOf(map, null, 320, 240)).toEqual({ x: 10, y: 5, w: 480, h: 640 });
  });
});
