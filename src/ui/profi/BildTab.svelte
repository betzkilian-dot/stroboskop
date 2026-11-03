<script lang="ts">
  import { isUniform, selectFrameIndices } from '../../lib/frames';
  import type { ComposeMode } from '../../lib/compose/compositor';
  import type { Project } from '../../lib/state/project.svelte';
  import Viewer from '../components/Viewer.svelte';
  import RegionEditor from '../components/RegionEditor.svelte';
  import CropEditor from '../components/CropEditor.svelte';
  import PositionStrip from '../components/PositionStrip.svelte';
  import Notice from '../components/Notice.svelte';
  import IntervalControl from './IntervalControl.svelte';
  import ThresholdControl from './ThresholdControl.svelte';

  let { project }: { project: Project } = $props();

  const modes: { id: ComposeMode; label: string }[] = [
    { id: 'difference', label: 'Differenz' },
    { id: 'lighten', label: 'Aufhellen' },
    { id: 'darken', label: 'Abdunkeln' },
    { id: 'average', label: 'Transparent' },
  ];

  let editMode = $state<'none' | 'region' | 'crop'>('none');
  let picking = $state(false);

  const bg = $derived(project.compose.background);
  const bgValue = $derived(typeof bg === 'object' ? 'frame' : bg);
  const bgFrame = $derived(typeof bg === 'object' ? bg.frameIndex : null);
  const maskShown = $derived(project.showMask && project.preview?.maskOverlay != null);
  const uniform = $derived(isUniform(selectFrameIndices(project.selection)));

  function changed() {
    project.requestPreview();
  }
  function setMode(m: ComposeMode) {
    project.compose.mode = m;
    changed();
  }
  function setFeather(e: Event & { currentTarget: HTMLInputElement }) {
    project.compose.featherPx = e.currentTarget.valueAsNumber;
    changed();
  }
  function setFade(e: Event & { currentTarget: HTMLInputElement }) {
    project.compose.fade = e.currentTarget.valueAsNumber / 100;
    changed();
  }
  function setLatest(e: Event & { currentTarget: HTMLInputElement }) {
    project.compose.latestOnTop = e.currentTarget.checked;
    changed();
  }
  function setBackground(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = e.currentTarget.value;
    if (v === 'frame') return;
    picking = false;
    project.compose.background = v as 'median' | 'first' | 'last';
    changed();
  }
  function tapPosition(frame: number) {
    if (picking) {
      project.compose.background = { frameIndex: frame };
      picking = false;
    } else {
      const ex = project.selection.excluded;
      // positionIndices ignoriert excluded: keine neuen Miniaturen noetig
      project.selection.excluded = ex.includes(frame) ? ex.filter((f) => f !== frame) : [...ex, frame];
    }
    changed();
  }
  function toggleEdit(m: 'region' | 'crop') {
    editMode = editMode === m ? 'none' : m;
  }
  function rotate() {
    project.rotation = ((project.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { picking = false; editMode = 'none'; } }} />

{#if project.info}
  <div class="bild">
    <div class="stage">
      <Viewer
        image={project.preview?.image ?? null}
        overlay={project.preview?.maskOverlay ?? null}
        crop={editMode === 'crop' ? null : project.crop}
        rotation={project.rotation}
        videoWidth={project.info.width}
        videoHeight={project.info.height}
      >
        {#snippet tools(geo)}
          <RegionEditor
            {geo}
            active={editMode === 'region'}
            region={project.compose.region}
            oncommit={(poly) => {
              project.compose.region = poly;
              editMode = 'none';
              changed();
            }}
          />
          <CropEditor
            {geo}
            active={editMode === 'crop'}
            current={project.crop}
            oncommit={(c) => {
              if (c) project.crop = c;
              editMode = 'none';
            }}
          />
        {/snippet}
      </Viewer>
      {#if maskShown}<span class="badge" data-testid="mask-overlay">Maske</span>{/if}
      {#if editMode === 'region'}
        <span class="hint">Antippen setzt Punkte, Doppeltipp schließt den Bereich.</span>
      {:else if editMode === 'crop'}
        <span class="hint">Rahmen aufziehen.</span>
      {/if}
      {#if project.rendering}
        <progress class="bar" max="1" value={project.progress}></progress>
      {/if}
    </div>

    <div class="side">
      <PositionStrip
        indices={project.positionIndices}
        thumbs={project.positionThumbs}
        thumbsKey={project.positionThumbsKey}
        current={bgFrame}
        excluded={project.selection.excluded}
        {picking}
        ontap={tapPosition}
      />
      {#if picking}<Notice>Bild in der Positionsleiste antippen.</Notice>{/if}

      <div class="controls">
        {#if project.preview?.cameraMoved}
          <Notice kind="error">Kamera hat sich bewegt – Ergebnis unscharf.</Notice>
        {/if}
        {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
        {#if !uniform}<Notice kind="error">Δt nicht mehr gleichmäßig</Notice>{/if}

        <IntervalControl {project} />

        <div class="modes" role="radiogroup" aria-label="Modus">
          {#each modes as m (m.id)}
            <label class="seg" class:on={project.compose.mode === m.id}>
              <input
                type="radio"
                name="modus"
                value={m.id}
                checked={project.compose.mode === m.id}
                onchange={() => setMode(m.id)}
              />{m.label}
            </label>
          {/each}
        </div>

        <ThresholdControl {project} />

        <label class="row"
          >Weiche Kante
          <input type="range" min="0" max="10" step="1" value={project.compose.featherPx} oninput={setFeather} />
          <output>{project.compose.featherPx} px</output>
        </label>

        <label class="row"
          >Hintergrund
          <select value={bgValue} onchange={setBackground}>
            <option value="median">Median</option>
            <option value="first">Erstes Bild</option>
            <option value="last">Letztes Bild</option>
            {#if bgFrame !== null}<option value="frame">Gewähltes Bild ({bgFrame})</option>{/if}
          </select>
        </label>
        <div class="row">
          <button type="button" aria-pressed={picking} onclick={() => (picking = !picking)}>
            {picking ? 'Auswahl abbrechen' : 'Bild wählen…'}
          </button>
        </div>

        <label class="row"
          >Verlauf
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(project.compose.fade * 100)}
            oninput={setFade}
          />
          <output>{Math.round(project.compose.fade * 100)} %</output>
        </label>

        <label class="row check"
          ><input type="checkbox" checked={project.compose.latestOnTop} onchange={setLatest} />Spätere oben</label
        >

        <div class="buttons">
          <button type="button" aria-pressed={editMode === 'region'} onclick={() => toggleEdit('region')}>
            {editMode === 'region' ? 'Zeichnen abbrechen' : 'Bereich zeichnen'}
          </button>
          <button
            type="button"
            disabled={!project.compose.region && editMode !== 'region'}
            onclick={() => {
              project.compose.region = null;
              if (editMode === 'region') editMode = 'none';
              changed();
            }}>Bereich löschen</button
          >
          <button type="button" onclick={rotate}>Drehen</button>
          <button type="button" aria-pressed={editMode === 'crop'} onclick={() => toggleEdit('crop')}
            >Zuschneiden</button
          >
          <button type="button" disabled={!project.crop} onclick={() => (project.crop = null)}
            >Zuschnitt zurücksetzen</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .bild {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .stage {
    position: relative;
    flex: 1 1 45%;
    min-height: 220px;
  }
  .side {
    flex: 1 1 55%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  @media (orientation: landscape) {
    .bild {
      flex-direction: row;
    }
    .stage {
      flex: 1 1 55%;
      min-height: 0;
    }
    .side {
      flex: 0 0 min(420px, 45%);
    }
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .badge,
  .hint {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 4px 10px;
    border-radius: 6px;
    pointer-events: none;
  }
  .hint {
    top: auto;
    bottom: 12px;
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 6px;
  }
  .modes {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .seg {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid #1b5fd1;
    border-radius: 8px;
  }
  .seg.on {
    background: #1b5fd1;
    color: #fff;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  .row input[type='range'] {
    flex: 1;
    min-height: 44px;
  }
  .row select {
    flex: 1;
    min-height: 44px;
    font-size: 1rem;
  }
  .row button {
    min-height: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
  .row.check input {
    width: 24px;
    height: 24px;
  }
  .row output {
    min-width: 3.5rem;
    text-align: right;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .buttons button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
  .buttons button[aria-pressed='true'] {
    background: #1b5fd1;
    color: #fff;
  }
</style>
