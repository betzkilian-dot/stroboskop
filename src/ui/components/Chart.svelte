<script lang="ts">
  import { niceTicks } from '../../lib/charts/ticks';
  import { evalFit, fitEquation, fitPoints, formatR2, type FitKind } from '../../lib/physics/fit';

  type Series = { id: number; color: string; name: string; points: { t: number; y: number; nr: number }[] };
  let {
    series,
    xLabel,
    yLabel,
    varName,
    fit,
    showEquation,
    showR2,
    selected,
    activeId,
    onselect,
  }: {
    series: Series[];
    xLabel: string;
    yLabel: string;
    varName: string;
    fit: FitKind;
    showEquation: boolean;
    showR2: boolean;
    selected: number | null;
    /** Aktives Objekt: nur dafür gilt der Ausgleich und die Auswahlmarkierung. */
    activeId: number;
    onselect: (seriesId: number, nr: number) => void;
  } = $props();

  const TICK_NF = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3, useGrouping: false });
  const H = 280;
  const M = { l: 52, r: 14, t: 14, b: 44 };
  let width = $state(480);
  let box = $state<HTMLDivElement>();

  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => {
      if (box!.clientWidth > 0) width = box!.clientWidth;
    });
    ro.observe(box);
    return () => ro.disconnect();
  });

  const all = $derived(series.flatMap((s) => s.points));
  const fitSeries = $derived(series[0] && series[0].id === activeId ? series[0] : undefined);
  const f = $derived(fit === 'none' || !fitSeries ? null : fitPoints(fitSeries.points, fit));

  function extent(vals: number[], include0: boolean): [number, number] {
    if (vals.length === 0) return [0, 1];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (include0) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    return [lo, hi];
  }
  const xt = $derived(niceTicks(...extent(all.map((p) => p.t), true), 6));
  const yt = $derived(niceTicks(...extent(all.map((p) => p.y), false), 6));
  const x0 = $derived(xt[0] ?? 0);
  const x1 = $derived(xt[xt.length - 1] ?? 1);
  const y0 = $derived(yt[0] ?? 0);
  const y1 = $derived(yt[yt.length - 1] ?? 1);
  const px = (t: number) => M.l + ((t - x0) / (x1 - x0 || 1)) * (width - M.l - M.r);
  const py = (y: number) => H - M.b - ((y - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const tickText = (v: number) => TICK_NF.format(v).replace('-', '−');
  const curve = $derived.by(() => {
    if (!f) return '';
    const n = 60;
    const ts = fitSeries!.points.map((p) => p.t);
    const a = Math.min(...ts);
    const b = Math.max(...ts);
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = a + ((b - a) * i) / n;
      const y = Math.min(y1, Math.max(y0, evalFit(f, t)));
      d += `${i ? 'L' : 'M'}${px(t).toFixed(1)} ${py(y).toFixed(1)}`;
    }
    return d;
  });
  const hint = $derived(fit !== 'none' && !f);
  const noOwnPoints = $derived(fit !== 'none' && !fitSeries);
  const eqLines = $derived((showEquation ? 1 : 0) + (showR2 ? 1 : 0));
  const eqText = $derived(f ? fitEquation(f, varName) : '');
  const eqW = $derived(Math.max(showEquation ? eqText.length : 0, showR2 && f ? formatR2(f.r2).length : 0) * 7.6 + 16);
</script>

{#snippet sym(t: string)}{#each t.split(/(_\w)/) as part}{#if part.startsWith('_')}<tspan baseline-shift="sub" font-size="75%">{part[1]}</tspan>{:else}{part}{/if}{/each}{/snippet}

<div class="box" bind:this={box}>
  <svg data-testid="chart" viewBox={`0 0 ${width} ${H}`} {width} height={H} role="img" aria-label="Diagramm">
    {#each xt as t (t)}
      <line x1={px(t)} x2={px(t)} y1={M.t} y2={H - M.b} class="grid" />
      <text x={px(t)} y={H - M.b + 16} text-anchor="middle" class="tick">{tickText(t)}</text>
    {/each}
    {#each yt as v (v)}
      <line x1={M.l} x2={width - M.r} y1={py(v)} y2={py(v)} class="grid" />
      <text x={M.l - 6} y={py(v) + 4} text-anchor="end" class="tick">{tickText(v)}</text>
    {/each}
    <rect x={M.l} y={M.t} width={Math.max(0, width - M.l - M.r)} height={H - M.t - M.b} class="frame" />
    <text x={(M.l + width - M.r) / 2} y={H - 6} text-anchor="middle" class="lbl">{@render sym(xLabel)}</text>
    <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} text-anchor="middle" class="lbl">{@render sym(yLabel)}</text>

    {#if f && fitSeries}<path d={curve} fill="none" stroke={fitSeries.color} stroke-width="2" stroke-dasharray="6 4" />{/if}

    {#each series as s (s.id)}
      {#each s.points as p (p.nr)}
        {@const sel = s.id === activeId && selected === p.nr}
        <g data-testid="chart-point" data-selected={sel} role="button" tabindex="0" aria-label={`Punkt ${p.nr}`}
          onclick={() => onselect(s.id, p.nr)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onselect(s.id, p.nr);
            }
          }}>
          <circle cx={px(p.t)} cy={py(p.y)} r="22" fill="transparent" />
          {#if sel}<circle cx={px(p.t)} cy={py(p.y)} r="10" fill="none" stroke="var(--acc)" stroke-width="3" />{/if}
          <circle cx={px(p.t)} cy={py(p.y)} r={sel ? 6 : 4} fill={s.color} />
        </g>
      {/each}
    {/each}

    {#if f && (showEquation || showR2)}
      <g class="eq">
        <rect x={M.l + 2} y={M.t + 2} width={eqW} height={eqLines * 20 + 6} rx="8" class="eqbg" />
        {#if showEquation}<text data-testid="chart-equation" x={M.l + 8} y={M.t + 18}>{@render sym(eqText)}</text>{/if}
        {#if showR2}<text data-testid="chart-r2" x={M.l + 8} y={M.t + (showEquation ? 38 : 18)}>{formatR2(f.r2)}</text>{/if}
      </g>
    {/if}
  </svg>
  {#if noOwnPoints}<p class="hint">Für dieses Objekt gibt es noch keine Punkte</p>
  {:else if hint}<p class="hint">Zu wenige Punkte für den Ausgleich</p>{/if}
</div>

<style>
  .box {
    width: 100%;
  }
  svg {
    display: block;
    max-width: 100%;
    font-family: inherit;
  }
  .grid {
    stroke: var(--sep);
    stroke-width: 1;
  }
  .frame {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1;
  }
  .tick,
  .lbl {
    fill: var(--muted);
    font-size: 11px;
  }
  .lbl {
    fill: var(--fg);
    font-size: 12px;
  }
  .eqbg {
    fill: var(--card);
    fill-opacity: 0.85;
  }
  .eq text {
    fill: var(--fg);
    font-size: 13px;
    font-weight: 600;
  }
  g[role='button'] {
    cursor: pointer;
  }
  .hint {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 4px 0 0;
  }
</style>
