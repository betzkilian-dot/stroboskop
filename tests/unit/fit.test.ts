import { describe, it, expect } from 'vitest';
import { fitPoints, evalFit, fitEquation, formatR2 } from '../../src/lib/physics/fit';

const pts = (f: (t: number) => number, n = 8) =>
  Array.from({ length: n }, (_, i) => ({ t: i * 0.1, y: f(i * 0.1) }));

describe('fitPoints', () => {
  it('Gerade exakt, R² = 1', () => {
    const f = fitPoints(pts((t) => 1.5 * t + 2), 'line')!;
    expect(f.coef[0]).toBeCloseTo(1.5, 9);
    expect(f.coef[1]).toBeCloseTo(2, 9);
    expect(f.r2).toBeCloseTo(1, 9);
    expect(evalFit(f, 2)).toBeCloseTo(5, 9);
  });
  it('Ursprungsgerade', () => {
    const f = fitPoints(pts((t) => 9.81 * t), 'origin')!;
    expect(f.coef).toHaveLength(1);
    expect(f.coef[0]).toBeCloseTo(9.81, 9);
    expect(f.r2).toBeCloseTo(1, 9);
  });
  it('Parabel freier Fall', () => {
    const f = fitPoints(pts((t) => 2 + 3 * t - 4.905 * t * t), 'parabola')!;
    expect(f.coef[0]).toBeCloseTo(-4.905, 6);
    expect(f.coef[1]).toBeCloseTo(3, 6);
    expect(f.coef[2]).toBeCloseTo(2, 6);
    expect(f.r2).toBeCloseTo(1, 9);
  });
  it('R² < 1 bei Rauschen', () => {
    const p = pts((t) => 2 * t).map((q, i) => ({ ...q, y: q.y + (i % 2 ? 0.1 : -0.1) }));
    const f = fitPoints(p, 'line')!;
    expect(f.r2).toBeLessThan(1);
    expect(f.r2).toBeGreaterThan(0.9);
  });
  it('zu wenige Punkte -> null', () => {
    expect(fitPoints([{ t: 0, y: 1 }], 'line')).toBeNull();
    expect(fitPoints([], 'origin')).toBeNull();
    expect(fitPoints(pts((t) => t, 2), 'parabola')).toBeNull();
  });
  it('alle t gleich -> null', () => {
    const p = [{ t: 1, y: 1 }, { t: 1, y: 2 }, { t: 1, y: 3 }];
    expect(fitPoints(p, 'line')).toBeNull();
    expect(fitPoints(p, 'parabola')).toBeNull();
  });
  it('alle y gleich: R² = 1', () => {
    const f = fitPoints(pts(() => 3), 'line')!;
    expect(f.r2).toBe(1);
  });
});

describe('fitEquation / formatR2', () => {
  it('Beispiele', () => {
    expect(fitEquation({ kind: 'line', coef: [1.52, 0.01], r2: 1 }, 'x')).toBe('x = 1,52·t + 0,01');
    expect(fitEquation({ kind: 'parabola', coef: [-4.91, 2.03, -0.05], r2: 1 }, 'y')).toBe(
      'y = −4,91·t² + 2,03·t − 0,05',
    );
    expect(fitEquation({ kind: 'origin', coef: [9.81], r2: 1 }, 'v')).toBe('v = 9,81·t');
    expect(fitEquation({ kind: 'line', coef: [491.3, 0.0123], r2: 1 }, 'x')).toBe('x = 491·t + 0,0123');
  });
  it('R²', () => {
    expect(formatR2(0.9984)).toBe('R² = 0,998');
    expect(formatR2(1)).toBe('R² = 1,000');
  });
});
