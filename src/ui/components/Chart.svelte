<script lang="ts">
  import { chartLayout, type ChartSeries as Series } from '../../lib/charts/layout';
  import type { FitKind } from '../../lib/physics/fit';

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

  const L = $derived(chartLayout({ series, xLabel, yLabel, varName, fit, showEquation, showR2, activeId }, width, H, M));
  const curve = $derived(L.curve ? L.curve.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') : '');
  const eqLines = $derived((L.equation ? 1 : 0) + (L.r2 ? 1 : 0));
  const eqW = $derived(Math.max(L.equation?.length ?? 0, L.r2?.length ?? 0) * 7.6 + 16);
</script>

{#snippet sym(t: string)}{#each t.split(/(_\w)/) as part}{#if part.startsWith('_')}<tspan baseline-shift="sub" font-size="75%">{part[1]}</tspan>{:else}{part}{/if}{/each}{/snippet}

<div class="box" bind:this={box}>
  <svg data-testid="chart" viewBox={`0 0 ${width} ${H}`} {width} height={H} role="img" aria-label="Diagramm">
    {#each L.xTicks as t (t.v)}
      <line x1={t.px} x2={t.px} y1={L.plot.y} y2={L.plot.y + L.plot.h} class="grid" />
      <text x={t.px} y={L.plot.y + L.plot.h + 16} text-anchor="middle" class="tick">{t.text}</text>
    {/each}
    {#each L.yTicks as t (t.v)}
      <line x1={L.plot.x} x2={L.plot.x + L.plot.w} y1={t.px} y2={t.px} class="grid" />
      <text x={L.plot.x - 6} y={t.px + 4} text-anchor="end" class="tick">{t.text}</text>
    {/each}
    <rect x={L.plot.x} y={L.plot.y} width={L.plot.w} height={L.plot.h} class="frame" />
    <text x={L.plot.x + L.plot.w / 2} y={H - 6} text-anchor="middle" class="lbl">{@render sym(xLabel)}</text>
    <text transform={`translate(14 ${L.plot.y + L.plot.h / 2}) rotate(-90)`} text-anchor="middle" class="lbl">{@render sym(yLabel)}</text>

    {#if L.curve && L.curveColor}<path d={curve} fill="none" stroke={L.curveColor} stroke-width="2" stroke-dasharray="6 4" />{/if}

    {#each L.points as p (`${p.seriesId}-${p.nr}`)}
      {@const sel = p.seriesId === activeId && selected === p.nr}
      <g data-testid="chart-point" data-selected={sel} role="button" tabindex="0" aria-label={`Punkt ${p.nr}`}
        onclick={() => onselect(p.seriesId, p.nr)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onselect(p.seriesId, p.nr);
          }
        }}>
        <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
        {#if sel}<circle cx={p.x} cy={p.y} r="10" fill="none" stroke="var(--acc)" stroke-width="3" />{/if}
        <circle cx={p.x} cy={p.y} r={sel ? 6 : 4} fill={p.color} />
      </g>
    {/each}

    {#if eqLines > 0}
      <g class="eq">
        <rect x={L.plot.x + 2} y={L.plot.y + 2} width={eqW} height={eqLines * 20 + 6} rx="8" class="eqbg" />
        {#if L.equation}<text data-testid="chart-equation" x={L.plot.x + 8} y={L.plot.y + 18}>{@render sym(L.equation)}</text>{/if}
        {#if L.r2}<text data-testid="chart-r2" x={L.plot.x + 8} y={L.plot.y + (L.equation ? 38 : 18)}>{L.r2}</text>{/if}
      </g>
    {/if}
  </svg>
  {#if L.hint}<p class="hint">{L.hint}</p>{/if}
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
