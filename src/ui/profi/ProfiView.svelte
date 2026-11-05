<script lang="ts">
  import { BUSY_TEXT, STAGE_TEXT, type Project } from '../../lib/state/project.svelte';
  import BildTab from './BildTab.svelte';
  import MassstabTab from './MassstabTab.svelte';
  import MessenTab from './MessenTab.svelte';
  import AuswertenTab from './AuswertenTab.svelte';
  import VideoTab from './VideoTab.svelte';
  import ExportDialog from '../ExportDialog.svelte';
  import Notice from '../components/Notice.svelte';
  import BusyOverlay from '../components/BusyOverlay.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  let { project, onpick, onhome }: { project: Project; onpick: () => void; onhome: () => void } = $props();

  const phases = $derived([
    { id: 'video', label: 'Video', icon: 'video' },
    { id: 'bild', label: 'Bild', icon: 'strobe' },
    { id: 'massstab', label: 'Maßstab', icon: 'ruler', disabled: !project.info },
    { id: 'messen', label: 'Messen', icon: 'pin', disabled: !project.info },
    { id: 'auswerten', label: 'Auswerten', icon: 'chart', disabled: !project.info },
  ] as const);
  let phase = $state<string>('video');
  // neues Video (auch ohne neues Einhaengen dieser Ansicht): zurueck zur Phase Video
  let lastInfo: unknown = null;
  $effect.pre(() => {
    const i = project.info;
    if (i !== lastInfo) {
      lastInfo = i;
      phase = 'video';
    }
  });
  let exportOpen = $state(false);
  let confirmHome = $state(false);
  function home() {
    if (project.info) confirmHome = true;
    else onhome();
  }
</script>

<div class="profi">
  <header>
    <button type="button" class="btn" data-testid="home" onclick={home}>‹ Start</button>
    <strong class="name">{project.name}</strong>
    <Segmented label="Phasen" options={[...phases]} value={phase} onchange={(id) => (phase = id)} />
    <span class="actions">
      <button type="button" class="btn" disabled={project.loading} onclick={() => onpick()}>
        <Icon name="plus" size={16} />Neu
      </button>
      <button
        type="button"
        class="btn primary"
        data-testid="open-export"
        disabled={!project.preview || project.selectionError !== null}
        onclick={() => (exportOpen = true)}
      >
        <Icon name="share" size={16} />Teilen
      </button>
    </span>
  </header>

  {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}
  {#if !project.exact}<Notice>Bildgenauigkeit eingeschränkt</Notice>{/if}

  <div class="panel">
    {#if phase === 'video'}
      <VideoTab {project} ontab={(id) => (phase = id)} />
    {:else if phase === 'massstab'}
      <MassstabTab {project} onnext={() => (phase = 'messen')} />
    {:else if phase === 'messen'}
      <MessenTab {project} ontab={(id) => (phase = id)} />
    {:else if phase === 'auswerten'}
      <AuswertenTab {project} ontab={(id) => (phase = id)} />
    {:else}
      <BildTab {project} ontab={(id) => (phase = id)} />
    {/if}
    <BusyOverlay active={project.loading} title={BUSY_TEXT.open} step={STAGE_TEXT.open} />
  </div>
</div>

{#if confirmHome}
  <ConfirmDialog title="Projekt verwerfen?" confirmLabel="Verwerfen" onconfirm={() => { confirmHome = false; onhome(); }} oncancel={() => (confirmHome = false)} />
{/if}

{#if exportOpen}<ExportDialog {project} onclose={() => (exportOpen = false)} />{/if}

<style>
  .profi {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    box-sizing: border-box;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 12px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .panel {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
</style>
