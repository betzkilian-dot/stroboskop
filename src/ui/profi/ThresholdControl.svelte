<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Project } from '../../lib/state/project.svelte';

  let { project }: { project: Project } = $props();

  const MASK_HOLD_MS = 1500;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const percent = $derived(
    project.compose.threshold < 0
      ? Math.round((project.preview?.autoThreshold ?? 0.1) * 100)
      : Math.round(project.compose.threshold * 100),
  );

  function slide(e: Event & { currentTarget: HTMLInputElement }) {
    project.compose.threshold = e.currentTarget.valueAsNumber / 100;
    project.showMask = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      project.showMask = false;
      project.requestPreview();
    }, MASK_HOLD_MS);
    project.requestPreview();
  }
  onDestroy(() => {
    clearTimeout(timer);
    if (project.showMask) {
      project.showMask = false;
      project.requestPreview(); // Vorschau ohne Maskenueberlagerung neu holen
    }
  });
</script>

<div class="threshold">
  <label
    >Schwelle
    <input type="range" min="1" max="100" value={Math.max(1, percent)} oninput={slide} />
  </label>
  <output>{percent} %</output>
  <button type="button" onclick={() => void project.autoThreshold()}>Auto</button>
</div>

<style>
  .threshold {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  input {
    flex: 1;
    min-height: 44px;
  }
  output {
    min-width: 3.5rem;
    text-align: right;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
</style>
