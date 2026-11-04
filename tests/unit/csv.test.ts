import { describe, it, expect } from 'vitest';
import { toCsv, csvFileName } from '../../src/lib/export/csv';
import type { Row } from '../../src/lib/physics/kinematics';

const row = (nr: number, over: Partial<Row> = {}): Row => ({
  nr, frame: nr, t: nr * 0.1, x: 0.5, y: -0.25, s: null,
  vx: null, vy: null, v: null, ax: null, ay: null, a: null, ...over,
});

describe('toCsv', () => {
  it('beginnt mit BOM und deutschem Kopf', () => {
    const s = toCsv([{ name: 'Ball', rows: [row(0)] }], 'de');
    expect(s.startsWith('\uFEFF')).toBe(true);
    expect(s.slice(1).split('\r\n')[0]).toBe('Nr;t in s;x in m;y in m;vx in m/s;vy in m/s;|v| in m/s;ax in m/s²;ay in m/s²;|a| in m/s²');
  });
  it('Dezimalkomma bzw. Punkt, fehlende Werte leer', () => {
    const rows = [row(1)];
    expect(toCsv([{ name: 'B', rows }], 'de').split('\r\n')[1]).toBe('1;0,1000;0,5000;-0,2500;;;;;;');
    expect(toCsv([{ name: 'B', rows }], 'intl').split('\r\n')[1]).toBe('1,0.1000,0.5000,-0.2500,,,,,,');
  });
  it('mehrere Objekte mit Objektzeile und Leerzeile', () => {
    const s = toCsv([{ name: 'Ball', rows: [row(0)] }, { name: 'Wagen', rows: [row(0)] }], 'de').slice(1);
    const l = s.split('\r\n');
    expect(l[0]).toBe('Objekt: Ball');
    expect(l[1].startsWith('Nr;')).toBe(true);
    expect(l[3]).toBe('');
    expect(l[4]).toBe('Objekt: Wagen');
  });
});

describe('csvFileName', () => {
  it('hängt _messung.csv an', () => expect(csvFileName('ball.mp4')).toBe('ball_messung.csv'));
});
