import { describe, expect, it } from 'vitest';
import { ellipsize, factsLines, footerText, IMAGE_MAX_H, paginate, planBlocks, type PBlock } from '../../src/lib/export/report';

const head: PBlock = { kind: 'tableHead', h: 80, keepWithNext: true };
const row: PBlock = { kind: 'row', h: 40 };

describe('paginate', () => {
  it('80 Zeilen: mehrere Seiten, jede Seite mit Zeilen beginnt mit Tabellenkopf', () => {
    const blocks = [head, ...Array.from({ length: 80 }, () => row)];
    const pages = paginate(blocks, 1000);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) expect(blocks[p[0]].kind).toBe('tableHead');
    const rowsSeen = pages.flat().filter((i) => blocks[i].kind === 'row');
    expect(rowsSeen).toHaveLength(80);
    for (const p of pages) expect(p.reduce((a, i) => a + blocks[i].h, 0)).toBeLessThanOrEqual(1000);
  });
  it('Diagramm, das nicht mehr passt, kommt auf die nächste Seite', () => {
    const blocks: PBlock[] = [{ kind: 'header', h: 150 }, { kind: 'image', h: 500 }, { kind: 'chart', h: 400 }, { kind: 'chart', h: 400 }];
    expect(paginate(blocks, 1000)).toEqual([[0, 1], [2, 3]]);
    expect(paginate(blocks, 1100)).toEqual([[0, 1, 2], [3]]);
  });
  it('keepWithNext hält Kopf und erste Zeile zusammen', () => {
    const blocks: PBlock[] = [{ kind: 'image', h: 950 }, head, row];
    expect(paginate(blocks, 1000)).toEqual([[0], [1, 2]]);
  });
  it('leere Liste ergibt eine leere Seite', () => {
    expect(paginate([], 1000)).toEqual([[]]);
  });
});

describe('footerText', () => {
  it('Seite 1 von 2', () => expect(footerText(1, 2)).toBe('Seite 1 von 2'));
});

describe('planBlocks', () => {
  it('Reihenfolge und Anzahl', () => {
    const b = planBlocks({ image: { w: 1600, h: 800 }, factsCount: 4, tables: [{ rows: 3 }], charts: 2 });
    expect(b.map((x) => x.kind)).toEqual(['header', 'image', 'facts', 'tableHead', 'row', 'row', 'row', 'chart', 'chart']);
    expect(b[3].keepWithNext).toBe(true);
  });
  it('Abschnitte lassen sich abschalten', () => {
    expect(planBlocks({ image: null, factsCount: 0, tables: [], charts: 0 }).map((x) => x.kind)).toEqual(['header']);
  });
});

describe('factsLines', () => {
  const base = { fps: 240, slowMotion: false, dt: 0.1, positions: 12, calibration: null, vScale: null, aScale: null };
  it('Standard', () => {
    expect(factsLines(base)).toEqual([['Bildrate', '240 Bilder/s'], ['Δt', '0,100 s'], ['Positionen', '12'], ['Maßstab', 'kein Maßstab']]);
  });
  it('Zeitlupe, Maßstab, Pfeilmaßstäbe', () => {
    const l = factsLines({ ...base, slowMotion: true, calibration: { length: 1, unit: 'm', pixels: 812 }, vScale: 0.1, aScale: 0.05 });
    expect(l[0]).toEqual(['Bildrate', 'Zeitlupe, 240 Bilder/s']);
    expect(l).toContainEqual(['Maßstab', '1,00 m ≙ 812 Pixel']);
    expect(l).toContainEqual(['Pfeilmaßstab v', '1 m/s ≙ 10 cm']);
    expect(l).toContainEqual(['Pfeilmaßstab a', '1 m/s² ≙ 5 cm']);
  });
});

describe('Zusatz', () => {
  it('zwei Tabellen: wiederholter Kopf gehört zur richtigen Tabelle', () => {
    const blocks: PBlock[] = [head, ...Array.from({ length: 5 }, () => row), head, ...Array.from({ length: 60 }, () => row)];
    const pages = paginate(blocks, 1000);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) {
      expect(blocks[p[0]].kind).not.toBe('row');
      if (p.some((i) => i > 6)) expect(p).toContain(6);
    }
  });
  it('Bildhöhe ist begrenzt', () => {
    const b = planBlocks({ image: { w: 800, h: 4000 }, factsCount: 0, tables: [], charts: 0 });
    expect(b[1].h).toBeLessThanOrEqual(IMAGE_MAX_H + 30);
    expect(IMAGE_MAX_H).toBe(Math.round(2339 * 0.4));
  });
  it('ellipsize kürzt mit …', () => {
    const m = (s: string) => s.length * 10;
    expect(ellipsize(m, 'kurz', 100)).toBe('kurz');
    const r = ellipsize(m, 'ein sehr langer Name', 100);
    expect(r.endsWith('…')).toBe(true);
    expect(m(r)).toBeLessThanOrEqual(100);
  });
});
