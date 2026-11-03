<script lang="ts">
  import type { Polygon } from '../../lib/compose/mask';
  import { videoToViewer, viewerToVideo, type ViewGeometry } from '../../lib/viewer-coords';

  let {
    geo,
    active,
    region,
    oncommit,
  }: {
    geo: () => ViewGeometry;
    active: boolean;
    /** vorhandenes Polygon in Video-Pixeln (wird angezeigt) */
    region: Polygon | null;
    oncommit: (p: Polygon) => void;
  } = $props();

  let svg: SVGSVGElement;
  let draft = $state<Polygon>([]);
  let start: { x: number; y: number } | null = null;
  let lastTap = 0;

  $effect(() => {
    if (!active) draft = [];
  });

  const toView = (poly: Polygon) => {
    const g = geo();
    return poly.map((p) => videoToViewer(p.x, p.y, g));
  };
  const pts = (poly: Polygon) =>
    toView(poly)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

  function down(e: PointerEvent) {
    start = { x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10;
    start = null;
    if (moved) return;
    const now = performance.now();
    if (now - lastTap < 350 && draft.length >= 3) {
      lastTap = 0;
      const done = draft;
      draft = [];
      oncommit(done);
      return;
    }
    lastTap = now;
    const r = svg.getBoundingClientRect();
    const p = viewerToVideo(e.clientX - r.left, e.clientY - r.top, geo());
    draft = [...draft, { x: Math.round(p.x), y: Math.round(p.y) }];
  }
</script>

<svg
  bind:this={svg}
  class:active
  data-testid="region-editor"
  aria-hidden="true"
  onpointerdown={active ? down : undefined}
  onpointerup={active ? up : undefined}
>
  {#if region && region.length >= 3 && !active}
    <polygon points={pts(region)} class="region" />
  {/if}
  {#if active && draft.length > 0}
    <polyline points={pts(draft)} class="draft" />
    {#each toView(draft) as p, i (i)}
      <circle cx={p.x} cy={p.y} r="6" class="dot" />
    {/each}
  {/if}
</svg>

<style>
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    touch-action: none;
  }
  svg.active {
    pointer-events: auto;
    cursor: crosshair;
  }
  .region {
    fill: rgba(255, 200, 0, 0.12);
    stroke: #ffc800;
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }
  .draft {
    fill: none;
    stroke: #ffc800;
    stroke-width: 2;
  }
  .dot {
    fill: #ffc800;
    stroke: #000;
    stroke-width: 1;
  }
</style>
