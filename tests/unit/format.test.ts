import { describe, it, expect } from 'vitest';
import { formatDt, formatFps, formatNumber, parseFps } from '../../src/lib/format';
import { thumbnailIndices } from '../../src/lib/frames';

describe('format', () => {
  it('formatDt', () => {
    expect(formatDt(1 / 12)).toBe('0,0833 s');
    expect(formatDt(0.25)).toBe('0,250 s');
    expect(formatDt(8 / 60)).toBe('0,133 s');
    expect(formatDt(1 / 240)).toBe('0,00417 s');
  });
  it('formatNumber', () => {
    expect(formatNumber(1.5, 2)).toBe('1,50');
  });
});

describe('formatFps', () => {
  it('bis zu 2 Nachkommastellen ohne Nullen am Ende', () => {
    expect(formatFps(60)).toBe('60');
    expect(formatFps(59.94)).toBe('59,94');
    expect(formatFps(29.97003)).toBe('29,97');
    expect(formatFps(12.5)).toBe('12,5');
  });
});

describe('thumbnailIndices', () => {
  it('gleichmaessig ueber das ganze Video', () => {
    expect(thumbnailIndices(120, 8)).toEqual([0, 17, 34, 51, 68, 85, 102, 119]);
  });
  it('wenige Bilder: ohne Duplikate', () => {
    expect(thumbnailIndices(3, 8)).toEqual([0, 1, 2]);
    expect(thumbnailIndices(1, 8)).toEqual([0]);
    expect(thumbnailIndices(0, 8)).toEqual([]);
  });
});

describe('parseFps', () => {
  it('Komma und Punkt', () => {
    expect(parseFps('59,94')).toBe(59.94);
    expect(parseFps('59.94')).toBe(59.94);
    expect(parseFps(' 120 ')).toBe(120);
  });
  it('ungueltig -> null', () => {
    for (const t of ['0', '-5', 'abc', '', '1e999', 'Infinity', '1,2,3', '12abc']) expect(parseFps(t)).toBeNull();
  });
});
