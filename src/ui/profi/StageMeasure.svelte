<script lang="ts">
  import { formatDt } from '../../lib/format';
  import { deltaT } from '../../lib/frames';
  import { buildScene } from '../../lib/overlay/scene';
  import { drawOverlay } from '../../lib/overlay/draw';
  import type { Pt } from '../../lib/physics/kinematics';
  import type { StageTool, ViewGeometry } from '../../lib/viewer-coords';
  import { BUSY_TEXT, STAGE_TEXT, type Project } from '../../lib/state/project.svelte';
  import Viewer from '../components/Viewer.svelte';
  import Magnifier from '../components/Magnifier.svelte';
  import BusyOverlay from '../components/BusyOverlay.svelte';

  let {
    project,
    tool,
    hint,
    showCalibration,
    highlight = null,
    drag = null,
  }: {
    project: Project;
    tool: StageTool | null;
    hint: string | null;
    showCalibration: boolean;
    highlight?: { object: number; nr: number } | null;
    drag?: { at: Pt; client: Pt } | null;
  } = $props();

  let viewer = $state<Viewer>();
  let boxW = $state(0);
  let boxH = $state(0);

  /** Geometrie des Viewers (fuer Trefferradius in Video-Pixeln) */
  export function geometry(): ViewGeometry {
    return viewer!.getGeometry();
  }

  function paint(ctx: CanvasRenderingContext2D, map: (p: Pt) => Pt, unit: number, size: { width: number; height: number }) {
    const info = project.info;
    if (!info) return;
    const long = project.crop ? Math.max(project.crop.w, project.crop.h) : Math.max(info.width, info.height);
    const m = project.measure;
    const scene = buildScene(m, project.measureIndices, project.captureFps, long, {
      showCalibration,
      highlight,
      dtText: m.overlays.dt ? `Δt = ${formatDt(deltaT(project.selection.step, project.captureFps))}` : null,
    });
    drawOverlay(ctx, scene, map, unit, { ...size, screen: true });
  }
</script>

{#if project.info}
  <div
    class="stage"
    data-testid="stage"
    data-ready={project.preview ? 'true' : 'false'}
    bind:clientWidth={boxW}
    bind:clientHeight={boxH}
  >
    <Viewer
      bind:this={viewer}
      image={project.preview?.image ?? null}
      crop={project.crop}
      rotation={project.rotation}
      videoWidth={project.info.width}
      videoHeight={project.info.height}
      {tool}
      {paint}
    />
    {#if hint}<span class="hint">{hint}</span>{/if}
    {#if drag && project.preview}
      <Magnifier
        image={project.preview.image}
        videoWidth={project.info.width}
        at={drag.at}
        client={drag.client}
        boxWidth={boxW}
        boxHeight={boxH}
        rotation={project.rotation}
      />
    {/if}
    <BusyOverlay
      active={project.rendering || project.exporting}
      title={project.exporting ? BUSY_TEXT.export : BUSY_TEXT.preview}
      step={project.stage ? STAGE_TEXT[project.stage] : undefined}
      progress={project.progress}
    />
  </div>
{/if}

<style>
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
</style>
