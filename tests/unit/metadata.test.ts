import { describe, it, expect } from 'vitest';
import { detectFps, snapFps, rotationFromMatrix } from '../../src/lib/video/metadata';

describe('metadata', () => {
  it('snapFps', () => {
    expect(snapFps(59.94)).toBe(59.94);
    expect(snapFps(239.8)).toBe(240);
    expect(snapFps(29.97)).toBe(29.97);
  });
  it('detectFps konstant', () => {
    expect(detectFps({ timescale: 600, sampleDurations: Array(120).fill(10), mediaDuration: 1200 }))
      .toEqual({ nominalFps: 60, captureFps: 60, fpsCertain: true, slowMotion: false });
  });
  it('Zeitlupe', () => {
    const r = detectFps({ timescale: 2400, sampleDurations: Array(480).fill(10), mediaDuration: 4800, editDuration: 16000, movieTimescale: 1000 });
    expect(r.slowMotion).toBe(true);
    expect(r.captureFps).toBe(240);
  });
  it('variable Bildrate', () => {
    expect(detectFps({ timescale: 600, sampleDurations: [10, 20, 10, 20, 10, 20], mediaDuration: 90 }).fpsCertain).toBe(false);
  });
  it('rotationFromMatrix', () => {
    expect(rotationFromMatrix([0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824])).toBe(90);
    expect(rotationFromMatrix([65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824])).toBe(0);
    expect(rotationFromMatrix([-65536, 0, 0, 0, -65536, 0, 0, 0, 1073741824])).toBe(180);
    expect(rotationFromMatrix([0, -65536, 0, 65536, 0, 0, 0, 0, 1073741824])).toBe(270);
  });
});
