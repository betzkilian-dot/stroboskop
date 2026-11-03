<script lang="ts">
  import { rectToCrop, videoToViewer, viewerToVideo, type ViewGeometry } from '../../lib/viewer-coords';
  import type { CropRect } from '../../lib/state/project.svelte';

  let {
    geo,
    active,
    current = null,
    oncommit,
  }: {
    geo: () => ViewGeometry;
    active: boolean;
    /** bestehender Zuschnitt (Video-Pixel), wird als Startrahmen gezeigt */
    current?: CropRect | null;
    oncommit: (c: CropRect | null) => void;
  } = $props();

  let svg: SVGSVGElement;
  let a = $state<{ x: number; y: number } | null>(null); // Video-Pixel
  let b = $state<{ x: number; y: number } | null>(null);

  $effect(() => {
    if (!active) {
      a = null;
      b = null;
    }
  });

  const at = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return viewerToVideo(e.clientX - r.left, e.clientY - r.top, geo());
  };
  function down(e: PointerEvent) {
    svg.setPointerCapture(e.pointerId);
    a = at(e);
    b = a;
  }
  function move(e: PointerEvent) {
    if (a) b = at(e);
  }
  function up(e: PointerEvent) {
    if (!a) return;
    b = at(e);
    const crop = rectToCrop(a, b);
    a = null;
    b = null;
    oncommit(crop);
  }
  function cancel() {
    a = null;
    b = null;
  }

  const box = $derived.by(() => {
    const from = a && b ? a : active && current ? { x: current.x, y: current.y } : null;
    const to = a && b ? b : current ? { x: current.x + current.w, y: current.y + current.h } : null;
    if (!from || !to) return null;
    const g = geo();
    const p = videoToViewer(from.x, from.y, g);
    const q = videoToViewer(to.x, to.y, g);
    return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(p.x - q.x), h: Math.abs(p.y - q.y) };
  });
</script>

<svg
  bind:this={svg}
  class:active
  data-testid="crop-editor"
  aria-hidden="true"
  onpointerdown={active ? down : undefined}
  onpointermove={active ? move : undefined}
  onpointerup={active ? up : undefined}
  onpointercancel={active ? cancel : undefined}
>
  {#if box}<rect x={box.x} y={box.y} width={box.w} height={box.h} />{/if}
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
  rect {
    fill: rgba(27, 95, 209, 0.2);
    stroke: #fff;
    stroke-width: 2;
  }
</style>
