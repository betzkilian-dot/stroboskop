<script lang="ts">
  import { isUniform, selectFrameIndices } from '../../lib/frames';
  import { isMaskedMode, type ComposeMode } from '../../lib/compose/compositor';
  import { BUSY_TEXT, STAGE_TEXT, type Project } from '../../lib/state/project.svelte';
  import Viewer from '../components/Viewer.svelte';
  import RegionEditor from '../components/RegionEditor.svelte';
  import CropEditor from '../components/CropEditor.svelte';
  import Filmstrip from '../components/Filmstrip.svelte';
  import Notice from '../components/Notice.svelte';
  import BusyOverlay from '../components/BusyOverlay.svelte';
  import IntervalControl from './IntervalControl.svelte';
  import Card from '../components/Card.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Switch from '../components/Switch.svelte';
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
  function setLatest(v: boolean) {
    project.compose.latestOnTop = v;
    changed();
  }
  const bgOptions = [
    { id: 'median', label: 'Automatisch' },
    { id: 'first', label: 'Erstes' },
    { id: 'last', label: 'Letztes' },
    { id: 'frame', label: 'Gewählt' },
  ];
  function setBackground(id: string) {
    if (id === 'frame') {
      picking = true;
      return;
    }
    picking = false;
    project.compose.background = id as 'median' | 'first' | 'last';
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
  <div class="work">
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
      <BusyOverlay
        active={project.rendering || project.exporting}
        title={project.exporting ? BUSY_TEXT.export : BUSY_TEXT.preview}
        step={project.stage ? STAGE_TEXT[project.stage] : undefined}
        progress={project.progress}
      />
    </div>

    <div class="col">
      {#if project.preview?.cameraMoved}
        <Notice kind="error">Kamera hat sich bewegt – Ergebnis unscharf.</Notice>
      {/if}
      {#if project.selectionError}<Notice kind="error">{project.selectionError}</Notice>{/if}
      {#if !uniform}<Notice kind="error">Δt nicht mehr gleichmäßig</Notice>{/if}
      {#if picking}<Notice>Bild in der Leiste antippen</Notice>{/if}

      <IntervalControl {project} />

      <Card title="Darstellung">
        <div class="tiles" role="radiogroup" aria-label="Darstellung">
          {#each modes as m (m.id)}
            <button
              type="button"
              role="radio"
              aria-checked={project.compose.mode === m.id}
              class="tile"
              class:on={project.compose.mode === m.id}
              onclick={() => setMode(m.id)}>{m.label}</button
            >
          {/each}
        </div>
      </Card>

      {#if isMaskedMode(project.compose.mode)}
        <ThresholdControl {project} />
      {/if}

      <details class="more" data-testid="more">
        <summary>Mehr …</summary>
        <div class="more-body">
          <label class="row"
            >Weiche Kante
            <input type="range" min="0" max="10" step="1" value={project.compose.featherPx} oninput={setFeather} />
            <output>{project.compose.featherPx} px</output>
          </label>
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
          {#if project.compose.mode === 'difference'}
            <Switch checked={project.compose.latestOnTop} label="Spätere oben" onchange={setLatest} />
          {/if}
          <div class="bg">
            <span class="muted">Hintergrund</span>
            <Segmented
              label="Hintergrund"
              options={bgOptions}
              value={picking || bgFrame !== null ? 'frame' : bgValue}
              onchange={setBackground}
            />
          </div>
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
      </details>
    </div>
  </div>
  <Filmstrip
    indices={project.positionIndices}
    thumbs={project.positionThumbs}
    thumbsKey={project.positionThumbsKey}
    current={bgFrame}
    excluded={project.selection.excluded}
    {picking}
    ontap={tapPosition}
  />
{/if}

<style>
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
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tile {
    min-height: 56px;
    font-weight: 600;
    border: 2px solid transparent;
  }
  .tile.on {
    background: var(--acc-soft);
    border-color: var(--acc);
    color: var(--acc);
  }
  .more {
    background: var(--card);
    border-radius: 12px;
    padding: 0 12px;
  }
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 600;
  }
  .more-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  .row input[type='range'] {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    accent-color: var(--acc);
  }
  .row output {
    min-width: 3.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .bg {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .buttons button[aria-pressed='true'] {
    background: var(--acc);
    color: #fff;
  }
</style>
