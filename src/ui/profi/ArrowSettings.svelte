<script lang="ts">
  import { untrack } from 'svelte';
  import { formatNumber, parseLength } from '../../lib/format';
  import { seriesFor } from '../../lib/measure/model';
  import { autoArrowScale, maxAccelPx, maxSpeedPx, type ArrowPos } from '../../lib/physics/kinematics';
  import type { Project } from '../../lib/state/project.svelte';
  import Segmented from '../components/Segmented.svelte';

  let { project, kind }: { project: Project; kind: 'v' | 'a' } = $props();

  const positions = [
    { id: 'start', label: 'Anfang' },
    { id: 'mid', label: 'Mitte' },
    { id: 'end', label: 'Ende' },
  ];
  const isV = $derived(kind === 'v');
  const arrows = $derived(project.measure.arrows);
  const user = $derived(isV ? arrows.vScale : arrows.aScale);
  const pos = $derived(isV ? arrows.vPos : arrows.aPos);

  const cm = (s: number) => formatNumber(s * 100, 1).replace(/,0$/, '');
  let text = $state('');
  {
    const u = untrack(() => (kind === 'v' ? project.measure.arrows.vScale : project.measure.arrows.aScale));
    if (u !== null) text = cm(u);
  }

  /** Automatischer Wert in cm (wie in buildScene), als Platzhalter */
  const autoCm = $derived.by(() => {
    const info = project.info;
    if (!info) return null;
    const long = project.crop ? Math.max(project.crop.w, project.crop.h) : Math.max(info.width, info.height);
    const series = project.measure.objects.map((o) => seriesFor(o, project.measureIndices, project.captureFps));
    const rate = Math.max(0, ...series.map(isV ? maxSpeedPx : maxAccelPx));
    const s = autoArrowScale(rate, long);
    return s > 0 ? cm(s) : null;
  });

  function setPos(id: string) {
    if (isV) project.measure.arrows.vPos = id as ArrowPos;
    else project.measure.arrows.aPos = id as ArrowPos;
  }
  function setScale(v: number | null) {
    if (isV) project.measure.arrows.vScale = v;
    else project.measure.arrows.aScale = v;
  }
  function input(e: Event & { currentTarget: HTMLInputElement }) {
    text = e.currentTarget.value;
    const v = parseLength(text);
    setScale(v > 0 ? v / 100 : null);
  }
  function auto() {
    text = '';
    setScale(null);
  }
</script>

<div class="set">
  <span class="lbl">{isV ? 'v' : 'a'}: Position im Intervall</span>
  <Segmented label={`Position ${isV ? 'v' : 'a'}-Pfeil`} options={positions} value={pos} onchange={setPos} />
  <div class="scale">
    <label>
      {isV ? '1 m/s' : '1 m/s²'} ≙
      <input
        data-testid={isV ? 'v-scale' : 'a-scale'}
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder={autoCm ?? ''}
        value={text}
        oninput={input}
      />
      cm
    </label>
    <button type="button" aria-pressed={user === null} class:on={user === null} onclick={auto}>Auto</button>
  </div>
</div>

<style>
  .set {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
  .lbl {
    color: var(--muted);
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .scale label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  input {
    width: 72px;
    min-height: 44px;
    font-size: 1rem;
    padding: 0 8px;
    box-sizing: border-box;
    text-align: right;
  }
  button {
    min-height: 44px;
    min-width: 64px;
    border: 2px solid transparent;
  }
  button.on {
    background: var(--acc-soft);
    border-color: var(--acc);
    color: var(--acc);
  }
</style>
