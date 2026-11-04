import { describe, it, expect } from 'vitest';
import {
  createMeasurement, addObject, removeObject, activeObject, seriesFor,
  nextOpenPosition, originFor, hitPoint, OBJECT_COLORS, MAX_OBJECTS
} from '../../src/lib/measure/model';

describe('createMeasurement', () => {
  it('liefert die Standards', () => {
    const m = createMeasurement();
    expect(m.calibration).toBeNull();
    expect(m.axes).toEqual({ originAtFirst: true, origin: null, angle: 0, yUp: true });
    expect(m.overlays).toEqual({ numbers: true, path: true, v: false, a: false, scaleBar: true, dt: true, axes: false });
    expect(m.overlays.v).toBe(false);
    expect(m.arrows).toEqual({ vPos: 'end', aPos: 'mid', vScale: null, aScale: null });
    expect(m.objects).toHaveLength(1);
    expect(m.objects[0].name).toBe('Objekt 1');
    expect(m.objects[0].color).toBe('#e2382b');
    expect(m.active).toBe(m.objects[0].id);
  });
  it('liefert jedes Mal ein unabhängiges Objekt', () => {
    const a = createMeasurement();
    const b = createMeasurement();
    a.objects[0].points[1] = { x: 1, y: 2, unsure: false };
    a.overlays.v = true;
    expect(b.objects[0].points).toEqual({});
    expect(b.overlays.v).toBe(false);
  });
});

describe('Objekte', () => {
  it('addObject bis 3, dann false', () => {
    const m = createMeasurement();
    expect(addObject(m)).toBe(true);
    expect(addObject(m)).toBe(true);
    expect(addObject(m)).toBe(false);
    expect(m.objects).toHaveLength(MAX_OBJECTS);
    expect(m.objects.map(o => o.name)).toEqual(['Objekt 1', 'Objekt 2', 'Objekt 3']);
    expect(m.objects.map(o => o.color)).toEqual(OBJECT_COLORS);
    expect(new Set(m.objects.map(o => o.id)).size).toBe(3);
  });
  it('removeObject: nicht das letzte, active bleibt gültig', () => {
    const m = createMeasurement();
    expect(removeObject(m, m.objects[0].id)).toBe(false);
    addObject(m);
    addObject(m);
    const [o1, o2, o3] = m.objects.map(o => o.id);
    m.active = o2;
    expect(removeObject(m, o2)).toBe(true);
    expect(m.objects.map(o => o.id)).toEqual([o1, o3]);
    expect(m.objects.some(o => o.id === m.active)).toBe(true);
    expect(activeObject(m).id).toBe(m.active);
    m.active = o3;
    expect(removeObject(m, o1)).toBe(true);
    expect(m.active).toBe(o3);
    expect(removeObject(m, 999)).toBe(false);
  });
  it('neue Objekte nach Löschen bekommen eine frische id und freie Farbe', () => {
    const m = createMeasurement();
    addObject(m);
    removeObject(m, m.objects[0].id);
    addObject(m);
    expect(new Set(m.objects.map(o => o.id)).size).toBe(2);
    expect(new Set(m.objects.map(o => o.color)).size).toBe(2);
  });
});

describe('seriesFor', () => {
  const pt = (x: number, y = 0) => ({ x, y, unsure: false });
  it('blendet Punkte auf nicht gewählten Bildern aus und holt sie zurück', () => {
    const o = createMeasurement().objects[0];
    o.points = { 0: pt(0), 10: pt(1), 20: pt(2), 30: pt(3) };
    const s = seriesFor(o, [0, 20, 40], 100);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ nr: 0, frame: 0, t: 0, px: { x: 0, y: 0 } });
    expect(s[1].nr).toBe(1);
    expect(s[1].frame).toBe(20);
    expect(s[1].t).toBeCloseTo(20 / 100);
    expect(seriesFor(o, [0, 10, 20, 30], 100)).toHaveLength(4);
  });
  it('t relativ zum ersten gewählten Bild', () => {
    const o = createMeasurement().objects[0];
    o.points = { 5: pt(1), 15: pt(2) };
    const s = seriesFor(o, [5, 10, 15], 50);
    expect(s.map(p => p.nr)).toEqual([0, 2]);
    expect(s[1].t).toBeCloseTo(10 / 50);
  });
});

describe('nextOpenPosition', () => {
  const o = createMeasurement().objects[0];
  o.points = { 0: { x: 0, y: 0, unsure: false }, 10: { x: 0, y: 0, unsure: false } };
  it('findet ab from die erste offene Position', () => {
    expect(nextOpenPosition(o, [0, 10, 20, 30], 0)).toBe(2);
    expect(nextOpenPosition(o, [0, 10, 20, 30], 3)).toBe(3);
  });
  it('fällt auf die erste offene überhaupt zurück', () => {
    expect(nextOpenPosition(o, [0, 10, 20], 3)).toBe(2);
    const p = createMeasurement().objects[0];
    p.points = { 10: { x: 0, y: 0, unsure: false }, 20: { x: 0, y: 0, unsure: false } };
    expect(nextOpenPosition(p, [0, 10, 20], 1)).toBe(0);
  });
  it('null wenn alles belegt', () => {
    expect(nextOpenPosition(o, [0, 10])).toBeNull();
  });
});

describe('originFor', () => {
  const cal = { a: { x: 5, y: 6 }, b: { x: 15, y: 6 }, length: 1, unit: 'm' as const };
  it('erster gemessener Punkt in Positionsreihenfolge', () => {
    const m = createMeasurement();
    m.calibration = cal;
    m.objects[0].points = { 20: { x: 7, y: 8, unsure: false }, 10: { x: 3, y: 4, unsure: false } };
    expect(originFor(m, m.objects[0], [0, 10, 20])).toEqual({ x: 3, y: 4 });
  });
  it('sonst axes.origin, dann calibration.a', () => {
    const m = createMeasurement();
    m.calibration = cal;
    m.axes.originAtFirst = false;
    m.axes.origin = { x: 9, y: 9 };
    m.objects[0].points = { 10: { x: 3, y: 4, unsure: false } };
    expect(originFor(m, m.objects[0], [0, 10])).toEqual({ x: 9, y: 9 });
    m.axes.origin = null;
    expect(originFor(m, m.objects[0], [0, 10])).toEqual({ x: 5, y: 6 });
  });
  it('sonst calibration.a, sonst (0,0)', () => {
    const m = createMeasurement();
    m.calibration = cal;
    expect(originFor(m, m.objects[0], [0, 10])).toEqual({ x: 5, y: 6 });
    m.calibration = null;
    expect(originFor(m, m.objects[0], [0, 10])).toEqual({ x: 0, y: 0 });
  });
});

describe('hitPoint', () => {
  const o = createMeasurement().objects[0];
  o.points = { 0: { x: 0, y: 0, unsure: false }, 10: { x: 10, y: 0, unsure: false }, 20: { x: 100, y: 0, unsure: false } };
  it('nächster Punkt innerhalb des Radius', () => {
    expect(hitPoint(o, [0, 10, 20], { x: 7, y: 0 }, 5)).toBe(1);
    expect(hitPoint(o, [0, 10, 20], { x: 3, y: 0 }, 5)).toBe(0);
  });
  it('Radius-Grenze inklusive, außerhalb null', () => {
    expect(hitPoint(o, [0, 10, 20], { x: 15, y: 0 }, 5)).toBe(1);
    expect(hitPoint(o, [0, 10, 20], { x: 15.1, y: 0 }, 5)).toBeNull();
    expect(hitPoint(o, [0, 10, 20], { x: 50, y: 50 }, 5)).toBeNull();
  });
  it('ignoriert ausgeblendete Punkte', () => {
    expect(hitPoint(o, [0, 20], { x: 10, y: 0 }, 5)).toBeNull();
  });
});
