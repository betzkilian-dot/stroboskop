<script lang="ts">
  let {
    title,
    text,
    confirmLabel,
    onconfirm,
    oncancel,
  }: { title: string; text?: string; confirmLabel: string; onconfirm: () => void; oncancel: () => void } = $props();

  let dialogEl: HTMLDivElement | undefined = $state();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') oncancel();
  }

  $effect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => prev?.focus?.();
  });
</script>

<div class="backdrop">
  <div class="dialog" tabindex="-1" bind:this={dialogEl} {onkeydown} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title">{title}</h2>
    {#if text}<p class="muted">{text}</p>{/if}
    <div class="actions">
      <button type="button" style="min-height:44px" onclick={oncancel}>Abbrechen</button>
      <button type="button" class="danger" onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, #000 45%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 20;
  }
  .dialog {
    background: var(--card);
    color: var(--fg);
    border-radius: 18px;
    padding: 20px 16px 16px;
    width: min(100%, 380px);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  p {
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .danger {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    border: none;
    background: var(--danger);
    color: #fff;
    font-weight: 600;
  }
</style>
