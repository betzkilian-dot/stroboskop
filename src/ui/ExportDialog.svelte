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
  import { BUSY_TEXT, STAGE_TEXT } from '../lib/state/project.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

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
  let dialogEl: HTMLDivElement | undefined = $state();
  const key = $derived(`${format}|${quality}|${size}|${infoLine}|${overlays}`);
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
      const o: ImageExportOptions = { format, quality, size, infoLine, overlays };
      const blob = await renderExportImage(project, o);
      result = { blob, name: exportFileName(project.name, format === 'png' ? 'png' : 'jpg'), key: k };
    } catch (e) {
      error = message(e);
    } finally {
      project.exporting = false;
    }
  }

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

<div class="backdrop">
  <div class="dialog" tabindex="-1" bind:this={dialogEl} {onkeydown} role="dialog" aria-modal="true" aria-labelledby="export-title">
    <div class="grab" aria-hidden="true"></div>
    <h2 id="export-title">Bild exportieren</h2>

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

    {#if error}<Notice kind="error">{error}</Notice>{/if}

    <div class="actions">
      <button type="button" disabled={project.exporting} onclick={close}>Schließen</button>
      {#if ready}
        <button type="button" class="btn primary" onclick={share}>Teilen / Sichern</button>
      {:else}
        <button type="button" class="btn primary" disabled={project.exporting} onclick={run}>Bild erzeugen</button>
      {/if}
    </div>

    <BusyOverlay
      active={project.exporting}
      title={BUSY_TEXT.export}
      step={project.stage ? STAGE_TEXT[project.stage] : undefined}
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
