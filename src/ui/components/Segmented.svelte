<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  let {
    options,
    value,
    onchange,
    label
  }: {
    options: { id: string; label: string; icon?: IconName; disabled?: boolean }[];
    value: string;
    onchange: (id: string) => void;
    label: string;
  } = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === o.id}
      class:on={value === o.id}
      disabled={o.disabled}
      onclick={() => onchange(o.id)}
    >
      {#if o.icon}<Icon name={o.icon} size={16} />{/if}
      <span class="lbl">{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    background: var(--fill);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
  }
  button {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-weight: 550;
  }
  .lbl {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button.on {
    background: var(--card);
    color: var(--fg);
    box-shadow: 0 1px 3px #0003;
  }
  button:disabled {
    opacity: 0.45;
  }
</style>
