<script lang="ts">
  import { activeObject, addReportChart, hitPoint, removeReportChart } from '../../lib/measure/model';
  import { measuredObjects, rowsForObject } from '../../lib/measure/objectRows';
  import type { Pt } from '../../lib/physics/kinematics';
  import { videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
  import StageMeasure from './StageMeasure.svelte';
  import Card from '../components/Card.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Switch from '../components/Switch.svelte';
  import Icon from '../components/Icon.svelte';
  import MeasureTable from '../components/MeasureTable.svelte';
  import { COLUMNS } from '../../lib/measure/columns';
  import Chart from '../components/Chart.svelte';
  import type { FitKind } from '../../lib/physics/fit';
  import CsvDialog from '../CsvDialog.svelte';
  import { chartFileName, renderChartPng } from '../../lib/charts/drawChart';
  import { shareOrDownload } from '../../lib/export/image';
  import { chartInputFor, QUANTITIES } from '../../lib/charts/input';
  import { toast } from '../../lib/state/toast.svelte';

  let { project, ontab }: { project: Project; ontab: (id: string) => void } = $props();

  const HIT_PX = 22;
  const LABELS: Record<string, string> = {
    t: 't', x: 'x', y: 'y', s: 's', vx: 'v_x', vy: 'v_y', v: '|v|', ax: 'a_x', ay: 'a_y', a: '|a|',
  };
  let colsOpen = $state(false);
  let csvOpen = $state(false);
  let selected = $state<number | null>(null);
  let stage = $state<StageMeasure>();

  const m = $derived(project.measure);
  const mpp = $derived(project.metersPerPixel);
  const obj = $derived(activeObject(m));
  const objIndex = $derived(Math.max(0, m.objects.indexOf(obj)));
  const columns = $derived(m.table.columns);
  const decimals = $derived(m.table.decimals);
  const rows = $derived(rowsForObject(project, obj));
  const csvObjects = $derived(measuredObjects(project));

  const FITS: { id: FitKind; label: string }[] = [
    { id: 'none', label: 'keine' },
    { id: 'line', label: 'Gerade' },
    { id: 'origin', label: 'Ursprungsgerade' },
    { id: 'parabola', label: 'Parabel' },
  ];
  const chart = $derived(m.chart);
  const q = $derived(QUANTITIES.find((c) => c.id === chart.quantity) ?? QUANTITIES[0]);
  const chartIn = $derived(chartInputFor(project, chart.quantity, chart.fit, chart.showEquation, chart.showR2));
  const chartSeries = $derived(chartIn.input.series);

  let chartBusy = $state(false);
  async function shareChart() {
    chartBusy = true;
    try {
      const blob = await renderChartPng(chartIn.input, chartIn.title);
      const r = await shareOrDownload(blob, chartFileName(project.name, q.id));
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
    } catch {
      toast.show('Export fehlgeschlagen.');
    } finally {
      chartBusy = false;
    }
  }

  const reportItems = $derived(
    m.reportCharts.map((c) => {
      const qq = QUANTITIES.find((x) => x.id === c.quantity) ?? QUANTITIES[0];
      const f = FITS.find((x) => x.id === c.fit);
      return { c, label: qq.label, text: `${qq.label.replace('_', '')}${c.fit === 'none' ? '' : ` · ${f?.label}`}`, fit: c.fit === 'none' ? '' : (f?.label ?? '') };
    }),
  );
  function chooseReportChart(i: number) {
    Object.assign(m.chart, m.reportCharts[i]);
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
    m.table.columns = COLUMNS.map((c) => c.id as string).filter((c) => (c === id ? on : columns.includes(c)));
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
                onchange={(id) => (m.table.decimals = Number(id) as 2 | 3)}
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
            xLabel={chartIn.input.xLabel}
            yLabel={`${q.name} in ${q.unit}`}
            varName={q.sym}
            fit={chart.fit}
            showEquation={chart.showEquation}
            showR2={chart.showR2}
            {selected}
            activeId={obj.id}
            argName={chartIn.input.argName}
            equalScale={chartIn.input.equalScale}
            connect={chartIn.input.connect}
            onselect={(seriesId, nr) => {
              if (seriesId !== m.active) m.active = seriesId;
              selected = nr;
            }}
          />
          <div class="head">
            <button type="button" class="act" onclick={() => addReportChart(m)}><Icon name="plus" size={16} />Zum Bericht hinzufügen</button>
            <button type="button" class="act" disabled={chartBusy} onclick={shareChart}><Icon name="share" size={16} />Diagramm als Bild teilen</button>
          </div>
          {#if reportItems.length > 0}
            <div class="lbl">Im Bericht</div>
            <ul class="rc" data-testid="report-charts">
              {#each reportItems as it, i (`${it.c.quantity}|${it.c.fit}`)}
                <li>
                  <button type="button" class="pick" aria-label={it.text} onclick={() => chooseReportChart(i)}>
                    {@render sym(it.label)}{it.fit ? ` · ${it.fit}` : ''}
                  </button>
                  <button type="button" class="rm" aria-label={`Entfernen: ${it.text}`} onclick={() => removeReportChart(m, i)}><Icon name="close" size={16} /></button>
                </li>
              {/each}
            </ul>
          {/if}
        </Card>
      {/if}
    </div>
  </div>
{/if}

{#if csvOpen}<CsvDialog {project} onclose={() => (csvOpen = false)} />{/if}

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
  .rc {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .rc li {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--sep);
  }
  .pick {
    flex: 1;
    min-height: 44px;
    text-align: left;
    background: none;
  }
  .rm {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
  }
  p {
    margin: 8px 0;
  }
</style>
