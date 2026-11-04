<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { deltaT } from '../../lib/frames';
  import { formatDt } from '../../lib/format';
  import { hasPoints } from '../../lib/einfach/steps';
  import { exportErrorText } from '../../lib/export/errors';
  import { exportFileName, renderExportImage, shareOrDownload } from '../../lib/export/image';
  import type { Project } from '../../lib/state/project.svelte';
  import { toast } from '../../lib/state/toast.svelte';
  import Notice from '../components/Notice.svelte';

  let { project }: { project: Project } = $props();

  let blob = $state.raw<Blob | null>(null);
  let url = $state<string | null>(null);
  let preparing = $state(true);
  let error = $state<string | null>(null);
  let failed = $state(false);
  let seq = 0;
  let inFlight = 0;

  async function run(my: number) {
    inFlight++;
    try {
      const b = await renderExportImage(
        project,
        { format: 'jpeg', quality: 0.9, size: 'worksheet', infoLine: true, overlays: hasPoints(project.measure) },
        () => my === seq,
      );
      if (my === seq) {
        blob = b;
        url = URL.createObjectURL(b);
        preparing = false;
      }
    } catch (e) {
      if (my === seq) {
        error = exportErrorText(e);
        failed = true;
        preparing = false;
      }
    } finally {
      inFlight--;
      project.endExport();
    }
  }

  function prepare() {
    const my = ++seq;
    if (inFlight > 0) project.engine.cancel();
    if (url) URL.revokeObjectURL(url);
    url = null;
    blob = null;
    error = null;
    failed = false;
    preparing = true;
    project.beginExport();
    void run(my);
  }

  onMount(prepare);

  onDestroy(() => {
    seq++;
    if (inFlight > 0) project.engine.cancel();
    project.strobeCache.clear();
    if (url) URL.revokeObjectURL(url);
  });

  async function share() {
    if (!blob) return;
    error = null;
    try {
      const r = await shareOrDownload(blob, exportFileName(project.name, 'jpg'));
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
    } catch (e) {
      error = exportErrorText(e);
    }
  }
</script>

<div class="step">
  <div class="stage">
    {#if url}
      <img src={url} alt="Fertiges Stroboskopbild" data-testid="einfach-share-preview" />
    {:else if preparing}
      <progress class="prog" value={project.progress > 0 ? project.progress : undefined} max="1" aria-label="Fortschritt"></progress>
    {/if}
  </div>
  <div class="controls">
    {#if error}<Notice kind="error">{error}</Notice>{/if}
    {#if failed}
      <button type="button" class="share" onclick={prepare}>Erneut versuchen</button>
    {:else}
      <button type="button" class="share" data-testid="einfach-share" disabled={preparing || !blob} onclick={share}>
        {preparing || !blob ? 'Wird vorbereitet …' : '⬆ Bild teilen'}
      </button>
    {/if}
    <p class="muted">Mit Infozeile „Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}“ unten im Bild</p>
    <p class="muted">In Fotos sichern, per AirDrop an die Lehrkraft, in Dateien …</p>
  </div>
</div>

<style>
  .step {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .stage {
    flex: 1;
    min-height: 200px;
    background: var(--stage);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .prog {
    width: 60%;
    accent-color: var(--acc);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  @media (orientation: landscape) and (min-width: 700px) {
    .step {
      flex-direction: row;
    }
    .stage {
      flex: 1.6;
    }
    .controls {
      flex: 1;
      justify-content: center;
    }
  }
  .share {
    min-height: 56px;
    padding: 0 20px;
    font: inherit;
    font-size: 1.15rem;
    font-weight: 700;
    border-radius: 14px;
    background: var(--acc);
    color: #fff;
  }
  .share:disabled {
    opacity: 0.5;
  }
  p {
    margin: 0;
  }
</style>
