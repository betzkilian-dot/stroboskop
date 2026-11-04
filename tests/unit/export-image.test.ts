import { describe, it, expect, vi } from 'vitest';
import { createMeasurement } from '../../src/lib/measure/model';
import type { Project } from '../../src/lib/state/project.svelte';
import { settingsKey, type RenderSettings } from '../../src/lib/engine/protocol';
import { infoLineText, exportFileName, targetSize, shareOrDownload, exportSettings, exportOverlay, type ImageExportOptions } from '../../src/lib/export/image';

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
    expect(await shareOrDownload(blob, 'a.png', dl)).toBe('downloaded');
    expect(dl).toHaveBeenCalledWith(blob, 'a.png');
  });
  it('AbortError ist kein Fehler und kein Download', async () => {
    setNav(() => Promise.reject(new DOMException('x', 'AbortError')));
    const dl = vi.fn();
    expect(await shareOrDownload(blob, 'a.png', dl)).toBe('cancelled');
    expect(dl).not.toHaveBeenCalled();
  });
  it('ohne canShare: Download', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    const dl = vi.fn();
    expect(await shareOrDownload(blob, 'a.png', dl)).toBe('downloaded');
    expect(dl).toHaveBeenCalled();
  });
  it('anderer Fehler wird weitergereicht; Erfolg ohne Download', async () => {
    setNav(() => Promise.reject(new Error('boom')));
    await expect(shareOrDownload(blob, 'a.png', vi.fn())).rejects.toThrow('boom');
    const ok = vi.fn(() => Promise.resolve());
    setNav(ok);
    const dl = vi.fn();
    expect(await shareOrDownload(blob, 'a.png', dl)).toBe('shared');
    expect(ok).toHaveBeenCalled();
    expect(dl).not.toHaveBeenCalled();
  });
});

describe('exportOverlay', () => {
  const opts = (overlays: boolean, infoLine = false) =>
    ({ format: 'png', quality: 0.9, size: 'original', infoLine, overlays }) as ImageExportOptions;
  const fake = (crop: { x: number; y: number; w: number; h: number } | null, rotation: 0 | 90 | 180 | 270) => {
    const measure = createMeasurement();
    measure.objects[0].points[0] = { x: 120, y: 70, unsure: false };
    measure.objects[0].points[2] = { x: 140, y: 90, unsure: false };
    return {
      measure, measureIndices: [0, 2], captureFps: 60, crop, rotation,
      selection: { startIndex: 0, endIndex: 2, step: 2, excluded: [] },
      info: { width: 320, height: 240 },
    } as never as Project;
  };
  it('ohne Einblendungen: kein Overlay', () => {
    expect(exportOverlay(fake(null, 0), opts(false), { width: 320, height: 240 }, 320)).toBeNull();
  });
  it('bildet Punkte auf Exportpixel ab (Zuschnitt, Drehung, Skalierung)', () => {
    const o = exportOverlay(fake({ x: 100, y: 50, w: 100, h: 80 }, 90), opts(true), { width: 40, height: 50 }, 80)!;
    // Zuschnitt (20,20) -> Drehung 90: (h - y, x) = (60, 20) -> Skalierung 0,5
    expect(o.map({ x: 120, y: 70 })).toEqual({ x: 30, y: 10 });
    expect(o.scene.objects[0].points).toHaveLength(2);
    expect(o.scene.dtText).toMatch(/^Δt = /);
    expect(o.scene.calibration).toBeNull();
    expect(o.unit).toBe(1);
  });
  it('Infozeile ersetzt Δt-Einblendung', () => {
    expect(exportOverlay(fake(null, 0), opts(true, true), { width: 320, height: 240 }, 320)!.scene.dtText).toBeNull();
  });
});
