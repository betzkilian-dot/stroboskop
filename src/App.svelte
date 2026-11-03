<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Project } from './lib/state/project.svelte';
  import Start from './ui/Start.svelte';
  import ProfiView from './ui/profi/ProfiView.svelte';
  import Notice from './ui/components/Notice.svelte';

  const project = new Project();
  let input: HTMLInputElement;

  function pick() {
    input.click();
  }
  async function onchange() {
    const f = input.files?.[0];
    if (!f) return;
    await project.load(f);
    input.value = ''; // gleiche Datei erneut waehlbar
  }
  onDestroy(() => project.dispose());
</script>

<!-- Genau ein Datei-Eingabefeld, in beiden Ansichten erreichbar -->
<input type="file" accept="video/*" hidden bind:this={input} onchange={onchange} />

{#if project.info}
  <ProfiView {project} onpick={pick} />
{:else}
  <Start onpick={pick}>
    {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}
  </Start>
{/if}
