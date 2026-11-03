<script lang="ts">
  import type { Snippet } from 'svelte';
  let { kind = 'info', children }: { kind?: 'error' | 'info'; children: Snippet } = $props();
</script>

<div class="notice {kind}" role={kind === 'error' ? 'alert' : 'status'}>{@render children()}</div>

<style>
  .notice {
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 1rem;
    line-height: 1.3;
    min-height: 44px;
    box-sizing: border-box;
  }
  .error {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }
  .info {
    background: color-mix(in srgb, var(--warn) 15%, transparent);
    color: var(--warn);
  }
</style>
