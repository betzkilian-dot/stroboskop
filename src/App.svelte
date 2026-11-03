<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Project } from './lib/state/project.svelte';
  import Start from './ui/Start.svelte';
  import ProfiView from './ui/profi/ProfiView.svelte';
  import Notice from './ui/components/Notice.svelte';

  const project = new Project();
  let cameraInput: HTMLInputElement;
  let fileInput: HTMLInputElement;

  function pick(kind: 'camera' | 'file') {
    (kind === 'camera' ? cameraInput : fileInput).click();
  }
  async function onchange(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    await project.load(f);
    input.value = ''; // gleiche Datei erneut waehlbar
  }
  onDestroy(() => project.dispose());
</script>

<!-- Zwei Datei-Eingabefelder (Kamera / Dateiwahl), in beiden Ansichten erreichbar -->
<input type="file" accept="video/*" capture="environment" hidden bind:this={cameraInput} onchange={() => onchange(cameraInput)} />
<input type="file" accept="video/*" hidden bind:this={fileInput} onchange={() => onchange(fileInput)} />

{#if project.info}
  <ProfiView {project} onpick={pick} />
{:else}
  <Start onpick={pick} loading={project.loading}>
    {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}
  </Start>
{/if}
