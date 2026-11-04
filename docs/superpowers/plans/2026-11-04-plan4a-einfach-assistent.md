# Plan 4a – Modus „Einfach“ (Schritt-Assistent) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Startseite „Einfach | Erweitert“ und ein fünfstufiger Assistent (Video → Zuschneiden → Bild → Markieren → Teilen) für Schüler.

**Architecture:** Neue Oberfläche `src/ui/einfach/` auf demselben `Project` wie der Modus „Erweitert“; reine Schritt-/Abbildungslogik in `src/lib/einfach/steps.ts`; Wiederverwendung von VideoPlayer, Timeline, Viewer, CropEditor, StageMeasure, `renderExportImage`, `shareOrDownload`. Keine Änderung an der Rechenlogik.

**Tech Stack:** TypeScript, Svelte 5 (Runes), Vite, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-04-plan4a-einfach-assistent-design.md` („§“).

## Global Constraints
- Deutsch, Dezimalkomma, „−“; Tippflächen ≥ 44 px, Bedientexte im Assistenten ≥ 15 px; Design-Tokens aus `src/app.css` (hell/dunkel automatisch); keine Browser-Selects, kein `window.confirm`; keine neuen npm-Abhängigkeiten.
- Texte exakt wie in der Spec (Anführungszeichen dort = sichtbarer Text).
- Bestehende Tests grün (angepasst nur, wo die neue Startseite einen Klick „Erweitert“ verlangt); neue Tests ohne `waitForTimeout`.
- Modelle: Umsetzer sonnet; Task-Prüfung sonnet; Gesamtprüfung opus.

## Review Focus
1. Video mit unsicherer Bildrate (`info.fpsCertain === false`, z. B. Zeitlupe/Bildschirmaufnahme): Δt wäre falsch, ohne dass der Schüler es merkt → Schritt Video zeigt den Hinweis `FPS_UNCERTAIN_TEXT` und ein Feld „Aufnahme-fps“ wie im Modus „Erweitert“ (Task 3, E2E mit `tests/fixtures/ball-vfr.mp4`: Hinweis und Feld „Aufnahme-fps“ sichtbar; Eingabe „30“ ändert die Δt-Anzeige in Schritt Bild).
2. Anfang/Ende so eng, dass < 2 Positionen entstehen (`project.selectionError`): „Weiter“ in Schritt 3 und 4 deaktiviert, Hinweis `selectionError` sichtbar; Teilen nie mit Fehlerbild (Task 2 `canAdvance`, Task 5).
3. Zurückspringen nach dem Markieren und Ändern von Abstand/Anfang/Ende: Punkte gehören zu Positionsnummern; Anzeige „3 von 7 markiert“ muss die aktuelle Positionsliste zählen, Markieren startet an der ersten offenen Position (Task 6, E2E).
4. Beenden/„Neues Video“ während einer laufenden Vorschau oder Teilen-Vorbereitung: keine Fehlermeldung, kein hängender Busy-Zustand, Export-Sperre aufgehoben (Task 1 neues Project, Task 7 onDestroy-Abbruch).
5. Hochformat (iPad 820×1180): Bild oben, Bedienung darunter, nichts abgeschnitten, Fußzeile sichtbar (Task 8 Screenshots + Layout-Test).

---

### Task 1: Startseite mit Modus-Wahl, Bestätigen-Dialog, „‹ Start“ im Modus „Erweitert“ (§2)
**Files:** Create `src/ui/ModeStart.svelte`, `src/ui/components/ConfirmDialog.svelte`; Modify `src/App.svelte`, `src/ui/Start.svelte`, `src/ui/profi/ProfiView.svelte`, `tests/e2e/helpers.ts` und alle E2E-Dateien, die direkt nach `page.goto('/')` ein Video laden; Test `tests/e2e/start.spec.ts`.
- **Interfaces (produziert):**
  - `ConfirmDialog.svelte` Props `{ title: string; text?: string; confirmLabel: string; onconfirm: () => void; oncancel: () => void }` – modal wie ExportDialog (Backdrop, Fokus, Escape = abbrechen), Knöpfe „Abbrechen“ und `confirmLabel` (danger-Farbe).
  - `App.svelte`: `mode = $state<'start' | 'einfach' | 'erweitert'>('start')`; `project` wird `$state`; `home()` = `project.dispose(); project = new Project(); mode = 'start'`. Die beiden versteckten Datei-Eingabefelder bleiben in allen Modi im DOM.
  - `ModeStart.svelte` Props `{ onchoose: (m: 'einfach' | 'erweitert') => void }`; Kacheln `data-testid="mode-einfach"` / `"mode-erweitert"`, Texte laut §2; Installationshinweis (bisher in `Start.svelte`) wandert hierher.
  - `Start.svelte` (Videoauswahl „Erweitert“) erhält Prop `onhome: () => void` und Knopf „‹ Start“ oben links.
  - `ProfiView.svelte` erhält Prop `onhome: () => void`; Kopfzeile links Knopf „‹ Start“ (`data-testid="home"`); mit geladenem Video erst `ConfirmDialog` title „Projekt verwerfen?“, confirmLabel „Verwerfen“.
  - `tests/e2e/helpers.ts`: neue Funktion `chooseMode(page, m: 'einfach' | 'erweitert')`; `openPhase` ruft nach `goto` `chooseMode(page,'erweitert')`.
- [ ] Failing E2E `start.spec.ts`: Startseite zeigt „Einfach“ und „Erweitert“ (keine Videokacheln); „Erweitert“ → `pick-file` sichtbar → „‹ Start“ zurück; Video laden → Reiter-Ansicht → `home` → Dialog „Projekt verwerfen?“ → „Abbrechen“ bleibt, „Verwerfen“ zeigt Startseite; nach Neuladen der Seite wieder Startseite (keine gemerkte Wahl).
- [ ] Implementieren; übrige E2E-Dateien mit `chooseMode(page,'erweitert')` nach `goto` anpassen.
- [ ] `npm test`, `npm run check`, `npx playwright test --project=edge` grün; Commit `feat: Startseite Einfach/Erweitert, Zurück zum Start`.

### Task 2: Schrittlogik (§3, §4.3, §4.4)
**Files:** Create `src/lib/einfach/steps.ts`; Test `tests/unit/einfach-steps.test.ts`.
- **Interfaces (produziert):**
  - `type StepId = 'video' | 'zuschnitt' | 'bild' | 'markieren' | 'teilen'`; `const STEPS: { id: StepId; label: string }[]` mit Labels „Video“, „Zuschneiden“, „Bild“, „Markieren“, „Teilen“ (Anzeige „1 Video“ usw. setzt die UI zusammen).
  - `type Look = 'auto' | 'hell' | 'dunkel'`; `const LOOKS: { id: Look; label: string; hint: string; mode: ComposeMode }[]` = auto „Automatisch“/„passt meistens“/`difference`, hell „Helles Objekt“/„z. B. Ball vor dunkler Wand“/`lighten`, dunkel „Dunkles Objekt“/„z. B. vor heller Wand“/`darken`; `lookOf(mode: ComposeMode): Look` (unbekannt → 'auto').
  - `canAdvance(step: StepId, s: { hasVideo: boolean; selectionError: string | null }): boolean` – video: hasVideo; zuschnitt: true; bild/markieren: `selectionError === null`; teilen: false.
  - `applyEinfachOverlays(m: Measurement): void` – setzt `m.overlays` auf `{ numbers: true, path: true, v: false, a: false, scaleBar: false, dt: false, axes: false, components: false }`.
  - `hasPoints(m: Measurement): boolean` – mindestens ein Punkt in irgendeinem Objekt.
  - `stepInfoText(step: number): string` – `1` → „jedes Bild“, sonst „jedes {n}. Bild“.
- [ ] Failing tests: Abbildung LOOKS (3 Einträge, Modi wie oben, `lookOf('average')==='auto'`); `canAdvance` alle Fälle; `applyEinfachOverlays` auf `createMeasurement()` → nur numbers/path true; `hasPoints` leer/gesetzt; `stepInfoText(1)`, `stepInfoText(3)==='jedes 3. Bild'`.
- [ ] Implementieren; Commit `feat: Schrittlogik für den Modus Einfach`.

### Task 3: Assistent-Rahmen und Schritt Video (§3, §4.1)
**Files:** Create `src/ui/einfach/EinfachView.svelte`, `src/ui/einfach/StepVideo.svelte`, `src/ui/einfach/einfach.css` (oder Styles in den Komponenten); Modify `src/App.svelte`; Test `tests/e2e/einfach.spec.ts`.
- **Interfaces:** `EinfachView` Props `{ project: Project; onpick: (k: 'camera' | 'file') => void; onhome: () => void }`; interner Zustand `step = $state<StepId>('video')`, `reached` (höchster erreichter Index). Kopfzeile: „✕ Beenden“ (`data-testid="einfach-quit"`; mit Video `ConfirmDialog` title „Beenden?“ text „Das Bild geht verloren.“ confirmLabel „Beenden“), Fortschrittsleiste als `<nav aria-label="Fortschritt">` mit Knöpfen „1 Video“ … „5 Teilen“ (`aria-current="step"` am aktuellen; erreichte antippbar, spätere `disabled`). Fußzeile: „‹ Zurück“ bzw. in Schritt 1 „Anderes Video“ (= `onpick('file')`), „Weiter ›“ (`data-testid="einfach-next"`, `disabled={!canAdvance(...)}`); in Schritt 5 rechts „Neues Video“ (Task 7). Beim Eintritt in den Modus: `applyEinfachOverlays(project.measure)`; bei neuem Video (`project.info` wechselt): Schritt Video, `reached` zurücksetzen, `applyEinfachOverlays` erneut. Busy-Overlay und Fehler-Notice wie ProfiView. Unbekannte Schritte 2–5 zeigen zunächst einen Platzhalter, den Tasks 4–7 ersetzen.
- `StepVideo` Props `{ project: Project; onpick }`: ohne Video Kacheln „Video aufnehmen“ / „Video wählen“ (`data-testid` `einfach-pick-camera` / `einfach-pick-file`); mit Video: VideoPlayer, Satz „Wo beginnt und endet die Bewegung?“, `Timeline` (Ziehen wie VideoTab), Kacheln „⏮ Anfang hier“ (`set-start`), „▶ Abspielen“/„⏸ Pause“, „Ende hier ⏭“ (`set-end`). Logik (seek, setStartAt/EndAt, dragStart/End) aus `VideoTab.svelte` übernehmen; wenn sinnvoll gemeinsame Hilfsfunktionen nach `src/lib/frames.ts` ziehen statt zu kopieren. Bei `!info.fpsCertain && project.captureFpsOverride === null`: Notice mit `FPS_UNCERTAIN_TEXT` und Feld „Aufnahme-fps“ (Logik wie VideoTab `commitFps`).
- [ ] Failing E2E `einfach.spec.ts`: Einfach → Fortschritt „1 Video“ aktuell, „Weiter“ deaktiviert → Video laden → „Weiter“ aktiv; „Anfang hier“/„Ende hier“ ändern die Markierungen; „Weiter“ → Schritt 2 aktuell, „1 Video“ antippbar führt zurück; Beenden → Dialog „Beenden?“ → „Beenden“ → Startseite; `ball-vfr.mp4` → Hinweis `FPS_UNCERTAIN_TEXT` und Feld „Aufnahme-fps“ sichtbar, `ball-60.mp4` → kein Hinweis.
- [ ] Implementieren; Tests grün; Commit `feat: Assistent-Rahmen und Schritt Video`.

### Task 4: Schritt Zuschneiden (§4.2)
**Files:** Create `src/ui/einfach/StepCrop.svelte`; Modify `EinfachView.svelte`; Test `tests/e2e/einfach.spec.ts`.
- Beim Öffnen Standbild des Anfangsbilds (`project.frameImage(project.selection.startIndex)`) laden (Folgenummer gegen Überholen, Bitmap in `onDestroy` schließen), `Viewer` + `CropEditor` mit Entwurf = `project.crop ?? ganzes Bild`; Satz „Ziehe den Rahmen um den Bereich der Bewegung.“; Kacheln „Ganzes Bild“ (Entwurf = ganzes Bild) und „↻ Drehen“ (`project.rotation` +90°). Übernahme des Entwurfs in `project.crop` (ganzes Bild → `null`) und `project.requestPreview()` beim Verlassen des Schritts (Weiter, Zurück, Fortschrittsleiste) – Prop `bind:this` mit Methode `commit(): void`, die EinfachView vor jedem Schrittwechsel aufruft.
- [ ] Failing E2E: Rahmen an einer Ecke ziehen → Weiter → Schritt Bild zeigt Vorschau mit kleinerem Seitenverhältnis (`viewer-canvas` `data-*`-Attribut oder Bühnengröße); „Ganzes Bild“ → Weiter → `project.crop` null (z. B. Pixelgröße der Vorschau wie Video).
- [ ] Implementieren; Commit `feat: Schritt Zuschneiden`.

### Task 5: Schritt Bild (§4.3)
**Files:** Create `src/ui/einfach/StepBild.svelte`; Modify `EinfachView.svelte`; Test `tests/e2e/einfach.spec.ts`.
- Vorschau wie BildTab (Viewer mit `project.preview`), große Anzeige „Δt = {formatDt(deltaT(step, captureFps))}“ (`data-testid="einfach-dt"`), grau „{positionsCount} Positionen · {stepInfoText(step)}“, Regler (Bereich 1…`maxStep` wie IntervalControl, `project.setSelection({ step })`, Beschriftung „dichter“/„weiter“), Überschrift „Darstellung“ und drei Kacheln aus `LOOKS` (`role="radio"`, gewählt = `lookOf(project.compose.mode)`; Wahl setzt `project.compose.mode` und `project.requestPreview()`). Bei `project.selectionError` Notice mit dem Text.
- [ ] Failing E2E: Regler verschieben → `einfach-dt` ändert sich (0,100 s bei `ball-60.mp4` Standard laut start.spec, danach anderer Wert); „Helles Objekt“ → `aria-checked=true`, Vorschau neu (Canvas-Pixelprobe ändert sich oder `data-settings`-Schlüssel).
- [ ] Implementieren; Commit `feat: Schritt Bild mit großer Δt-Anzeige`.

### Task 6: Schritt Markieren (§4.4)
**Files:** Create `src/ui/einfach/StepMarkieren.svelte`; Modify `EinfachView.svelte`; Test `tests/e2e/einfach.spec.ts`.
- Bühne `StageMeasure` (showCalibration=false, showAxes=false) mit Tipp-/Zieh-Logik wie `MessenTab.svelte` (aktuelle Position, `nextOpenPosition`, Hinweistext); nur aktives Objekt 1, keine Objekt-Chips. Rechts: „Position {n} antippen“ bzw. „Alle Positionen markiert“, Kacheln „‹ Vorige“ / „Nächste ›“, Kachel „✨ Vorschlagen“ mit Untertitel „App setzt alle Punkte, du korrigierst“ (`project.suggestPositions()`, während `project.suggesting` „Wird berechnet …“), grau „{gesetzt} von {Positionen} markiert“ (gezählt über `project.measureIndices`), grau „Punkte, Nummern und Bahn werden automatisch eingezeichnet.“, Knopf „Alle Punkte löschen“ (nur mit Punkten; `ConfirmDialog` title „Alle Punkte löschen?“ confirmLabel „Löschen“ → `project.clearPoints()`).
- Gemeinsame Logik mit MessenTab (Positionswahl, Tipp setzt Punkt und springt weiter) in eine Hilfsdatei `src/ui/profi/measureFlow.svelte.ts` ziehen, wenn sie sonst > 20 Zeilen dupliziert würde.
- [ ] Failing E2E: Bühne antippen → „1 von N markiert“, Hinweis springt auf „Position 1 antippen“; „Vorschlagen“ → „N von N markiert“; zurück zu Bild, Abstand ändern, wieder Markieren → Zähler passt zur neuen Positionszahl; „Alle Punkte löschen“ → Dialog → „0 von N markiert“.
- [ ] Implementieren; Commit `feat: Schritt Markieren mit Punkten und Bahn`.

### Task 7: Schritt Teilen (§4.5)
**Files:** Create `src/ui/einfach/StepTeilen.svelte`, `src/lib/export/errors.ts`; Modify `src/ui/ExportDialog.svelte` (nutzt `exportErrorText`), `EinfachView.svelte`; Tests `tests/unit/export-errors.test.ts`, `tests/e2e/einfach.spec.ts`.
- **Interfaces:** `exportErrorText(e: unknown): string` (aus `ExportDialog.message` verschoben, gleiche Texte).
- Beim Öffnen einmal vorbereiten: `project.beginExport()`, `renderExportImage(project, { format: 'jpeg', quality: 0.9, size: 'worksheet', infoLine: true, overlays: hasPoints(project.measure) }, () => mySeq === seq)`, im `finally` `project.endExport()`; `onDestroy`: seq erhöhen, laufenden Render mit `project.engine.cancel()` abbrechen, `project.strobeCache.clear()`. Vorschau = Objekt-URL des fertigen Blobs (freigeben). Knopf `data-testid="einfach-share"`: „Wird vorbereitet …“ (deaktiviert) → „⬆ Bild teilen“; Klick ruft direkt `shareOrDownload(blob, exportFileName(project.name, 'jpg'))`; Toasts „Gespeichert“/„Heruntergeladen“; `cancelled` bleibt; Fehler als Notice mit „Erneut versuchen“. Texte „Mit Infozeile „Δt = …“ unten im Bild“ und „In Fotos sichern, per AirDrop an die Lehrkraft, in Dateien …“. Fußzeile rechts „Neues Video“ (`ConfirmDialog` wie Beenden, confirmLabel „Neues Video“ → `onpick('file')` – der neue Ladevorgang setzt den Assistenten auf Schritt 1).
- [ ] Failing unit: `exportErrorText` für VideoError, NotAllowedError, sonst „Export fehlgeschlagen.“.
- [ ] Failing E2E: Durchlauf Video → Weiter ×3 → Vorschlagen → Weiter → Knopf wird „⬆ Bild teilen“ → Download `ball-60_stroboskop.jpg` mit JPEG-Signatur `FF D8 FF`; ohne Punkte ebenfalls Download; Zurück während „Wird vorbereitet …“ → Schritt Markieren, danach rendert die Vorschau (Sperre aufgehoben).
- [ ] Implementieren; volle Tests grün; Commit `feat: Schritt Teilen im Modus Einfach`.

### Task 8: Sichtprüfung, Hochformat, Checkliste
**Files:** Modify `tests/e2e/screens.spec.ts`, `tests/e2e/layout.spec.ts`; Create `docs/abnahme-plan4a.md`.
- Screenshots hell/dunkel, quer (1180×820) und hoch (820×1180) für Startseite und Schritte 1, 3, 4, 5; ansehen und Abweichungen von der Spec beheben (Hochformat: Bild oben, Bedienung darunter, Fußzeile sichtbar ohne Scrollen der Seite; Querformat: Bild links).
- Layout-Test: in beiden Ausrichtungen liegt `einfach-next` vollständig im Viewport; keine waagerechte Seitenrolle.
- `docs/abnahme-plan4a.md` (iPad: Startseite, Video aufnehmen, Anfang/Ende, Zuschneiden, Darstellung wechseln, Markieren mit Lupe, Teilen in Fotos/AirDrop, Beenden, Hochformat).
- [ ] `npm test`, `npm run check`, `npx playwright test --project=edge`, `npm run build` grün; Commit `test: Sichtprüfung Plan 4a; docs: Abnahme-Checkliste Plan 4a`.
