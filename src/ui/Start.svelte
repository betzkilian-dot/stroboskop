<script lang="ts">
  import type { Snippet } from 'svelte';
  import { BUSY_TEXT } from '../lib/state/project.svelte';
  import Icon from './components/Icon.svelte';
  import BusyOverlay from './components/BusyOverlay.svelte';
  let { onpick, onhome, loading = false, children }: { onpick: () => void; onhome: () => void; loading?: boolean; children?: Snippet } = $props();
</script>

<main class="start">
  <button type="button" class="btn back" data-testid="home" onclick={onhome}>‹ Start</button>
  <h1>Stroboskop</h1>
  <p class="muted">Aus einem Video ein Stroboskopbild erzeugen.</p>
  <div class="tiles">
    <button class="tile" type="button" data-testid="pick-file" disabled={loading} onclick={() => onpick()}>
      <Icon name="video" size={36} />
      <span>Video</span>
      <small class="muted">aufnehmen oder aus Fotos/Dateien wählen</small>
    </button>
  </div>
  {@render children?.()}
  <BusyOverlay active={loading} title={BUSY_TEXT.open} />
</main>

<style>
  .start {
    position: relative;
    min-height: 100dvh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px 16px;
    text-align: center;
  }
  .tiles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 260px;
    min-height: 140px;
    padding: 12px;
    background: var(--card);
    color: var(--fg);
    border: 1px solid var(--sep);
    border-radius: 16px;
    font-size: 1.1rem;
  }
  .tile small {
    font-size: 0.95rem;
  }
  .tile :global(svg) {
    color: var(--acc);
  }
  .back {
    position: absolute;
    top: calc(8px + env(safe-area-inset-top, 0px));
    left: 12px;
    min-height: 44px;
  }
</style>
