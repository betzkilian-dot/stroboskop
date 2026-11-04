<script lang="ts">
  let { onchoose }: { onchoose: (m: 'einfach' | 'erweitert') => void } = $props();
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
</script>

<main class="start">
  <h1>Stroboskop</h1>
  <p class="muted">Aus einem Video ein Stroboskopbild erzeugen.</p>
  <div class="tiles">
    <button class="tile" type="button" data-testid="mode-einfach" onclick={() => onchoose('einfach')}>
      <strong>Einfach</strong>
      <span class="muted">Schritt für Schritt zum Stroboskopbild</span>
    </button>
    <button class="tile" type="button" data-testid="mode-erweitert" onclick={() => onchoose('erweitert')}>
      <strong>Erweitert</strong>
      <span class="muted">Alle Funktionen: Maßstab, Messen, Auswerten</span>
    </button>
  </div>
  {#if !standalone}
    <p class="hint muted">Tipp: Zum Home-Bildschirm hinzufügen, um die App im Vollbild zu nutzen.</p>
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
    gap: 8px;
    width: 260px;
    min-height: 140px;
    padding: 12px;
    background: var(--card);
    color: var(--fg);
    border: 1px solid var(--sep);
    border-radius: 16px;
    font-size: 1.1rem;
  }
  .tile span {
    font-size: 0.95rem;
  }
  .hint {
    font-size: 0.95rem;
  }
</style>
