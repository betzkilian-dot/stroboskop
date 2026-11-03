<script lang="ts">
  let { active, title, step, progress }: { active: boolean; title: string; step?: string; progress?: number } = $props();

  const DELAY_MS = 300;
  let shown = $state(false);

  // Erscheint erst nach 300 ms ununterbrochen aktiv; verschwindet sofort, Timer startet bei jedem Aktivwerden neu.
  $effect(() => {
    if (!active) {
      shown = false;
      return;
    }
    const t = setTimeout(() => (shown = true), DELAY_MS);
    return () => clearTimeout(t);
  });
</script>

{#if active && shown}
  <div class="busy-wrap">
    <div class="busy" role="status" data-testid="busy">
      <b>{title}</b>
      {#if step}<div class="step">{step}</div>{/if}
      {#if progress === undefined}
        <div class="bar indeterminate" aria-hidden="true"><i></i></div>
      {:else}
        <div class="bar" aria-hidden="true"><i style="width:{Math.round(Math.min(1, Math.max(0, progress)) * 100)}%"></i></div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .busy-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 5;
  }
  .busy {
    background: var(--card);
    color: var(--fg);
    border-radius: 14px;
    padding: 12px 16px;
    box-shadow: 0 6px 24px #0004;
    min-width: 190px;
    max-width: 90%;
  }
  .step {
    color: var(--muted);
    font-size: 0.8rem;
    margin-top: 2px;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--fill);
    margin-top: 10px;
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--acc);
    border-radius: 3px;
    transition: width 0.15s;
  }
  .indeterminate i {
    width: 40%;
    animation: slide 1.1s ease-in-out infinite;
  }
  @keyframes slide {
    from { transform: translateX(-100%); }
    to { transform: translateX(250%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .indeterminate i { animation: none; width: 100%; }
  }
</style>
