import { untrack } from 'svelte';
import { activeObject, hitPoint, nextOpenPosition } from '../../lib/measure/model';
import type { Pt } from '../../lib/physics/kinematics';
import { clampToView, videoToViewer, type StageTool } from '../../lib/viewer-coords';
import type { Project } from '../../lib/state/project.svelte';
import type StageMeasure from './StageMeasure.svelte';

const HIT_PX = 22;

/**
 * Gemeinsame Mess-Logik (Messen-Tab und Schritt Markieren): aktuelle Position,
 * Tippen setzt Punkt und springt weiter, Ziehen korrigiert, Legende verschieben.
 * Muss im Komponenten-Init aufgerufen werden (enthaelt $effect).
 */
export function createMeasureFlow(project: Project, getStage: () => StageMeasure | undefined) {
  let current = $state(
    untrack(() => nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? 0),
  );
  let drag = $state<{ at: Pt; client: Pt } | null>(null);
  let grabbed: number | null = null;
  let legendGrab: Pt | null = null;

  const obj = $derived(activeObject(project.measure));
  const indices = $derived(project.measureIndices);
  const setCount = $derived(indices.filter((f) => obj.points[f]).length);
  const here = $derived(current < indices.length && !!obj.points[indices[current]]);

  // Objektwechsel: zur ersten offenen Position
  $effect(() => {
    void project.measure.active;
    untrack(() => {
      current = nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? 0;
    });
  });

  // Aktuelle Position im gueltigen Bereich halten (z. B. nach Aenderung des Intervalls)
  $effect(() => {
    const n = indices.length;
    untrack(() => {
      if (current >= n) current = Math.max(0, n - 1);
    });
  });

  function hitRadius(): number {
    const g = getStage()!.geometry();
    const a = videoToViewer(0, 0, g);
    const b = videoToViewer(1, 0, g);
    const fit = Math.hypot(b.x - a.x, b.y - a.y);
    return fit > 0 ? HIT_PX / fit : HIT_PX;
  }
  const clamp = (p: Pt): Pt => clampToView(p, project.crop, project.info?.width ?? 0, project.info?.height ?? 0);
  function advance() {
    current = nextOpenPosition(activeObject(project.measure), project.measureIndices, current + 1) ?? current;
  }

  const tool: StageTool = {
    press(p, client) {
      legendGrab = getStage()!.legendGrab(client);
      if (legendGrab) return true;
      const hit = hitPoint(activeObject(project.measure), project.measureIndices, p, hitRadius());
      if (hit === null) return false;
      grabbed = hit;
      return true;
    },
    drag(p, client) {
      if (legendGrab) {
        getStage()!.moveLegend(client, legendGrab);
        return;
      }
      if (grabbed === null) return;
      const q = clamp(p);
      project.setPoint(grabbed, q);
      drag = { at: q, client };
    },
    release() {
      legendGrab = null;
      if (grabbed !== null) current = grabbed;
      grabbed = null;
      drag = null;
    },
    tap(p) {
      if (project.measureIndices.length === 0) return;
      project.setPoint(current, clamp(p));
      advance();
    },
    cancel() {
      legendGrab = null;
      grabbed = null;
      drag = null;
    },
  };

  return {
    get current() {
      return current;
    },
    set current(v: number) {
      current = v;
    },
    get drag() {
      return drag;
    },
    get obj() {
      return obj;
    },
    get indices() {
      return indices;
    },
    get setCount() {
      return setCount;
    },
    get here() {
      return here;
    },
    tool,
    async suggest() {
      await project.suggestPositions();
      current = nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? current;
    },
    clearPoints() {
      project.clearPoints();
      current = 0;
    },
  };
}
