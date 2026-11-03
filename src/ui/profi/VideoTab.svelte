<script lang="ts">
  import { deltaT } from '../../lib/frames';
  import { formatDt, formatFps, parseFps } from '../../lib/format';
  import type { Project } from '../../lib/state/project.svelte';
  import RangeSlider from '../components/RangeSlider.svelte';
  import Notice from '../components/Notice.svelte';

  let { project }: { project: Project } = $props();

  const info = $derived(project.info);

  function setRange(r: { startIndex?: number; endIndex?: number }) {
    project.setSelection(r);
  }

  // Textfeld: erst bei change/Enter uebernehmen; ungueltig -> bisheriger Wert bleibt
  function commitFps(e: Event & { currentTarget: HTMLInputElement }) {
    const el = e.currentTarget;
    const text = el.value.trim();
    if (text === '') {
      project.captureFpsOverride = null;
    } else {
      const v = parseFps(text);
      if (v !== null) project.captureFpsOverride = v;
    }
    el.value = project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride);
    project.requestPreview();
  }
  function enter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
  }
</script>

{#if info}
  <div class="work solo">
  <div class="col video">
    <RangeSlider
      min={0}
      max={Math.max(0, info.frameCount - 1)}
      bind:start={() => project.selection.startIndex, (v) => setRange({ startIndex: v })}
      bind:end={() => project.selection.endIndex, (v) => setRange({ endIndex: v })}
      thumbs={project.thumbs}
    />
    <p>Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}</p>
    <p class="positions">{project.positionsCount} Positionen</p>
    {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}

    <p>Aufnahme: {formatFps(project.captureFps)} Bilder/s</p>
    <label>Aufnahme-fps
      <input
        type="text"
        inputmode="decimal"
        placeholder={formatFps(info.captureFps)}
        value={project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride)}
        onchange={commitFps}
        onkeydown={enter}
      />
    </label>
    {#if info.slowMotion}<span class="slow">Zeitlupe erkannt</span>{/if}
  </div>
</div>
{/if}

<style>
  .video { align-items: flex-start; }
  .video > :global(.range) { align-self: stretch; }
  p { margin: 0; }
  label { display: flex; align-items: center; gap: 8px; }
  input { min-height: 44px; width: 7rem; font-size: 1rem; box-sizing: border-box; }
  .slow { font-weight: 600; }
</style>
