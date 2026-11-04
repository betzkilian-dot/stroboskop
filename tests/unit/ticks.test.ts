import { describe, it, expect } from 'vitest';
import { niceTicks } from '../../src/lib/charts/ticks';

describe('niceTicks', () => {
  it('0..0,93', () => {
    expect(niceTicks(0, 0.93)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('-2,1..2,5 enthält 0, Schritt 1', () => {
    const t = niceTicks(-2.1, 2.5);
    expect(t).toContain(0);
    expect(t[1] - t[0]).toBe(1);
    expect(t[0]).toBeLessThanOrEqual(-2.1);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(2.5);
  });
  it('min = max', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const t = niceTicks(5, 5);
    expect(t[0]).toBeLessThanOrEqual(4);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(6);
  });
});
