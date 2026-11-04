<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { Project } from '../lib/state/project.svelte';
  import { VideoError } from '../lib/video/demux';
  import { errorText } from '../lib/state/project.svelte';
  import { exportFileName, renderExportImage, outputSize, shareOrDownload, type ImageExportOptions } from '../lib/export/image';
  import Notice from './components/Notice.svelte';
  import Segmented from './components/Segmented.svelte';
  import Switch from './components/Switch.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { renderReport, reportFileName } from '../lib/export/report';
  import { csvFileName, toCsv, type CsvStyle } from '../lib/export/csv';
  import CsvOptions from './components/CsvOptions.svelte';
  import { measuredObjects } from '../lib/measure/objectRows';
  import { QUANTITIES } from '../lib/charts/input';
  import { reportChartList } from '../lib/measure/model';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

  const NAME_KEY = 'stroboskop.name';
  function loadName(): string {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  }
  function saveName(v: string) {
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* ohne Speicher weiter */
    }
  }
  function today(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  let mode = $state<'image' | 'pdf' | 'csv'>('image');
  let csvStyle = $state<CsvStyle>('de');
  const hasScale = $derived(project.measure.calibration !== null);
  const csvObjects = $derived(measuredObjects(project));
  const initialTitle = () => project.name.replace(/\.[^.]+$/, '');
  let title = $state(initialTitle());
  let personName = $state(loadName());
  let rImage = $state(true);
  let rFacts = $state(true);
  let rTables = $state(true);
  let rCharts = $state(true);
  const chartsActive = $derived(hasScale && rCharts);
  const collected = $derived(project.measure.reportCharts.length);
  const chartHint = $derived.by(() => {
    if (collected > 0) return `${collected} ${collected === 1 ? 'Diagramm' : 'Diagramme'} aus Auswerten`;
    const q = QUANTITIES.find((c) => c.id === project.measure.chart.quantity) ?? QUANTITIES[0];
    return `Aktuelles Diagramm aus Auswerten (${q.label.replace('_', '')})`;
  });

  let format = $state<'png' | 'jpeg'>('png');
  let quality = $state(0.9);
  let size = $state<'original' | 'worksheet'>('original');
  let infoLine = $state(true);
  let overlays = $state(hasMeasurement());
  function hasMeasurement(): boolean {
    const m = project.measure;
    return m.calibration !== null || m.objects.some((o) => Object.keys(o.points).length > 0);
  }
  let dialogEl: HTMLDivElement | undefined = $state();
  const key = $derived(
    mode === 'pdf'
      ? JSON.stringify([title, personName, rImage, rFacts, hasScale && rTables, chartsActive])
      : mode === 'csv'
        ? `${csvStyle}|${csvObjects.length}`
        : `${format}|${quality}|${size}|${infoLine}|${overlays}`,
  );
  const pixelText = $derived.by(() => {
    if (!project.info) return '';
    const t = outputSize(project.info, project.crop, project.rotation, size);
    return `${t.width} × ${t.height} Pixel`;
  });

  function message(e: unknown): string {
    if (e instanceof VideoError) return errorText(e);
    if (e instanceof DOMException && e.name === 'NotAllowedError') return 'Teilen wurde nicht erlaubt. Bitte erneut versuchen.';
    return 'Export fehlgeschlagen.';
  }

  // ---- Vorbereitung im Hintergrund ----
  // Jede Änderung startet eine neue Vorbereitung (Folgenummer); veraltete Ergebnisse werden verworfen.
  // Die Engine wird geteilt: Vorbereitungen laufen nacheinander, die Export-Sperre gilt bis zur letzten.
  let result = $state.raw<{ blob: Blob; name: string } | null>(null);
  let preparing = $state(false);
  let error = $state<string | null>(null);
  let prepFailed = $state(false);
  let seq = 0;
  let pending = 0;
  let chain: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastMode: string | null = null;

  async function build(): Promise<{ blob: Blob; name: string }> {
    if (mode === 'pdf') {
      const t = project.measure.table;
      const blob = await renderReport(project, {
        title: title.trim() || project.name.replace(/\.[^.]+$/, ''), name: personName.trim(), date: today(), image: rImage, facts: rFacts,
        tables: hasScale && rTables, charts: chartsActive ? reportChartList(project.measure) : [],
        columns: t.columns, decimals: t.decimals,
      });
      return { blob, name: reportFileName(project.name) };
    }
    const o: ImageExportOptions = { format, quality, size, infoLine, overlays };
    const blob = await renderExportImage(project, o);
    return { blob, name: exportFileName(project.name, format === 'png' ? 'png' : 'jpg') };
  }

  async function run(my: number) {
    try {
      if (my !== seq) return;
      const r = await build();
      if (my === seq) {
        result = r;
        preparing = false;
      }
    } catch (e) {
      if (my === seq) {
        error = message(e);
        prepFailed = true;
        preparing = false;
      }
    } finally {
      pending--;
      if (pending === 0) project.exporting = false;
    }
  }

  function prepare(delay: number) {
    const my = ++seq;
    clearTimeout(timer);
    result = null;
    error = null;
    prepFailed = false;
    if (mode === 'csv') {
      preparing = false;
      if (csvObjects.length > 0) {
        result = { blob: new Blob([toCsv(csvObjects, csvStyle)], { type: 'text/csv;charset=utf-8' }), name: csvFileName(project.name) };
      }
      return;
    }
    preparing = true;
    timer = setTimeout(() => {
      if (my !== seq) return;
      pending++;
      project.exporting = true;
      chain = chain.then(() => run(my));
    }, delay);
  }

  $effect(() => {
    const m = mode;
    void key;
    untrack(() => {
      prepare(lastMode === m ? 400 : 0);
      lastMode = m;
    });
  });

  onDestroy(() => {
    seq++; // laufende Vorbereitung verwerfen; die Sperre hebt sich nach ihrem Ende auf
    clearTimeout(timer);
  });

  async function share() {
    if (!result) return;
    error = null;
    try {
      const r = await shareOrDownload(result.blob, result.name);
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
      if (r !== 'cancelled') onclose();
    } catch (e) {
      error = message(e);
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  $effect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => prev?.focus?.();
  });
</script>

<div class="backdrop">
  <div class="dialog" tabindex="-1" bind:this={dialogEl} {onkeydown} role="dialog" aria-modal="true" aria-labelledby="export-title">
    <div class="grab" aria-hidden="true"></div>
    <h2 id="export-title">Teilen</h2>

    <Segmented
      label="Art"
      options={[{ id: 'image', label: 'Bild' }, { id: 'pdf', label: 'PDF-Bericht' }, { id: 'csv', label: 'Messdaten (CSV)' }]}
      value={mode}
      onchange={(id) => (mode = id as 'image' | 'pdf' | 'csv')}
    />

    {#if mode === 'image'}
    <div class="field">
      <span class="lbl">Format</span>
      <Segmented
        label="Format"
        options={[{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPEG' }]}
        value={format}
        onchange={(id) => (format = id as 'png' | 'jpeg')}
      />
    </div>

    {#if format === 'jpeg'}
      <label class="field">
        <span class="lbl">Qualität <span class="val">{quality.toFixed(2).replace('.', ',')}</span></span>
        <input type="range" min="0.5" max="1" step="0.05" bind:value={quality} />
      </label>
    {/if}

    <div class="field">
      <span class="lbl">Größe</span>
      <Segmented
        label="Größe"
        options={[{ id: 'worksheet', label: 'Klein (für Arbeitsblätter)' }, { id: 'original', label: 'Original (volle Auflösung)' }]}
        value={size}
        onchange={(id) => (size = id as 'original' | 'worksheet')}
      />
      {#if pixelText}<span class="hintline" data-testid="export-size">{pixelText}</span>{/if}
    </div>

    <Switch label="Einblendungen" checked={overlays} onchange={(v) => (overlays = v)} />
    <Switch label="Infozeile" checked={infoLine} onchange={(v) => (infoLine = v)} />
    {:else if mode === 'pdf'}
      <label class="field">
        <span class="lbl">Titel</span>
        <input type="text" class="txt" bind:value={title} />
      </label>
      <label class="field">
        <span class="lbl">Name / Klasse</span>
        <input type="text" class="txt" bind:value={personName} oninput={() => saveName(personName)} />
      </label>
      <Switch label="Stroboskopbild mit Einblendungen" checked={rImage} onchange={(v) => (rImage = v)} />
      <Switch label="Kenndaten" checked={rFacts} onchange={(v) => (rFacts = v)} />
      <Switch label="Messtabelle(n)" checked={hasScale && rTables} disabled={!hasScale} onchange={(v) => (rTables = v)} />
      <Switch label="Diagramme" checked={chartsActive} disabled={!hasScale} onchange={(v) => (rCharts = v)} />
      {#if !hasScale}
        <span class="hintline">Für Tabelle und Diagramme zuerst den Maßstab festlegen</span>
      {:else if chartsActive}
        <span class="hintline">{chartHint}</span>
      {/if}
    {:else}
      <CsvOptions bind:style={csvStyle} empty={csvObjects.length === 0} />
    {/if}

    {#if error}<Notice kind="error">{error}</Notice>{/if}
    {#if preparing && mode !== 'csv'}
      <progress class="prog" value={project.progress} max="1" aria-label="Fortschritt"></progress>
    {/if}

    <div class="actions">
      <button type="button" style="min-height:44px" onclick={onclose}>Schließen</button>
      {#if preparing}
        <button type="button" class="btn primary" disabled>Wird vorbereitet …</button>
      {:else if prepFailed}
        <button type="button" class="btn primary" onclick={() => prepare(0)}>Erneut versuchen</button>
      {:else}
        <button type="button" class="btn primary" disabled={result === null} onclick={share}>Teilen</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, #000 45%, transparent);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    position: relative;
    background: var(--card);
    color: var(--fg);
    border-radius: 18px 18px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    width: min(100vw, 480px);
    max-height: 90dvh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .grab {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--sep);
    align-self: center;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .hintline {
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .val {
    font-variant-numeric: tabular-nums;
    color: var(--fg);
    margin-left: 6px;
  }
  .txt {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--sep);
    background: var(--fill);
    color: var(--fg);
    font: inherit;
  }
  input[type='range'] {
    min-height: 44px;
    accent-color: var(--acc);
  }
  .prog {
    width: 100%;
    accent-color: var(--acc);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
