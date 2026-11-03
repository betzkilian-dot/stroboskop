<script lang="ts">
  import type { Snippet } from 'svelte';
  import { BUSY_TEXT } from '../lib/state/project.svelte';
  import Icon from './components/Icon.svelte';
  import BusyOverlay from './components/BusyOverlay.svelte';
  let { onpick, loading = false, children }: { onpick: (kind: 'camera' | 'file') => void; loading?: boolean; children?: Snippet } = $props();
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
</script>

<main class="start">
  <h1>Stroboskop</h1>
  <p class="muted">Aus einem Video ein Stroboskopbild erzeugen.</p>
  <div class="tiles">
    <button class="tile" type="button" data-testid="pick-camera" disabled={loading} onclick={() => onpick('camera')}>
      <Icon name="camera" size={36} />
      <span>Video aufnehmen</span>
    </button>
    <button class="tile" type="button" data-testid="pick-file" disabled={loading} onclick={() => onpick('file')}>
      <Icon name="folder" size={36} />
      <span>Video auswählen</span>
    </button>
  </div>
  {@render children?.()}
  {#if !standalone}
    <p class="hint muted">Tipp: Zum Home-Bildschirm hinzufügen, um die App im Vollbild zu nutzen.</p>
  {/if}
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
    width: 200px;
    min-height: 140px;
    background: var(--card);
    color: var(--fg);
    border: 1px solid var(--sep);
    border-radius: 16px;
    font-size: 1.1rem;
  }
  .tile :global(svg) {
    color: var(--acc);
  }
  .hint {
    font-size: 0.95rem;
  }
</style>
