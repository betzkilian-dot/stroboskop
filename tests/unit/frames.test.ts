import { describe, it, expect } from 'vitest';
import {
  selectFrameIndices, deltaT, stepForDesiredDt, isUniform,
  frameTimeS, nearestFrameIndex, playerToMediaTime, mediaToPlayerTime, setRangeStart, setRangeEnd,
} from '../../src/lib/frames';

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

describe('Zeit-Helfer', () => {
  const t = [0, 0.0167, 0.0333, 0.05];
  const info = { frameTimesS: t, nominalFps: 60, frameCount: 4 };
  it('nearestFrameIndex', () => {
    expect(nearestFrameIndex(info, 0.024)).toBe(1);
    expect(nearestFrameIndex(info, 0.026)).toBe(2);
    expect(nearestFrameIndex(info, -1)).toBe(0);
    expect(nearestFrameIndex(info, 99)).toBe(3);
    expect(nearestFrameIndex({ nominalFps: 60, frameCount: 120 }, 0.5)).toBe(30);
  });
  it('nearestFrameIndex: nicht endliche Zeit (z. B. <video> vor den Metadaten) -> 0', () => {
    expect(nearestFrameIndex(info, NaN)).toBe(0);
    expect(nearestFrameIndex({ nominalFps: 60, frameCount: 120 }, NaN)).toBe(0);
    expect(nearestFrameIndex({ nominalFps: 60, frameCount: 120 }, Infinity)).toBe(0);
  });
  it('frameTimeS', () => {
    expect(frameTimeS(info, 2)).toBe(0.0333);
    expect(frameTimeS({ nominalFps: 60 }, 30)).toBe(0.5);
  });
  it('Player-/Medienzeit', () => {
    expect(playerToMediaTime(8, 8, 1)).toBe(1);
    expect(playerToMediaTime(2, NaN, 4)).toBe(2);
    expect(mediaToPlayerTime(1, 8, 1)).toBe(8);
    expect(mediaToPlayerTime(2, 0, 4)).toBe(2);
  });
  it('setRangeStart / setRangeEnd', () => {
    const sel = { startIndex: 0, endIndex: 50, step: 1, excluded: [] };
    expect(setRangeStart(sel, 60, 100)).toEqual({ startIndex: 60, endIndex: 99 });
    expect(setRangeStart(sel, 99, 100)).toEqual({ startIndex: 98, endIndex: 99 });
    expect(setRangeStart(sel, 10, 100)).toEqual({ startIndex: 10, endIndex: 50 });
    const sel2 = { startIndex: 40, endIndex: 99, step: 1, excluded: [] };
    expect(setRangeEnd(sel2, 10, 100)).toEqual({ startIndex: 0, endIndex: 10 });
    expect(setRangeEnd(sel2, 0, 100)).toEqual({ startIndex: 0, endIndex: 1 });
    expect(setRangeEnd(sel2, 70, 100)).toEqual({ startIndex: 40, endIndex: 70 });
  });
});
