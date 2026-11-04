import { describe, expect, it } from 'vitest';
import { chartLayout, type ChartInput } from '../../src/lib/charts/layout';
import { chartFileName } from '../../src/lib/charts/drawChart';

const pts = [0, 1, 2, 3].map((t, i) => ({ t: t * 0.5, y: 2 * t * 0.5 + 1, nr: i + 1 }));
const input = (over: Partial<ChartInput> = {}): ChartInput => ({
  series: [{ id: 1, color: '#f00', name: 'A', points: pts }],
  xLabel: 't in s', yLabel: 'x in m', varName: 'x', fit: 'line', showEquation: true, showR2: true, activeId: 1, ...over,
});
const pad = { l: 50, r: 10, t: 10, b: 40 };

describe('chartLayout', () => {
  it('Kurve nur über den Datenbereich', () => {
    const l = chartLayout(input(), 400, 300, pad);
    expect(l.curve).not.toBeNull();
    const xs = l.curve!.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(l.points[0].x, 5);
    expect(Math.max(...xs)).toBeCloseTo(l.points[3].x, 5);
  });
  it('Teilstrich-Texte mit Komma und Minuszeichen', () => {
    const l = chartLayout(input(), 400, 300, pad);
    expect(l.xTicks.some((t) => t.text.includes(','))).toBe(true);
    const n = chartLayout(input({ series: [{ id: 1, color: '#f00', name: 'A', points: [{ t: 0, y: -2, nr: 1 }, { t: 1, y: 1, nr: 2 }] }] }), 400, 300, pad);
    expect(n.yTicks.some((t) => t.text.startsWith('−'))).toBe(true);
  });
  it('Punkte im Plotbereich', () => {
    const l = chartLayout(input(), 400, 300, pad);
    expect(l.plot).toEqual({ x: 50, y: 10, w: 340, h: 250 });
    for (const p of l.points) {
      expect(p.x).toBeGreaterThanOrEqual(l.plot.x);
      expect(p.x).toBeLessThanOrEqual(l.plot.x + l.plot.w);
      expect(p.y).toBeGreaterThanOrEqual(l.plot.y);
      expect(p.y).toBeLessThanOrEqual(l.plot.y + l.plot.h);
    }
  });
  it('Gleichung, R² und Hinweise', () => {
    const l = chartLayout(input(), 400, 300, pad);
    expect(l.equation).toMatch(/^x =/);
    expect(l.r2).toMatch(/^R² = /);
    expect(l.hint).toBeNull();
    const few = chartLayout(input({ series: [{ id: 1, color: '#f00', name: 'A', points: [pts[0]] }] }), 400, 300, pad);
    expect(few.curve).toBeNull();
    expect(few.hint).toBe('Zu wenige Punkte für den Ausgleich');
    const other = chartLayout(input({ activeId: 2 }), 400, 300, pad);
    expect(other.hint).toBe('Für dieses Objekt gibt es noch keine Punkte');
    expect(chartLayout(input({ fit: 'none' }), 400, 300, pad).equation).toBeNull();
  });
});

describe('chartFileName', () => {
  it('benennt nach Video und Größe', () => {
    expect(chartFileName('ball.mp4', 'vx')).toBe('ball_diagramm_t-vx.png');
    expect(chartFileName('ball', 'a')).toBe('ball_diagramm_t-a.png');
  });
});
