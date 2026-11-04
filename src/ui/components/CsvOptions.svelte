<script lang="ts">
  import Segmented from './Segmented.svelte';
  import type { CsvStyle } from '../../lib/export/csv';

  let { style = $bindable(), empty = false }: { style: CsvStyle; empty?: boolean } = $props();
</script>

<div class="field">
  <span class="lbl">Format</span>
  <Segmented
    label="CSV-Format"
    options={[{ id: 'de', label: 'Deutsch (Semikolon, Komma)' }, { id: 'intl', label: 'International (Komma, Punkt)' }]}
    value={style}
    onchange={(id) => (style = id as CsvStyle)}
  />
  {#if empty}<span class="hintline">Noch keine Positionen gemessen</span>{/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl,
  .hintline {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
