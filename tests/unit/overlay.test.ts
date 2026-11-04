import { describe, it, expect } from 'vitest';
import { exportMap } from '../../src/lib/overlay/map';
import { buildScene, formatScaleLabel } from '../../src/lib/overlay/scene';
import { drawOverlay } from '../../src/lib/overlay/draw';
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
const opts = { showCalibration: false, highlight: null, dtText: 'Δt = 0,1 s' };

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
    const s = buildScene(m, idx, 10, 1000, { showCalibration: true, highlight: { object: 0, nr: 2 }, dtText: null });
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
