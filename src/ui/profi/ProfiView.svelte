<script lang="ts">
  import { BUSY_TEXT, STAGE_TEXT, FPS_UNCERTAIN_TEXT, type Project } from '../../lib/state/project.svelte';
  import BildTab from './BildTab.svelte';
  import VideoTab from './VideoTab.svelte';
  import ExportDialog from '../ExportDialog.svelte';
  import Notice from '../components/Notice.svelte';
  import BusyOverlay from '../components/BusyOverlay.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';

  let { project, onpick }: { project: Project; onpick: (kind: 'camera' | 'file') => void } = $props();

  const phases = [
    { id: 'video', label: 'Video', icon: 'video' },
    { id: 'bild', label: 'Bild', icon: 'strobe' },
    { id: 'massstab', label: 'Maßstab', icon: 'ruler', disabled: true },
    { id: 'messen', label: 'Messen', icon: 'pin', disabled: true },
    { id: 'auswerten', label: 'Auswerten', icon: 'chart', disabled: true },
  ] as const;
  let phase = $state<string>('video');
  let exportOpen = $state(false);
</script>

<div class="profi">
  <header>
    <strong class="name">{project.name}</strong>
    <Segmented label="Phasen" options={[...phases]} value={phase} onchange={(id) => (phase = id)} />
    <span class="actions">
      <button type="button" class="btn" disabled={project.loading} onclick={() => onpick('file')}>
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
  {#if project.info?.fpsCertain === false}<Notice kind="error">{FPS_UNCERTAIN_TEXT}</Notice>{/if}

  <div class="panel">
    {#if phase === 'video'}
      <VideoTab {project} />
    {:else}
      <BildTab {project} />
    {/if}
    <BusyOverlay active={project.loading} title={BUSY_TEXT.open} step={STAGE_TEXT.open} />
  </div>
</div>

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
