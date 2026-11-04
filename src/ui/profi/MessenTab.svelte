<script lang="ts">
  import { untrack } from 'svelte';
  import {
    activeObject,
    addObject,
    hitPoint,
    nextOpenPosition,
    removeObject,
    seriesFor,
  } from '../../lib/measure/model';
  import type { Pt } from '../../lib/physics/kinematics';
  import { clampToView, videoToViewer, type StageTool } from '../../lib/viewer-coords';
  import type { Project } from '../../lib/state/project.svelte';
  import StageMeasure from './StageMeasure.svelte';
  import ObjectChips from './ObjectChips.svelte';
  import ArrowSettings from './ArrowSettings.svelte';
  import Card from '../components/Card.svelte';
  import Filmstrip from '../components/Filmstrip.svelte';
  import Notice from '../components/Notice.svelte';
  import Switch from '../components/Switch.svelte';

  let { project, ontab }: { project: Project; ontab: (id: string) => void } = $props();

  const HIT_PX = 22;
  // aktuelle Position (Index in measureIndices); beim Oeffnen und Objektwechsel: erste offene Position
  let current = $state(
    untrack(() => nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? 0),
  );
  let drag = $state<{ at: Pt; client: Pt } | null>(null);
  let grabbed: number | null = null;
  let legendGrab: Pt | null = null;
  let stage = $state<StageMeasure>();
  let confirmClear = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  const m = $derived(project.measure);
  const obj = $derived(activeObject(m));
  const indices = $derived(project.measureIndices);
  const mpp = $derived(project.metersPerPixel);
  const setCount = $derived(indices.filter((f) => obj.points[f]).length);
  const unsureCount = $derived(indices.filter((f) => obj.points[f]?.unsure).length);
  const here = $derived(current < indices.length && !!obj.points[indices[current]]);
  const numbers = $derived(Object.fromEntries(indices.map((f, i) => [f, i])) as Record<number, number>);
  const marks = $derived.by(() => {
    const out: Record<number, 'set' | 'unsure'> = {};
    for (const f of indices) {
      const p = obj.points[f];
      if (p) out[f] = p.unsure ? 'unsure' : 'set';
    }
    return out;
  });

  // Pfeile: v ab 2, a ab 3 aufeinanderfolgenden gesetzten Positionen (je Objekt)
  function run(n: number): boolean {
    return m.objects.some((o) => {
      const nrs = new Set(seriesFor(o, indices, 1).map((s) => s.nr));
      return [...nrs].some((nr) => Array.from({ length: n }, (_, k) => nrs.has(nr + k)).every(Boolean));
    });
  }
  const vOk = $derived(mpp !== null && run(2));
  const aOk = $derived(mpp !== null && run(3));

  const hint = $derived.by(() => {
    if (indices.length === 0) return null;
    if (setCount < indices.length) return here ? `Position ${current} neu setzen` : `Position ${current} antippen`;
    const u = indices.findIndex((f) => obj.points[f]?.unsure);
    return u >= 0 ? `Punkt ${u} unsicher – antippen und ziehen zum Korrigieren` : 'Alle Positionen gesetzt';
  });

  // Objektwechsel (auswaehlen, hinzufuegen, loeschen): zur ersten offenen Position
  $effect(() => {
    void m.active;
    untrack(() => {
      current = nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? 0;
    });
  });

  // Aktuelle Position im gueltigen Bereich halten (z. B. nach Aenderung des Intervalls)
  $effect(() => {
    const n = indices.length;
    untrack(() => {
      if (current >= n) current = Math.max(0, n - 1);
    });
  });

  function hitRadius(): number {
    const g = stage!.geometry();
    const a = videoToViewer(0, 0, g);
    const b = videoToViewer(1, 0, g);
    const fit = Math.hypot(b.x - a.x, b.y - a.y);
    return fit > 0 ? HIT_PX / fit : HIT_PX;
  }
  const clamp = (p: Pt): Pt => clampToView(p, project.crop, project.info?.width ?? 0, project.info?.height ?? 0);
  function advance() {
    current = nextOpenPosition(activeObject(project.measure), project.measureIndices, current + 1) ?? current;
  }

  const tool: StageTool = {
    press(p, client) {
      legendGrab = stage!.legendGrab(client);
      if (legendGrab) return true;
      const hit = hitPoint(activeObject(project.measure), project.measureIndices, p, hitRadius());
      if (hit === null) return false;
      grabbed = hit;
      return true;
    },
    drag(p, client) {
      if (legendGrab) {
        stage!.moveLegend(client, legendGrab);
        return;
      }
      if (grabbed === null) return;
      const q = clamp(p);
      project.setPoint(grabbed, q);
      drag = { at: q, client };
    },
    release() {
      legendGrab = null;
      if (grabbed !== null) current = grabbed;
      grabbed = null;
      drag = null;
    },
    tap(p) {
      if (project.measureIndices.length === 0) return;
      project.setPoint(current, clamp(p));
      advance();
    },
    cancel() {
      legendGrab = null;
      grabbed = null;
      drag = null;
    },
  };

  async function suggest() {
    await project.suggestPositions();
    current = nextOpenPosition(activeObject(project.measure), project.measureIndices, 0) ?? current;
  }
  function clearAll() {
    if (!confirmClear) {
      confirmClear = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirmClear = false), 3000);
      return;
    }
    clearTimeout(confirmTimer);
    confirmClear = false;
    project.clearPoints();
    current = 0;
  }
  function tapFilm(frame: number) {
    const nr = indices.indexOf(frame);
    if (nr >= 0) current = nr;
  }
  function rename(id: number, name: string) {
    const o = m.objects.find((x) => x.id === id);
    const n = name.trim();
    if (o && n) o.name = n;
  }
</script>

{#if project.info}
  <div class="work">
    <StageMeasure bind:this={stage} {project} {tool} {hint} showCalibration={false} {drag} />

    <div class="col">
      {#if mpp === null}
        <Notice>
          Für Pfeile und Tabelle zuerst den Maßstab festlegen
          <button type="button" class="to-scale" onclick={() => ontab('massstab')}>Zum Maßstab</button>
        </Notice>
      {/if}

      <Card title="Objekte">
        <ObjectChips
          objects={m.objects}
          active={m.active}
          onselect={(id) => (m.active = id)}
          onadd={() => {
            if (addObject(m)) {
              m.active = m.objects[m.objects.length - 1].id;
            }
          }}
          onrename={rename}
          ondelete={(id) => removeObject(m, id)}
        />
      </Card>

      <Card title="Positionen">
        <div class="count">
          <strong data-testid="pos-count">{setCount} / {indices.length}</strong>
          <span class="muted">gesetzt{unsureCount > 0 ? ` · ${unsureCount} unsicher` : ''}</span>
        </div>
        <div class="btns">
          <button type="button" class="btn primary" disabled={project.suggesting} onclick={suggest}>
            {project.suggesting ? 'Wird berechnet …' : 'Vorschlagen'}
          </button>
          <button type="button" disabled={!here} onclick={() => project.deletePoint(current)}>Punkt löschen</button>
          <button type="button" disabled={setCount === 0} onclick={clearAll}>
            {confirmClear ? 'Wirklich löschen?' : 'Alle löschen'}
          </button>
        </div>
      </Card>

      <Card title="Einblendungen">
        <div class="switches">
          <Switch checked={m.overlays.numbers} label="Nummern" onchange={(v) => (m.overlays.numbers = v)} />
          <Switch checked={m.overlays.path} label="Bahn" onchange={(v) => (m.overlays.path = v)} />
          <Switch
            checked={m.overlays.scaleBar}
            label="Maßstabsbalken"
            disabled={mpp === null}
            onchange={(v) => (m.overlays.scaleBar = v)}
          />
          <Switch checked={m.overlays.axes} label="Koordinatensystem" onchange={(v) => (m.overlays.axes = v)} />
          <Switch checked={m.overlays.dt} label="Δt" onchange={(v) => (m.overlays.dt = v)} />
        </div>
      </Card>

      <Card title="Pfeile">
        <div class="switches">
          <Switch
            checked={m.overlays.v}
            label="v-Pfeile"
            disabled={!vOk && !m.overlays.v}
            onchange={(x) => (m.overlays.v = x)}
          />
          {#if !vOk}<span class="muted">Ab 2 Punkten und mit Maßstab</span>{/if}
          <Switch
            checked={m.overlays.a}
            label="a-Pfeile"
            disabled={!aOk && !m.overlays.a}
            onchange={(x) => (m.overlays.a = x)}
          />
          {#if !aOk}<span class="muted">Ab 3 Punkten</span>{/if}
          {#if m.overlays.v || m.overlays.a}
            <Switch checked={m.overlays.components} label="Komponenten" onchange={(x) => (m.overlays.components = x)} />
          {/if}
        </div>
        {#if m.overlays.v}<ArrowSettings {project} kind="v" />{/if}
        {#if m.overlays.a}<ArrowSettings {project} kind="a" />{/if}
      </Card>
    </div>
  </div>
  <div class="film">
    <Filmstrip
      indices={project.positionIndices}
      thumbs={project.positionThumbs}
      thumbsKey={project.positionThumbsKey}
      current={indices[current] ?? null}
      {marks}
      firstNumber={0}
      {numbers}
      markColor={obj.color}
      excluded={project.selection.excluded}
      ontap={tapFilm}
    />
  </div>
{/if}

<style>
  .count {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }
  .count strong {
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--muted);
  }
  .btns {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .btns button {
    min-height: 44px;
  }
  .switches {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .to-scale {
    display: block;
    margin-top: 8px;
    min-height: 44px;
  }
  .film {
    flex: none;
  }
  @media (max-width: 899px) {
    .film {
      position: sticky;
      bottom: 0;
      z-index: 3;
      background: var(--bg);
    }
  }
</style>
