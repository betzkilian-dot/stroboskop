import { describe, it, expect } from 'vitest';
import {
  findCandidates, assignTrack, DETECT_GRID, MIN_AREA, MAX_CANDIDATES,
  type FrameCandidates, type Candidate
} from '../../src/lib/measure/detect';
import type { MeasuredPoint } from '../../src/lib/measure/model';

function mask(w: number, h: number): Float32Array {
  return new Float32Array(w * h);
}
function rect(m: Float32Array, w: number, x0: number, y0: number, rw: number, rh: number): void {
  for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) m[y * w + x] = 1;
}

describe('Konstanten', () => {
  it('haben die vorgegebenen Werte', () => {
    expect(DETECT_GRID).toBe(320);
    expect(MIN_AREA).toBe(0.0002);
    expect(MAX_CANDIDATES).toBe(5);
  });
});

describe('findCandidates', () => {
  it('findet ein Quadrat mit Schwerpunkt und Fläche', () => {
    const m = mask(200, 100);
    rect(m, 200, 50, 40, 10, 10);
    const c = findCandidates(m, 200, 100, 2);
    expect(c).toHaveLength(1);
    expect(c[0].x).toBeCloseTo(110, 0);
    expect(c[0].y).toBeCloseTo(90, 0);
    expect(c[0].area).toBeCloseTo(100 / 20000, 3);
  });

  it('liefert zwei Flächen, die größere zuerst', () => {
    const m = mask(200, 100);
    rect(m, 200, 150, 60, 6, 6);
    rect(m, 200, 20, 10, 20, 20);
    const c = findCandidates(m, 200, 100, 1);
    expect(c).toHaveLength(2);
    expect(c[0].area).toBeGreaterThan(c[1].area);
    expect(c[0].x).toBeCloseTo(30, 0);
    expect(c[1].x).toBeCloseTo(153, 0);
  });

  it('verwirft einen 1-Pixel-Fleck', () => {
    const m = mask(200, 100);
    m[50 * 200 + 100] = 1;
    expect(findCandidates(m, 200, 100, 1)).toHaveLength(0);
  });

  it('rechnet eine große Maske auf das Raster herunter', () => {
    const m = mask(1000, 500);
    rect(m, 1000, 403, 201, 40, 40);
    const c = findCandidates(m, 1000, 500, 1);
    expect(c).toHaveLength(1);
    expect(Math.abs(c[0].x - 423)).toBeLessThanOrEqual(4);
    expect(Math.abs(c[0].y - 221)).toBeLessThanOrEqual(4);
  });

  it('liefert höchstens MAX_CANDIDATES', () => {
    const m = mask(200, 100);
    for (let i = 0; i < 8; i++) rect(m, 200, 5 + i * 24, 40, 10, 10);
    expect(findCandidates(m, 200, 100, 1)).toHaveLength(MAX_CANDIDATES);
  });
});

const L = 1000;
const cand = (x: number, y: number, area = 0.01): Candidate => ({ x, y, area });
function line(n: number, y = 100): FrameCandidates[] {
  return Array.from({ length: n }, (_, i) => ({ index: i, candidates: [cand(10 + 20 * i, y)] }));
}

describe('assignTrack', () => {
  it('ordnet einen Ball auf einer Geraden sicher zu', () => {
    const r = assignTrack(line(6), {}, {}, L);
    for (let i = 0; i < 6; i++) expect(r[i]).toEqual({ x: 10 + 20 * i, y: 100, unsure: false });
  });

  it('wählt bei einem Störkandidaten weit weg den richtigen', () => {
    const f = line(6);
    f[3].candidates.unshift(cand(900, 800, 0.012));
    const r = assignTrack(f, {}, {}, L);
    expect(r[3]).toEqual({ x: 70, y: 100, unsure: false });
  });

  it('setzt ohne Kandidat keinen Punkt und danach wieder sicher', () => {
    const f = line(6);
    f[4].candidates = [];
    const r = assignTrack(f, {}, {}, L);
    expect(r[4]).toBeUndefined();
    expect(r[5]).toEqual({ x: 110, y: 100, unsure: false });
  });

  it('lässt sichere vorhandene Punkte stehen; sie lenken die Vorhersage', () => {
    const f: FrameCandidates[] = [
      { index: 0, candidates: [cand(10, 100)] },
      { index: 1, candidates: [cand(30, 100)] },
      { index: 2, candidates: [cand(50, 100)] },
      { index: 3, candidates: [cand(70, 100), cand(70, 220)] }
    ];
    const existing: Record<number, MeasuredPoint> = { 2: { x: 50, y: 160, unsure: false } };
    const r = assignTrack(f, existing, {}, L);
    expect(r[2]).toBeUndefined();
    expect(r[3]).toEqual({ x: 70, y: 220, unsure: false });
  });

  it('berechnet unsichere vorhandene Punkte neu', () => {
    const existing: Record<number, MeasuredPoint> = { 2: { x: 500, y: 500, unsure: true } };
    const r = assignTrack(line(4), existing, {}, L);
    expect(r[2]).toEqual({ x: 50, y: 100, unsure: false });
  });

  it('überspringt Kandidaten anderer Objekte', () => {
    const f: FrameCandidates[] = Array.from({ length: 4 }, (_, i) => ({
      index: i,
      candidates: [cand(10 + 20 * i, 100, 0.02), cand(10 + 20 * i, 500, 0.01)]
    }));
    const taken: Record<number, { x: number; y: number }[]> = {};
    for (let i = 0; i < 4; i++) taken[i] = [{ x: 10 + 20 * i, y: 100 }];
    const r = assignTrack(f, {}, taken, L);
    for (let i = 0; i < 4; i++) expect(r[i]).toEqual({ x: 10 + 20 * i, y: 500, unsure: false });
  });

  it('markiert einen Kandidaten 0,3·lange Kante von der Vorhersage als unsicher', () => {
    const f: FrameCandidates[] = [
      { index: 0, candidates: [cand(10, 100)] },
      { index: 1, candidates: [cand(30, 100)] },
      { index: 2, candidates: [cand(50 + 0.3 * L, 100)] }
    ];
    const r = assignTrack(f, {}, {}, L);
    expect(r[0].unsure).toBe(false);
    expect(r[2]).toEqual({ x: 350, y: 100, unsure: true });
  });

  it('markiert Flächenausreißer als unsicher', () => {
    const f = line(5);
    f[2].candidates = [cand(50, 100, 0.05)];
    const r = assignTrack(f, {}, {}, L);
    expect(r[2].unsure).toBe(true);
    expect(r[1].unsure).toBe(false);
  });

  it('markiert bei zwei ähnlich nahen Kandidaten als unsicher', () => {
    const f = line(4);
    f[3].candidates = [cand(70, 110), cand(70, 88)];
    const r = assignTrack(f, {}, {}, L);
    expect(r[3]).toEqual({ x: 70, y: 110, unsure: true });
  });
});
