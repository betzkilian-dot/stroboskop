# Plan 1b – Überarbeitung Design & Fehler – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Plan-1-App bekommt das freigegebene Design „Variante A – folgt dem iPad“ (hell/dunkel automatisch), eine Video-Phase mit Abspielen und Anfang/Ende-Markierung, eine Rechen-Anzeige, maskierte Modi Aufhellen/Abdunkeln, Export-Rückmeldung und die Fehlerbehebungen A/B.

**Architecture:** Globale Design-Tokens in `src/app.css` (CSS-Variablen, `prefers-color-scheme`), kleine wiederverwendbare UI-Bausteine (`Icon`, `Segmented`, `Card`, `BusyOverlay`, `Toast`, `Filmstrip`, `VideoPlayer`, `Timeline`). Rechenlogik bleibt in `src/lib/…`; neue reine Funktionen (Zeit↔Bild, Anfang/Ende-Regeln) liegen in `src/lib/frames.ts` und werden unit-getestet. Die Engine meldet zusätzlich den Rechenschritt.

**Tech Stack:** TypeScript, Svelte 5 (Runes), Vite 8, vite-plugin-pwa, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-03-plan1b-ueberarbeitung-design.md` (übergeordnet: `docs/superpowers/specs/2026-11-03-stroboskop-app-design.md`). Freigegebener Entwurf: `.superpowers/brainstorm/3959-1793729735/content/design-a-hell-dunkel.html` (lokal, git-ignoriert; Implementer der UI-Tasks lesen ihn als Referenz für Optik).

## Global Constraints

- Alle UI-Texte Deutsch; Zahlen mit Dezimalkomma über die bestehenden Helfer in `src/lib/format.ts`.
- Farben ausschließlich über die Tokens aus Spec §3 (`var(--bg)` usw.); keine hart codierten Farben in Komponenten außer `#fff` auf Akzentflächen und Maskenfarben.
- Schrift: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`, Grundgröße 16 px; Zahlen `font-variant-numeric: tabular-nums`.
- Jede tippbare Fläche ≥ 44 × 44 px.
- Keine Emojis als Symbole; nur `Icon.svelte`.
- Keine sichtbaren Browser-Standard-Radio-Buttons/Checkboxen/Selects (Segment-Schalter, Kacheln, eigener Schalter statt Checkbox).
- Bestehende Verträge bleiben: `Project.requestPreview()` nach jeder Einstellungsänderung, `Project.setSelection()` für Bereich/Schritt, Export zweistufig, `$state.snapshot` für Render-Einstellungen.
- Keine neuen Laufzeit-Abhängigkeiten.
- Tests: `npm test` (Vitest) und `npm run test:e2e` (Playwright, Edge) müssen am Ende jeder Task grün sein; bestehende E2E-Tests werden an neue Selektoren angepasst, nicht gelöscht, solange ihr Verhalten noch existiert.
- Commit-Nachrichten Deutsch, Präfix `feat:`/`fix:`/`test:`/`style:`, Abschlusszeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dunkelmodus-Lesbarkeit:** Jede Komponente muss in hell und dunkel lesbar sein (kein dunkler Text auf dunkler Karte, Viewer-Hintergrund nicht weiß im Dunkelmodus). → Task 1 (Theme-Test) + Task 9 (Screenshot-Durchlauf beider Modi pro Phase).
2. **Hochformat auf dem iPad (< 900 px Breite):** Einstellungen rücken unter die Bühne, nichts horizontal abgeschnitten, Bühne ≥ 50 % Höhe. → Task 5 (E2E mit Viewport 820×1180).
3. **Spulen bei Zeitlupe / Edit-Listen:** Player-Zeit und Medien-Zeit weichen ab (Zeitlupe läuft im Player gestreckt). Anfang/Ende muss trotzdem das richtige Videobild treffen. → Task 3 (`playerToMediaTime` mit gestreckter Dauer), Task 7.
4. **Schnelles Umschalten während einer langen Rechnung** (Modus wechseln, Regler ziehen, Phase wechseln): Rechen-Anzeige darf nicht hängen bleiben und nicht flackern. → Task 4 (Overlay erst nach 300 ms, verschwindet bei `rendering=false`).
5. **Export-Abbruch im Teilen-Menü:** kein Toast, Dialog bleibt offen, erneutes Teilen geht. → Task 8.

---

### Task 1: Design-Grundlage (Tokens, Schrift, Icon, Segmented, Card)

**Files:**
- Create: `src/app.css`, `src/ui/components/Icon.svelte`, `src/ui/components/Segmented.svelte`, `src/ui/components/Card.svelte`, `src/ui/components/Switch.svelte`, `tests/e2e/theme.spec.ts`
- Modify: `src/main.ts` (CSS importieren), `index.html` (theme-color je Modus), `src/ui/components/Notice.svelte` (Token-Farben)

**Interfaces:**
- Produces:
  - Globale CSS-Variablen aus Spec §3 auf `:root`, Dunkelwerte unter `@media (prefers-color-scheme: dark)`; `color-scheme: light dark`.
  - Globale Klassen: `.btn` (Fläche `--fill`), `.btn.primary` (Akzent, weißer Text), `.chip`, `.chip.ok`, `.chip.warn`, `.muted`. Buttons haben ohne Klasse keinen Browser-Rahmen (`button { font: inherit; color: inherit; border: 0; background: var(--fill); border-radius: 10px; min-height: 44px; padding: 0 14px; }`).
  - `Icon.svelte` Props `{ name: IconName; size?: number /* px, default 20 */ }`, rendert `<svg aria-hidden="true" stroke="currentColor" stroke-width="2" fill="none">`. `export type IconName = 'video'|'strobe'|'ruler'|'pin'|'chart'|'share'|'camera'|'folder'|'play'|'pause'|'step-back'|'step-forward'|'rotate'|'crop'|'more'|'check'|'close'|'warning'|'plus'` (in `<script module>`).
  - `Segmented.svelte` Props `{ options: { id: string; label: string; icon?: IconName; disabled?: boolean }[]; value: string; onchange: (id: string) => void; label: string /* aria-label */ }`; rendert `role="radiogroup"` mit Buttons `role="radio" aria-checked`; Optik wie `.seg` im Entwurf.
  - `Card.svelte` Props `{ title?: string; children: Snippet }` → `<section class="card">` mit Überschrift in Versalien 11 px `--muted`.
  - `Switch.svelte` Props `{ checked: boolean; label: string; onchange: (v: boolean) => void }` → `role="switch"`, ersetzt Checkboxen.

- [ ] **Step 1: Failing E2E-Test `tests/e2e/theme.spec.ts`**

```ts
for (const scheme of ['light', 'dark'] as const) {
  test(`Grundlayout ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === 'light' ? 'rgb(242, 242, 247)' : 'rgb(0, 0, 0)');
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).not.toMatch(/Times|serif$/i);
    expect(font).toMatch(/system-ui|-apple-system|Segoe UI/);
  });
}
```

- [ ] **Step 2:** `npx playwright test theme` → FAIL (Hintergrund weiß, Times).
- [ ] **Step 3:** `src/app.css` mit Tokens, `body { margin:0; background: var(--bg); color: var(--fg); font: 16px/1.4 <Schrift>; -webkit-tap-highlight-color: transparent; }`, Basis-Buttons, Klassen; in `src/main.ts` `import './app.css'`. `index.html`: `<meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)">` und `#000000` für dunkel (bestehendes theme-color ersetzen). Komponenten `Icon`, `Segmented`, `Card`, `Switch` anlegen (Pfade der Symbole frei gestaltbar, 24er-viewBox, Strich 2). `Notice.svelte` auf Tokens (`--warn`/`--danger` mit 15 % Hintergrund via `color-mix(in srgb, var(--danger) 15%, transparent)`).
- [ ] **Step 4:** `npx playwright test theme` → PASS; `npm test` → PASS; `npm run check` → 0 Fehler.
- [ ] **Step 5:** Commit `style: Design-Grundlage (Tokens hell/dunkel, Systemschrift, Icon, Segmented, Card, Switch)`.

---

### Task 2: Maskierte Modi Aufhellen/Abdunkeln + Fehler B

**Files:**
- Modify: `src/lib/compose/compositor.ts`, `src/lib/engine/render.ts`, `src/lib/engine/protocol.ts`, `src/lib/export/image.ts` (`exportSettings`), `src/lib/state/project.svelte.ts`
- Test: `tests/unit/compose.test.ts`, `tests/unit/export-image.test.ts`, `tests/unit/render.test.ts`

**Interfaces:**
- Produces:
  - `export function isMaskedMode(m: ComposeMode): boolean` in `compositor.ts` (true für `difference`, `lighten`, `darken`).
  - Compositor: `lighten`/`darken` starten bei `bg` (nicht beim ersten Bild); je Bild Maske `m` via `motionMaskScratch` (gleiche Parameter wie Differenz), `opacity` wie Differenz, je Kanal `c = light ? max(out,f) : min(out,f)`, `out += (c − out) · m · opacity`. `latestOnTop` wird in diesen Modi ignoriert.
  - `render.ts`: Auto-Schwelle/Maskenüberlagerung nur, wenn `isMaskedMode(mode)`; sonst `autoThreshold` im Ergebnis = übergebene Schwelle (oder 0,1 wenn < 0).
  - `RenderResult.settingsKey: string` (neu, Pflicht) = `JSON.stringify([selection, compose ohne threshold, captureFps])` der Einstellungen, mit denen gerechnet wurde; erzeugt von `export function settingsKey(s: RenderSettings): string` in `protocol.ts`.
  - `exportSettings(s, preview)`: übernimmt `preview.autoThreshold` nur bei `s.compose.threshold < 0 && preview?.settingsKey === settingsKey(s)`; sonst bleibt `threshold = -1` (Export berechnet selbst).

- [ ] **Step 1: Failing Unit-Tests** in `compose.test.ts`:
  - `aufhellen mit Maske: Hintergrund ausserhalb des Objekts unverändert` – bg grau 100, zwei Frames mit weißem 4×4-Quadrat an verschiedenen Stellen plus Rauschen ±10 auf dem ganzen Bild, Schwelle 0,2: Pixel weit weg vom Quadrat == bg-Wert (exakt 100), beide Quadratpositionen == 255.
  - `abdunkeln mit Maske: dunkles Objekt an allen Positionen, Hintergrund unverändert` (analog mit schwarzem Quadrat, bg 200).
  - `aufhellen startet beim Hintergrund, nicht beim ersten Bild` – bg grau 100, einziges Frame = 105 überall (Differenz unter Schwelle 0,2): Ergebnis == 100 überall.
  - `isMaskedMode` für alle vier Modi.
  In `export-image.test.ts`: `exportSettings nutzt autoThreshold nur bei passendem settingsKey` (zwei Fälle: gleicher Schlüssel → Wert übernommen; anderer Modus/Schritt → threshold bleibt -1).
- [ ] **Step 2:** `npx vitest run tests/unit/compose.test.ts tests/unit/export-image.test.ts` → FAIL.
- [ ] **Step 3:** Implementieren wie in Interfaces; Worker/Hauptthread-Pfad liefern `settingsKey` mit (render.ts setzt es). Projekt: unverändert außer Typen.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `fix: Aufhellen/Abdunkeln mit Bewegungsmaske; Export-Schwelle nur bei passender Vorschau (B)`.

---

### Task 3: Engine – Rechenschritt, Bild-Zeitstempel, Fehler A; Zeit-Helfer

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/video/demux.ts`, `src/lib/video/element-source.ts` (nur falls `info` dort gebaut wird), `src/lib/engine/protocol.ts`, `src/lib/engine/render.ts`, `src/lib/engine/strobe.worker.ts`, `src/lib/engine/engine.ts`, `src/lib/frames.ts`, `src/lib/state/project.svelte.ts`
- Test: `tests/unit/frames.test.ts`, `tests/unit/render.test.ts`, `tests/unit/demux.test.ts`, `tests/unit/project-preview.test.ts`, `tests/e2e/engine.spec.ts`

**Interfaces:**
- Produces:
  - `VideoInfo.frameTimesS?: number[]` – Präsentationszeit je Bildindex in Sekunden, aufsteigend, erstes Bild = 0 (aus Demux: cts sortiert, minus kleinster cts). Element-Rückfall: fehlt.
  - `export type RenderStage = 'open' | 'background' | 'motion' | 'compose'`; `RenderOptions.onProgress(done, total, stage: RenderStage)`; Worker-Nachricht `progress` bekommt `stage`; `StrobeEngine.onProgress(cb: (done, total, stage) => void)`.
  - `frames.ts`:
    - `export function frameTimeS(info: Pick<VideoInfo,'frameTimesS'|'nominalFps'>, index: number): number` (aus `frameTimesS`, sonst `index / nominalFps`).
    - `export function nearestFrameIndex(info: Pick<VideoInfo,'frameTimesS'|'nominalFps'|'frameCount'>, mediaTimeS: number): number` (binäre Suche; geklemmt auf `[0, frameCount-1]`).
    - `export function playerToMediaTime(playerTimeS: number, playerDurationS: number, mediaDurationS: number): number` = `playerTimeS * mediaDurationS / playerDurationS` (bei `playerDurationS` ≤ 0 oder nicht endlich: `playerTimeS`).
    - `export function mediaToPlayerTime(mediaTimeS, playerDurationS, mediaDurationS): number` (Umkehrung).
    - `export function setRangeStart(sel: FrameSelection, index: number, frameCount: number): Pick<FrameSelection,'startIndex'|'endIndex'>` – neuer Anfang; liegt er ≥ `endIndex`, wird `endIndex = frameCount-1` (und falls der Anfang selbst `frameCount-1` ist, wird er auf `frameCount-2` geklemmt).
    - `export function setRangeEnd(sel, index, frameCount)` – symmetrisch: Ende ≤ Anfang → `startIndex = 0` (Ende mindestens 1).
  - `Project.stage: RenderStage | null` (gesetzt aus onProgress, `null` wenn nichts läuft).
  - **Fehler A:** `engine.open()` liest `const busy = inflight` synchron beim Aufruf und `openImpl(file, busy)` wartet auf `busy` statt auf das spätere `inflight`.

- [ ] **Step 1: Failing Unit-Tests** in `frames.test.ts`:
  - `nearestFrameIndex` mit `frameTimesS=[0,0.0167,0.0333,0.05]`: 0,024 → 1; 0,026 → 2; -1 → 0; 99 → 3; ohne `frameTimesS` bei 60 fps: 0,5 → 30.
  - `playerToMediaTime(8, 8, 1)` → 1 (Zeitlupe 8× gestreckt); `playerToMediaTime(2, NaN, 4)` → 2; `mediaToPlayerTime(1, 8, 1)` → 8.
  - `setRangeStart({startIndex:0,endIndex:50,…}, 60, 100)` → `{startIndex:60,endIndex:99}`; `setRangeStart(…, 99, 100)` → `{startIndex:98,endIndex:99}`; `setRangeEnd({startIndex:40,endIndex:99,…}, 10, 100)` → `{startIndex:0,endIndex:10}`; `setRangeEnd(…, 0, 100)` → `{startIndex:0,endIndex:1}`.
  In `demux.test.ts`: `frameTimesS` für `ball-bframes.mp4` ist aufsteigend, beginnt bei 0, Länge = frameCount. In `render.test.ts`: onProgress liefert Stufen in Reihenfolge `background` → `motion` → `compose` (ohne Cache) bzw. nur `compose` (Cache-Treffer). In `project-preview.test.ts` (Fake-Engine): `stage` wird gesetzt und nach Ende `null`. In `tests/e2e/engine.spec.ts`: `open() direkt nach render() hängt nicht` – render starten, sofort zweimal `open()` mit verschiedenen Dateien, beide Promises lösen innerhalb 10 s auf.
- [ ] **Step 2:** Tests laufen → FAIL.
- [ ] **Step 3:** Implementieren. Worker meldet beim Öffnen `stage:'open'` nicht nötig (Öffnen hat keinen Fortschritt) – `Project` setzt `stage='open'` selbst während `load()`.
- [ ] **Step 4:** `npm test` und `npx playwright test engine decode` → PASS.
- [ ] **Step 5:** Commit `feat: Rechenschritt und Bild-Zeitstempel aus der Engine; Zeit-/Bereichshelfer; open() wartet korrekt (A)`.

---

### Task 4: Rechen-Anzeige und Startseite

**Files:**
- Create: `src/ui/components/BusyOverlay.svelte`, `tests/e2e/busy.spec.ts`
- Modify: `src/ui/Start.svelte`, `src/App.svelte`, `tests/e2e/start.spec.ts`

**Interfaces:**
- Consumes: `Project.stage`, `Project.progress`, `Project.rendering`, `Project.loading`, `Project.exporting` (Task 3).
- Produces:
  - `BusyOverlay.svelte` Props `{ active: boolean; title: string; step?: string; progress?: number /* 0..1, undefined = unbestimmt */ }`; erscheint erst, wenn `active` 300 ms ununterbrochen true ist; `role="status"`, `data-testid="busy"`; Karte mittig, Fortschrittsbalken Akzent.
  - `export const BUSY_TEXT = { open: 'Video wird geöffnet …', preview: 'Bild wird berechnet …', export: 'Export wird erstellt …' }` und `export const STAGE_TEXT: Record<RenderStage,string> = { open:'Video lesen', background:'Hintergrund ermitteln', motion:'Kamerabewegung prüfen', compose:'Bild zusammensetzen' }` in `project.svelte.ts`.
  - Startseite: Titel „Stroboskop“, Untertitel, zwei Kacheln (`data-testid="pick-camera"` mit Icon camera „Video aufnehmen“; `data-testid="pick-file"` mit Icon folder „Video auswählen“). `App.svelte` hält zwei versteckte Eingabefelder: `accept="video/*" capture="environment"` und `accept="video/*"`; `onpick(kind: 'camera' | 'file')`. Beim Laden: BusyOverlay mit `BUSY_TEXT.open`. Fehler als `Notice`.

- [ ] **Step 1: Failing E2E** `busy.spec.ts`: Fixture `ball-60.mp4` laden, Modus mehrfach schnell wechseln → `[data-testid=busy]` erscheint höchstens einmal sichtbar und ist 5 s nach dem letzten Wechsel nicht mehr sichtbar. Zweiter Test: Fixture `ball-240.mp4` laden (erster Render mit Median-Hintergrund dauert > 300 ms) → `busy` wird sichtbar und enthält „Bild wird berechnet“; nach Abschluss verschwindet es. `start.spec.ts`: beide Kacheln sichtbar; `pick-file` öffnet Dateiwahl (Playwright `filechooser`-Event), das Eingabefeld hinter `pick-camera` hat `capture="environment"`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat: Rechen-Anzeige und neue Startseite (aufnehmen/auswählen)`.

---

### Task 5: Arbeitsbereich-Gerüst (Kopfleiste, Phasen, Layout, Miniaturleiste)

**Files:**
- Create: `src/ui/components/Filmstrip.svelte`, `tests/e2e/layout.spec.ts`
- Modify: `src/ui/profi/ProfiView.svelte`; Delete: `src/ui/components/PositionStrip.svelte` (ersetzt durch Filmstrip; Aufrufer anpassen)

**Interfaces:**
- Consumes: `Segmented`, `Icon`, `BusyOverlay`, Tokens (Task 1, 4).
- Produces:
  - `ProfiView` Kopfleiste: Projektname; `Segmented` mit Phasen `video`(Icon video), `bild`(strobe), `massstab`(ruler, disabled), `messen`(pin, disabled), `auswerten`(chart, disabled); rechts `.btn` „Neu“ (Icon plus) und `.btn.primary` „Teilen“ (Icon share, `data-testid="open-export"`, deaktiviert wie bisher Export). Start-Phase nach dem Laden: `video`.
  - Hinweise (Fehler, Bildgenauigkeit) als `Notice` unter der Kopfleiste; die fps-Unsicherheit wandert in die Video-Phase (Chip, Task 7).
  - Layout-Klassen für Phasen: `.work` (Grid: Bühne `1fr`, Spalte `300px`, Abstand 12 px, Innenabstand 12 px); unter 900 px Breite eine Spalte, Bühne `min-height: 50dvh`, Spalte darunter scrollbar. Die Phasen-Komponenten rendern ihre Bühne und Spalte selbst in `<div class="work">`.
  - `BusyOverlay` über der Bühne: `active = project.rendering || project.exporting`, Titel `BUSY_TEXT.preview` bzw. `.export`, Schritt `STAGE_TEXT[project.stage]`.
  - `Filmstrip.svelte` Props wie bisher `PositionStrip` (`indices, thumbs, thumbsKey, excluded, current, picking, ontap`); feste Höhe 64 px, horizontal scrollbar, jede Miniatur im Seitenverhältnis ihres Bitmaps (Höhe 52 px, Breite proportional), ausgeschlossene Positionen 35 % Deckkraft, gewähltes Hintergrundbild Rahmen `--acc`, Nummer klein unten links. `data-testid="filmstrip"`, Einträge `data-testid="film-item"`.

- [ ] **Step 1: Failing E2E** `layout.spec.ts`: nach Laden von `ball-60.mp4`: (a) Viewport 1180×820: Spalte rechts neben Bühne (`boundingBox` x-Vergleich); (b) Viewport 820×1180: Spalte unter Bühne, Bühnenhöhe ≥ 0,45 × Viewporthöhe, `document.documentElement.scrollWidth <= 820`; (c) in Phase Bild: jeder `film-item` hat `boundingBox().height >= 40` und liegt vollständig innerhalb `filmstrip` (vertikal); (d) Phasen Maßstab/Messen/Auswerten sind `aria-disabled`/disabled.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren; bestehende E2E-Selektoren (`role=tab`) in `video-tab.spec.ts`, `bild-tab.spec.ts`, `export.spec.ts` auf `role=radio` mit Name bzw. `data-testid` umstellen.
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat: neues Arbeitsbereich-Gerüst mit Phasen-Umschalter und Miniaturleiste`.

---

### Task 6: Phase „Bild“ neu

**Files:**
- Modify: `src/ui/profi/BildTab.svelte`, `src/ui/profi/IntervalControl.svelte` (→ Karte „Zeitabstand“), `src/ui/profi/ThresholdControl.svelte` (→ Karte „Empfindlichkeit“)
- Test: `tests/e2e/bild-tab.spec.ts`

**Interfaces:**
- Consumes: `Card`, `Segmented`, `Switch`, `Icon`, `Filmstrip`, `isMaskedMode` (Task 1, 2, 5), bestehende `stepForDesiredDt`, `deltaT`, `formatDt`, `parseFps`-ähnliches Parsen (Komma).
- Produces (UI-Vertrag, Testselektoren):
  - Karte „Zeitabstand“: `data-testid="dt-value"` (Text `Δt = 0,133 s`, als Button), daneben „n Positionen“; Schieberegler `data-testid="step-slider"` (min 1, max `max(1, endIndex − startIndex)`, Wert = `selection.step`, ändert über `project.setSelection({step})`). Tippen auf `dt-value` zeigt Eingabefeld `data-testid="dt-input"` (inputmode decimal); Enter/Verlassen → `step = stepForDesiredDt(wert, captureFps)`; ungültig → unverändert. Die alten Felder „Abstand“ und „Wunsch-Δt“ entfallen.
  - Karte „Darstellung“: 2×2-Kacheln (Buttons `role="radio"`, Namen Differenz/Aufhellen/Abdunkeln/Transparent).
  - Karte „Empfindlichkeit“ (`data-testid="sensitivity"`): nur wenn `isMaskedMode(mode)`; Regler + „Auto“; Maskenanzeige beim Ziehen wie bisher.
  - `<details data-testid="more">` „Mehr …“ (zu): Weiche Kante (Regler), Verlauf (Regler), „Spätere oben“ (`Switch`, nur bei Differenz), Hintergrund (`Segmented`: Automatisch=`median`, Erstes, Letztes, Gewählt – „Gewählt“ aktiviert den Bild-wählen-Modus; Hinweis „Bild in der Leiste antippen“), Bereich zeichnen / löschen, Drehen, Zuschneiden / Zuschnitt zurücksetzen.
  - Hinweise (Kamera bewegt, zu wenige Positionen, Δt ungleichmäßig) als `Notice` oben in der Spalte.
  - Unten: `Filmstrip` über die volle Breite unter `.work`.

- [ ] **Step 1: Failing E2E-Ergänzungen** in `bild-tab.spec.ts`: (a) `sensitivity` sichtbar bei Differenz/Aufhellen/Abdunkeln, nicht bei Transparent; (b) in Aufhellen ändert Ziehen der Empfindlichkeit das Vorschaubild (Canvas-Pixel-Hash vorher ≠ nachher, wie bestehender Hash-Helfer); (c) `dt-value` antippen, `0,2` eingeben, Enter → Text `Δt = 0,200 s` bei `ball-60.mp4` (60 fps → Schritt 12); (d) `more` ist anfangs zu; (e) keine sichtbaren `input[type=radio]`, `input[type=checkbox]`, `select` auf der Seite (`page.locator('input[type=radio]:visible, input[type=checkbox]:visible, select:visible')` hat Anzahl 0). Bestehende Bild-Tab-Tests an neue Selektoren anpassen.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren (Optik nach Entwurf).
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat: Phase Bild im neuen Design (Zeitabstand, Darstellung, Empfindlichkeit, Mehr)`.

---

### Task 7: Phase „Video“ mit Player und Anfang/Ende

**Files:**
- Create: `src/ui/components/VideoPlayer.svelte`, `src/ui/components/Timeline.svelte`
- Modify: `src/ui/profi/VideoTab.svelte`, `src/lib/state/project.svelte.ts` (Object-URL), Delete: `src/ui/components/RangeSlider.svelte` (falls nicht mehr benutzt)
- Test: `tests/e2e/video-tab.spec.ts`

**Interfaces:**
- Consumes: `frameTimeS`, `nearestFrameIndex`, `playerToMediaTime`, `mediaToPlayerTime`, `setRangeStart`, `setRangeEnd` (Task 3); `Card`, `Icon`, `Viewer`, `CropEditor` (bestehend).
- Produces:
  - `Project.videoUrl: string | null` – Object-URL von `file`, beim Laden neu erzeugt, die alte per `URL.revokeObjectURL` freigegeben (auch in `dispose`).
  - `VideoPlayer.svelte` Props `{ src: string; rotation: 0|90|180|270; mediaDurationS: number; currentTimeS: number /* bindable, Medien-Zeit */; playing: boolean /* bindable */; rate: number }`; `<video playsinline muted preload="auto">`; intern Umrechnung über `playerToMediaTime`/`mediaToPlayerTime` mit `video.duration`; Tippen aufs Video = Abspielen/Pause; Play-Symbol mittig bei Pause; Drehung per CSS-Transform (Seitenverhältnis bei 90/270 korrekt). `data-testid="player"`.
  - `Timeline.svelte` Props `{ thumbs: ImageBitmap[]; durationS: number; currentTimeS: number; startS: number; endS: number; onseek(t:number):void; onstart(t:number):void; onend(t:number):void }`; Miniaturen (bestehende 8 `project.thumbs`, gleichmäßig gestreckt), abgedunkelte Bereiche außerhalb, Markierungen (`data-testid="mark-start"`/`"mark-end"`, ziehbar, Pointer-Events), roter Wiedergabekopf (`data-testid="playhead"`, Ziehen/Tippen auf die Leiste = Spulen). Darunter Zeiten: `0,00 s`, `Auswahl a – b s (d s)` (`data-testid="range-text"`), Gesamtdauer.
  - VideoTab-Spalte: Karte „Video“ (Chips: `formatFps` + „Bilder/s ✓“ grün bei `fpsCertain`, sonst Chip warn „Bildrate prüfen“ → klappt das bestehende Aufnahme-fps-Feld auf; Auflösung `B × H`; Dauer; „Zeitlupe“-Chip bei `slowMotion`), Karte „Bereich festlegen“ (Buttons `data-testid="set-start"` „Anfang hier“, `"set-end"` „Ende hier“; darunter Bild zurück, Abspielen/Pause, Bild vor, Tempo 1×→½×→¼×), Karte „Ausrichtung“ (Drehen; Zuschneiden: pausiert, holt aktuelles Bild per `project.engine.thumbnails([index], 1280, 'trim')`, zeigt es im `Viewer` mit aktivem `CropEditor`; Übernehmen/Abbrechen kehrt zum Player zurück; Zuschnitt zurücksetzen), primär „Weiter zu Bild ›“ (wechselt Phase; ProfiView reicht `ontab` herunter).
  - „Anfang hier“: `project.setSelection(setRangeStart(project.selection, nearestFrameIndex(info, currentTimeS), info.frameCount))`; „Ende hier“ analog. Ziehen einer Markierung ruft dasselbe mit der Zeit der Markierung.
  - Einzelbild: pausieren, `currentTimeS = frameTimeS(info, nearestFrameIndex(info, currentTimeS) ± 1)` (geklemmt).

- [ ] **Step 1: Failing E2E** in `video-tab.spec.ts` (Fixture `ball-60.mp4`): (a) nach dem Laden ist Phase Video aktiv und `player` sichtbar; (b) Wiedergabekopf per Klick auf 50 % der Timeline setzen → `set-start` → `range-text` beginnt mit dem halben Videowert (±1 Bild), Positionsanzahl kleiner als vorher; (c) danach Timeline-Klick auf 25 % + `set-end` → Anfang wurde auf 0 zurückgesetzt (`range-text` beginnt mit `0,00`); (d) „Bild vor“ zweimal → Medienzeit +2/60 s (über `data-time`-Attribut am Player prüfen, das `currentTimeS` spiegelt); (e) Chip enthält „60 Bilder/s“. Alte RangeSlider-Tests ersetzen.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat: Phase Video mit Abspielen, Zeitleiste und Anfang/Ende per Tippen`.

---

### Task 8: Export-Fenster neu mit Rückmeldung

**Files:**
- Create: `src/ui/components/Toast.svelte`, `src/lib/state/toast.svelte.ts`
- Modify: `src/ui/ExportDialog.svelte`, `src/lib/export/image.ts` (`shareOrDownload`), `src/App.svelte` (Toast einhängen)
- Test: `tests/unit/export-image.test.ts`, `tests/e2e/export.spec.ts`

**Interfaces:**
- Produces:
  - `shareOrDownload(...)`: `Promise<'shared' | 'downloaded' | 'cancelled'>` (AbortError → `'cancelled'`, sonst wie bisher).
  - `toast.svelte.ts`: `export const toast = { message: string | null; show(text: string, ms = 2500): void }` (Runes-Objekt; neuere Meldung ersetzt ältere).
  - `Toast.svelte`: unten mittig, Karte mit Icon check, `role="status"`, `data-testid="toast"`.
  - ExportDialog als Sheet im neuen Design: Format `Segmented` (PNG/JPEG), Qualität (nur JPEG), Größe `Segmented` (Original/Arbeitsblatt), Infozeile `Switch`; Fortschritt über `BusyOverlay`-Stil im Dialog; Schritt 1 „Bild erzeugen“, Schritt 2 primär „Teilen / Sichern“. Ergebnis `'shared'` → `toast.show('Gespeichert ✓')` + `onclose()`; `'downloaded'` → `toast.show('Heruntergeladen ✓')` + `onclose()`; `'cancelled'` → nichts. Fehler → `Notice` im Dialog, Dialog bleibt.

- [ ] **Step 1: Failing Tests**: Unit `shareOrDownload` liefert `'shared'` (Mock `navigator.share` resolve), `'cancelled'` (reject AbortError), `'downloaded'` (kein `canShare`). E2E `export.spec.ts`: Export erzeugen → „Teilen / Sichern“ (Edge ohne Datei-Teilen → Download) → `toast` mit „Heruntergeladen ✓“ sichtbar und Dialog geschlossen; Download-Event wird ausgelöst.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` und `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat: Export-Fenster im neuen Design mit Rückmeldung und automatischem Schließen`.

---

### Task 9: Sichtprüfung hell/dunkel, Abnahme-Checkliste, Aufräumen

**Files:**
- Create: `tests/e2e/screens.spec.ts`
- Modify: `docs/abnahme-plan1.md` (→ neue Abschnitte), `package.json` nur falls ein Skript `test:screens` sinnvoll ist

**Interfaces:**
- Consumes: alles Vorherige.

- [ ] **Step 1:** `screens.spec.ts`: für `light` und `dark`, Viewport 1180×820 und 820×1180: Startseite, Phase Video, Phase Bild (Mehr aufgeklappt), Export-Fenster → `page.screenshot({ path: 'test-results/screens/<modus>-<format>-<seite>.png' })`. Zusätzlich je Seite: kein Element mit berechneter Schrift, die „Times“ enthält (`page.evaluate` über alle sichtbaren Elemente); kein sichtbarer Text mit Kontrast < 3:1 zwischen `color` und dem effektiven Hintergrund der nächsten Karte/Seite (einfacher Helfer: relative Luminanz, nur für Elemente mit eigenem Text).
- [ ] **Step 2:** Lauf → ggf. FAIL; gefundene Stellen beheben, bis PASS. Screenshots selbst ansehen (Read-Tool) und offensichtliche Darstellungsfehler (abgeschnitten, überlappend, falsche Farbe im Dunkelmodus) beheben.
- [ ] **Step 3:** `docs/abnahme-plan1.md` um Abschnitt „Plan 1b“ ergänzen: hell/dunkel umschalten (Einstellungen → Anzeige & Helligkeit), Startseite „Video aufnehmen“ öffnet Kamera, Video abspielen + Anfang/Ende, Einzelbild-Tasten, Rechen-Anzeige bei 4K, Empfindlichkeit in Aufhellen/Abdunkeln, Export „Gespeichert ✓“ und Schließen, Abbruch im Teilen-Menü, Hochformat.
- [ ] **Step 4:** `npm test`, `npm run test:e2e`, `npm run check` → alles grün.
- [ ] **Step 5:** Commit `test: Sichtprüfung hell/dunkel; Abnahme-Checkliste Plan 1b`.
