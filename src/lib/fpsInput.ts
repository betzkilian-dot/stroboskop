import { formatFps, parseFps } from './format';
import type { Project } from './state/project.svelte';

/** Textfeld "Aufnahme-fps": leer = Automatik, ungueltig = bisheriger Wert bleibt; danach Vorschau neu anfordern. */
export function commitFpsInput(project: Project, el: HTMLInputElement): void {
  const text = el.value.trim();
  if (text === '') {
    project.captureFpsOverride = null;
  } else {
    const v = parseFps(text);
    if (v !== null) project.captureFpsOverride = v;
  }
  el.value = project.captureFpsOverride === null ? '' : formatFps(project.captureFpsOverride);
  project.requestPreview();
}
