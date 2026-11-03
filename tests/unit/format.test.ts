import { describe, it, expect } from 'vitest';
import { formatDt, formatNumber } from '../../src/lib/format';

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
