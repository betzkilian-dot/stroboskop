<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Project } from './lib/state/project.svelte';
  import ModeStart from './ui/ModeStart.svelte';
  import Start from './ui/Start.svelte';
  import EinfachView from './ui/einfach/EinfachView.svelte';
  import ProfiView from './ui/profi/ProfiView.svelte';
  import Toast from './ui/components/Toast.svelte';
  import Notice from './ui/components/Notice.svelte';

  let project = $state(new Project());
  let mode = $state<'start' | 'einfach' | 'erweitert'>('start');
  function home() {
    project.dispose();
    project = new Project();
    mode = 'start';
  }
  /** Neues Video im Modus Einfach: Projekt verwerfen, im Modus bleiben (Schritt 1 ohne Video) */
  function restart() {
    project.dispose();
    project = new Project();
  }
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

{#if mode === 'start'}
  <ModeStart onchoose={(m) => (mode = m)} />
{:else if mode === 'einfach'}
  <EinfachView {project} onpick={pick} onhome={home} onrestart={restart} />
{:else if project.info}
  <ProfiView {project} onpick={pick} onhome={home} />
{:else}
  <Start onpick={pick} onhome={home} loading={project.loading}>
    {#if project.error}<Notice kind="error">{project.error}</Notice>{/if}
  </Start>
{/if}

<Toast />
