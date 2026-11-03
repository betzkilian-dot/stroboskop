<script lang="ts">
  import { deltaT } from '../../lib/frames';
  import { formatDt } from '../../lib/format';
  import { FPS_UNCERTAIN_TEXT, LOADING_TEXT, type Project } from '../../lib/state/project.svelte';
  import BildTab from './BildTab.svelte';
  import VideoTab from './VideoTab.svelte';
  import ExportDialog from '../ExportDialog.svelte';
  import Notice from '../components/Notice.svelte';

  let { project, onpick }: { project: Project; onpick: () => void } = $props();

  const tabs = [
    { id: 'video', label: 'Video', enabled: true },
    { id: 'bild', label: 'Bild', enabled: true },
    { id: 'massstab', label: 'Maßstab', enabled: false },
    { id: 'messen', label: 'Messen', enabled: false },
    { id: 'auswerten', label: 'Auswerten', enabled: false },
  ];
  let tab = $state('bild');
  let exportOpen = $state(false);
</script>

<div class="profi">
  <header>
    <strong class="name">{project.name}</strong>
    {#if tab !== 'bild'}
      <span class="dt">Δt = {formatDt(deltaT(project.selection.step, project.captureFps))}</span>
    {/if}
    {#if project.loading}<span class="loading" role="status">{LOADING_TEXT}</span>{/if}
    <button type="button" disabled={project.loading} onclick={onpick}>Neues Projekt</button>
    <button type="button" disabled={!project.preview || project.selectionError !== null} onclick={() => (exportOpen = true)}>Export</button>
  </header>

  {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}
  {#if !project.exact}<Notice>Bildgenauigkeit eingeschränkt</Notice>{/if}
  {#if project.info?.fpsCertain === false}<Notice kind="error">{FPS_UNCERTAIN_TEXT}</Notice>{/if}

  <div role="tablist" aria-label="Bereiche">
    {#each tabs as t (t.id)}
      <button
        role="tab"
        type="button"
        id="tab-{t.id}"
        aria-selected={tab === t.id}
        aria-controls="panel-{t.id}"
        disabled={!t.enabled}
        title={t.enabled ? undefined : 'folgt'}
        onclick={() => (tab = t.id)}>{t.label}</button
      >
    {/each}
  </div>

  <div class="panel" role="tabpanel" id="panel-{tab}" aria-labelledby="tab-{tab}">
    {#if tab === 'video'}
      <VideoTab {project} />
    {:else}
      <BildTab {project} />
    {/if}
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
    gap: 12px;
    padding: 8px 12px;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
  [role='tablist'] {
    display: flex;
    gap: 4px;
    padding: 0 12px;
    overflow-x: auto;
  }
  [role='tab'][aria-selected='true'] {
    background: #1b5fd1;
    color: #fff;
  }
  .panel {
    flex: 1;
    min-height: 0;
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
  }
</style>
