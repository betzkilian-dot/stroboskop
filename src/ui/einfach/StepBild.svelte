<script lang="ts">
  import { deltaT } from '../../lib/frames';
  import { formatDt } from '../../lib/format';
  import { LOOKS, kontrastThreshold, lookOf, stepInfoText, type Look } from '../../lib/einfach/steps';
  import { BUSY_TEXT, STAGE_TEXT, type Project } from '../../lib/state/project.svelte';
  import BusyOverlay from '../components/BusyOverlay.svelte';
  import Notice from '../components/Notice.svelte';
  import Viewer from '../components/Viewer.svelte';
  import ThresholdControl from '../profi/ThresholdControl.svelte';

  let { project }: { project: Project } = $props();

  const maxStep = $derived(Math.max(1, project.selection.endIndex - project.selection.startIndex));
  const look = $derived(lookOf(project.compose.mode, project.compose.threshold));

  function setStep(v: number) {
    if (!Number.isFinite(v) || v < 1) return;
    project.setSelection({ step: Math.floor(v) });
  }
  function pick(id: Look, mode: (typeof LOOKS)[number]['mode']) {
    if (id === look) return;
    // „Wenig Kontrast“: empfindlichere feste Schwelle; alle anderen: Schwelle automatisch
    project.compose.threshold = id === 'kontrast' ? kontrastThreshold(project.preview?.autoThreshold) : -1;
    project.compose.mode = mode;
    project.requestPreview();
  }
</script>

{#if project.info}
  <div class="step">
    <div class="stage">
      <Viewer
        image={project.preview?.image ?? null}
        overlay={null}
        crop={project.crop}
        rotation={project.rotation}
        videoWidth={project.info.width}
        videoHeight={project.info.height}
      />
      <BusyOverlay
        active={project.rendering}
        title={BUSY_TEXT.preview}
        step={project.stage ? STAGE_TEXT[project.stage] : undefined}
        progress={project.progress}
      />
    </div>
    <div class="controls">
      {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
      <div class="dt-box">
        <div class="dt" data-testid="einfach-dt">Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}</div>
        <div class="muted info">{project.positionsCount} Positionen · {stepInfoText(project.selection.step)}</div>
      </div>
      <div class="slider">
        <input
          type="range"
          data-testid="step-slider"
          aria-label="Schrittweite"
          min="1"
          max={maxStep}
          value={Math.min(project.selection.step, maxStep)}
          oninput={(e) => setStep(e.currentTarget.valueAsNumber)}
        />
        <div class="ends muted"><span>dichter</span><span>weiter</span></div>
      </div>
      <h2>Darstellung</h2>
      <div class="tiles" role="radiogroup" aria-label="Darstellung">
        {#each LOOKS as l (l.id)}
          <button
            type="button"
            role="radio"
            aria-checked={look === l.id}
            class="tile"
            class:on={look === l.id}
            onclick={() => pick(l.id, l.mode)}
          >
            <span class="name">{l.label}</span>
            <span class="hint">{l.hint}</span>
          </button>
        {/each}
      </div>
      {#if look === 'kontrast'}
        <ThresholdControl {project} />
        <p class="muted tip">Regler nach rechts, wenn Rauschen oder Schatten mit ins Bild kommen.</p>
      {/if}
    </div>
  </div>
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
    min-height: 200px;
    background: var(--stage);
    border-radius: 12px;
    overflow: hidden;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .dt {
    font-size: 2.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .info {
    font-size: 1rem;
  }
  input[type='range'] {
    width: 100%;
    min-height: 44px;
    margin: 0;
    accent-color: var(--acc);
  }
  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
  }
  h2 {
    margin: 4px 0 0;
    font-size: 1.1rem;
    font-weight: 650;
  }
  .tiles {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
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
  .tile.on {
    background: var(--acc-soft);
    border-color: var(--acc);
    color: var(--acc);
  }
  .name {
    font-size: 1rem;
    font-weight: 650;
  }
  .tip {
    margin: 0;
    font-size: 0.95rem;
  }
  .hint {
    font-size: 0.95rem;
    font-weight: 400;
    opacity: 0.8;
  }
</style>
