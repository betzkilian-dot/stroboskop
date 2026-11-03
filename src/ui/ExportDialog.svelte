<script lang="ts">
  import type { Project } from '../lib/state/project.svelte';
  import { errorText } from '../lib/state/project.svelte';
  import { exportFileName, renderExportImage, shareOrDownload, type ImageExportOptions } from '../lib/export/image';
  import Notice from './components/Notice.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

  let format = $state<'png' | 'jpeg'>('png');
  let quality = $state(0.9);
  let size = $state<'original' | 'worksheet'>('original');
  let infoLine = $state(true);
  let error = $state<string | null>(null);

  async function run() {
    error = null;
    project.exporting = true;
    try {
      const o: ImageExportOptions = { format, quality, size, infoLine, overlays: false };
      const blob = await renderExportImage(project, o);
      await shareOrDownload(blob, exportFileName(project.name, format === 'png' ? 'png' : 'jpg'));
    } catch (e) {
      error = e instanceof Error && e.message ? e.message : errorText(e);
    } finally {
      project.exporting = false;
    }
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
    <h2 id="export-title">Bild exportieren</h2>

    <fieldset disabled={project.exporting}>
      <legend>Format</legend>
      <label><input type="radio" name="fmt" value="png" bind:group={format} /> PNG</label>
      <label><input type="radio" name="fmt" value="jpeg" bind:group={format} /> JPEG</label>
    </fieldset>

    {#if format === 'jpeg'}
      <label class="row">
        Qualität
        <input type="range" min="0.5" max="1" step="0.05" bind:value={quality} disabled={project.exporting} />
        <span>{quality.toFixed(2).replace('.', ',')}</span>
      </label>
    {/if}

    <fieldset disabled={project.exporting}>
      <legend>Größe</legend>
      <label><input type="radio" name="size" value="original" bind:group={size} /> Original</label>
      <label><input type="radio" name="size" value="worksheet" bind:group={size} /> Arbeitsblatt</label>
    </fieldset>

    <label class="row">
      <input type="checkbox" bind:checked={infoLine} disabled={project.exporting} /> Infozeile
    </label>

    {#if project.exporting}
      <progress value={project.progress} max="1" aria-label="Fortschritt"></progress>
    {/if}
    {#if error}<Notice kind="error">{error}</Notice>{/if}

    <div class="actions">
      <button type="button" onclick={onclose}>Schließen</button>
      <button type="button" class="primary" disabled={project.exporting} onclick={run}>Bild exportieren</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    background: #fff;
    color: #111;
    border-radius: 12px;
    padding: 16px;
    width: min(92vw, 420px);
    max-height: 90dvh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  fieldset {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  .row {
    display: flex;
  }
  input[type='radio'],
  input[type='checkbox'] {
    width: 24px;
    height: 24px;
  }
  input[type='range'] {
    flex: 1;
    min-height: 44px;
  }
  progress {
    width: 100%;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
  .primary {
    background: #1b5fd1;
    color: #fff;
    border: 0;
    border-radius: 8px;
  }
</style>
