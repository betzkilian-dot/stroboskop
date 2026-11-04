<script lang="ts">
  import { untrack } from 'svelte';
  import { BUSY_TEXT, STAGE_TEXT, type Project } from '../../lib/state/project.svelte';
  import { STEPS, applyEinfachOverlays, canAdvance, canJump, type StepId } from '../../lib/einfach/steps';
  import type { VideoInfo } from '../../lib/types';
  import BusyOverlay from '../components/BusyOverlay.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Notice from '../components/Notice.svelte';
  import StepBild from './StepBild.svelte';
  import StepMarkieren from './StepMarkieren.svelte';
  import StepCrop from './StepCrop.svelte';
  import StepTeilen from './StepTeilen.svelte';
  import StepVideo from './StepVideo.svelte';

  let { project, onpick, onhome, onrestart }: { project: Project; onpick: (kind: 'camera' | 'file') => void; onhome: () => void; onrestart: () => void } = $props();

  let step = $state<StepId>('video');
  /** hoechster erreichter Schrittindex */
  let reached = $state(0);
  const index = $derived(STEPS.findIndex((s) => s.id === step));

  // Eintritt in den Modus und neues Video: Schritt Video, Fortschritt zuruecksetzen, Einblendungen setzen
  let lastInfo: VideoInfo | null | undefined;
  $effect.pre(() => {
    const i = project.info;
    if (i === lastInfo) return;
    lastInfo = i;
    untrack(() => {
      step = 'video';
      reached = 0;
      applyEinfachOverlays(project.measure);
    });
  });

  let crop = $state<StepCrop>();
  /** vor jedem Schrittwechsel: Zuschnitt-Entwurf uebernehmen */
  function leave() {
    if (step === 'zuschnitt') crop?.commit();
  }
  function go(i: number) {
    leave();
    step = STEPS[i].id;
    reached = Math.max(reached, i);
  }
  const gate = $derived({ hasVideo: project.info !== null, selectionError: project.selectionError });
  const canNext = $derived(canAdvance(step, gate));

  let confirmQuit = $state(false);
  let confirmNew = $state(false);
  function quit() {
    if (project.info) confirmQuit = true;
    else onhome();
  }
</script>

<div class="einfach">
  <header>
    <button type="button" class="quit" data-testid="einfach-quit" onclick={quit}>✕ Beenden</button>
    <nav aria-label="Fortschritt">
      {#each STEPS as s, i (s.id)}
        <button
          type="button"
          class="seg"
          class:done={i < index}
          class:on={i === index}
          aria-current={i === index ? 'step' : undefined}
          disabled={i > reached || !canJump(step, s.id, gate)}
          onclick={() => { leave(); step = s.id; }}>{i + 1} {s.label}</button
        >
      {/each}
    </nav>
  </header>

  {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}

  <div class="body">
    {#if step === 'video'}
      <StepVideo {project} {onpick} />
    {:else if step === 'zuschnitt'}
      <StepCrop {project} bind:this={crop} />
    {:else if step === 'bild'}
      <StepBild {project} />
    {:else if step === 'markieren'}
      <StepMarkieren {project} />
    {:else}
      <StepTeilen {project} />
    {/if}
    <BusyOverlay active={project.loading} title={BUSY_TEXT.open} step={STAGE_TEXT.open} />
  </div>

  <footer>
    {#if step === 'video'}
      {#if project.info}
        <button type="button" class="nav" disabled={project.loading} onclick={() => onpick('file')}>Anderes Video</button>
      {:else}
        <span></span>
      {/if}
    {:else}
      <button type="button" class="nav" onclick={() => go(index - 1)}>‹ Zurück</button>
    {/if}
    {#if step !== 'teilen'}
      <button type="button" class="nav primary" data-testid="einfach-next" disabled={!canNext} onclick={() => go(index + 1)}>Weiter ›</button>
    {:else}
      <button type="button" class="nav" data-testid="einfach-new" onclick={() => (confirmNew = true)}>Neues Video</button>
    {/if}
  </footer>
</div>

{#if confirmNew}
  <ConfirmDialog
    title="Neues Video?"
    text="Das Bild geht verloren."
    confirmLabel="Neues Video"
    onconfirm={() => { confirmNew = false; onrestart(); }}
    oncancel={() => (confirmNew = false)}
  />
{/if}

{#if confirmQuit}
  <ConfirmDialog
    title="Beenden?"
    text="Das Bild geht verloren."
    confirmLabel="Beenden"
    onconfirm={() => { confirmQuit = false; onhome(); }}
    oncancel={() => (confirmQuit = false)}
  />
{/if}

<style>
  .einfach {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    box-sizing: border-box;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--card);
  }
  header {
    border-bottom: 1px solid var(--sep);
  }
  footer {
    justify-content: space-between;
    border-top: 1px solid var(--sep);
  }
  .quit {
    min-height: 44px;
    padding: 0 8px;
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    color: var(--acc);
    background: none;
    white-space: nowrap;
  }
  nav {
    flex: 1;
    display: flex;
    gap: 4px;
    min-width: 0;
  }
  .seg {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0 4px;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 8px;
    background: var(--fill);
    color: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seg.done {
    background: color-mix(in srgb, var(--acc) 15%, transparent);
    color: var(--acc);
  }
  .seg.on {
    background: var(--acc);
    color: #fff;
  }
  .seg:disabled:not(.on) {
    opacity: 0.6;
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px;
    overflow-y: auto;
  }
  .nav {
    min-width: 120px;
    min-height: 48px;
    padding: 0 20px;
    font: inherit;
    font-size: 1rem;
    font-weight: 650;
    border-radius: 12px;
    background: var(--fill);
    color: var(--acc);
  }
  .nav.primary {
    background: var(--acc);
    color: #fff;
  }
  .nav:disabled {
    opacity: 0.35;
  }
</style>
