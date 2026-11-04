import {
  type Pt, type Arrow, metersPerPixel, velocityArrows, accelArrows, maxSpeedPx, maxAccelPx, autoArrowScale,
} from '../physics/kinematics';
import { type Measurement, seriesFor } from '../measure/model';
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

export function buildScene(
  m: Measurement, indices: number[], captureFps: number, imageLongEdge: number,
  opts: { showCalibration: boolean; highlight: { object: number; nr: number } | null; dtText: string | null },
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
  return {
    objects, showNumbers: m.overlays.numbers, showPath: m.overlays.path, vScale, aScale, mpp,
    scaleBar: m.overlays.scaleBar && mpp !== null,
    dtText: opts.dtText, calibration, highlight,
  };
}
