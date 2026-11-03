<script lang="ts">
  type Crop = { x: number; y: number; w: number; h: number };
  let {
    image,
    overlay = null,
    crop = null,
    rotation = 0,
  }: { image: ImageBitmap | null; overlay?: ImageBitmap | null; crop?: Crop | null; rotation?: 0 | 90 | 180 | 270 } =
    $props();

  let box: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cw = $state(0);
  let ch = $state(0);
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  const MAX_ZOOM = 8;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastTap = 0;
  let moved = false;

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
    const c = crop ?? { x: 0, y: 0, w: image.width, h: image.height };
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
  }

  $effect(() => {
    // Abhaengigkeiten explizit lesen
    void [image, overlay, crop, rotation, cw, ch, zoom, panX, panY];
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

  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = pointers.size > 1;
  }
  function move(e: PointerEvent) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
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
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
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
</div>

<style>
  .viewer {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    background: #111;
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
</style>
