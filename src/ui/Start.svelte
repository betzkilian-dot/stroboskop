<script lang="ts">
  import type { Snippet } from 'svelte';
  import { LOADING_TEXT } from '../lib/state/project.svelte';
  let { onpick, loading = false, children }: { onpick: () => void; loading?: boolean; children?: Snippet } = $props();
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
</script>

<main class="start">
  <h1>Stroboskop</h1>
  <p>Aus einem Video ein Stroboskopbild erzeugen.</p>
  <button class="primary" type="button" disabled={loading} onclick={onpick}>Neues Projekt</button>
  {#if loading}<p role="status">{LOADING_TEXT}</p>{/if}
  {@render children?.()}
  {#if !standalone}
    <p class="hint">Tipp: Zum Home-Bildschirm hinzufügen, um die App im Vollbild zu nutzen.</p>
  {/if}
</main>

<style>
  .start {
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
  .primary {
    min-height: 56px;
    min-width: 240px;
    font-size: 1.2rem;
    border: 0;
    border-radius: 12px;
    background: #1b5fd1;
    color: #fff;
    padding: 0 28px;
  }
  .hint {
    color: #555;
    font-size: 0.95rem;
  }
</style>
