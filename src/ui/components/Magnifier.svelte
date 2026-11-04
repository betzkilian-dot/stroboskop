<script lang="ts">
  import type { Pt } from '../../lib/physics/kinematics';
  let {
    image,
    videoWidth,
    at,
    client,
    boxHeight,
    rotation = 0,
  }: {
    image: ImageBitmap;
    videoWidth: number;
    /** Video-Pixel */
    at: Pt;
    /** Position in der Viewer-Box (CSS-px) */
    client: Pt;
    boxHeight: number;
    rotation?: 0 | 90 | 180 | 270;
  } = $props();

  const SIZE = 120;
  const SRC = 40; // Vorschau-Pixel, Faktor 3
  let canvas: HTMLCanvasElement;

  const top = $derived(
    Math.min(
      Math.max(0, boxHeight - SIZE),
      client.y < 150 ? client.y + 90 : client.y - 90 - SIZE,
    ),
  );
  const left = $derived(client.x - SIZE / 2);

  $effect(() => {
    void [image, videoWidth, at.x, at.y, rotation];
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const S = Math.round(SIZE * dpr);
    if (canvas.width !== S) canvas.width = S;
    if (canvas.height !== S) canvas.height = S;
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    const k = videoWidth > 0 ? image.width / videoWidth : 1;
    const cx = at.x * k;
    const cy = at.y * k;
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate((rotation * Math.PI) / 180);
    const f = S / SRC;
    g.scale(f, f);
    g.imageSmoothingEnabled = false;
    g.drawImage(image, -cx, -cy);
    g.restore();
    // Fadenkreuz
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = Math.max(1, dpr);
    g.beginPath();
    g.moveTo(S / 2, S * 0.2);
    g.lineTo(S / 2, S * 0.8);
    g.moveTo(S * 0.2, S / 2);
    g.lineTo(S * 0.8, S / 2);
    g.stroke();
  });
</script>

<canvas
  bind:this={canvas}
  class="magnifier"
  data-testid="magnifier"
  style:left="{left}px"
  style:top="{top}px"
></canvas>

<style>
  .magnifier {
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-sizing: border-box;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
</style>
