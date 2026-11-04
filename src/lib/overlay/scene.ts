import {
  type Pt, type Arrow, metersPerPixel, velocityArrows, accelArrows, maxSpeedPx, maxAccelPx, autoArrowScale,
} from '../physics/kinematics';
import { type Measurement, seriesFor, activeObject, originFor } from '../measure/model';
import { formatNumber } from '../format';

export interface SceneObject {
  color: string;
  points: { nr: number; p: Pt; unsure: boolean }[];
  v: Arrow[];
  a: Arrow[];
}
export interface Scene {
  objects: SceneObject[];
  showNumbers: boolean;
  showPath: boolean;
  vScale: number | null;
  aScale: number | null;
  mpp: number | null;
  scaleBar: boolean;
  dtText: string | null;
  calibration: { a: Pt; b: Pt; label: string } | null;
  highlight: Pt | null;
  axes: { origin: Pt; angle: number; yUp: boolean; lengthPx: number } | null;
  legendPos: { x: number; y: number };
}

type SceneAxes = NonNullable<Scene['axes']>;

/** Einheitsvektor der x-Achse im Bild (y nach unten). */
export function axisDir(a: Pick<SceneAxes, 'angle'>): Pt {
  return { x: Math.cos(a.angle), y: -Math.sin(a.angle) };
}

/** Einheitsvektor der y-Achse im Bild: yUp (−sin a, −cos a), sonst das Negative. */
export function axisDirY(a: Pick<SceneAxes, 'angle' | 'yUp'>): Pt {
  const s = a.yUp ? 1 : -1;
  return { x: -s * Math.sin(a.angle), y: -s * Math.cos(a.angle) };
}

/** Spitze der x-Achse in Video-Pixeln. */
export function axisTip(a: SceneAxes): Pt {
  const d = axisDir(a);
  return { x: a.origin.x + d.x * a.lengthPx, y: a.origin.y + d.y * a.lengthPx };
}

/** Spitze der y-Achse in Video-Pixeln. */
export function axisTipY(a: SceneAxes): Pt {
  const d = axisDirY(a);
  return { x: a.origin.x + d.x * a.lengthPx, y: a.origin.y + d.y * a.lengthPx };
}

const trim = (v: number, max: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: max, useGrouping: false }).format(v);

/** Länge in m als "50 cm" / "1 m" / "5 mm". */
export function formatLength(m: number): string {
  if (m >= 1) return `${trim(m, 2)} m`;
  if (m >= 0.01) return `${trim(m * 100, 2)} cm`;
  return `${trim(m * 1000, 2)} mm`;
}

/** Pfeilmaßstab L (m je 1 m/s bzw. 1 m/s²) als Text, z. B. "1 m/s ≙ 10 cm". */
export function formatScaleLabel(L: number, kind: 'v' | 'a'): string {
  const unit = kind === 'v' ? 'm/s' : 'm/s²';
  const len = L < 1 ? `${trim(L * 100, 2)} cm` : `${trim(L, 2)} m`;
  return `1 ${unit} ≙ ${len}`;
}

/** Koordinatensystem der Szene (Ursprung, Drehung, Achsenlaenge = 12 % der langen Bildkante). */
export function sceneAxes(m: Measurement, indices: number[], imageLongEdge: number): SceneAxes {
  return {
    origin: originFor(m, activeObject(m), indices), angle: m.axes.angle, yUp: m.axes.yUp,
    lengthPx: 0.12 * imageLongEdge,
  };
}

export function buildScene(
  m: Measurement, indices: number[], captureFps: number, imageLongEdge: number,
  opts: { showCalibration: boolean; showAxes: boolean; highlight: { object: number; nr: number } | null; dtText: string | null },
): Scene {
  const mpp = metersPerPixel(m.calibration);
  const series = m.objects.map(o => seriesFor(o, indices, captureFps));
  const eff = (user: number | null, rate: number): number | null => {
    if (mpp === null) return null;
    const s = user ?? autoArrowScale(rate, imageLongEdge);
    return s > 0 ? s : null;
  };
  const vScale = m.overlays.v ? eff(m.arrows.vScale, Math.max(0, ...series.map(maxSpeedPx))) : null;
  const aScale = m.overlays.a ? eff(m.arrows.aScale, Math.max(0, ...series.map(maxAccelPx))) : null;

  const objects: SceneObject[] = m.objects.map((o, i) => ({
    color: o.color,
    points: series[i].map(s => ({ nr: s.nr, p: { ...s.px }, unsure: !!o.points[s.frame]?.unsure })),
    v: vScale !== null ? velocityArrows(series[i], m.arrows.vPos, vScale) : [],
    a: aScale !== null ? accelArrows(series[i], m.arrows.aPos, aScale) : [],
  }));

  let highlight: Pt | null = null;
  if (opts.highlight) {
    const pt = objects[opts.highlight.object]?.points.find(q => q.nr === opts.highlight!.nr);
    if (pt) highlight = { ...pt.p };
  }
  let calibration: Scene['calibration'] = null;
  const c = m.calibration;
  if (opts.showCalibration && c) {
    const dec = c.unit === 'm' ? 2 : c.unit === 'cm' ? 1 : 0;
    calibration = { a: { ...c.a }, b: { ...c.b }, label: `${formatNumber(c.length, dec)} ${c.unit}` };
  }
  const axes: Scene['axes'] = opts.showAxes ? sceneAxes(m, indices, imageLongEdge) : null;
  return {
    objects, showNumbers: m.overlays.numbers, showPath: m.overlays.path, vScale, aScale, mpp,
    scaleBar: m.overlays.scaleBar && mpp !== null,
    dtText: opts.dtText, calibration, highlight, axes, legendPos: { ...m.legendPos },
  };
}
