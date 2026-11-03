<script lang="ts">
  import { onDestroy } from 'svelte';
  import Card from '../components/Card.svelte';
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

  // Laeuft beim Fallback noch eine (langsame, z. B. 4K-)Maskenvorschau, wird erneut gewartet statt sie zu verdraengen.
  function fallbackFired() {
    if (project.rendering) {
      fallback = setTimeout(fallbackFired, MASK_MAX_MS);
      return;
    }
    endHold();
  }

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
    fallback = setTimeout(fallbackFired, MASK_MAX_MS);
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

<div data-testid="sensitivity">
  <Card title="Empfindlichkeit">
    <div class="threshold">
      <input
        type="range"
        aria-label="Empfindlichkeit"
        min="1"
        max="100"
        value={Math.max(1, percent)}
        oninput={slide}
      />
      <output>{percent} %</output>
      <button type="button" onclick={() => void project.autoThreshold()}>Auto</button>
    </div>
  </Card>
</div>

<style>
  .threshold {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    accent-color: var(--acc);
  }
  output {
    min-width: 3rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  button {
    min-width: 44px;
    padding: 0 16px;
  }
</style>
