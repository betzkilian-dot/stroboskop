<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    checked,
    label,
    disabled = false,
    onchange,
    children
  }: { checked: boolean; label: string; disabled?: boolean; onchange: (v: boolean) => void; children?: Snippet } = $props();
</script>

<button type="button" class="row" role="switch" aria-checked={checked} {disabled} onclick={() => onchange(!checked)}>
  <span class="text">{#if children}{@render children()}{:else}{label}{/if}</span>
  <span class="track" class:on={checked}><span class="knob"></span></span>
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    background: transparent;
    padding: 0;
    text-align: left;
  }
  .track {
    flex: none;
    position: relative;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    background: var(--fill);
    transition: background 0.15s;
  }
  .track.on {
    background: var(--ok);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px #0004;
    transition: transform 0.15s;
  }
  .track.on .knob {
    transform: translateX(20px);
  }
</style>
