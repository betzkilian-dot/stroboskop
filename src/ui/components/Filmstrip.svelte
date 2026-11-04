<script lang="ts">
  let {
    indices,
    thumbs,
    thumbsKey,
    excluded,
    current = null,
    marks = {},
    firstNumber = 1,
    numbers,
    markColor = 'var(--acc)',
    picking = false,
    ontap,
  }: {
    indices: number[];
    thumbs: ImageBitmap[];
    /** Indizes (kommagetrennt), zu denen thumbs gehoeren */
    thumbsKey: string;
    /** Bildindex des gewaehlten Hintergrundbildes */
    current?: number | null;
    /** Markierung je Bildindex: gesetzter oder unsicherer Messpunkt */
    marks?: Record<number, 'set' | 'unsure'>;
    markColor?: string;
    /** Nummer der ersten Position (Bild: 1, Messen: 0 wie in der Einblendung) */
    firstNumber?: number;
    /** Nummer je Bildindex (Messen: Index unter den Messpositionen); Bilder ohne Eintrag (ausgeschlossen) bleiben ohne Nummer. */
    numbers?: Record<number, number>;
    excluded: number[];
    picking?: boolean;
    ontap: (frameIndex: number, position: number) => void;
  } = $props();

  // Miniaturen nur nutzen, wenn sie zur aktuellen Positionsliste passen
  const numOf = (frame: number, i: number): number | null => (numbers ? (numbers[frame] ?? null) : i + firstNumber);
  const usable = $derived(thumbs.length === indices.length && thumbsKey === indices.join(','));

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

<div class="strip" role="group" aria-label="Positionen" data-testid="filmstrip">
  {#each indices as frame, i (frame)}
    <button
      type="button"
      class="item"
      class:off={excluded.includes(frame)}
      class:bg={current === frame}
      data-testid="film-item"
      aria-pressed={!excluded.includes(frame)}
      aria-current={current === frame ? 'true' : undefined}
      aria-label={picking
        ? `Bild ${frame} als Hintergrund`
        : numOf(frame, i) === null
          ? `Bild ${frame}, ausgeschlossen`
          : `Position ${numOf(frame, i)}, Bild ${frame}`}
      onclick={() => ontap(frame, i)}
    >
      {#if usable}<canvas use:paint={thumbs[i]}></canvas>{/if}
      {#if marks[frame]}
        <span
          class="mark"
          data-testid="film-mark"
          style:background={marks[frame] === 'unsure' ? 'var(--warn, #ff9500)' : markColor}
        ></span>
      {/if}
      {#if numOf(frame, i) !== null}<span class="n">{numOf(frame, i)}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .strip {
    flex: none;
    height: 64px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .item {
    position: relative;
    flex: none;
    box-sizing: border-box;
    height: 52px;
    min-height: 0;
    min-width: 44px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 8px;
    background: var(--fill);
    overflow: hidden;
  }
  .item.off {
    opacity: 0.35;
  }
  .item.bg {
    border-color: var(--acc);
  }
  canvas {
    display: block;
    height: 48px;
    width: auto;
  }
  .mark {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-sizing: border-box;
  }
  .n {
    position: absolute;
    left: 2px;
    bottom: 2px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    padding: 0 4px;
    border-radius: 3px;
  }
</style>
