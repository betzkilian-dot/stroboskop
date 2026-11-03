import { describe, it, expect } from 'vitest';
import {
  selectFrameIndices, deltaT, stepForDesiredDt, isUniform,
  frameTimeS, nearestFrameIndex, displayedFrameIndex, frameSeekOffsetS, playerToMediaTime, mediaToPlayerTime, setRangeStart, setRangeEnd,
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
  it('displayedFrameIndex: zwischen zwei Zeitstempeln -> das frühere Bild', () => {
    expect(displayedFrameIndex(info, 0.024)).toBe(1);
    expect(displayedFrameIndex(info, 0.033)).toBe(1);
    expect(displayedFrameIndex(info, 0.0331)).toBe(1);
    expect(displayedFrameIndex({ nominalFps: 60, frameCount: 120 }, 0.5 + 0.9 / 60)).toBe(30);
  });
  it('displayedFrameIndex: genau auf dem Zeitstempel -> dieses Bild', () => {
    expect(displayedFrameIndex(info, 0)).toBe(0);
    expect(displayedFrameIndex(info, 0.0167)).toBe(1);
    expect(displayedFrameIndex(info, 0.0333)).toBe(2);
    expect(displayedFrameIndex({ nominalFps: 60, frameCount: 120 }, 30 / 60)).toBe(30);
  });
  it('displayedFrameIndex: knapp darunter (Gleitkomma) -> eps fängt es ab', () => {
    expect(displayedFrameIndex(info, 0.0333 - 1e-9)).toBe(2);
    expect(displayedFrameIndex(info, 0.0167 - 5e-5)).toBe(1);
    expect(displayedFrameIndex({ nominalFps: 60, frameCount: 120 }, 7 / 60 - 1e-12)).toBe(7);
    expect(displayedFrameIndex({ nominalFps: 30, frameCount: 120 }, 0.1 * 3)).toBe(9); // 0,30000000000000004
    expect(displayedFrameIndex({ nominalFps: 10, frameCount: 120 }, 0.7 - 0.1 * 1e-6)).toBe(7);
  });
  it('displayedFrameIndex: geklemmt, nicht endlich -> 0', () => {
    expect(displayedFrameIndex(info, -1)).toBe(0);
    expect(displayedFrameIndex(info, 99)).toBe(3);
    expect(displayedFrameIndex({ nominalFps: 60, frameCount: 120 }, 99)).toBe(119);
    expect(displayedFrameIndex(info, NaN)).toBe(0);
    expect(displayedFrameIndex({ nominalFps: 60, frameCount: 120 }, Infinity)).toBe(0);
  });
  it('frameSeekOffsetS: min(1 ms, 1/4 Bilddauer)', () => {
    expect(frameSeekOffsetS(60)).toBe(0.001);
    expect(frameSeekOffsetS(1000)).toBeCloseTo(0.00025, 8);
    expect(frameSeekOffsetS(NaN)).toBe(0.001);
    // Versatz bleibt im selben Bild
    expect(displayedFrameIndex(info, 0.0167 + frameSeekOffsetS(60))).toBe(1);
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
