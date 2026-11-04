import type { Row } from '../physics/kinematics';
import { computeRows } from '../physics/kinematics';
import { originFor, seriesFor, type TrackedObject } from './model';
import type { Project } from '../state/project.svelte';

export function rowsForObject(p: Project, o: TrackedObject): Row[] {
  return computeRows(seriesFor(o, p.measureIndices, p.captureFps), originFor(p.measure, p.viewRect), p.measure.calibration, p.measure.axes);
}

/** Objekte mit mindestens einer Position samt Messzeilen (für CSV, Tabelle und Bericht). */
export function measuredObjects(p: Project): { name: string; rows: Row[] }[] {
  return p.measure.objects
    .filter((o) => p.measureIndices.some((f) => o.points[f]))
    .map((o) => ({ name: o.name, rows: rowsForObject(p, o) }));
}
