<script lang="ts">
  import { tick } from 'svelte';
  import { deltaT, stepForDesiredDt } from '../../lib/frames';
  import { formatDt, parseFps } from '../../lib/format';
  import type { Project } from '../../lib/state/project.svelte';
  import Card from '../components/Card.svelte';

  let { project }: { project: Project } = $props();

  const maxStep = $derived(Math.max(1, project.selection.endIndex - project.selection.startIndex));
  let editing = $state(false);
  let input = $state<HTMLInputElement>();

  function setStep(v: number) {
    if (!Number.isFinite(v) || v < 1) return;
    project.setSelection({ step: Math.floor(v) });
  }
  async function startEdit() {
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }
  function commit(e: Event & { currentTarget: HTMLInputElement }) {
    if (!editing) return;
    editing = false;
    const v = parseFps(e.currentTarget.value); // Dezimalkomma oder -punkt, > 0
    if (v !== null) setStep(stepForDesiredDt(v, project.captureFps));
  }
  function key(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') {
      e.stopPropagation();
      editing = false;
    }
  }
</script>

<Card title="Zeitabstand">
  <div class="top">
    {#if editing}
      <input
        bind:this={input}
        data-testid="dt-input"
        class="dt-input"
        type="text"
        inputmode="decimal"
        aria-label="Wunschabstand in Sekunden"
        placeholder="z. B. 0,133"
        onblur={commit}
        onkeydown={key}
      />
    {:else}
      <button type="button" class="dt" data-testid="dt-value" onclick={startEdit}>
        Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}
      </button>
    {/if}
    <span class="count muted">{project.positionsCount} Positionen</span>
  </div>
  <input
    type="range"
    data-testid="step-slider"
    aria-label="Schrittweite"
    min="1"
    max={maxStep}
    value={Math.min(project.selection.step, maxStep)}
    oninput={(e) => setStep(e.currentTarget.valueAsNumber)}
  />
</Card>

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    flex-wrap: wrap;
  }
  .dt {
    background: transparent;
    padding: 0 4px;
    font-size: 1.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--fg);
  }
  .dt-input {
    min-height: 44px;
    width: 9rem;
    font-size: 1.25rem;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    width: 100%;
    min-height: 44px;
    margin: 4px 0 0;
    accent-color: var(--acc);
  }
</style>
