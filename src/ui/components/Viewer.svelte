<script lang="ts">
  import type { Snippet } from 'svelte';
  import { viewerToVideo, videoToViewer, type ViewGeometry, type StageTool } from '../../lib/viewer-coords';
  import type { Pt } from '../../lib/physics/kinematics';
  import Icon from './Icon.svelte';
  type Crop = { x: number; y: number; w: number; h: number };
  let {
    image,
    overlay = null,
    crop = null,
    rotation = 0,
    videoWidth = 0,
    videoHeight = 0,
    tools,
    tool = null,
    paint = null,
  }: {
    image: ImageBitmap | null;
    overlay?: ImageBitmap | null;
    crop?: Crop | null;
    rotation?: 0 | 90 | 180 | 270;
    videoWidth?: number;
    videoHeight?: number;
    /** Zeichenflaeche ueber dem Bild (Bereich/Zuschnitt); bekommt die aktuelle Geometrie als Funktion */
    tools?: Snippet<[() => ViewGeometry]>;
    /** Werkzeug fuer Punkte setzen/ziehen; null = nur Zoom/Pan */
    tool?: StageTool | null;
    /** Einblendungen nach dem Bild (Geraetepixel, ohne Bildtransformation) */
    paint?:
      | ((
          ctx: CanvasRenderingContext2D,
          map: (p: Pt) => Pt,
          unit: number,
          size: { width: number; height: number },
        ) => void)
      | null;
  } = $props();

  /** Aktuelle Abbildung Video-Pixel <-> Viewer (reaktiv, wenn in $derived/$effect gelesen). */
  function geometry(): ViewGeometry {
    return { cw, ch, zoom, panX, panY, rotation, videoWidth, videoHeight, crop };
  }

  /** Aktuelle Geometrie fuer Eltern-Komponenten (Trefferradius u. a.) */
  export function getGeometry(): ViewGeometry {
    return geometry();
  }

  let box: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cw = $state(0);
  let ch = $state(0);
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  const MAX_ZOOM = 8;
  /** Tipp-Toleranz in CSS-px: kleinere Bewegungen zaehlen noch als Tippen (Finger zittern). */
  const TAP_SLOP = 10;
  const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  let lastTap = 0;
  let moved = false;
  let toolActive = false;

  $effect(() => {
    const ro = new ResizeObserver(() => {
      cw = box.clientWidth;
      ch = box.clientHeight;
    });
    ro.observe(box);
    return () => ro.disconnect();
  });

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(cw * dpr));
    const H = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!image) return;
    // crop liegt in Video-Pixeln; auf die Vorschau-Bitmap umrechnen
    const k = videoWidth > 0 ? image.width / videoWidth : 1;
    const c = crop
      ? { x: crop.x * k, y: crop.y * k, w: crop.w * k, h: crop.h * k }
      : { x: 0, y: 0, w: image.width, h: image.height };
    const swap = rotation === 90 || rotation === 270;
    const rw = swap ? c.h : c.w;
    const rh = swap ? c.w : c.h;
    const fit = Math.min(W / rw, H / rh) * zoom;
    g.translate(W / 2 + panX * dpr, H / 2 + panY * dpr);
    g.scale(fit, fit);
    g.rotate((rotation * Math.PI) / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, c.x, c.y, c.w, c.h, -c.w / 2, -c.h / 2, c.w, c.h);
    if (overlay) g.drawImage(overlay, c.x, c.y, c.w, c.h, -c.w / 2, -c.h / 2, c.w, c.h);
    if (paint) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const geo = geometry();
      const map = (p: Pt): Pt => {
        const v = videoToViewer(p.x, p.y, geo);
        return { x: v.x * dpr, y: v.y * dpr };
      };
      paint(g, map, dpr, { width: W, height: H });
    }
  }

  $effect(() => {
    // Abhaengigkeiten explizit lesen
    void [image, overlay, crop, rotation, videoWidth, paint, cw, ch, zoom, panX, panY];
    if (canvas) draw();
  });

  function clampPan() {
    if (zoom <= 1) {
      panX = 0;
      panY = 0;
      return;
    }
    const lim = (v: number, size: number) => Math.max(-size * zoom, Math.min(size * zoom, v));
    panX = lim(panX, cw / 2);
    panY = lim(panY, ch / 2);
  }
  function reset() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }
  function dist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function midpoint() {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Position relativ zur Viewer-Box (CSS-px) */
  function local(e: PointerEvent): Pt {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toVideo(c: Pt): Pt {
    return viewerToVideo(c.x, c.y, geometry());
  }

  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    moved = pointers.size > 1;
    if (tool) {
      if (pointers.size === 1) toolActive = tool.press(toVideo(local(e)), local(e));
      else if (toolActive) {
        tool.cancel();
        toolActive = false;
      }
    }
  }
  function move(e: PointerEvent) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (toolActive && tool && pointers.size === 1) {
      if (!moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < TAP_SLOP) return;
      p.x = e.clientX;
      p.y = e.clientY;
      moved = true;
      const c = local(e);
      tool.drag(toVideo(c), c);
      return;
    }
    if (pointers.size === 2) {
      const before = dist();
      const oldMid = midpoint();
      p.x = e.clientX;
      p.y = e.clientY;
      const after = dist();
      const newMid = midpoint();
      if (before > 0) zoom = Math.max(1, Math.min(MAX_ZOOM, (zoom * after) / before));
      panX += newMid.x - oldMid.x;
      panY += newMid.y - oldMid.y;
      moved = true;
      clampPan();
    } else if (pointers.size === 1) {
      if (!moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < TAP_SLOP) return;
      moved = true;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (zoom > 1) {
        panX += dx;
        panY += dy;
        clampPan();
      }
    }
  }
  function up(e: PointerEvent) {
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (toolActive && tool) {
      toolActive = false;
      if (e.type === 'pointercancel') tool.cancel();
      else tool.release();
      return;
    }
    if (e.type === 'pointercancel') return;
    if (wasSingle && !moved && tool) {
      tool.tap(toVideo(local(e)));
      return;
    }
    if (wasSingle && !moved) {
      const now = performance.now();
      if (now - lastTap < 350) {
        reset();
        lastTap = 0;
      } else lastTap = now;
    }
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    zoom = Math.max(1, Math.min(MAX_ZOOM, zoom * Math.exp(-e.deltaY * 0.002)));
    clampPan();
  }
</script>

<div class="viewer" bind:this={box}>
  <canvas
    bind:this={canvas}
    data-testid="viewer-canvas"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onwheel={wheel}
  ></canvas>
  {@render tools?.(geometry)}
  {#if tool && zoom > 1}
    <button type="button" class="zoom-reset" data-testid="zoom-reset" aria-label="Ansicht zurücksetzen" onclick={reset}>
      <Icon name="close" size={18} />
    </button>
  {/if}
</div>

<style>
  .viewer {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    background: var(--stage);
    overflow: hidden;
  }
  .zoom-reset {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    cursor: pointer;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
</style>
