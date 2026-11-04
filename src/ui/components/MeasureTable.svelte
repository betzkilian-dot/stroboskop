<script lang="ts" module>
  export const COLUMNS = [
    { id: 't', head: 't', sub: '', unit: 's', kind: 'base' },
    { id: 'x', head: 'x', sub: '', unit: 'm', kind: 'base' },
    { id: 'y', head: 'y', sub: '', unit: 'm', kind: 'base' },
    { id: 's', head: 's', sub: '', unit: 'm', kind: 'base' },
    { id: 'vx', head: 'v', sub: 'x', unit: 'm/s', kind: 'der' },
    { id: 'vy', head: 'v', sub: 'y', unit: 'm/s', kind: 'der' },
    { id: 'v', head: '|v|', sub: '', unit: 'm/s', kind: 'der' },
    { id: 'ax', head: 'a', sub: 'x', unit: 'm/s²', kind: 'der' },
    { id: 'ay', head: 'a', sub: 'y', unit: 'm/s²', kind: 'der' },
    { id: 'a', head: '|a|', sub: '', unit: 'm/s²', kind: 'der' },
  ] as const;
</script>

<script lang="ts">
  import { formatNumber } from '../../lib/format';
  import type { Row } from '../../lib/physics/kinematics';

  let {
    rows,
    columns,
    decimals,
    selected,
    onselect,
  }: {
    rows: Row[];
    columns: string[];
    decimals: number;
    selected: number | null;
    onselect: (nr: number) => void;
  } = $props();

  const shown = $derived(COLUMNS.filter((c) => columns.includes(c.id)));

  function cell(v: number | null, kind: 'base' | 'der'): string {
    if (v === null || !Number.isFinite(v)) return '–';
    const d = kind === 'base' ? decimals : Math.max(1, decimals - 1);
    return formatNumber(v, d).replace('-', '−');
  }
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th>Nr.</th>
        {#each shown as c (c.id)}
          <th>{c.head}{#if c.sub}<sub>{c.sub}</sub>{/if} in {c.unit}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.nr)}
        <tr
          data-testid="row"
          aria-selected={selected === r.nr}
          class:sel={selected === r.nr}
          onclick={() => onselect(r.nr)}
        >
          <td>{r.nr}</td>
          {#each shown as c (c.id)}
            <td>{cell(r[c.id], c.kind)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: right;
    padding: 8px 8px;
    white-space: nowrap;
  }
  th {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 600;
    border-bottom: 1px solid var(--sep);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr.sel {
    background: var(--acc-soft);
  }
</style>
