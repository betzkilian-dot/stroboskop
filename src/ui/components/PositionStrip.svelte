<script lang="ts">
  let {
    indices,
    thumbs,
    excluded,
    picking = false,
    ontap,
  }: {
    indices: number[];
    thumbs: ImageBitmap[];
    excluded: number[];
    picking?: boolean;
    ontap: (frameIndex: number, position: number) => void;
  } = $props();

  // Miniaturen nur nutzen, wenn sie zur aktuellen Positionsliste passen
  const usable = $derived(thumbs.length === indices.length);

  function paint(node: HTMLCanvasElement, bmp: ImageBitmap | undefined) {
    const draw = (b: ImageBitmap | undefined) => {
      if (!b) return;
      try {
        node.width = b.width;
        node.height = b.height;
        node.getContext('2d')!.drawImage(b, 0, 0);
      } catch {
        /* Bitmap bereits geschlossen */
      }
    };
    draw(bmp);
    return { update: draw };
  }
</script>

<div class="strip" role="group" aria-label="Positionen">
  {#each indices as frame, i (frame)}
    <button
      type="button"
      class="item"
      class:off={excluded.includes(frame)}
      data-testid="position-{i}"
      aria-pressed={!excluded.includes(frame)}
      aria-label={picking ? `Bild ${frame} als Hintergrund` : `Position ${i + 1}, Bild ${frame}`}
      onclick={() => ontap(frame, i)}
    >
      {#if usable}<canvas use:paint={thumbs[i]}></canvas>{/if}
      <span class="n">{i + 1}</span>
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 4px 0;
  }
  .item {
    position: relative;
    flex: 0 0 auto;
    min-width: 56px;
    min-height: 56px;
    padding: 0;
    border: 2px solid #1b5fd1;
    border-radius: 6px;
    background: #222;
    color: #fff;
    overflow: hidden;
  }
  .item.off {
    opacity: 0.35;
    border-color: #888;
  }
  canvas {
    display: block;
    height: 56px;
    width: auto;
  }
  .n {
    position: absolute;
    left: 2px;
    bottom: 2px;
    font-size: 0.75rem;
    background: rgba(0, 0, 0, 0.6);
    padding: 0 4px;
    border-radius: 3px;
  }
</style>
