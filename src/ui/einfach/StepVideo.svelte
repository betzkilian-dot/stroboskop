<script lang="ts">
  import { untrack } from 'svelte';
  import {
    displayedFrameIndex,
    dragEndIndex,
    dragStartIndex,
    frameSeekOffsetS,
    frameTimeS,
    setRangeEnd,
    setRangeStart,
  } from '../../lib/frames';
  import { formatFps } from '../../lib/format';
  import { commitFpsInput } from '../../lib/fpsInput';
  import { FPS_UNCERTAIN_TEXT, type Project } from '../../lib/state/project.svelte';
  import type { VideoInfo } from '../../lib/types';
  import Notice from '../components/Notice.svelte';
  import VideoPlayer from '../components/VideoPlayer.svelte';
  import Timeline from '../components/Timeline.svelte';

  let { project, onpick }: { project: Project; onpick: () => void } = $props();

  const info = $derived(project.info);
  let currentTimeS = $state(0);
  let playing = $state(false);
  let fpsOpen = $state(false);
  const FPS_CHOICES = [30, 60, 120, 240] as const;

  // neues Video: Wiedergabe zuruecksetzen
  let lastInfo: VideoInfo | null = null;
  $effect.pre(() => {
    const i = project.info;
    if (i === lastInfo) return;
    lastInfo = i;
    untrack(() => {
      currentTimeS = 0;
      playing = false;
      // unsichere Bildrate: Auswahl gleich offen und offen lassen, damit der Wert korrigierbar bleibt
      fpsOpen = i !== null && !i.fpsCertain;
    });
  });

  const lastIndex = $derived(info ? Math.max(0, info.frameCount - 1) : 0);
  const startS = $derived(info ? frameTimeS(info, project.selection.startIndex) : 0);
  const endS = $derived(info ? frameTimeS(info, project.selection.endIndex) : 0);
  const currentIndex = (i: VideoInfo) => displayedFrameIndex(i, currentTimeS);

  function seek(t: number) {
    if (!info) return;
    currentTimeS = frameTimeS(info, displayedFrameIndex(info, Math.min(frameTimeS(info, lastIndex), Math.max(0, t))));
  }
  /** ein Bild vor/zurueck (haelt die Wiedergabe an) */
  function stepFrame(d: number) {
    if (!info) return;
    playing = false;
    currentTimeS = frameTimeS(info, Math.min(lastIndex, Math.max(0, currentIndex(info) + d)));
  }
  function chooseFps(v: number) {
    project.captureFpsOverride = info && v === info.captureFps ? null : v;
    project.requestPreview();
  }
  function setStartAt(index: number) {
    if (!info) return;
    project.setSelection(setRangeStart(project.selection, index, info.frameCount));
  }
  function setEndAt(index: number) {
    if (!info) return;
    project.setSelection(setRangeEnd(project.selection, index, info.frameCount));
  }
  function dragStart(t: number) {
    if (!info) return;
    playing = false;
    setStartAt(dragStartIndex(info, t, project.selection.endIndex));
    currentTimeS = frameTimeS(info, project.selection.startIndex);
  }
  function dragEnd(t: number) {
    if (!info) return;
    playing = false;
    setEndAt(dragEndIndex(info, t, project.selection.startIndex));
    currentTimeS = frameTimeS(info, project.selection.endIndex);
  }
  function commitFps(e: Event & { currentTarget: HTMLInputElement }) {
    commitFpsInput(project, e.currentTarget);
  }
  function enter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
  }
</script>

{#if info}
  <div class="step">
    <div class="stage">
      {#if project.videoUrl}
        <VideoPlayer
          src={project.videoUrl}
          rotation={project.rotation}
          crop={project.crop}
          mediaDurationS={info.durationS}
          bind:currentTimeS
          bind:playing
          rate={1}
          seekOffsetS={frameSeekOffsetS(info.nominalFps)}
        />
      {/if}
    </div>
    <div class="controls">
      <p class="ask">Wo beginnt und endet die Bewegung?</p>
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
      <div class="tiles">
        <button type="button" class="tile" data-testid="frame-back" aria-label="1 Bild zurück" onclick={() => stepFrame(-1)}>◀ 1 Bild</button>
        <button type="button" class="tile" onclick={() => (playing = !playing)}>{playing ? '⏸ Pause' : '▶ Abspielen'}</button>
        <button type="button" class="tile" data-testid="frame-forward" aria-label="1 Bild vor" onclick={() => stepFrame(1)}>1 Bild ▶</button>
      </div>
      <div class="tiles">
        <button type="button" class="tile" data-testid="set-start" onclick={() => setStartAt(currentIndex(info))}>⏮ Anfang hier</button>
        <button type="button" class="tile" data-testid="set-end" onclick={() => setEndAt(currentIndex(info))}>Ende hier ⏭</button>
      </div>
      <div class="fpsline">
        <span data-testid="einfach-fps">
          {#if info.slowMotion && project.captureFpsOverride === null}Zeitlupe erkannt: {/if}Aufnahme: {formatFps(project.captureFps)} Bilder/s
        </span>
        <button type="button" class="link" data-testid="fps-change" aria-expanded={fpsOpen} onclick={() => (fpsOpen = !fpsOpen)}
          >{fpsOpen ? 'Fertig' : 'Zeitlupe? ändern'}</button
        >
      </div>
      {#if fpsOpen}
        <Notice>
          {#if !info.fpsCertain && project.captureFpsOverride === null}<p class="fpsnote">{FPS_UNCERTAIN_TEXT}</p>{/if}
          <p class="fpsnote">Mit wie vielen Bildern pro Sekunde wurde gefilmt? Zeitlupe aus der Fotomediathek kommt oft als 30 Bilder/s an – dann die echte Rate wählen (meist 120 oder 240).</p>
          <div class="chips" role="radiogroup" aria-label="Aufnahme-Bildrate">
            {#each FPS_CHOICES as v (v)}
              <button type="button" role="radio" class="chip" class:on={project.captureFps === v} aria-checked={project.captureFps === v} onclick={() => chooseFps(v)}>{v}</button>
            {/each}
          </div>
          <label>
            Aufnahme-fps
            <input
              type="text"
              inputmode="decimal"
              placeholder={formatFps(info.captureFps)}
              value={project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride)}
              onchange={commitFps}
              onkeydown={enter}
            />
          </label>
          {#if project.captureFpsOverride !== null}
            <button type="button" class="link" onclick={() => chooseFps(info.captureFps)}>Zurück auf erkannte {formatFps(info.captureFps)} Bilder/s</button>
          {/if}
        </Notice>
      {/if}
      {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
    </div>
  </div>
{:else}
  <div class="pick">
    <button type="button" class="tile big" data-testid="einfach-pick-file" onclick={() => onpick()}>
      <strong>Video</strong>
      <span class="muted">aufnehmen oder aus Fotos/Dateien wählen</span>
    </button>
  </div>
{/if}

<style>
  .step {
    flex: 1;
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
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  @media (orientation: landscape) and (min-width: 700px) {
    .step {
      flex-direction: row;
    }
    .stage {
      flex: 1.6;
    }
    .controls {
      flex: 1;
      justify-content: center;
      overflow-y: auto;
    }
  }
  .ask {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 650;
  }
  .tiles {
    display: flex;
    gap: 8px;
  }
  .tile {
    flex: 1;
    min-height: 52px;
    padding: 8px 10px;
    font: inherit;
    font-size: 1rem;
    font-weight: 650;
    color: var(--fg);
    background: var(--card);
    border: 1px solid var(--sep);
    border-radius: 12px;
  }
  .pick {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .tile.big {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 260px;
    min-height: 140px;
    border-radius: 16px;
    font-size: 1.1rem;
  }
  .tile.big span {
    font-weight: 400;
    font-size: 0.95rem;
  }
  .fpsnote {
    margin: 0 0 8px;
  }
  .fpsline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
  .link {
    min-height: 44px;
    padding: 0 4px;
    font: inherit;
    font-weight: 600;
    color: var(--acc);
    background: none;
    border: none;
  }
  .chips {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .chip {
    flex: 1;
    min-height: 44px;
    font: inherit;
    font-weight: 650;
    color: var(--fg);
    background: var(--card);
    border: 2px solid var(--sep);
    border-radius: 10px;
  }
  .chip.on {
    background: var(--acc-soft);
    border-color: var(--acc);
    color: var(--acc);
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
    font-size: 1rem;
    color: var(--fg);
    background: var(--fill);
    border: 1px solid var(--sep);
    border-radius: 10px;
    padding: 0 10px;
    box-sizing: border-box;
  }
</style>
