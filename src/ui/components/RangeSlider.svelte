<script lang="ts">
  let {
    min,
    max,
    start = $bindable(),
    end = $bindable(),
    thumbs = [],
  }: { min: number; max: number; start: number; end: number; thumbs?: ImageBitmap[] } = $props();

  let track: HTMLDivElement | undefined = $state();
  let canvases: HTMLCanvasElement[] = $state([]);

  const span = $derived(Math.max(1, max - min));
  const pct = (v: number) => ((v - min) / span) * 100;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  function setStart(v: number) {
    if (Number.isFinite(v)) start = clamp(Math.round(v), min, end);
  }
  function setEnd(v: number) {
    if (Number.isFinite(v)) end = clamp(Math.round(v), start, max);
  }

  function valueAt(clientX: number): number {
    const r = track!.getBoundingClientRect();
    return min + clamp((clientX - r.left) / Math.max(1, r.width), 0, 1) * (max - min);
  }
  function drag(e: PointerEvent, which: 'start' | 'end') {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    // Liegen beide Griffe uebereinander, entscheidet die Zugrichtung: links = Start, rechts = Ende.
    let target: 'start' | 'end' | null = start === end ? null : which;
    const move = (ev: PointerEvent) => {
      const v = valueAt(ev.clientX);
      if (target === null) {
        if (Math.round(v) === start) return;
        target = v < start ? 'start' : 'end';
      }
      if (target === 'start') setStart(v);
      else setEnd(v);
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
  function key(e: KeyboardEvent, which: 'start' | 'end') {
    const cur = which === 'start' ? start : end;
    let next: number;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + 1;
    else if (e.key === 'Home') next = which === 'start' ? min : start;
    else if (e.key === 'End') next = which === 'start' ? end : max;
    else return;
    e.preventDefault();
    if (which === 'start') setStart(next);
    else setEnd(next);
  }

  $effect(() => {
    thumbs.forEach((b, i) => {
      const c = canvases[i];
      if (!c) return;
      c.width = b.width;
      c.height = b.height;
      c.getContext('2d')?.drawImage(b, 0, 0);
    });
  });
</script>

<div class="range">
  <div class="track" bind:this={track}>
    <div class="strip">
      {#each thumbs as _, i (i)}
        <canvas bind:this={canvases[i]}></canvas>
      {/each}
    </div>
    <div class="dim" style="left:0;width:{pct(start)}%"></div>
    <div class="dim" style="right:0;width:{100 - pct(end)}%"></div>
    <div
      class="handle"
      role="slider"
      tabindex="0"
      aria-label="Anfangsgriff"
      aria-valuemin={min}
      aria-valuemax={end}
      aria-valuenow={start}
      style="left:{pct(start)}%"
      onpointerdown={(e) => drag(e, 'start')}
      onkeydown={(e) => key(e, 'start')}
    ></div>
    <div
      class="handle"
      role="slider"
      tabindex="0"
      aria-label="Schlussgriff"
      aria-valuemin={start}
      aria-valuemax={max}
      aria-valuenow={end}
      style="left:{pct(end)}%"
      onpointerdown={(e) => drag(e, 'end')}
      onkeydown={(e) => key(e, 'end')}
    ></div>
  </div>
  <div class="fields">
    <label>Start
      <input type="number" inputmode="numeric" {min} {max} value={start}
        oninput={(e) => setStart(e.currentTarget.valueAsNumber)}
        onchange={(e) => (e.currentTarget.value = String(start))} />
    </label>
    <label>Ende
      <input type="number" inputmode="numeric" {min} {max} value={end}
        oninput={(e) => setEnd(e.currentTarget.valueAsNumber)}
        onchange={(e) => (e.currentTarget.value = String(end))} />
    </label>
  </div>
</div>

<style>
  .range { display: flex; flex-direction: column; gap: 8px; }
  .track { position: relative; margin: 0 22px; height: 64px; touch-action: none; }
  .strip { display: flex; height: 100%; overflow: hidden; background: #ddd; border-radius: 4px; }
  .strip canvas { flex: 1; min-width: 0; height: 100%; object-fit: cover; }
  .dim { position: absolute; top: 0; bottom: 0; background: rgba(255, 255, 255, 0.7); pointer-events: none; }
  .handle {
    position: absolute; top: 0; height: 100%; width: 44px; margin-left: -22px;
    touch-action: none; cursor: ew-resize; background: transparent;
  }
  .handle::after {
    content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 6px; margin-left: -3px;
    background: #1b5fd1; border-radius: 3px;
  }
  .handle:focus-visible { outline: none; }
  .handle:focus-visible::after { outline: 2px solid #000; }
  .fields { display: flex; gap: 16px; }
  label { display: flex; align-items: center; gap: 8px; }
  input { min-height: 44px; width: 6rem; font-size: 1rem; box-sizing: border-box; }
</style>
