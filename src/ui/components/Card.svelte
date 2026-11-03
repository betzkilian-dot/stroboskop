<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<section class="card">
  {#if title}<h3>{title}</h3>{/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--card);
    border-radius: 12px;
    padding: 12px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
</style>
