<script lang="ts">
  import type { Project } from '../../lib/state/project.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import StageMeasure from '../profi/StageMeasure.svelte';
  import { createMeasureFlow } from '../profi/measureFlow.svelte';

  let { project }: { project: Project } = $props();

  let stage = $state<StageMeasure>();
  // svelte-ignore state_referenced_locally -- project ist pro Ansicht konstant
  const flow = createMeasureFlow(project, () => stage);
  let confirmClear = $state(false);

  const total = $derived(flow.indices.length);
  const done = $derived(total > 0 && flow.setCount >= total);
  const title = $derived(done ? 'Alle Positionen markiert' : `Position ${flow.current} antippen`);

  function step(d: number) {
    flow.current = Math.min(Math.max(0, total - 1), Math.max(0, flow.current + d));
  }
</script>

{#if project.info}
  <div class="step">
    <div class="stage">
      <StageMeasure
        bind:this={stage}
        {project}
        tool={flow.tool}
        hint={total === 0 ? null : title}
        showCalibration={false}
        showAxes={false}
        drag={flow.drag}
      />
    </div>
    <div class="controls">
      <h2>{title}</h2>
      <div class="pair">
        <button type="button" class="tile" disabled={flow.current <= 0} onclick={() => step(-1)}>‹ Vorige</button>
        <button type="button" class="tile" disabled={flow.current >= total - 1} onclick={() => step(1)}>Nächste ›</button>
      </div>
      <button type="button" class="tile" disabled={project.suggesting} onclick={() => flow.suggest()}>
        {#if project.suggesting}
          <span class="name">Wird berechnet …</span>
        {:else}
          <span class="name">✨ Vorschlagen</span>
          <span class="hint">App setzt alle Punkte, du korrigierst</span>
        {/if}
      </button>
      <div class="muted" data-testid="markiert-count">{flow.setCount} von {total} markiert</div>
      <div class="muted">Punkte, Nummern und Bahn werden automatisch eingezeichnet.</div>
      {#if flow.setCount > 0}
        <button type="button" class="tile danger" onclick={() => (confirmClear = true)}>Alle Punkte löschen</button>
      {/if}
    </div>
  </div>
{/if}

{#if confirmClear}
  <ConfirmDialog
    title="Alle Punkte löschen?"
    confirmLabel="Löschen"
    onconfirm={() => { confirmClear = false; flow.clearPoints(); }}
    oncancel={() => (confirmClear = false)}
  />
{/if}

<style>
  .step {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    background: var(--stage);
    border-radius: 12px;
    overflow: hidden;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
      overflow-y: auto;
    }
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .pair {
    display: flex;
    gap: 8px;
  }
  .pair .tile {
    flex: 1;
  }
  .muted {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    padding: 8px 12px;
    font: inherit;
    text-align: left;
    color: var(--fg);
    background: var(--card);
    border: 2px solid var(--sep);
    border-radius: 12px;
  }
  .tile:disabled {
    opacity: 0.4;
  }
  .danger {
    color: var(--acc);
    align-items: center;
  }
  .name {
    font-size: 1rem;
    font-weight: 650;
  }
  .hint {
    font-size: 0.95rem;
    opacity: 0.8;
  }
</style>
