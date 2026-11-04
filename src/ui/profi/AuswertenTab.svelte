<script lang="ts">
  import { activeObject, hitPoint, originFor, seriesFor } from '../../lib/measure/model';
  import { computeRows } from '../../lib/physics/kinematics';
  import { videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
  import StageMeasure from './StageMeasure.svelte';
  import Card from '../components/Card.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Switch from '../components/Switch.svelte';
  import Icon from '../components/Icon.svelte';
  import MeasureTable, { COLUMNS } from '../components/MeasureTable.svelte';
  import CsvDialog from '../CsvDialog.svelte';

  let { project, ontab }: { project: Project; ontab: (id: string) => void } = $props();

  const HIT_PX = 22;
  const LABELS: Record<string, string> = {
    t: 't', x: 'x', y: 'y', s: 's', vx: 'vₓ', vy: 'v_y', v: '|v|', ax: 'aₓ', ay: 'a_y', a: '|a|',
  };
  let columns = $state<string[]>(['t', 'x', 'y', 'vx', 'vy', 'v', 'a']);
  let decimals = $state(3);
  let colsOpen = $state(false);
  let csvOpen = $state(false);
  let selected = $state<number | null>(null);
  let stage = $state<StageMeasure>();

  const m = $derived(project.measure);
  const indices = $derived(project.measureIndices);
  const mpp = $derived(project.metersPerPixel);
  const obj = $derived(activeObject(m));
  const objIndex = $derived(Math.max(0, m.objects.indexOf(obj)));
  const rowsFor = (o: typeof obj) =>
    computeRows(seriesFor(o, indices, project.captureFps), originFor(m, o, indices), m.calibration, m.axes);
  const rows = $derived(rowsFor(obj));
  const csvObjects = $derived(
    m.objects.filter((o) => indices.some((f) => o.points[f])).map((o) => ({ name: o.name, rows: rowsFor(o) })),
  );

  const highlight = $derived(selected === null ? null : { object: objIndex, nr: selected });

  function hitRadius(): number {
    const g = stage!.geometry();
    const a = videoToViewer(0, 0, g);
    const b = videoToViewer(1, 0, g);
    const fit = Math.hypot(b.x - a.x, b.y - a.y);
    return fit > 0 ? HIT_PX / fit : HIT_PX;
  }
  const tool: StageTool = {
    press: () => false,
    drag() {},
    release() {},
    tap(p) {
      const hit = hitPoint(activeObject(project.measure), project.measureIndices, p, hitRadius());
      if (hit !== null) selected = hit;
    },
    cancel() {},
  };

  function toggle(id: string, on: boolean) {
    columns = COLUMNS.map((c) => c.id as string).filter((c) => (c === id ? on : columns.includes(c)));
  }
</script>

{#if project.info}
  <div class="work">
    <StageMeasure bind:this={stage} {project} {tool} hint={null} showCalibration={false} {highlight} />

    <div class="col">
      {#if mpp === null}
        <Card title="Messtabelle">
          <p>Für die Tabelle zuerst den Maßstab festlegen.</p>
          <button type="button" class="act" onclick={() => ontab('massstab')}>Zum Maßstab</button>
        </Card>
      {:else if csvObjects.length === 0}
        <Card title="Messtabelle">
          <p>Noch keine Positionen gemessen</p>
          <button type="button" class="act" onclick={() => ontab('messen')}>Zum Messen</button>
        </Card>
      {:else}
        <Card title={`Messtabelle · ${obj.name}`}>
          <div class="head">
            {#if m.objects.length > 1}
              <Segmented
                label="Objekt"
                options={m.objects.map((o) => ({ id: String(o.id), label: o.name }))}
                value={String(m.active)}
                onchange={(id) => {
                  m.active = Number(id);
                  selected = null;
                }}
              />
            {/if}
            <button type="button" class="act" aria-expanded={colsOpen} onclick={() => (colsOpen = !colsOpen)}>Spalten …</button>
            <button type="button" class="act" onclick={() => (csvOpen = true)}><Icon name="share" size={16} />CSV</button>
          </div>
          {#if colsOpen}
            <div class="cols">
              {#each COLUMNS as c (c.id)}
                <Switch checked={columns.includes(c.id)} label={LABELS[c.id]} onchange={(v) => toggle(c.id, v)} />
              {/each}
              <span class="lbl">Nachkommastellen</span>
              <Segmented
                label="Nachkommastellen"
                options={[{ id: '2', label: '2' }, { id: '3', label: '3' }]}
                value={String(decimals)}
                onchange={(id) => (decimals = Number(id))}
              />
            </div>
          {/if}
          {#if rows.length === 0}
            <p>Für dieses Objekt noch keine Positionen gemessen</p>
          {:else}
            <MeasureTable {rows} {columns} {decimals} {selected} onselect={(nr) => (selected = nr)} />
          {/if}
          <p class="lbl">Diagramme folgen in einer späteren Version.</p>
        </Card>
      {/if}
    </div>
  </div>
{/if}

{#if csvOpen}<CsvDialog {project} objects={csvObjects} onclose={() => (csvOpen = false)} />{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  .act {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cols {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 8px;
  }
  .lbl {
    color: var(--muted);
    font-size: 0.85rem;
  }
  p {
    margin: 8px 0;
  }
</style>
