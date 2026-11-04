import { VideoError } from '../video/demux';
import { errorText } from '../state/project.svelte';

/** Fehlertext fuer Export/Teilen (Dialog und Schritt Teilen). */
export function exportErrorText(e: unknown): string {
  if (e instanceof VideoError) return errorText(e);
  if (e instanceof DOMException && e.name === 'NotAllowedError') return 'Teilen wurde nicht erlaubt. Bitte erneut versuchen.';
  return 'Export fehlgeschlagen.';
}
