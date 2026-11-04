<script lang="ts">
  import type { Project } from '../lib/state/project.svelte';
  import { csvFileName, toCsv, type CsvStyle } from '../lib/export/csv';
  import { shareOrDownload } from '../lib/export/image';
  import { toast } from '../lib/state/toast.svelte';
  import Notice from './components/Notice.svelte';
  import Segmented from './components/Segmented.svelte';
  import type { Row } from '../lib/physics/kinematics';

  let {
    project,
    objects,
    onclose,
  }: { project: Project; objects: { name: string; rows: Row[] }[]; onclose: () => void } = $props();

  let style = $state<CsvStyle>('de');
  let error = $state<string | null>(null);
  let dialogEl: HTMLDivElement | undefined = $state();

  async function share() {
    error = null;
    try {
      const blob = new Blob([toCsv(objects, style)], { type: 'text/csv;charset=utf-8' });
      const r = await shareOrDownload(blob, csvFileName(project.name));
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
    <div class="field">
      <span class="lbl">Format</span>
      <Segmented
        label="Format"
        options={[
          { id: 'de', label: 'Deutsch (Semikolon, Komma)' },
          { id: 'intl', label: 'International (Komma, Punkt)' },
        ]}
        value={style}
        onchange={(id) => (style = id as CsvStyle)}
      />
    </div>
    {#if error}<Notice kind="error">{error}</Notice>{/if}
    <div class="actions">
      <button type="button" onclick={onclose}>Abbrechen</button>
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
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
