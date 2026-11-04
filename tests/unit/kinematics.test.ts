import { describe, it, expect } from 'vitest';
import {
  toMeters, metersPerPixel, toWorld, computeRows, velocityArrows, accelArrows,
  maxSpeedPx, maxAccelPx, niceNumber, autoArrowScale,
  type Calibration, type Axes, type SamplePoint,
} from '../../src/lib/physics/kinematics';

const cal = (mpp: number): Calibration => ({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 100 * mpp, unit: 'm' });
const axes = (o: Partial<Axes> = {}): Axes => ({ originAtFirst: true, yUp: true, alignToScale: false, ...o });
const sp = (nr: number, t: number, x: number, y = 0): SamplePoint => ({ nr, frame: nr, t, px: { x, y } });

describe('kinematics', () => {
  it('toMeters', () => {
    expect(toMeters(50, 'cm')).toBe(0.5);
    expect(toMeters(812, 'mm')).toBeCloseTo(0.812, 10);
    expect(toMeters(2, 'm')).toBe(2);
  });

  it('metersPerPixel', () => {
    expect(metersPerPixel({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 1, unit: 'm' })).toBe(0.01);
    expect(metersPerPixel({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 0, unit: 'm' })).toBeNull();
    expect(metersPerPixel({ a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, length: 1, unit: 'm' })).toBeNull();
    expect(metersPerPixel({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: Infinity, unit: 'm' })).toBeNull();
    expect(metersPerPixel(null)).toBeNull();
  });

  it('toWorld', () => {
    const c = cal(0.01);
    const w = toWorld({ x: 200, y: 100 }, { x: 100, y: 200 }, c, axes());
    expect(w.x).toBeCloseTo(1, 9);
    expect(w.y).toBeCloseTo(1, 9);
    const w2 = toWorld({ x: 200, y: 100 }, { x: 100, y: 200 }, c, axes({ yUp: false }));
    expect(w2.x).toBeCloseTo(1, 9);
    expect(w2.y).toBeCloseTo(-1, 9);
    const c3: Calibration = { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, length: 1, unit: 'm' };
    const w3 = toWorld({ x: 100, y: 300 }, { x: 100, y: 200 }, c3, axes({ alignToScale: true }));
    expect(w3.x).toBeCloseTo(1, 9);
    expect(w3.y).toBeCloseTo(0, 9);
  });

  it('computeRows gleichförmig', () => {
    const s = [0, 1, 2, 3, 4, 5].map((i) => sp(i, i / 10, 100 + 15 * i));
    const rows = computeRows(s, { x: 100, y: 0 }, cal(0.01), axes());
    expect(rows).toHaveLength(6);
    for (let i = 0; i < 5; i++) expect(rows[i].v).toBeCloseTo(1.5, 9);
    for (let i = 0; i < 4; i++) expect(rows[i].a).toBeCloseTo(0, 9);
    expect(rows[5].v).toBeNull();
    expect(rows[4].a).toBeNull();
    expect(rows[5].a).toBeNull();
    expect(rows[4].s).toBeCloseTo(0.6, 9);
  });

  it('computeRows freier Fall', () => {
    const s = Array.from({ length: 8 }, (_, i) => {
      const t = i * 0.05;
      return sp(i, t, 0, (4.905 * t * t) / 0.001);
    });
    const rows = computeRows(s, { x: 0, y: 0 }, cal(0.001), axes({ yUp: false }));
    const withA = rows.filter((r) => r.a !== null);
    expect(withA.length).toBe(6);
    for (const r of withA) expect(Math.abs(r.a as number)).toBeCloseTo(9.81, 6);
  });

  it('computeRows ungleichmäßig', () => {
    const s = [sp(0, 0, 0), sp(1, 0.1, 0.1), sp(2, 0.3, 0.3)];
    const c: Calibration = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, length: 10, unit: 'm' };
    const rows = computeRows(s, { x: 0, y: 0 }, c, axes());
    expect(rows[0].v).toBeCloseTo(1, 9);
    expect(rows[1].v).toBeCloseTo(1, 9);
    expect(rows[0].a).toBeCloseTo(0, 9);
  });

  it('computeRows Lücke', () => {
    const s = [sp(0, 0, 0), sp(1, 0.1, 10), sp(3, 0.3, 30), sp(4, 0.4, 40)];
    const rows = computeRows(s, { x: 0, y: 0 }, cal(0.01), axes());
    expect(rows[1].v).toBeNull();
    expect(rows[0].v).not.toBeNull();
    expect(rows[0].a).toBeNull();
  });

  it('computeRows ohne Maßstab', () => {
    const rows = computeRows([sp(0, 0, 0), sp(1, 0.1, 10)], { x: 0, y: 0 }, null, axes());
    expect(rows[0].x).toBeNull();
    expect(rows[0].v).toBeNull();
    expect(rows[1].s).toBeNull();
    expect(rows[1].t).toBe(0.1);
  });

  it('velocityArrows', () => {
    const s = [sp(0, 0, 0), sp(1, 0.1, 10), sp(2, 0.2, 20)];
    expect(velocityArrows(s, 'end', 0.5)).toEqual([
      { from: { x: 10, y: 0 }, to: { x: 60, y: 0 } },
      { from: { x: 20, y: 0 }, to: { x: 70, y: 0 } },
    ]);
    expect(velocityArrows(s, 'start', 0.5)[0].from).toEqual({ x: 0, y: 0 });
    expect(velocityArrows(s, 'mid', 0.5)[0].from).toEqual({ x: 5, y: 0 });
  });

  it('accelArrows', () => {
    const s = [sp(0, 0, 0), sp(1, 0.1, 10), sp(2, 0.2, 30)];
    const mid = accelArrows(s, 'mid', 0.01);
    expect(mid).toHaveLength(1);
    expect(mid[0].from).toEqual({ x: 10, y: 0 });
    expect(mid[0].to.x).toBeCloseTo(20, 9);
    expect(accelArrows(s, 'start', 0.01)[0].from).toEqual({ x: 5, y: 0 });
    expect(accelArrows(s, 'end', 0.01)[0].from).toEqual({ x: 20, y: 0 });
  });

  it('maxSpeedPx / maxAccelPx', () => {
    const s = [sp(0, 0, 0), sp(1, 0.1, 10), sp(2, 0.2, 30)];
    expect(maxSpeedPx(s)).toBeCloseTo(200, 9);
    expect(maxAccelPx(s)).toBeCloseTo(1000, 9);
    expect(maxSpeedPx([])).toBe(0);
    expect(maxAccelPx([s[0], s[1]])).toBe(0);
  });

  it('niceNumber', () => {
    expect(niceNumber(0.37)).toBe(0.2);
    expect(niceNumber(7)).toBe(5);
    expect(niceNumber(1)).toBe(1);
    expect(niceNumber(0)).toBe(0);
    expect(niceNumber(-3)).toBe(0);
  });

  it('autoArrowScale', () => {
    expect(autoArrowScale(1000, 1000)).toBe(0.1);
    expect(autoArrowScale(0, 1000)).toBe(0);
  });
});
