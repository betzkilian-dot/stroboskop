import { describe, it, expect } from 'vitest';
import {
  STEPS, LOOKS, lookOf, canAdvance, canJump, applyEinfachOverlays, hasPoints, stepInfoText
} from '../../src/lib/einfach/steps';
import { createMeasurement, addObject } from '../../src/lib/measure/model';

describe('STEPS', () => {
  it('hat die fünf Schritte mit Labels', () => {
    expect(STEPS).toEqual([
      { id: 'video', label: 'Video' },
      { id: 'zuschnitt', label: 'Zuschneiden' },
      { id: 'bild', label: 'Bild' },
      { id: 'markieren', label: 'Markieren' },
      { id: 'teilen', label: 'Teilen' }
    ]);
  });
});

describe('LOOKS', () => {
  it('hat drei Einträge mit den richtigen Modi', () => {
    expect(LOOKS).toHaveLength(3);
    expect(LOOKS).toEqual([
      { id: 'auto', label: 'Automatisch', hint: 'passt meistens', mode: 'difference' },
      { id: 'hell', label: 'Helles Objekt', hint: 'z. B. Ball vor dunkler Wand', mode: 'lighten' },
      { id: 'dunkel', label: 'Dunkles Objekt', hint: 'z. B. vor heller Wand', mode: 'darken' }
    ]);
  });
  it('lookOf ordnet Modi zu, unbekannte fallen auf auto', () => {
    expect(lookOf('difference')).toBe('auto');
    expect(lookOf('lighten')).toBe('hell');
    expect(lookOf('darken')).toBe('dunkel');
    expect(lookOf('average')).toBe('auto');
  });
});

describe('canAdvance', () => {
  const ok = { hasVideo: true, selectionError: null };
  it('video: nur mit Video', () => {
    expect(canAdvance('video', { hasVideo: true, selectionError: null })).toBe(true);
    expect(canAdvance('video', { hasVideo: false, selectionError: null })).toBe(false);
  });
  it('zuschnitt: immer', () => {
    expect(canAdvance('zuschnitt', { hasVideo: false, selectionError: 'x' })).toBe(true);
    expect(canAdvance('zuschnitt', ok)).toBe(true);
  });
  it('bild und markieren: nur ohne Auswahlfehler', () => {
    expect(canAdvance('bild', ok)).toBe(true);
    expect(canAdvance('bild', { hasVideo: true, selectionError: 'zu wenige Bilder' })).toBe(false);
    expect(canAdvance('markieren', ok)).toBe(true);
    expect(canAdvance('markieren', { hasVideo: true, selectionError: 'Fehler' })).toBe(false);
  });
  it('teilen: nie', () => {
    expect(canAdvance('teilen', ok)).toBe(false);
  });
});

describe('applyEinfachOverlays', () => {
  it('setzt nur Zahlen und Bahn auf true', () => {
    const m = createMeasurement();
    m.overlays.v = true;
    m.overlays.scaleBar = true;
    applyEinfachOverlays(m);
    expect(m.overlays).toEqual({ numbers: true, path: true, v: false, a: false, scaleBar: false, dt: false, axes: false, components: false });
  });
});

describe('hasPoints', () => {
  it('leer ohne Punkte', () => {
    expect(hasPoints(createMeasurement())).toBe(false);
  });
  it('wahr, sobald ein Objekt einen Punkt hat', () => {
    const m = createMeasurement();
    addObject(m);
    m.objects[1].points[4] = { x: 1, y: 2, unsure: false };
    expect(hasPoints(m)).toBe(true);
  });
});

describe('stepInfoText', () => {
  it('Bild 1 ist „jedes Bild“', () => {
    expect(stepInfoText(1)).toBe('jedes Bild');
  });
  it('sonst „jedes n. Bild“', () => {
    expect(stepInfoText(3)).toBe('jedes 3. Bild');
  });
});

describe('canJump', () => {
  const ok = { hasVideo: true, selectionError: null };
  const bad = { hasVideo: true, selectionError: 'zu wenige Bilder' };
  it('rückwärts und gleich immer erlaubt', () => {
    expect(canJump('teilen', 'video', bad)).toBe(true);
    expect(canJump('bild', 'bild', bad)).toBe(true);
  });
  it('vorwärts ohne Fehler erlaubt (außer über Teilen hinaus nie nötig)', () => {
    expect(canJump('video', 'teilen', ok)).toBe(true);
  });
  it('vorwärts mit Auswahlfehler ab Bild gesperrt', () => {
    expect(canJump('zuschnitt', 'bild', bad)).toBe(true);
    expect(canJump('zuschnitt', 'markieren', bad)).toBe(false);
    expect(canJump('video', 'teilen', bad)).toBe(false);
    expect(canJump('bild', 'markieren', bad)).toBe(false);
  });
  it('ohne Video nicht vorwärts', () => {
    expect(canJump('video', 'zuschnitt', { hasVideo: false, selectionError: null })).toBe(false);
  });
});
