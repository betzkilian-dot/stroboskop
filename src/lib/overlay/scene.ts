import {
  type Pt, type Arrow, metersPerPixel, velocityArrows, accelArrows, componentArrows, axisDir, axisDirY, maxSpeedPx, maxAccelPx, autoArrowScale,
} from '../physics/kinematics';
import { type Measurement, type ViewRect, seriesFor, originFor } from '../measure/model';
import { formatNumber } from '../format';

export interface SceneObject {
  color: string;
  points: { nr: number; p: Pt; unsure: boolean }[];
  v: Arrow[];
  a: Arrow[];
  /** Komponenten (x und y) der v- bzw. a-Pfeile; leer ohne Schalter. */
  vc: Arrow[];
  ac: Arrow[];
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
  axes: { origin: Pt; angle: number; yUp: boolean; dims: 'xy' | 'x' | 'y'; lengthPx: number } | null;
  legendPos: { x: number; y: number };
}

type SceneAxes = NonNullable<Scene['axes']>;

export { axisDir, axisDirY };

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

/** Koordinatensystem der Szene (Ursprung, Drehung, Achsenlaenge = 12 % der langen Kante der sichtbaren Bildflaeche). */
export function sceneAxes(m: Measurement, view: ViewRect): SceneAxes {
  return {
    origin: originFor(m, view), angle: m.axes.angle, yUp: m.axes.yUp, dims: m.axes.dims,
    lengthPx: 0.12 * Math.max(view.w, view.h),
  };
}

export function buildScene(
  m: Measurement, indices: number[], captureFps: number, view: ViewRect,
  opts: { showCalibration: boolean; showAxes: boolean; highlight: { object: number; nr: number } | null; dtText: string | null },
): Scene {
  const imageLongEdge = Math.max(view.w, view.h);
  const mpp = metersPerPixel(m.calibration);
  const series = m.objects.map(o => seriesFor(o, indices, captureFps));
  const eff = (user: number | null, rate: number): number | null => {
    if (mpp === null) return null;
    const s = user ?? autoArrowScale(rate, imageLongEdge);
    return s > 0 ? s : null;
  };
  const vScale = m.overlays.v ? eff(m.arrows.vScale, Math.max(0, ...series.map(maxSpeedPx))) : null;
  const aScale = m.overlays.a ? eff(m.arrows.aScale, Math.max(0, ...series.map(maxAccelPx))) : null;

  const flat = (arrows: Arrow[]): Arrow[] => {
    if (!m.overlays.components) return [];
    const c = componentArrows(arrows, m.axes);
    return [...c.x, ...c.y];
  };
  const objects: SceneObject[] = m.objects.map((o, i) => {
    const v = vScale !== null ? velocityArrows(series[i], m.arrows.vPos, vScale) : [];
    const a = aScale !== null ? accelArrows(series[i], m.arrows.aPos, aScale) : [];
    return {
      color: o.color,
      points: series[i].map(s => ({ nr: s.nr, p: { ...s.px }, unsure: !!o.points[s.frame]?.unsure })),
      v, a, vc: flat(v), ac: flat(a),
    };
  });

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
  const axes: Scene['axes'] = opts.showAxes ? sceneAxes(m, view) : null;
  return {
    objects, showNumbers: m.overlays.numbers, showPath: m.overlays.path, vScale, aScale, mpp,
    scaleBar: m.overlays.scaleBar && mpp !== null,
    dtText: opts.dtText, calibration, highlight, axes, legendPos: { ...m.legendPos },
  };
}
