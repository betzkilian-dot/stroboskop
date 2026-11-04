<script lang="ts">
  import { untrack } from 'svelte';
  import { formatNumber, parseLength } from '../../lib/format';
  import type { Pt } from '../../lib/physics/kinematics';
  import { videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
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
  let waiting = $state(false); // erster Punkt gesetzt, Ende fehlt
  let drag = $state<{ at: Pt; client: Pt } | null>(null);
  let dragging: 'a' | 'b' | null = null;
  let stage = $state<StageMeasure>();

  const cal = $derived(project.measure.calibration);
  const mpp = $derived(project.metersPerPixel);
  const pxDist = $derived(cal ? Math.hypot(cal.b.x - cal.a.x, cal.b.y - cal.a.y) : 0);
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

  const tool: StageTool = {
    press(p) {
      const c = project.measure.calibration;
      if (!c || waiting) return false;
      const r = hitRadius();
      const da = Math.hypot(p.x - c.a.x, p.y - c.a.y);
      const db = Math.hypot(p.x - c.b.x, p.y - c.b.y);
      if (Math.min(da, db) > r) return false;
      dragging = da <= db ? 'a' : 'b';
      return true;
    },
    drag(p, client) {
      const c = project.measure.calibration;
      if (!c || !dragging) return;
      c[dragging] = { x: p.x, y: p.y };
      drag = { at: p, client };
    },
    release() {
      dragging = null;
      drag = null;
    },
    tap(p) {
      const c = project.measure.calibration;
      if (!c) {
        project.measure.calibration = { a: p, b: p, length: parseLength(lengthText), unit };
        waiting = true;
      } else if (waiting) {
        c.b = p;
        waiting = false;
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
  function reset() {
    project.measure.calibration = null;
    waiting = false;
  }
</script>

{#if project.info}
  <div class="work">
    <StageMeasure bind:this={stage} {project} {tool} {hint} showCalibration={true} {drag} />

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

      <Card title="Koordinaten">
        <div class="switches">
          <Switch
            checked={project.measure.axes.originAtFirst}
            label="Ursprung bei Position 0"
            onchange={(v) => (project.measure.axes.originAtFirst = v)}
          />
          <Switch checked={project.measure.axes.yUp} label="y nach oben" onchange={(v) => (project.measure.axes.yUp = v)} />
          <Switch
            checked={project.measure.axes.alignToScale}
            label="Achse an Maßstab ausrichten"
            onchange={(v) => (project.measure.axes.alignToScale = v)}
          />
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
  .next {
    min-height: 48px;
  }
</style>
