<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Project } from '../../lib/state/project.svelte';

  let { project }: { project: Project } = $props();

  const MASK_HOLD_MS = 1500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Haltezeit der Maske beginnt erst, wenn nach dem letzten Ziehen eine Vorschau MIT Maske eingetroffen ist.
  // Fallback: endet die Haltezeit nie (Fehler, Modus ohne Maske, Auswahlfehler), wird die Maske nach 10 s trotzdem beendet.
  const MASK_MAX_MS = 10000;
  let holdPending = false;
  let previewAtSlide: unknown = null;
  let fallback: ReturnType<typeof setTimeout> | undefined;

  function endHold() {
    holdPending = false;
    clearTimeout(timer);
    clearTimeout(fallback);
    if (project.showMask) {
      project.showMask = false;
      project.requestPreview();
    }
  }

  $effect(() => {
    const p = project.preview;
    // jede neue Vorschau nach dem Ziehen (mit oder ohne Maske) startet die Haltezeit
    if (holdPending && p && p !== previewAtSlide) {
      holdPending = false;
      clearTimeout(timer);
      clearTimeout(fallback);
      timer = setTimeout(endHold, MASK_HOLD_MS);
    }
  });

  const percent = $derived(
    project.compose.threshold < 0
      ? Math.round((project.preview?.autoThreshold ?? 0.1) * 100)
      : Math.round(project.compose.threshold * 100),
  );

  function slide(e: Event & { currentTarget: HTMLInputElement }) {
    project.compose.threshold = e.currentTarget.valueAsNumber / 100;
    project.showMask = true;
    clearTimeout(timer);
    clearTimeout(fallback);
    fallback = setTimeout(endHold, MASK_MAX_MS);
    holdPending = true;
    previewAtSlide = project.preview;
    project.requestPreview();
  }
  onDestroy(() => {
    clearTimeout(timer);
    clearTimeout(fallback);
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
