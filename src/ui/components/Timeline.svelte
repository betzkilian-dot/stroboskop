<script lang="ts">
  import { formatNumber } from '../../lib/format';

  let {
    thumbs,
    durationS,
    currentTimeS,
    startS,
    endS,
    stepS = 1 / 30,
    onseek,
    onstart,
    onend,
  }: {
    thumbs: ImageBitmap[];
    durationS: number;
    currentTimeS: number;
    startS: number;
    endS: number;
    /** Schrittweite der Pfeiltasten an den Markierungen (ein Videobild) */
    stepS?: number;
    onseek: (t: number) => void;
    onstart: (t: number) => void;
    onend: (t: number) => void;
  } = $props();

  let track: HTMLDivElement;
  let canvases: HTMLCanvasElement[] = $state([]);

  const dur = $derived(durationS > 0 ? durationS : 1);
  const pct = (t: number) => Math.min(100, Math.max(0, (t / dur) * 100));
  const s = (v: number) => `${formatNumber(v, 2)} s`;

  $effect(() => {
    thumbs.forEach((b, i) => {
      const c = canvases[i];
      if (!c) return;
      c.width = b.width;
      c.height = b.height;
      c.getContext('2d')?.drawImage(b, 0, 0);
    });
  });

  function timeAt(clientX: number): number {
    const r = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width))) * dur;
  }

  /** Ziehen mit Pointer-Capture; fn bekommt die Zeit unter dem Finger.
   *  fn = null: Ziel steht erst nach der ersten Bewegung fest (choose(dx), dx = Bewegungsrichtung). */
  function drag(e: PointerEvent, fn: ((t: number) => void) | null, choose?: (dx: number) => (t: number) => void) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    let active = fn;
    active?.(timeAt(e.clientX));
    const move = (ev: PointerEvent) => {
      if (!active) {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) < DECIDE_PX || !choose) return;
        active = choose(dx);
      }
      active(timeAt(ev.clientX));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** halbe Breite der Greifflaeche einer Markierung (CSS: width 44px) */
  const HALF_HIT_PX = 22;
  /** Mindestbewegung, bevor bei ueberlappenden Markierungen entschieden wird */
  const DECIDE_PX = 3;

  /** Markierung greifen. Ueberlappen sich die Greifflaechen von Anfang und Ende unter dem Finger,
   *  entscheidet die erste Bewegung: nach links = Anfang, nach rechts = Ende. */
  function markDown(e: PointerEvent, which: 'start' | 'end') {
    const r = track.getBoundingClientRect();
    const xs = r.left + (pct(startS) / 100) * r.width;
    const xe = r.left + (pct(endS) / 100) * r.width;
    const both = Math.abs(e.clientX - xs) <= HALF_HIT_PX && Math.abs(e.clientX - xe) <= HALF_HIT_PX;
    if (!both) return drag(e, which === 'start' ? onstart : onend);
    drag(e, null, (dx) => (dx < 0 ? onstart : onend));
  }

  function key(e: KeyboardEvent, t: number, fn: (t: number) => void) {
    let next: number;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = t - stepS;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = t + stepS;
    else return;
    e.preventDefault();
    fn(Math.min(dur, Math.max(0, next)));
  }
</script>

<div class="timeline">
  <div
    class="track"
    bind:this={track}
    data-testid="timeline-track"
    role="slider"
    tabindex="0"
    aria-label="Wiedergabeposition"
    aria-valuemin={0}
    aria-valuemax={dur}
    aria-valuenow={currentTimeS}
    aria-valuetext={s(currentTimeS)}
    onpointerdown={(e) => drag(e, onseek)}
    onkeydown={(e) => key(e, currentTimeS, onseek)}
  >
    <div class="strip">
      {#each thumbs as _, i (i)}
        <canvas bind:this={canvases[i]}></canvas>
      {/each}
    </div>
    <div class="dim" style:left="0" style:width="{pct(startS)}%"></div>
    <div class="dim" style:right="0" style:width="{100 - pct(endS)}%"></div>
    <div
      class="mark"
      data-testid="mark-start"
      role="slider"
      tabindex="0"
      aria-label="Anfang"
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={startS}
      aria-valuetext={s(startS)}
      style:left="{pct(startS)}%"
      onpointerdown={(e) => markDown(e, 'start')}
      onkeydown={(e) => key(e, startS, onstart)}
    ></div>
    <div
      class="mark"
      data-testid="mark-end"
      role="slider"
      tabindex="0"
      aria-label="Ende"
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={endS}
      aria-valuetext={s(endS)}
      style:left="{pct(endS)}%"
      onpointerdown={(e) => markDown(e, 'end')}
      onkeydown={(e) => key(e, endS, onend)}
    ></div>
    <div class="head" data-testid="playhead" style:left="{pct(currentTimeS)}%"></div>
  </div>
  <div class="times">
    <span>{s(0)}</span>
    <span data-testid="range-text">Auswahl {formatNumber(startS, 2)} – {formatNumber(endS, 2)} s ({s(Math.max(0, endS - startS))})</span>
    <span data-testid="duration-text">{s(durationS)}</span>
  </div>
</div>

<style>
  .timeline {
    background: var(--card);
    border-radius: 12px;
    padding: 12px 22px 10px;
  }
  .track {
    position: relative;
    height: 52px;
    touch-action: none;
    cursor: pointer;
    outline: none;
  }
  .track:focus-visible {
    box-shadow: 0 0 0 2px var(--acc);
    border-radius: 8px;
  }
  .strip {
    display: flex;
    gap: 2px;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: var(--stage);
  }
  .strip canvas {
    flex: 1;
    min-width: 0;
    height: 100%;
    object-fit: cover;
    background: var(--stage);
  }
  .dim {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
  }
  .dim:first-of-type {
    border-radius: 8px 0 0 8px;
  }
  .mark {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 44px;
    margin-left: -22px;
    touch-action: none;
    cursor: ew-resize;
    outline: none;
    z-index: 1;
  }
  .mark::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 6px;
    margin-left: -3px;
    border-radius: 3px;
    background: var(--acc);
  }
  .mark:focus-visible::after {
    box-shadow: 0 0 0 2px var(--fg);
  }
  .head {
    position: absolute;
    top: -7px;
    bottom: -7px;
    width: 3px;
    margin-left: -1.5px;
    border-radius: 2px;
    background: var(--danger);
    pointer-events: none;
    z-index: 2;
  }
  .times {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  [data-testid='range-text'] {
    color: var(--fg);
    font-weight: 550;
    text-align: center;
  }
</style>
