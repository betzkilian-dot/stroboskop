<script lang="ts">
  import { infoLineText } from '../../lib/export/image';
  import { deltaT, isUniform } from '../../lib/frames';
  import { buildScene, sceneAxes } from '../../lib/overlay/scene';
  import { drawOverlay } from '../../lib/overlay/draw';
  import { imageRectOf, type Rect } from '../../lib/overlay/map';
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
    showAxes = false,
    highlight = null,
    drag = null,
  }: {
    project: Project;
    tool: StageTool | null;
    hint: string | null;
    showCalibration: boolean;
    showAxes?: boolean;
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
    const m = project.measure;
    const scene = buildScene(m, project.measureIndices, project.captureFps, project.viewRect, {
      showCalibration,
      showAxes: showAxes || m.overlays.axes,
      highlight,
      dtText: m.overlays.dt
        ? infoLineText(deltaT(project.selection.step, project.captureFps), isUniform(project.measureIndices))
        : null,
    });
    const o = scene.axes?.origin ?? sceneAxes(m, project.viewRect).origin;
    originAttr = `${o.x.toFixed(1)},${o.y.toFixed(1)}`;
    axesAttr = scene.axes ? (scene.axes.dims === 'xy' ? 'x,y' : scene.axes.dims) : '';
    const imageRect = imageRectOf(map, project.crop, info.width, info.height);
    const lr = drawOverlay(ctx, scene, map, unit, { ...size, screen: true, imageRect });
    // fuer Treffer und Ziehen der Legende in CSS-Pixeln (Geraetepixel / unit = dpr)
    const css = (r: Rect): Rect => ({ x: r.x / unit, y: r.y / unit, w: r.w / unit, h: r.h / unit });
    imageCss = css(imageRect);
    legendCss = lr ? css(lr) : null;
    legendAttr = legendCss ? [legendCss.x, legendCss.y, legendCss.w, legendCss.h].map(v => v.toFixed(1)).join(',') : '';
  }

  /** Sichtbare Bildflaeche und Legende der letzten Zeichnung, CSS-px relativ zur Viewer-Box. */
  let imageCss: Rect | null = null;
  let legendCss: Rect | null = null;
  /** Legendenrechteck als Text (x,y,w,h in CSS-px) fuer Tests. */
  let legendAttr = $state('');
  /** Ursprung (Video-Pixel) und gezeichnete Achsen als Text fuer Tests. */
  let originAttr = $state('');
  let axesAttr = $state('');

  /** Greifpunkt (Abstand zur linken oberen Ecke der Legende) oder null, wenn der Punkt nicht auf der Legende liegt. */
  export function legendGrab(client: Pt): Pt | null {
    const r = legendCss;
    if (!r || client.x < r.x || client.x > r.x + r.w || client.y < r.y || client.y > r.y + r.h) return null;
    return { x: client.x - r.x, y: client.y - r.y };
  }
  /** Legende so verschieben, dass der Greifpunkt unter `client` bleibt; speichert die Position als Anteil der Bildflaeche. */
  export function moveLegend(client: Pt, grab: Pt): void {
    const img = imageCss, lg = legendCss;
    if (!img || !lg || img.w <= 0 || img.h <= 0) return;
    const fx = (client.x - grab.x - img.x) / img.w;
    const fy = (client.y - grab.y - img.y) / img.h;
    project.measure.legendPos = {
      x: Math.max(0, Math.min(Math.max(0, 1 - lg.w / img.w), fx)),
      y: Math.max(0, Math.min(Math.max(0, 1 - lg.h / img.h), fy)),
    };
  }
</script>

{#if project.info}
  <div
    class="stage"
    data-testid="stage"
    data-legend={legendAttr}
    data-origin={originAttr}
    data-axes={axesAttr}
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
