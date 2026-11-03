<script lang="ts">
  import { deltaT, stepForDesiredDt } from '../../lib/frames';
  import { formatDt, parseFps } from '../../lib/format';
  import type { Project } from '../../lib/state/project.svelte';

  let { project }: { project: Project } = $props();

  const maxStep = $derived(Math.max(1, project.selection.endIndex - project.selection.startIndex));

  function setStep(v: number) {
    if (!Number.isFinite(v) || v < 1) return;
    project.selection.step = Math.floor(v);
    project.requestPreview();
    project.requestPositionThumbs();
  }
  function commitDt(e: Event & { currentTarget: HTMLInputElement }) {
    const v = parseFps(e.currentTarget.value); // Dezimalkomma oder -punkt, > 0
    if (v !== null) setStep(stepForDesiredDt(v, project.captureFps));
  }
  function enter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
  }
</script>

<section class="interval">
  <p class="dt">Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}</p>
  <p class="count">{project.positionsCount} Positionen</p>
  <label
    >Abstand
    <input
      type="number"
      min="1"
      step="1"
      value={project.selection.step}
      oninput={(e) => setStep(e.currentTarget.valueAsNumber)}
    />
  </label>
  <input
    type="range"
    aria-label="Abstand-Regler"
    min="1"
    max={maxStep}
    value={Math.min(project.selection.step, maxStep)}
    oninput={(e) => setStep(e.currentTarget.valueAsNumber)}
  />
  <label
    >Wunsch-Δt
    <input type="text" inputmode="decimal" placeholder="z. B. 0,133" onchange={commitDt} onkeydown={enter} />
  </label>
</section>

<style>
  .interval {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  p {
    margin: 0;
  }
  .dt {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .count {
    font-size: 1.1rem;
  }
  .interval > input[type='range'] {
    flex: 1 1 100%;
    min-height: 44px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  label input {
    min-height: 44px;
    width: 7rem;
    font-size: 1rem;
    box-sizing: border-box;
  }
</style>
