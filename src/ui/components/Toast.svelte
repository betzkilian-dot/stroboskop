<script lang="ts">
  import { toast } from '../../lib/state/toast.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="wrap" role="status" aria-live="polite">
  {#if toast.message}
    <div class="toast" data-testid="toast">
      <Icon name="check" size={18} />
      <span>{toast.message}</span>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 30;
  }
  .toast {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--card);
    color: var(--fg);
    border-radius: 14px;
    padding: 12px 16px;
    box-shadow: 0 6px 24px color-mix(in srgb, var(--fg) 27%, transparent);
  }
  .toast :global(svg) {
    color: var(--ok);
  }
</style>
