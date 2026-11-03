import { describe, it, expect } from 'vitest';
import { infoLineText, exportFileName, targetSize } from '../../src/lib/export/image';

describe('Bild-Export Hilfsfunktionen', () => {
  it('infoLineText', () => {
    expect(infoLineText(8 / 60)).toBe('Δt = 0,133 s');
  });
  it('exportFileName', () => {
    expect(exportFileName('IMG_0042.MOV', 'png')).toBe('IMG_0042_stroboskop.png');
    expect(exportFileName('a.b.mp4', 'jpg')).toBe('a.b_stroboskop.jpg');
    expect(exportFileName('ohne', 'png')).toBe('ohne_stroboskop.png');
  });
  it('targetSize', () => {
    expect(targetSize(3840, 2160, 'worksheet')).toEqual({ width: 1600, height: 900 });
    expect(targetSize(2160, 3840, 'worksheet')).toEqual({ width: 900, height: 1600 });
    expect(targetSize(800, 600, 'worksheet')).toEqual({ width: 800, height: 600 });
    expect(targetSize(3840, 2160, 'original')).toEqual({ width: 3840, height: 2160 });
  });
});
