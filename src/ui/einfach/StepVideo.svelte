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

  let { project, onpick }: { project: Project; onpick: (kind: 'camera' | 'file') => void } = $props();

  const info = $derived(project.info);
  let currentTimeS = $state(0);
  let playing = $state(false);

  // neues Video: Wiedergabe zuruecksetzen
  let lastInfo: VideoInfo | null = null;
  $effect.pre(() => {
    const i = project.info;
    if (i === lastInfo) return;
    lastInfo = i;
    untrack(() => {
      currentTimeS = 0;
      playing = false;
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
        <button type="button" class="tile" data-testid="set-start" onclick={() => setStartAt(currentIndex(info))}>⏮ Anfang hier</button>
        <button type="button" class="tile" onclick={() => (playing = !playing)}>{playing ? '⏸ Pause' : '▶ Abspielen'}</button>
        <button type="button" class="tile" data-testid="set-end" onclick={() => setEndAt(currentIndex(info))}>Ende hier ⏭</button>
      </div>
      {#if !info.fpsCertain}
        <Notice>
          {#if project.captureFpsOverride === null}<p class="fpsnote">{FPS_UNCERTAIN_TEXT}</p>{/if}
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
        </Notice>
      {/if}
      {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
    </div>
  </div>
{:else}
  <div class="pick">
    <button type="button" class="tile big" data-testid="einfach-pick-camera" onclick={() => onpick('camera')}>
      <strong>Video aufnehmen</strong>
      <span class="muted">mit der Kamera</span>
    </button>
    <button type="button" class="tile big" data-testid="einfach-pick-file" onclick={() => onpick('file')}>
      <strong>Video wählen</strong>
      <span class="muted">aus Fotos oder Dateien</span>
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
