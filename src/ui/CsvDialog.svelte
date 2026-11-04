<script lang="ts">
  import type { Project } from '../lib/state/project.svelte';
  import { shareCsv, type CsvStyle } from '../lib/export/csv';
  import { toast } from '../lib/state/toast.svelte';
  import Notice from './components/Notice.svelte';
  import CsvOptions from './components/CsvOptions.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

  let style = $state<CsvStyle>('de');
  let error = $state<string | null>(null);
  let dialogEl: HTMLDivElement | undefined = $state();

  async function share() {
    error = null;
    try {
      const r = await shareCsv(project, style);
      if (r === 'shared') toast.show('Gespeichert');
      else if (r === 'downloaded') toast.show('Heruntergeladen');
      if (r !== 'cancelled') onclose();
    } catch (e) {
      error =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Teilen wurde nicht erlaubt. Bitte erneut versuchen.'
          : 'Export fehlgeschlagen.';
    }
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
  $effect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => prev?.focus?.();
  });
</script>

<div class="backdrop">
  <div class="dialog" tabindex="-1" bind:this={dialogEl} {onkeydown} role="dialog" aria-modal="true" aria-labelledby="csv-title">
    <div class="grab" aria-hidden="true"></div>
    <h2 id="csv-title">Messtabelle als CSV</h2>
    <CsvOptions bind:style />
    {#if error}<Notice kind="error">{error}</Notice>{/if}
    <div class="actions">
      <button type="button" style="min-height:44px" onclick={onclose}>Abbrechen</button>
      <button type="button" class="btn primary" onclick={share}>Teilen / Sichern</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, #000 45%, transparent);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    background: var(--card);
    color: var(--fg);
    border-radius: 18px 18px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    width: min(100vw, 480px);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .grab {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--sep);
    align-self: center;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
