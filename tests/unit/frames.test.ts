import { describe, it, expect } from 'vitest';
import { selectFrameIndices, deltaT, stepForDesiredDt, isUniform } from '../../src/lib/frames';

describe('frames', () => {
  it('selectFrameIndices', () => {
    expect(selectFrameIndices({ startIndex: 0, endIndex: 10, step: 3, excluded: [] })).toEqual([0, 3, 6, 9]);
    expect(selectFrameIndices({ startIndex: 2, endIndex: 10, step: 4, excluded: [6] })).toEqual([2, 10]);
  });
  it('deltaT', () => {
    expect(deltaT(1, 12)).toBeCloseTo(0.0833, 4);
    expect(deltaT(2, 12)).toBeCloseTo(0.1667, 4);
    expect(deltaT(15, 60)).toBe(0.25);
  });
  it('stepForDesiredDt', () => {
    expect(stepForDesiredDt(0.133, 60)).toBe(8);
    expect(stepForDesiredDt(0.001, 60)).toBe(1);
  });
  it('isUniform', () => {
    expect(isUniform([0, 4, 8])).toBe(true);
    expect(isUniform([0, 4, 12])).toBe(false);
    expect(isUniform([])).toBe(true);
    expect(isUniform([5, 9])).toBe(true);
  });
});
