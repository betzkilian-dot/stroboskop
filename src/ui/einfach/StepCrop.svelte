<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { CropRect, Project } from '../../lib/state/project.svelte';
  import CropEditor from '../components/CropEditor.svelte';
  import Viewer from '../components/Viewer.svelte';

  let { project }: { project: Project } = $props();

  const info = $derived(project.info);
  let image = $state.raw<ImageBitmap | null>(null);
  let draft = $state<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  let seq = 0;

  const fullRect = (): CropRect => ({ x: 0, y: 0, w: info?.width ?? 1, h: info?.height ?? 1 });

  onMount(async () => {
    if (!info) return;
    const my = ++seq;
    try {
      const img = await project.frameImage(project.selection.startIndex);
      if (my !== seq) {
        img?.close();
        return;
      }
      draft = project.crop ? { ...project.crop } : fullRect();
      image = img;
    } catch (e) {
      console.warn('Standbild für den Zuschnitt konnte nicht geladen werden', e);
    }
  });
  onDestroy(() => {
    seq++;
    image?.close();
    image = null;
  });

  /** Entwurf in den Zuschnitt uebernehmen (ganzes Bild -> null); EinfachView ruft das vor jedem Schrittwechsel. */
  export function commit(): void {
    if (!image) return; // nie geladen: bisherigen Zuschnitt nicht anfassen
    const f = fullRect();
    const c = draft;
    project.crop = c.x === 0 && c.y === 0 && c.w === f.w && c.h === f.h ? null : { ...c };
    project.requestPreview();
  }
  function rotate() {
    project.rotation = ((project.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  }
</script>

{#if info}
  <div class="step">
    <div class="stage">
      {#if image}
        <Viewer {image} crop={null} rotation={project.rotation} videoWidth={info.width} videoHeight={info.height}>
          {#snippet tools(geo)}
            <CropEditor {geo} bind:crop={draft} />
          {/snippet}
        </Viewer>
      {/if}
    </div>
    <div class="controls">
      <p class="ask">Ziehe den Rahmen um den Bereich der Bewegung.</p>
      <div class="tiles">
        <button type="button" class="tile" onclick={() => (draft = fullRect())}>Ganzes Bild</button>
        <button type="button" class="tile" onclick={rotate}>↻ Drehen</button>
      </div>
    </div>
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
</style>
