<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import {
    deltaT,
    displayedFrameIndex,
    frameSeekOffsetS,
    frameTimeS,
    nearestFrameIndex,
    setRangeEnd,
    setRangeStart,
  } from '../../lib/frames';
  import { formatDt, formatFps, formatNumber, parseFps } from '../../lib/format';
  import { FPS_UNCERTAIN_TEXT, type CropRect, type Project } from '../../lib/state/project.svelte';
  import type { VideoInfo } from '../../lib/types';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Notice from '../components/Notice.svelte';
  import VideoPlayer from '../components/VideoPlayer.svelte';
  import Timeline from '../components/Timeline.svelte';
  import Viewer from '../components/Viewer.svelte';
  import CropEditor from '../components/CropEditor.svelte';

  let { project, ontab }: { project: Project; ontab: (phase: string) => void } = $props();

  const info = $derived(project.info);
  const RATES = [1, 0.5, 0.25] as const;
  const RATE_TEXT: Record<number, string> = { 1: '1×', 0.5: '½×', 0.25: '¼×' };

  let currentTimeS = $state(0);
  let playing = $state(false);
  let rate = $state<number>(1);
  let fpsOpen = $state(false);
  /** Zuschnitt: Standbild des aktuellen Videobilds (null = Player sichtbar) */
  let cropImage = $state.raw<ImageBitmap | null>(null);
  let cropLoading = $state(false);
  /** Rahmen im Bearbeiten (Video-Pixel) */
  let cropDraft = $state<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  let cropSeq = 0;

  // neues Video: Wiedergabe zuruecksetzen
  let lastInfo: VideoInfo | null = null;
  $effect.pre(() => {
    const i = project.info;
    if (i === lastInfo) return;
    lastInfo = i;
    currentTimeS = 0;
    playing = false;
    fpsOpen = false;
    untrack(closeCrop);
  });
  onDestroy(() => closeCrop());

  const lastIndex = $derived(info ? Math.max(0, info.frameCount - 1) : 0);
  const startS = $derived(info ? frameTimeS(info, project.selection.startIndex) : 0);
  const endS = $derived(info ? frameTimeS(info, project.selection.endIndex) : 0);
  /** R-F1: das gerade angezeigte Videobild (letzter Zeitstempel <= Wiedergabezeit) */
  const currentIndex = (i: VideoInfo) => displayedFrameIndex(i, currentTimeS);

  // Spulen springt auf den Zeitstempel des Bildes, das an dieser Stelle angezeigt wird
  function seek(t: number) {
    if (!info) return;
    currentTimeS = frameTimeS(info, displayedFrameIndex(info, Math.min(frameTimeS(info, lastIndex), Math.max(0, t))));
  }
  function setStartAt(index: number) {
    if (!info) return;
    project.setSelection(setRangeStart(project.selection, index, info.frameCount));
  }
  function setEndAt(index: number) {
    if (!info) return;
    project.setSelection(setRangeEnd(project.selection, index, info.frameCount));
  }
  // Ziehen einer Markierung: wie "Anfang/Ende hier", aber nicht ueber die andere Markierung hinaus
  function dragStart(t: number) {
    if (!info) return;
    const i = Math.min(nearestFrameIndex(info, t), project.selection.endIndex - 1);
    playing = false;
    setStartAt(i);
    currentTimeS = frameTimeS(info, project.selection.startIndex);
  }
  function dragEnd(t: number) {
    if (!info) return;
    const i = Math.max(nearestFrameIndex(info, t), project.selection.startIndex + 1);
    playing = false;
    setEndAt(i);
    currentTimeS = frameTimeS(info, project.selection.endIndex);
  }
  function step(d: number) {
    if (!info) return;
    playing = false;
    const i = Math.min(lastIndex, Math.max(0, currentIndex(info) + d));
    currentTimeS = frameTimeS(info, i);
  }
  function nextRate() {
    rate = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length];
  }
  function rotate() {
    project.rotation = ((project.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  }

  async function startCrop() {
    if (!info || cropLoading) return;
    playing = false;
    const seq = ++cropSeq;
    cropLoading = true;
    try {
      const img = await project.frameImage(currentIndex(info));
      if (seq !== cropSeq) {
        img?.close();
        return;
      }
      cropDraft = project.crop ? { ...project.crop } : fullRect();
      cropImage = img;
    } catch (e) {
      console.warn('Standbild für den Zuschnitt konnte nicht geladen werden', e);
    } finally {
      if (seq === cropSeq) cropLoading = false;
    }
  }
  const fullRect = (): CropRect => ({ x: 0, y: 0, w: info?.width ?? 1, h: info?.height ?? 1 });
  function finishCrop() {
    const f = fullRect();
    const c = cropDraft;
    project.crop = c.x === 0 && c.y === 0 && c.w === f.w && c.h === f.h ? null : { ...c };
    closeCrop();
  }
  function closeCrop() {
    cropSeq++;
    cropLoading = false;
    cropImage?.close();
    cropImage = null;
  }

  // Textfeld: erst bei change/Enter uebernehmen; ungueltig -> bisheriger Wert bleibt
  function commitFps(e: Event & { currentTarget: HTMLInputElement }) {
    const el = e.currentTarget;
    const text = el.value.trim();
    if (text === '') {
      project.captureFpsOverride = null;
    } else {
      const v = parseFps(text);
      if (v !== null) project.captureFpsOverride = v;
    }
    el.value = project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride);
    project.requestPreview();
  }
  function enter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && (cropImage || cropLoading)) closeCrop(); }} />

{#if info}
  <div class="work">
    <div class="left">
      <div class="stage">
        {#if cropImage}
          <Viewer
            image={cropImage}
            crop={null}
            rotation={project.rotation}
            videoWidth={info.width}
            videoHeight={info.height}
          >
            {#snippet tools(geo)}
              <CropEditor {geo} bind:crop={cropDraft} />
            {/snippet}
          </Viewer>
          <span class="hint">Rahmen an den Griffen anpassen.</span>
        {:else if project.videoUrl}
          <VideoPlayer
            src={project.videoUrl}
            rotation={project.rotation}
            crop={project.crop}
            mediaDurationS={info.durationS}
            bind:currentTimeS
            bind:playing
            {rate}
            seekOffsetS={frameSeekOffsetS(info.nominalFps)}
          />
        {/if}
      </div>
      <Timeline
        thumbs={project.thumbs}
        durationS={info.durationS}
        {currentTimeS}
        {startS}
        {endS}
        stepS={1 / info.nominalFps}
        onseek={seek}
        onstart={dragStart}
        onend={dragEnd}
      />
    </div>

    <div class="col">
      <Card title="Video">
        <div class="chips">
          {#if info.fpsCertain || project.captureFpsOverride !== null}
            <button
              type="button"
              class="chip-btn"
              data-testid="fps-chip"
              aria-expanded={fpsOpen}
              onclick={() => (fpsOpen = !fpsOpen)}
            >
              <span class="chip" class:ok={info.fpsCertain && project.captureFpsOverride === null}
                >{formatFps(project.captureFps)} Bilder/s{#if info.fpsCertain && project.captureFpsOverride === null}<Icon
                    name="check"
                    size={13}
                  />{/if}</span
              >
            </button>
          {:else}
            <button
              type="button"
              class="chip-btn"
              data-testid="fps-chip"
              aria-expanded={fpsOpen}
              onclick={() => (fpsOpen = !fpsOpen)}
            >
              <span class="chip warn"><Icon name="warning" size={13} />Bildrate prüfen</span>
            </button>
          {/if}
          <span class="chip">{info.width} × {info.height}</span>
          <span class="chip">{formatNumber(info.durationS, 1)} s</span>
          {#if info.slowMotion}<span class="chip">Zeitlupe</span>{/if}
        </div>
        {#if fpsOpen}
          <div class="fps">
            {#if !info.fpsCertain}<p class="muted">{FPS_UNCERTAIN_TEXT}</p>{/if}
            <label
              >Aufnahme-fps
              <input
                type="text"
                inputmode="decimal"
                placeholder={formatFps(info.captureFps)}
                value={project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride)}
                onchange={commitFps}
                onkeydown={enter}
              />
            </label>
          </div>
        {/if}
      </Card>

      <Card title="Bereich festlegen">
        <div class="big">
          <button type="button" class="btn" data-testid="set-start" onclick={() => setStartAt(currentIndex(info))}
            >Anfang hier</button
          >
          <button type="button" class="btn" data-testid="set-end" onclick={() => setEndAt(currentIndex(info))}
            >Ende hier</button
          >
        </div>
        <div class="transport">
          <button type="button" class="btn" aria-label="Bild zurück" disabled={cropImage !== null} onclick={() => step(-1)}
            ><Icon name="step-back" size={18} /></button
          >
          <button
            type="button"
            class="btn"
            aria-label={playing ? 'Pause' : 'Abspielen'}
            disabled={cropImage !== null}
            onclick={() => (playing = !playing)}><Icon name={playing ? 'pause' : 'play'} size={18} /></button
          >
          <button type="button" class="btn" aria-label="Bild vor" disabled={cropImage !== null} onclick={() => step(1)}
            ><Icon name="step-forward" size={18} /></button
          >
          <button type="button" class="btn rate" aria-label="Tempo {RATE_TEXT[rate]}" onclick={nextRate}
            >{RATE_TEXT[rate]}</button
          >
        </div>
        <p class="readout">
          <span data-testid="positions">{project.positionsCount} Positionen</span>
          <span class="muted">Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}</span>
        </p>
        {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
      </Card>

      <Card title="Ausrichtung">
        <div class="buttons">
          <button type="button" class="btn" onclick={rotate}><Icon name="rotate" size={16} />Drehen</button>
          {#if cropImage}
            <button type="button" class="btn" onclick={() => (cropDraft = fullRect())}>Zurücksetzen</button>
            <button type="button" class="btn" onclick={closeCrop}><Icon name="close" size={16} />Abbrechen</button>
            <button type="button" class="btn primary" onclick={finishCrop}>Fertig</button>
          {:else}
            <button type="button" class="btn" disabled={cropLoading} onclick={startCrop}
              ><Icon name="crop" size={16} />Zuschneiden</button
            >
            <button type="button" class="btn" disabled={!project.crop} onclick={() => (project.crop = null)}
              >Zuschnitt zurücksetzen</button
            >
          {/if}
        </div>
      </Card>

      <button type="button" class="btn primary next" onclick={() => ontab('bild')}>Weiter zu Bild ›</button>
    </div>
  </div>
{/if}

<style>
  .left {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 200px;
    background: var(--stage);
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 899px) {
    .stage {
      flex: none;
      height: 50dvh;
    }
  }
  .hint {
    position: absolute;
    left: 8px;
    bottom: 12px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 4px 10px;
    border-radius: 6px;
    pointer-events: none;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip {
    gap: 4px;
  }
  .chip-btn {
    background: none;
    padding: 0;
    min-height: 44px;
    min-width: 44px;
    border-radius: 20px;
  }
  .fps {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .fps p {
    margin: 0;
    font-size: 13px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  input {
    min-height: 44px;
    width: 7rem;
    font: inherit;
    color: var(--fg);
    background: var(--fill);
    border: 1px solid var(--sep);
    border-radius: 10px;
    padding: 0 10px;
    box-sizing: border-box;
  }
  .big {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .big .btn {
    min-height: 52px;
  }
  .transport {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
  }
  .transport .btn {
    min-width: 44px;
    padding: 0 10px;
  }
  .rate {
    min-width: 52px;
    font-variant-numeric: tabular-nums;
  }
  .readout {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 10px 0 0;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .readout + :global(*) {
    margin-top: 8px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .next {
    min-height: 48px;
  }
</style>
