<script lang="ts">
  import type { Snippet } from 'svelte';
  let { kind = 'info', children }: { kind?: 'error' | 'info'; children: Snippet } = $props();
</script>

<div class="notice {kind}" role={kind === 'error' ? 'alert' : 'status'}>{@render children()}</div>

<style>
  .notice {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 1rem;
    line-height: 1.3;
    min-height: 44px;
    box-sizing: border-box;
  }
  .error {
    background: #fde8e8;
    color: #7a1212;
    border: 1px solid #e0a0a0;
  }
  .info {
    background: #fff4d6;
    color: #5a4300;
    border: 1px solid #e6cf85;
  }
</style>
