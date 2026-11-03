import { describe, it, expect, vi } from 'vitest';
import { settingsKey, type RenderSettings } from '../../src/lib/engine/protocol';
import { infoLineText, exportFileName, targetSize, shareOrDownload, exportSettings } from '../../src/lib/export/image';

describe('Bild-Export Hilfsfunktionen', () => {
  it('infoLineText', () => {
    expect(infoLineText(8 / 60)).toBe('Δt = 0,133 s');
  });
  it('infoLineText bei ungleichmäßigen Positionen', () => {
    expect(infoLineText(8 / 60, false)).toBe('Δt = 0,133 s (nicht gleichmäßig)');
    expect(infoLineText(8 / 60, true)).toBe('Δt = 0,133 s');
  });
  it('exportSettings nutzt autoThreshold nur bei passendem settingsKey', () => {
    const base = {
      selection: { startIndex: 0, endIndex: 9, step: 1, excluded: [] },
      compose: { threshold: -1, mode: 'difference' },
      captureFps: 60,
    } as never as RenderSettings;
    const prev = { autoThreshold: 0.37, settingsKey: settingsKey(base) } as never;
    expect(exportSettings(base, prev).compose.threshold).toBe(0.37);
    expect(exportSettings(base, null).compose.threshold).toBe(-1);
    const fixed = { ...base, compose: { ...base.compose, threshold: 0.2 } } as RenderSettings;
    expect(exportSettings(fixed, prev).compose.threshold).toBe(0.2);
    // anderer Modus / Schritt: Schluessel passt nicht -> Export rechnet selbst
    const otherMode = { ...base, compose: { ...base.compose, mode: 'lighten' } } as RenderSettings;
    expect(exportSettings(otherMode, prev).compose.threshold).toBe(-1);
    const otherStep = { ...base, selection: { ...base.selection, step: 2 } } as RenderSettings;
    expect(exportSettings(otherStep, prev).compose.threshold).toBe(-1);
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

describe('shareOrDownload', () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const setNav = (share: unknown) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { canShare: () => true, share },
      configurable: true,
    });
  };
  it('NotAllowedError faellt auf Download zurueck', async () => {
    setNav(() => Promise.reject(new DOMException('x', 'NotAllowedError')));
    const dl = vi.fn();
    await shareOrDownload(blob, 'a.png', dl);
    expect(dl).toHaveBeenCalledWith(blob, 'a.png');
  });
  it('AbortError ist kein Fehler und kein Download', async () => {
    setNav(() => Promise.reject(new DOMException('x', 'AbortError')));
    const dl = vi.fn();
    await shareOrDownload(blob, 'a.png', dl);
    expect(dl).not.toHaveBeenCalled();
  });
  it('anderer Fehler wird weitergereicht; Erfolg ohne Download', async () => {
    setNav(() => Promise.reject(new Error('boom')));
    await expect(shareOrDownload(blob, 'a.png', vi.fn())).rejects.toThrow('boom');
    const ok = vi.fn(() => Promise.resolve());
    setNav(ok);
    const dl = vi.fn();
    await shareOrDownload(blob, 'a.png', dl);
    expect(ok).toHaveBeenCalled();
    expect(dl).not.toHaveBeenCalled();
  });
});
