<script lang="ts">
  import { untrack } from 'svelte';
  import { formatNumber, parseLength } from '../../lib/format';
  import type { Pt } from '../../lib/physics/kinematics';
  import { clampToView, videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
  import { activeObject } from '../../lib/measure/model';
  import { axisTip, axisTipY, sceneAxes } from '../../lib/overlay/scene';
  import StageMeasure from './StageMeasure.svelte';
  import Card from '../components/Card.svelte';
  import Notice from '../components/Notice.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Switch from '../components/Switch.svelte';

  let { project, onnext }: { project: Project; onnext: () => void } = $props();

  type Unit = 'mm' | 'cm' | 'm';
  const HIT_PX = 22;
  const units = [
    { id: 'mm', label: 'mm' },
    { id: 'cm', label: 'cm' },
    { id: 'm', label: 'm' },
  ];

  let lengthText = $state('');
  let unit = $state<Unit>('cm');
  {
    // beim Wiederoeffnen der Phase: Felder aus vorhandenem Massstab uebernehmen
    const c0 = untrack(() => project.measure.calibration);
    if (c0) {
      if (c0.length > 0) lengthText = String(c0.length).replace('.', ',');
      unit = c0.unit;
    }
  }
  let drag = $state<{ at: Pt; client: Pt } | null>(null);
  let dragging: 'a' | 'b' | 'origin' | 'tip' | 'shaft' | null = null;
  let grab: Pt = { x: 0, y: 0 };
  let stage = $state<StageMeasure>();

  const cal = $derived(project.measure.calibration);
  const mpp = $derived(project.metersPerPixel);
  const pxDist = $derived(cal ? Math.hypot(cal.b.x - cal.a.x, cal.b.y - cal.a.y) : 0);
  // erster Punkt gesetzt, Ende fehlt: a und b fallen zusammen (aus der Kalibrierung abgeleitet, ueberlebt Phasenwechsel)
  const waiting = $derived(cal !== null && pxDist < 4);
  const hint = $derived(
    !cal ? 'Anfang der bekannten Strecke antippen' : waiting ? 'Ende antippen' : 'Endpunkte ziehen zum Korrigieren',
  );

  /** Trefferradius (22 CSS-px) in Video-Pixeln */
  function hitRadius(): number {
    const g = stage!.geometry();
    // CSS-px je Video-Pixel ueber zwei Punkte im Abstand 1 px
    const a = videoToViewer(0, 0, g);
    const b = videoToViewer(1, 0, g);
    const fit = Math.hypot(b.x - a.x, b.y - a.y);
    return fit > 0 ? HIT_PX / fit : HIT_PX;
  }

  function distToSegment(p: Pt, a: Pt, b: Pt): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
  }

  function currentAxes() {
    return sceneAxes(project.measure, project.viewRect);
  }

  const dims = $derived(project.measure.axes.dims);
  const dimOptions = [
    { id: 'xy', label: 'x und y' },
    { id: 'x', label: 'nur x' },
    { id: 'y', label: 'nur y' },
  ];
  /** Erster gemessener Punkt des aktiven Objekts (Position 0 der Messung) oder null. */
  const firstPoint = $derived.by(() => {
    const o = activeObject(project.measure);
    for (const f of project.measureIndices) {
      const q = o.points[f];
      if (q) return { x: q.x, y: q.y };
    }
    return null;
  });

  /** Winkel in (-180, 180] ganze Grad */
  const angleDeg = $derived.by(() => {
    let d = Math.round((project.measure.axes.angle * 180) / Math.PI) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  });

  const clamp = (p: Pt): Pt => clampToView(p, project.crop, project.info?.width ?? 0, project.info?.height ?? 0);

  const tool: StageTool = {
    press(p) {
      const c = project.measure.calibration;
      const r = hitRadius();
      if (c && !waiting) {
        const da = Math.hypot(p.x - c.a.x, p.y - c.a.y);
        const db = Math.hypot(p.x - c.b.x, p.y - c.b.y);
        if (Math.min(da, db) <= r) {
          dragging = da <= db ? 'a' : 'b';
          return true;
        }
      }
      // Solange die Strecke gesetzt wird, gehen Tipps an den Maßstab (der Ursprung liegt in der Bildmitte)
      if (!c || waiting) return false;
      const ax = currentAxes();
      // Drehgriff: Spitze der gezeichneten Achse (bei „nur y“ die y-Achse)
      const t = dims === 'y' ? axisTipY(ax) : axisTip(ax);
      if (Math.hypot(p.x - t.x, p.y - t.y) <= r) {
        dragging = 'tip';
        return true;
      }
      if (Math.hypot(p.x - ax.origin.x, p.y - ax.origin.y) <= r) {
        dragging = 'origin';
        grab = { x: 0, y: 0 };
        return true;
      }
      // Achsenschaft (x oder y): fasst das ganze Koordinatensystem
      for (const end of dims === 'xy' ? [axisTip(ax), axisTipY(ax)] : [t]) {
        if (distToSegment(p, ax.origin, end) <= r) {
          dragging = 'shaft';
          grab = { x: ax.origin.x - p.x, y: ax.origin.y - p.y };
          return true;
        }
      }
      return false;
    },
    drag(p, client) {
      if (!dragging) return;
      const q = clamp(p);
      const axes = project.measure.axes;
      if (dragging === 'origin' || dragging === 'shaft') {
        const o = clamp({ x: p.x + grab.x, y: p.y + grab.y });
        axes.origin = { x: o.x, y: o.y };
      } else if (dragging === 'tip') {
        const o = currentAxes().origin;
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        if (Math.hypot(dx, dy) > 0.5) {
          let a = Math.atan2(-dy, dx);
          // „nur y“: die y-Achse folgt dem Finger (x-Achse liegt 90° daneben)
          if (axes.dims === 'y') a -= axes.yUp ? Math.PI / 2 : -Math.PI / 2;
          const snap = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
          if (Math.abs(a - snap) < (3 * Math.PI) / 180) a = snap;
          axes.angle = Math.atan2(Math.sin(a), Math.cos(a));
        }
      } else {
        const c = project.measure.calibration;
        if (!c) return;
        c[dragging] = { x: q.x, y: q.y };
      }
      drag = { at: q, client };
    },
    release() {
      dragging = null;
      drag = null;
    },
    tap(p0) {
      const p = clamp(p0);
      const c = project.measure.calibration;
      if (!c) {
        project.measure.calibration = { a: { ...p }, b: { ...p }, length: parseLength(lengthText), unit };
      } else if (waiting) {
        c.b = { ...p };
      }
    },
    cancel() {
      dragging = null;
      drag = null;
    },
  };

  function setLength(e: Event & { currentTarget: HTMLInputElement }) {
    lengthText = e.currentTarget.value;
    const c = project.measure.calibration;
    if (c) c.length = parseLength(lengthText);
  }
  function setUnit(id: string) {
    unit = id as Unit;
    const c = project.measure.calibration;
    if (c) c.unit = unit;
  }
  function alignToScale() {
    const c = project.measure.calibration;
    if (c) project.measure.axes.angle = Math.atan2(-(c.b.y - c.a.y), c.b.x - c.a.x);
  }
  function resetAxes() {
    const axes = project.measure.axes;
    axes.origin = null;
    axes.angle = 0;
    axes.dims = 'xy';
  }
  function originToFirst() {
    const q = firstPoint;
    if (q) project.measure.axes.origin = q;
  }
  function reset() {
    project.measure.calibration = null;
  }
</script>

{#if project.info}
  <div class="work">
    <StageMeasure bind:this={stage} {project} {tool} {hint} showCalibration={true} showAxes={true} {drag} />

    <div class="col">
      <Card title="Bekannte Strecke">
        <p class="lead">Länge der Strecke zwischen den beiden Punkten im Bild, z. B. am Lineal.</p>
        <label class="field">
          Länge
          <input
            data-testid="scale-length"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            value={lengthText}
            oninput={setLength}
          />
        </label>
        <Segmented label="Einheit" options={units} value={unit} onchange={setUnit} />
        {#if mpp !== null}
          <p class="info" data-testid="scale-info">
            ≙ {Math.round(pxDist)} Pixel · 1 Pixel = {formatNumber(mpp * 1000, 2)} mm
          </p>
        {/if}
        <button type="button" disabled={!cal} onclick={reset}>Strecke neu setzen</button>
      </Card>

      <Card title="Koordinatensystem">
        <p class="info" data-testid="axes-angle">Drehung: {angleDeg}°</p>
        <Segmented label="Achsen" options={dimOptions} value={dims} onchange={(id) => (project.measure.axes.dims = id as 'xy' | 'x' | 'y')} />
        <div class="switches">
          <Switch checked={project.measure.axes.yUp} label="y nach oben" onchange={(v) => (project.measure.axes.yUp = v)} />
        </div>
        <div class="btns">
          <button type="button" disabled={!firstPoint} onclick={originToFirst}>Auf Position 0 setzen</button>
          <button type="button" disabled={!cal || waiting} onclick={alignToScale}>An Maßstab ausrichten</button>
          <button type="button" onclick={resetAxes}>Zurücksetzen</button>
        </div>
      </Card>

      <Notice>Der Maßstab gilt nur in der Ebene der Bewegung – das Lineal sollte auf Höhe der Bahn liegen.</Notice>

      <button type="button" class="btn primary next" onclick={onnext}>Weiter zu Messen ›</button>
    </div>
  </div>
{/if}

<style>
  .lead {
    margin: 0 0 8px;
    color: var(--muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }
  .field input {
    min-height: 44px;
    font-size: 1rem;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .info {
    margin: 8px 0;
    font-variant-numeric: tabular-nums;
  }
  .switches {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .btns button {
    min-height: 44px;
  }
  .next {
    min-height: 48px;
  }
</style>
