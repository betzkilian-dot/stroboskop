import { describe, expect, it } from 'vitest';
import { chartLayout, type ChartInput } from '../../src/lib/charts/layout';
import { chartFileName, chartKey, drawChart, LIGHT_THEME } from '../../src/lib/charts/drawChart';

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

describe('chartLayout x-y', () => {
  const bahn = [
    { t: 0, y: 0, nr: 1 }, { t: 1, y: 0.8, nr: 2 }, { t: 2, y: 1.2, nr: 3 }, { t: 3, y: 1.2, nr: 4 }, { t: 4, y: 0.8, nr: 5 },
  ];
  const xy = (over: Partial<ChartInput> = {}) =>
    input({ series: [{ id: 1, color: '#f00', name: 'A', points: bahn }], xLabel: 'x in m', yLabel: 'y in m', varName: 'y', argName: 'x', equalScale: true, connect: true, ...over });
  it('gleicher Maßstab: Pixel je Meter auf beiden Achsen gleich', () => {
    const l = chartLayout(xy(), 400, 300, pad);
    const xs = l.xTicks, ys = l.yTicks;
    const sx = (xs[xs.length - 1].px - xs[0].px) / (xs[xs.length - 1].v - xs[0].v);
    const sy = (ys[0].px - ys[ys.length - 1].px) / (ys[ys.length - 1].v - ys[0].v);
    expect(sx).toBeCloseTo(sy, 6);
    for (const p of l.points) {
      expect(p.x).toBeGreaterThanOrEqual(l.plot.x - 1e-6);
      expect(p.x).toBeLessThanOrEqual(l.plot.x + l.plot.w + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(l.plot.y - 1e-6);
      expect(p.y).toBeLessThanOrEqual(l.plot.y + l.plot.h + 1e-6);
    }
  });
  it('gleicher Maßstab auch bei hohem Plotbereich', () => {
    const l = chartLayout(xy(), 200, 600, pad);
    const xs = l.xTicks, ys = l.yTicks;
    const sx = (xs[xs.length - 1].px - xs[0].px) / (xs[xs.length - 1].v - xs[0].v);
    const sy = (ys[0].px - ys[ys.length - 1].px) / (ys[ys.length - 1].v - ys[0].v);
    expect(sx).toBeCloseTo(sy, 6);
  });
  it('Ausgleich y = f(x) mit Gleichung in x', () => {
    const l = chartLayout(xy({ fit: 'parabola' }), 400, 300, pad);
    expect(l.equation).toMatch(/^y = .*·x²/);
    expect(l.curve).not.toBeNull();
    expect(Math.min(...l.curve!.map((p) => p.x))).toBeCloseTo(l.points[0].x, 5);
    expect(Math.max(...l.curve!.map((p) => p.x))).toBeCloseTo(l.points[4].x, 5);
  });
  it('Verbindungslinie in Zeitreihenfolge', () => {
    const l = chartLayout(xy(), 400, 300, pad);
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0].color).toBe('#f00');
    expect(l.lines[0].pts.map((p) => p.x)).toEqual(l.points.map((p) => p.x));
  });
  it('ohne connect keine Linien', () => {
    expect(chartLayout(input(), 400, 300, pad).lines).toEqual([]);
  });
});

describe('chartFileName', () => {
  it('x-y-Diagramm', () => {
    expect(chartFileName('ball.mp4', 'xy')).toBe('ball_diagramm_x-y.png');
  });
  it('benennt nach Video und Größe', () => {
    expect(chartFileName('ball.mp4', 'vx')).toBe('ball_diagramm_t-vx.png');
    expect(chartFileName('ball', 'a')).toBe('ball_diagramm_t-a.png');
  });
});

describe('drawChart', () => {
  it('zeichnet den Titel, wenn angegeben', () => {
    const texts: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 5 }) : typeof k === 'string' && k !== 'canvas' ? () => {} : undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    (ctx as unknown as { fillText: (s: string) => void }).fillText = () => {};
    const rec = new Proxy(ctx, { get: (t, k) => (k === 'fillText' ? (s: string) => texts.push(s) : (t as never)[k]) });
    const l = chartLayout(input(), 400, 300, pad);
    drawChart(rec, l, LIGHT_THEME, 't-x · Objekt 1', { width: 400, height: 300 });
    expect(texts.join('')).toContain('Objekt 1');
    texts.length = 0;
    drawChart(rec, l, LIGHT_THEME, undefined, { width: 400, height: 300 });
    expect(texts.join('')).not.toContain('Objekt 1');
  });
  it('Farbschlüssel nur bei mehr als einer Reihe', () => {
    const two = input({ series: [
      { id: 1, color: '#f00', name: 'Ball', points: pts },
      { id: 2, color: '#00f', name: 'Wagen', points: pts },
    ] });
    expect(chartKey(input())).toBeUndefined();
    expect(chartKey(two)).toEqual([{ color: '#f00', name: 'Ball' }, { color: '#00f', name: 'Wagen' }]);
    const run = (inp: ChartInput) => {
      const texts: string[] = [];
      const fills: string[] = [];
      const ctx = new Proxy({}, {
        get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 5 }) : k === 'fillText' ? (s: string) => texts.push(s)
          : typeof k === 'string' && k !== 'canvas' ? () => {} : undefined),
        set: (_t, k, v) => { if (k === 'fillStyle') fills.push(String(v)); return true; },
      }) as unknown as CanvasRenderingContext2D;
      drawChart(ctx, chartLayout(inp, 400, 300, pad), LIGHT_THEME, { sym: 't-x', plain: '' }, { width: 400, height: 300, key: chartKey(inp) });
      return { texts, fills };
    };
    const a = run(input());
    expect(a.texts).not.toContain('Ball');
    const b = run(two);
    expect(b.texts).toEqual(expect.arrayContaining(['Ball', 'Wagen']));
    expect(b.fills).toEqual(expect.arrayContaining(['#f00', '#00f']));
  });
});
