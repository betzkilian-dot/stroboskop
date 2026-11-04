<script lang="ts">
  import { adjustCrop, videoToViewer, viewerToVideo, type CropHandle, type ViewGeometry } from '../../lib/viewer-coords';
  import type { CropRect } from '../../lib/state/project.svelte';

  let {
    geo,
    crop = $bindable(),
  }: {
    geo: () => ViewGeometry;
    /** Rahmen in Video-Pixeln (wird beim Ziehen angepasst) */
    crop: CropRect;
  } = $props();

  let svg: SVGSVGElement;
  /** laufende Geste: Griff, Startpunkt (Video-px) und Rahmen beim Start */
  let drag: { id: number; handle: CropHandle; start: { x: number; y: number }; orig: CropRect } | null = null;

  const HIT = 44;
  const HANDLES: { h: CropHandle; fx: number; fy: number }[] = [
    { h: 'nw', fx: 0, fy: 0 },
    { h: 'n', fx: 0.5, fy: 0 },
    { h: 'ne', fx: 1, fy: 0 },
    { h: 'e', fx: 1, fy: 0.5 },
    { h: 'se', fx: 1, fy: 1 },
    { h: 's', fx: 0.5, fy: 1 },
    { h: 'sw', fx: 0, fy: 1 },
    { h: 'w', fx: 0, fy: 0.5 },
  ];

  const at = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return viewerToVideo(e.clientX - r.left, e.clientY - r.top, geo());
  };
  function down(e: PointerEvent, handle: CropHandle) {
    if (drag) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, handle, start: at(e), orig: { ...crop } };
  }
  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = at(e);
    const g = geo();
    // Bewegung in Video-Pixeln: gilt auch bei Drehung, die Griffe liegen im Video-Raum
    crop = adjustCrop(drag.orig, drag.handle, p.x - drag.start.x, p.y - drag.start.y, g.videoWidth, g.videoHeight);
  }
  function up(e: PointerEvent) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  const view = $derived.by(() => {
    const g = geo();
    const c = crop;
    const corners = [
      videoToViewer(c.x, c.y, g),
      videoToViewer(c.x + c.w, c.y, g),
      videoToViewer(c.x + c.w, c.y + c.h, g),
      videoToViewer(c.x, c.y + c.h, g),
    ];
    const pts = corners.map((p) => `${p.x},${p.y}`).join(' ');
    const handles = HANDLES.map(({ h, fx, fy }) => ({
      h,
      ...videoToViewer(c.x + c.w * fx, c.y + c.h * fy, g),
    }));
    return { pts, handles, outer: `M0,0H${g.cw}V${g.ch}H0Z`, inner: `M${pts.replaceAll(' ', 'L')}Z` };
  });
</script>

<svg bind:this={svg} data-testid="crop-editor" aria-hidden="true">
  <path d="{view.outer} {view.inner}" fill-rule="evenodd" class="dim" />
  <polygon
    points={view.pts}
    class="frame"
    role="presentation"
    data-testid="crop-frame"
    onpointerdown={(e) => down(e, 'move')}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  />
  {#each view.handles as p (p.h)}
    <circle cx={p.x} cy={p.y} r="7" class="knob" />
    <rect
      x={p.x - HIT / 2}
      y={p.y - HIT / 2}
      width={HIT}
      height={HIT}
      class="hit"
      role="presentation"
      data-testid="crop-handle-{p.h}"
      onpointerdown={(e) => down(e, p.h)}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    />
  {/each}
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
  .dim {
    fill: rgba(0, 0, 0, 0.55);
  }
  .frame {
    fill: transparent;
    stroke: #fff;
    stroke-width: 2;
    pointer-events: all;
    cursor: move;
  }
  .knob {
    fill: #fff;
    stroke: rgba(0, 0, 0, 0.5);
    stroke-width: 1;
  }
  .hit {
    fill: transparent;
    pointer-events: all;
  }
</style>
