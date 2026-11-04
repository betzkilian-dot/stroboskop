<script lang="ts">
  import { activeObject, type ChartQuantity, hitPoint, originFor, seriesFor } from '../../lib/measure/model';
  import { computeRows } from '../../lib/physics/kinematics';
  import type { Pt } from '../../lib/physics/kinematics';
  import { videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
  import StageMeasure from './StageMeasure.svelte';
  import Card from '../components/Card.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Switch from '../components/Switch.svelte';
  import Icon from '../components/Icon.svelte';
  import MeasureTable, { COLUMNS } from '../components/MeasureTable.svelte';
  import Chart from '../components/Chart.svelte';
  import type { FitKind } from '../../lib/physics/fit';
  import CsvDialog from '../CsvDialog.svelte';
  import { chartFileName, renderChartPng } from '../../lib/charts/drawChart';
  import { shareOrDownload } from '../../lib/export/image';
  import { toast } from '../../lib/state/toast.svelte';

  let { project, ontab }: { project: Project; ontab: (id: string) => void } = $props();

  const HIT_PX = 22;
  const LABELS: Record<string, string> = {
    t: 't', x: 'x', y: 'y', s: 's', vx: 'v_x', vy: 'v_y', v: '|v|', ax: 'a_x', ay: 'a_y', a: '|a|',
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
    computeRows(seriesFor(o, indices, project.captureFps), originFor(m, project.viewRect), m.calibration, m.axes);
  const rows = $derived(rowsFor(obj));
  const csvObjects = $derived(
    m.objects.filter((o) => indices.some((f) => o.points[f])).map((o) => ({ name: o.name, rows: rowsFor(o) })),
  );

  const QUANTITIES: { id: ChartQuantity; label: string; name: string; unit: string; sym: string }[] = [
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
  const FITS: { id: FitKind; label: string }[] = [
    { id: 'none', label: 'keine' },
    { id: 'line', label: 'Gerade' },
    { id: 'origin', label: 'Ursprungsgerade' },
    { id: 'parabola', label: 'Parabel' },
  ];
  const chart = $derived(m.chart);
  const q = $derived(QUANTITIES.find((c) => c.id === chart.quantity) ?? QUANTITIES[0]);
  // Aktives Objekt zuerst (Ausgleich gilt nur für die erste Reihe).
  const chartSeries = $derived(
    [obj, ...m.objects.filter((o) => o !== obj)]
      .map((o) => ({
        id: o.id,
        color: o.color,
        name: o.name,
        points: rowsFor(o).flatMap((r) => (r[q.id] === null ? [] : [{ t: r.t, y: r[q.id] as number, nr: r.nr }])),
      }))
      .filter((s) => s.points.length > 0),
  );

  let chartBusy = $state(false);
  async function shareChart() {
    chartBusy = true;
    try {
      const blob = await renderChartPng({
        series: chartSeries,
        xLabel: 't in s',
        yLabel: `${q.name} in ${q.unit}`,
        varName: q.sym,
        fit: chart.fit,
        showEquation: chart.showEquation,
        showR2: chart.showR2,
        activeId: obj.id,
      });
      const r = await shareOrDownload(blob, chartFileName(project.name, q.id));
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
    } catch {
      toast.show('Export fehlgeschlagen.');
    } finally {
      chartBusy = false;
    }
  }

  const highlight = $derived(selected === null ? null : { object: objIndex, nr: selected });

  function hitRadius(): number {
    const g = stage!.geometry();
    const a = videoToViewer(0, 0, g);
    const b = videoToViewer(1, 0, g);
    const fit = Math.hypot(b.x - a.x, b.y - a.y);
    return fit > 0 ? HIT_PX / fit : HIT_PX;
  }
  let legendGrab: Pt | null = null;
  const tool: StageTool = {
    press(_p, client) {
      legendGrab = stage!.legendGrab(client);
      return legendGrab !== null;
    },
    drag(_p, client) {
      if (legendGrab) stage!.moveLegend(client, legendGrab);
    },
    release() {
      legendGrab = null;
    },
    tap(p) {
      const hit = hitPoint(activeObject(project.measure), project.measureIndices, p, hitRadius());
      if (hit !== null) selected = hit;
    },
    cancel() {
      legendGrab = null;
    },
  };

  function toggle(id: string, on: boolean) {
    columns = COLUMNS.map((c) => c.id as string).filter((c) => (c === id ? on : columns.includes(c)));
  }
</script>

{#snippet sym(t: string)}{#each t.split(/(_\w)/) as part}{#if part.startsWith('_')}<sub>{part[1]}</sub>{:else}{part}{/if}{/each}{/snippet}

{#if project.info}
  <div class="work split">
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
                <Switch checked={columns.includes(c.id)} label={LABELS[c.id].replace('_', '')} onchange={(v) => toggle(c.id, v)}>{@render sym(LABELS[c.id])}</Switch>
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
        </Card>
        <Card title="Diagramm">
          <div class="qty" role="radiogroup" aria-label="Größe">
            {#each QUANTITIES as c (c.id)}
              <button type="button" role="radio" aria-checked={chart.quantity === c.id} class:on={chart.quantity === c.id}
                onclick={() => (m.chart.quantity = c.id)}>{@render sym(c.label)}</button>
            {/each}
          </div>
          <Segmented label="Ausgleich" options={FITS} value={chart.fit} onchange={(id) => (m.chart.fit = id as FitKind)} />
          <div class="sw">
            <Switch checked={chart.showEquation} label="Gleichung" onchange={(v) => (m.chart.showEquation = v)} />
            <Switch checked={chart.showR2} label="R²" onchange={(v) => (m.chart.showR2 = v)} />
          </div>
          <Chart
            series={chartSeries}
            xLabel="t in s"
            yLabel={`${q.name} in ${q.unit}`}
            varName={q.sym}
            fit={chart.fit}
            showEquation={chart.showEquation}
            showR2={chart.showR2}
            {selected}
            activeId={obj.id}
            onselect={(seriesId, nr) => {
              if (seriesId !== m.active) m.active = seriesId;
              selected = nr;
            }}
          />
          <button type="button" class="act" disabled={chartBusy} onclick={shareChart}><Icon name="share" size={16} />Diagramm als Bild teilen</button>
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
  .qty {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .qty button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 12px;
    border-radius: 8px;
    background: var(--fill);
    color: var(--muted);
    font-weight: 550;
  }
  .qty button.on {
    background: var(--acc);
    color: #fff;
  }
  .sw {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 10px 0;
  }
  p {
    margin: 8px 0;
  }
</style>
