import { describe, it, expect } from 'vitest';
import { keyframeFor, needsRestart, type GopSample } from '../../src/lib/video/gop';

// Dekodierreihenfolge mit offener GOP: CRA (pts 100) bei Index 3, RASL-Bild (pts 80) folgt im Strom bei Index 4
const samples: GopSample[] = [
  { isKey: true, timestampUs: 0 }, // 0 IDR
  { isKey: false, timestampUs: 20 },
  { isKey: false, timestampUs: 40 },
  { isKey: true, timestampUs: 100 }, // 3 CRA
  { isKey: false, timestampUs: 80 }, // 4 RASL (fuehrend, pts < CRA)
  { isKey: false, timestampUs: 120 },
];

describe('keyframeFor', () => {
  it('nimmt den letzten Keyframe mit pts <= Ziel-pts', () => {
    expect(keyframeFor(samples, 5, 120)).toBe(3);
    expect(keyframeFor(samples, 2, 40)).toBe(0);
  });
  it('ueberspringt die CRA fuer fuehrende Bilder (RASL)', () => {
    expect(keyframeFor(samples, 4, 80)).toBe(0);
  });
});

describe('needsRestart', () => {
  it('RASL-Ziel nach Lauf ab CRA erzwingt Neustart (Keyframe 0 < runStart 3)', () => {
    const kf = keyframeFor(samples, 4, 80);
    expect(needsRestart(false, 6, 3, kf)).toBe(true);
  });
  it('normales Ziel im laufenden Lauf: kein Neustart', () => {
    expect(needsRestart(false, 6, 3, keyframeFor(samples, 5, 120))).toBe(false);
  });
  it('bereits ausgegeben -> Neustart; kein aktiver Lauf -> keiner', () => {
    expect(needsRestart(true, 6, 0, 0)).toBe(true);
    expect(needsRestart(false, -1, -1, 0)).toBe(false);
  });
});
