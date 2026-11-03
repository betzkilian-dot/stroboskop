<script lang="ts">
  import { selectFrameIndices } from '../../lib/frames';
  import { formatFps } from '../../lib/format';
  import type { Project } from '../../lib/state/project.svelte';
  import RangeSlider from '../components/RangeSlider.svelte';
  import Notice from '../components/Notice.svelte';

  let { project }: { project: Project } = $props();

  const info = $derived(project.info);
  const positions = $derived(selectFrameIndices(project.selection).length);

  function setRange(r: { startIndex?: number; endIndex?: number }) {
    Object.assign(project.selection, r);
    project.requestPreview();
  }

  function onfps(e: Event & { currentTarget: HTMLInputElement }) {
    const v = e.currentTarget.valueAsNumber;
    project.captureFpsOverride = Number.isFinite(v) && v > 0 ? v : null;
    project.requestPreview();
  }
</script>

{#if info}
  <div class="video">
    <RangeSlider
      min={0}
      max={Math.max(0, info.frameCount - 1)}
      bind:start={() => project.selection.startIndex, (v) => setRange({ startIndex: v })}
      bind:end={() => project.selection.endIndex, (v) => setRange({ endIndex: v })}
      thumbs={project.thumbs}
    />
    <p class="positions">{positions} Positionen</p>

    <p>Aufnahme: {formatFps(project.captureFps)} Bilder/s</p>
    <label>Aufnahme-fps
      <input
        type="number"
        inputmode="decimal"
        min="1"
        step="any"
        placeholder={formatFps(info.captureFps)}
        value={project.captureFpsOverride ?? ''}
        oninput={onfps}
      />
    </label>
    {#if info.slowMotion}<span class="slow">Zeitlupe erkannt</span>{/if}
    {#if info.fpsCertain === false}
      <Notice kind="error">Bildrate nicht eindeutig – bitte Aufnahme-fps prüfen.</Notice>
    {/if}
  </div>
{/if}

<style>
  .video { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .video > :global(.range) { align-self: stretch; }
  p { margin: 0; }
  label { display: flex; align-items: center; gap: 8px; }
  input { min-height: 44px; width: 7rem; font-size: 1rem; box-sizing: border-box; }
  .slow { font-weight: 600; }
</style>
