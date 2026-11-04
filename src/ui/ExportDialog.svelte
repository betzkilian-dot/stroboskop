<script lang="ts">
  import type { Project } from '../lib/state/project.svelte';
  import { VideoError } from '../lib/video/demux';
  import { errorText } from '../lib/state/project.svelte';
  import { exportFileName, renderExportImage, outputSize, shareOrDownload, type ImageExportOptions } from '../lib/export/image';
  import Notice from './components/Notice.svelte';
  import Segmented from './components/Segmented.svelte';
  import Switch from './components/Switch.svelte';
  import BusyOverlay from './components/BusyOverlay.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { renderReport, reportFileName } from '../lib/export/report';
  import { shareCsv, type CsvStyle } from '../lib/export/csv';
  import CsvOptions from './components/CsvOptions.svelte';
  import { measuredObjects } from '../lib/measure/objectRows';
  import { QUANTITIES } from '../lib/charts/input';
  import type { ChartQuantity } from '../lib/measure/model';
  import type { FitKind } from '../lib/physics/fit';
  import { BUSY_TEXT, STAGE_TEXT } from '../lib/state/project.svelte';

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

  function initial() {
    const c = project.measure.chart;
    return { title: project.name.replace(/\.[^.]+$/, ''), quantity: c.quantity, fit: c.fit, eq: c.showEquation, r2: c.showR2 };
  }
  const init = initial();
  let mode = $state<'image' | 'pdf' | 'csv'>('image');
  let csvStyle = $state<CsvStyle>('de');
  const hasScale = $derived(project.measure.calibration !== null);
  const csvObjects = $derived(measuredObjects(project));
  let title = $state(init.title);
  let personName = $state(loadName());
  let rImage = $state(true);
  let rFacts = $state(true);
  let rTables = $state(true);
  let rCharts = $state(true);
  let quantities = $state<ChartQuantity[]>([init.quantity]);
  let fit = $state<FitKind>(init.fit);
  let showEquation = $state(init.eq);
  let showR2 = $state(init.r2);
  const FITS: { id: FitKind; label: string }[] = [
    { id: 'none', label: 'keine' },
    { id: 'line', label: 'Gerade' },
    { id: 'origin', label: 'Ursprungsgerade' },
    { id: 'parabola', label: 'Parabel' },
  ];
  const chartsActive = $derived(hasScale && rCharts);
  const pdfBlocked = $derived(chartsActive && quantities.length === 0);
  const pdfKey = $derived(
    JSON.stringify([title, personName, rImage, rFacts, hasScale && rTables, chartsActive, quantities, fit, showEquation, showR2]),
  );

  let format = $state<'png' | 'jpeg'>('png');
  let quality = $state(0.9);
  let size = $state<'original' | 'worksheet'>('original');
  let infoLine = $state(true);
  let overlays = $state(hasMeasurement());
  function hasMeasurement(): boolean {
    const m = project.measure;
    return m.calibration !== null || m.objects.some((o) => Object.keys(o.points).length > 0);
  }
  let error = $state<string | null>(null);
  let result = $state.raw<{ blob: Blob; name: string; key: string } | null>(null);
  $effect(() => {
    void mode;
    result = null;
    error = null;
  });
  let dialogEl: HTMLDivElement | undefined = $state();
  const key = $derived(mode === 'pdf' ? pdfKey : `${format}|${quality}|${size}|${infoLine}|${overlays}`);
  const pixelText = $derived.by(() => {
    if (!project.info) return '';
    const t = outputSize(project.info, project.crop, project.rotation, size);
    return `${t.width} × ${t.height} Pixel`;
  });
  const ready = $derived(result !== null && result.key === key);

  function message(e: unknown): string {
    if (e instanceof VideoError) return errorText(e);
    if (e instanceof DOMException && e.name === 'NotAllowedError') return 'Teilen wurde nicht erlaubt. Bitte erneut versuchen.';
    return 'Export fehlgeschlagen.';
  }

  async function run() {
    error = null;
    result = null;
    const k = key;
    project.exporting = true;
    try {
      if (mode === 'pdf') {
        saveName(personName);
        const t = project.measure.table;
        const blob = await renderReport(project, {
          title, name: personName.trim(), date: today(), image: rImage, facts: rFacts, tables: hasScale && rTables,
          charts: chartsActive ? QUANTITIES.map((q) => q.id).filter((id) => quantities.includes(id)) : [],
          fit, showEquation, showR2, columns: t.columns, decimals: t.decimals,
        });
        result = { blob, name: reportFileName(project.name), key: k };
        return;
      }
      const o: ImageExportOptions = { format, quality, size, infoLine, overlays };
      const blob = await renderExportImage(project, o);
      result = { blob, name: exportFileName(project.name, format === 'png' ? 'png' : 'jpg'), key: k };
    } catch (e) {
      error = message(e);
    } finally {
      project.exporting = false;
    }
  }

  function toggleQuantity(id: ChartQuantity) {
    quantities = quantities.includes(id) ? quantities.filter((q) => q !== id) : [...quantities, id];
  }

  async function share() {
    error = null;
    try {
      let r;
      if (mode === 'csv') {
        r = await shareCsv(project, csvStyle);
      } else {
        if (!result) return;
        r = await shareOrDownload(result.blob, result.name);
      }
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
      if (r !== 'cancelled') onclose();
    } catch (e) {
      error = message(e);
    }
  }

  function close() {
    if (!project.exporting) onclose();
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  $effect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => prev?.focus?.();
  });
</script>

{#snippet sym(t: string)}{#each t.split(/(_\w)/) as part}{#if part.startsWith('_')}<sub>{part[1]}</sub>{:else}{part}{/if}{/each}{/snippet}

<div class="backdrop">
  <div class="dialog" tabindex="-1" bind:this={dialogEl} {onkeydown} role="dialog" aria-modal="true" aria-labelledby="export-title">
    <div class="grab" aria-hidden="true"></div>
    <h2 id="export-title">Teilen</h2>

    <Segmented
      label="Art"
      options={[{ id: 'image', label: 'Bild' }, { id: 'pdf', label: 'PDF-Bericht' }, { id: 'csv', label: 'Messdaten (CSV)' }]}
      value={mode}
      onchange={(id) => {
        if (!project.exporting) mode = id as 'image' | 'pdf' | 'csv';
      }}
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
        <input type="range" min="0.5" max="1" step="0.05" bind:value={quality} disabled={project.exporting} />
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
        <input type="text" class="txt" bind:value={title} disabled={project.exporting} />
      </label>
      <label class="field">
        <span class="lbl">Name / Klasse</span>
        <input type="text" class="txt" bind:value={personName} oninput={() => saveName(personName)} disabled={project.exporting} />
      </label>
      <Switch label="Stroboskopbild mit Einblendungen" checked={rImage} onchange={(v) => (rImage = v)} />
      <Switch label="Kenndaten" checked={rFacts} onchange={(v) => (rFacts = v)} />
      <Switch label="Messtabelle(n)" checked={hasScale && rTables} disabled={!hasScale} onchange={(v) => (rTables = v)} />
      <Switch label="Diagramme" checked={chartsActive} disabled={!hasScale} onchange={(v) => (rCharts = v)} />
      {#if !hasScale}<span class="hintline">Für Tabelle und Diagramme zuerst den Maßstab festlegen</span>{/if}
      {#if chartsActive}
        <div class="field">
          <span class="lbl">Größen</span>
          <div class="qty" role="group" aria-label="Größen">
            {#each QUANTITIES as c (c.id)}
              <button type="button" role="checkbox" aria-checked={quantities.includes(c.id)} class:on={quantities.includes(c.id)}
                onclick={() => toggleQuantity(c.id)}>{@render sym(c.label)}</button>
            {/each}
          </div>
          {#if quantities.length === 0}<span class="hintline">Bitte mindestens eine Größe wählen</span>{/if}
        </div>
        <div class="field">
          <span class="lbl">Ausgleich</span>
          <Segmented label="Ausgleich" options={FITS} value={fit} onchange={(id) => (fit = id as FitKind)} />
        </div>
        <Switch label="Gleichung" checked={showEquation} onchange={(v) => (showEquation = v)} />
        <Switch label="R²" checked={showR2} onchange={(v) => (showR2 = v)} />
      {/if}
    {:else}
      <CsvOptions bind:style={csvStyle} empty={csvObjects.length === 0} />
    {/if}

    {#if error}<Notice kind="error">{error}</Notice>{/if}

    <div class="actions">
      <button type="button" disabled={project.exporting} onclick={close}>Schließen</button>
      {#if mode === 'csv'}
        <button type="button" class="btn primary" disabled={csvObjects.length === 0} onclick={share}>Teilen / Sichern</button>
      {:else if ready}
        <button type="button" class="btn primary" onclick={share}>Teilen / Sichern</button>
      {:else}
        <button type="button" class="btn primary" disabled={project.exporting || (mode === 'pdf' && pdfBlocked)} onclick={run}>
          {mode === 'pdf' ? 'PDF erstellen' : 'Bild erzeugen'}
        </button>
      {/if}
    </div>

    <BusyOverlay
      active={project.exporting}
      title={mode === 'pdf' ? BUSY_TEXT.report : BUSY_TEXT.export}
      step={mode === 'image' && project.stage ? STAGE_TEXT[project.stage] : undefined}
      progress={project.progress}
    />
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
  .qty {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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
  input[type='range'] {
    min-height: 44px;
    accent-color: var(--acc);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
