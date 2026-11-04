import { activeObject, originFor, seriesFor, type ChartQuantity } from '../measure/model';
import { computeRows } from '../physics/kinematics';
import type { FitKind } from '../physics/fit';
import type { Project } from '../state/project.svelte';
import type { ChartInput } from './layout';
import type { ChartTitle } from './drawChart';

export const QUANTITIES: { id: ChartQuantity; label: string; name: string; unit: string; sym: string }[] = [
  { id: 'x', label: 't-x', name: 'x', unit: 'm', sym: 'x' },
  { id: 'y', label: 't-y', name: 'y', unit: 'm', sym: 'y' },
  { id: 's', label: 't-s', name: 's', unit: 'm', sym: 's' },
  { id: 'vx', label: 't-v_x', name: 'v_x', unit: 'm/s', sym: 'v_x' },
  { id: 'vy', label: 't-v_y', name: 'v_y', unit: 'm/s', sym: 'v_y' },
  { id: 'v', label: 't-|v|', name: '|v|', unit: 'm/s', sym: '|v|' },
  { id: 'ax', label: 't-a_x', name: 'a_x', unit: 'm/s²', sym: 'a_x' },
  { id: 'ay', label: 't-a_y', name: 'a_y', unit: 'm/s²', sym: 'a_y' },
  { id: 'a', label: 't-|a|', name: '|a|', unit: 'm/s²', sym: '|a|' },
];

/** Diagrammeingabe für eine Größe; aktives Objekt zuerst (Ausgleich gilt nur für die erste Reihe). */
export function chartInputFor(
  project: Project, quantity: ChartQuantity, fit: FitKind, showEquation: boolean, showR2: boolean,
): { input: ChartInput; title: ChartTitle } {
  const m = project.measure;
  const obj = activeObject(m);
  const q = QUANTITIES.find((c) => c.id === quantity) ?? QUANTITIES[0];
  const rowsFor = (o: typeof obj) =>
    computeRows(seriesFor(o, project.measureIndices, project.captureFps), originFor(m, project.viewRect), m.calibration, m.axes);
  const series = [obj, ...m.objects.filter((o) => o !== obj)]
    .map((o) => ({
      id: o.id,
      color: o.color,
      name: o.name,
      points: rowsFor(o).flatMap((r) => (r[q.id] === null ? [] : [{ t: r.t, y: r[q.id] as number, nr: r.nr }])),
    }))
    .filter((s) => s.points.length > 0);
  return {
    input: { series, xLabel: 't in s', yLabel: `${q.name} in ${q.unit}`, varName: q.sym, fit, showEquation, showR2, activeId: obj.id },
    // Bei mehreren Reihen zeigt der Farbschlüssel die Namen; der Titel nennt nur die Größe.
    title: { sym: q.label, plain: series.length > 1 ? '' : obj.name },
  };
}
