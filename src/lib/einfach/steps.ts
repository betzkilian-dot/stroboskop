// Schrittlogik des Modus Einfach (Schritt-Assistent). Reine Funktionen, ohne UI.
import type { ComposeMode } from '../compose/compositor';
import type { Measurement } from '../measure/model';

export type StepId = 'video' | 'zuschnitt' | 'bild' | 'markieren' | 'teilen';
export const STEPS: { id: StepId; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'zuschnitt', label: 'Zuschneiden' },
  { id: 'bild', label: 'Bild' },
  { id: 'markieren', label: 'Markieren' },
  { id: 'teilen', label: 'Teilen' }
];

export type Look = 'auto' | 'hell' | 'dunkel' | 'kontrast';
export const LOOKS: { id: Look; label: string; hint: string; mode: ComposeMode }[] = [
  { id: 'auto', label: 'Automatisch', hint: 'passt meistens', mode: 'difference' },
  { id: 'hell', label: 'Helles Objekt', hint: 'z. B. Ball vor dunkler Wand', mode: 'lighten' },
  { id: 'dunkel', label: 'Dunkles Objekt', hint: 'z. B. vor heller Wand', mode: 'darken' },
  { id: 'kontrast', label: 'Wenig Kontrast', hint: 'Objekt hebt sich kaum ab', mode: 'difference' }
];

/** Zuordnung Modus (+ Schwelle) → Look. „Unterschied“ mit fester Schwelle (≥ 0) ist „Wenig Kontrast“; unbekannte Modi fallen auf 'auto'. */
export function lookOf(mode: ComposeMode, threshold: number): Look {
  if (mode === 'difference') return threshold >= 0 ? 'kontrast' : 'auto';
  return LOOKS.find(l => l.mode === mode)?.id ?? 'auto';
}

/** Startschwelle für „Wenig Kontrast“: halbe automatische Schwelle (empfindlicher), mindestens 0,02. */
export function kontrastThreshold(auto: number | undefined): number {
  return Math.max(0.02, Math.round(((auto ?? 0.1) / 2) * 100) / 100);
}

/** Darf der Assistent vom Schritt `step` weitergehen? */
export function canAdvance(step: StepId, s: { hasVideo: boolean; selectionError: string | null }): boolean {
  switch (step) {
    case 'video': return s.hasVideo;
    case 'zuschnitt': return true;
    case 'bild':
    case 'markieren': return s.selectionError === null;
    case 'teilen': return false;
  }
}

/** Darf die Fortschrittsleiste von Schritt `from` auf `to` springen? Rückwärts immer; vorwärts nur, wenn jeder Schritt dazwischen weiter darf. */
export function canJump(from: StepId, to: StepId, s: { hasVideo: boolean; selectionError: string | null }): boolean {
  const a = STEPS.findIndex(x => x.id === from);
  const b = STEPS.findIndex(x => x.id === to);
  for (let i = a; i < b; i++) if (!canAdvance(STEPS[i].id, s)) return false;
  return true;
}

/** Im Modus Einfach sichtbare Überlagerungen: nur Zahlen und Bahn. */
export function applyEinfachOverlays(m: Measurement): void {
  m.overlays = { numbers: true, path: true, v: false, a: false, scaleBar: false, dt: false, axes: false, components: false };
}

/** Mindestens ein gesetzter Punkt in einem beliebigen Objekt. */
export function hasPoints(m: Measurement): boolean {
  return m.objects.some(o => Object.keys(o.points).length > 0);
}

/** Erklärtext zum Bildabstand: `1` → „jedes Bild“, sonst „jedes n. Bild“. */
export function stepInfoText(step: number): string {
  return step === 1 ? 'jedes Bild' : `jedes ${step}. Bild`;
}
