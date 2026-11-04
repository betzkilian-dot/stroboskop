# Plan 2 – Maßstab, Messen, Auswerten – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phasen Maßstab, Messen und Auswerten freischalten: Kalibrierung, Positionen (manuell + „Vorschlagen“), Einblendungen (Nummern, Bahn, v/a-Pfeile, Legende, Maßstabsbalken, Δt) auf Bühne und im Export, Messtabelle und CSV.

**Architecture:** Reine Logik in `src/lib/physics/` (Kinematik), `src/lib/measure/` (Modell, Kandidaten, Zuordnung), `src/lib/overlay/` (Szene + Zeichnen, identisch für Bühne und Export), `src/lib/export/csv.ts`. Der Vorschau-Render liefert zusätzlich Kandidaten je Bild. UI in neuen Svelte-Tabs; der Viewer bekommt ein Werkzeug-Interface und eine Zeichen-Rückruffunktion.

**Tech Stack:** TypeScript, Svelte 5 (Runes), Vite, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-04-plan2-messen-anzeigen-design.md` (Abschnittsnummern unten = „§“).

## Global Constraints

- Alle Bildkoordinaten in **Video-Pixeln** (Anzeigeorientierung, vor Zuschnitt/Drehung).
- Texte deutsch, Zahlen mit Dezimalkomma (`formatNumber` aus `src/lib/format.ts`), Minus als „−“ (U+2212) in Tabelle.
- Design: Tokens aus `src/app.css`, Komponenten `Card`, `Segmented`, `Switch`, `Icon`, `Notice`; Tippflächen ≥ 44 px; keine Browser-Standard-Radios/Selects.
- Farben (§3): Objekte `#e2382b`, `#1f9d55`, `#0a8fb0`; v `#007aff`; a `#af52de`; unsicher `#ff9500`.
- Zeitbasis tᵢ = (Bildindexᵢ − Bildindex₀) / `project.captureFps`.
- Bestehende Tests (`npm test`, `npm run check`, `npx playwright test --project=edge`) bleiben grün.
- Modellwahl Subagenten: Standard **sonnet**; Task 3 (Kandidaten/Zuordnung) und die Abschluss-Gesamtprüfung mit dem Standardmodell (opus).

## Review Focus

1. Zuschnitt + Drehung 90/270: Punkte, Pfeile und Lupe müssen auf Bühne und Export exakt am Objekt sitzen → Test in Task 4 (`exportMap` mit Drehung) und Task 6 (Lupe nutzt `viewerToVideo`).
2. Zeitabstand ändern nach dem Messen: Punkte auf nicht mehr gewählten Bildern verschwinden aus Tabelle/Bild, kommen bei Rückkehr wieder → Test in Task 2 (`seriesFor`).
3. Maßstab mit Länge 0/leer oder zwei fast gleichen Punkten: keine Division durch 0, Pfeile/Tabelle zeigen „Maßstab fehlt“ → Test in Task 1 (`metersPerPixel` → null).
4. Neues Video geladen: Messung und Maßstab zurückgesetzt, keine Punkte aus altem Video → Test in Task 5.
5. „Vorschlagen“, während die Vorschau noch rechnet oder zu anderen Einstellungen gehört: wartet und nutzt nur Kandidaten mit passendem `settingsKey` → Test in Task 5.

---

### Task 1: Kinematik (`physics`)

**Files:**
- Create: `src/lib/physics/kinematics.ts`
- Test: `tests/unit/kinematics.test.ts`

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`
  - `type Unit = 'mm' | 'cm' | 'm'`; `toMeters(v: number, u: Unit): number`
  - `interface Calibration { a: Pt; b: Pt; length: number; unit: Unit }`
  - `interface Axes { originAtFirst: boolean; yUp: boolean; alignToScale: boolean }`
  - `metersPerPixel(c: Calibration | null): number | null` (null bei |b−a| < 4 px, length ≤ 0, nicht endlich)
  - `interface SamplePoint { nr: number; frame: number; t: number; px: Pt }`
  - `interface Row { nr: number; frame: number; t: number; x: number | null; y: number | null; s: number | null; vx: number | null; vy: number | null; v: number | null; ax: number | null; ay: number | null; a: number | null }`
  - `toWorld(p: Pt, origin: Pt, c: Calibration, axes: Axes): Pt` (Meter)
  - `computeRows(samples: SamplePoint[], origin: Pt, c: Calibration | null, axes: Axes): Row[]` – samples nach nr aufsteigend, nur gemessene; ohne gültigen Maßstab sind x..a null.
  - `interface Arrow { from: Pt; to: Pt }` (Video-Pixel)
  - `type ArrowPos = 'start' | 'mid' | 'end'`
  - `velocityArrows(samples: SamplePoint[], pos: ArrowPos, scaleS: number): Arrow[]`
  - `accelArrows(samples: SamplePoint[], pos: ArrowPos, scaleS2: number): Arrow[]`
  - `maxSpeedPx(samples): number` (px/s), `maxAccelPx(samples): number` (px/s²)
  - `niceNumber(x: number): number` (größter Wert aus {1,2,5}·10ᵏ ≤ x; x ≤ 0 → 0)
  - `autoArrowScale(maxPxRate: number, imageLongEdgePx: number): number` – liefert L (s bzw. s² = Meter Bildlänge je 1 m/s bzw. 1 m/s²). Pfeil in Pixeln = v_px · L (Spec §4), gewünscht max. Pfeil ≈ 0,18·Kante ⇒ `L = niceNumber(0.18 * imageLongEdgePx / maxPxRate)`; 0, wenn maxPxRate ≤ 0. (Unabhängig vom Maßstab.)

- [ ] **Step 1: Failing tests** in `tests/unit/kinematics.test.ts`:
  - `toMeters(50,'cm') === 0.5`, `toMeters(812,'mm') ≈ 0.812`.
  - `metersPerPixel({a:{x:0,y:0},b:{x:100,y:0},length:1,unit:'m'}) === 0.01`; Länge 0 → null; b = a + (2,0) → null; null → null.
  - `toWorld`: origin (100,200), mpp 0.01, yUp → Punkt (200,100) ergibt (1, 1); yUp false → (1, −1); alignToScale mit a=(0,0), b=(0,100) (Strecke nach unten) → x-Achse zeigt nach unten: Punkt origin+(0,100) ergibt x ≈ 1, y ≈ 0.
  - Gleichförmig: 6 samples, t = i/10, px.x = 100 + 15·i (mpp 0.01) → alle v ≈ 1,5, a ≈ 0, letzte Zeile v null, letzte zwei a null; s der Zeile 4 ≈ 0,6.
  - Freier Fall: y_px = 4,905·t²/0,001 mit mpp 0,001, yUp false, Δt 0,05, 8 Punkte → `|a| ≈ 9.81` (toBeCloseTo, 6) für alle vorhandenen a.
  - Ungleichmäßig: t = [0, 0.1, 0.3], x = [0, 0.1, 0.3] m (mpp 1, px gleich) → v0 = v1 = 1, a0 = 0.
  - Lücke: samples mit nr 0,1,3,4 → Zeile nr 1 hat v null (Nachbar nr 2 fehlt), Zeile 0 hat v, a von Zeile 0 null.
  - `velocityArrows` mit 3 samples (0,0),(10,0),(20,0), t 0, 0.1, 0.2, scale 0.5: 'end' → [{from:(10,0),to:(60,0)},{from:(20,0),to:(70,0)}]; 'start' → from (0,0); 'mid' → from (5,0).
  - `accelArrows` mit (0,0),(10,0),(30,0), t 0,0.1,0.2, scale 0.01: a_px = 1000 px/s² → Länge 10; 'mid' from (10,0) to (20,0); 'start' from (5,0); 'end' from (20,0).
  - `niceNumber(0.37) === 0.2`, `niceNumber(7) === 5`, `niceNumber(1) === 1`, `niceNumber(0) === 0`.
  - `autoArrowScale(1000, 1000) === 0.1` (0,18 → 0,1), `autoArrowScale(0, 1000) === 0`.
- [ ] **Step 2:** `npx vitest run tests/unit/kinematics.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren (Signaturen oben). `computeRows`: x,y aus `toWorld`; v aus Nachbar nr+1 (muss existieren); a aus v(nr) und v(nr+1), Nenner (t[nr+2] − t[nr]) / 2; s kumulativ über die gemessenen Teilstrecken (Lücken überbrückt durch direkte Strecke).
- [ ] **Step 4:** Test → PASS; `npm run check` grün.
- [ ] **Step 5:** `git commit -m "feat: Kinematik (Maßstab, Achsen, v/a, Pfeile, Pfeilmaßstab)"`

### Task 2: Messmodell (`measure/model.ts`)

**Files:**
- Create: `src/lib/measure/model.ts`
- Test: `tests/unit/measure-model.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Pt`, `Calibration`, `Axes`, `ArrowPos`, `SamplePoint`).
- Produces:
  - `OBJECT_COLORS = ['#e2382b', '#1f9d55', '#0a8fb0']`, `V_COLOR = '#007aff'`, `A_COLOR = '#af52de'`, `UNSURE_COLOR = '#ff9500'`, `MAX_OBJECTS = 3`
  - Typen `MeasuredPoint`, `TrackedObject`, `Overlays`, `ArrowSettings`, `Measurement` exakt wie Spec §3.
  - `createMeasurement(): Measurement` (Standards §3)
  - `addObject(m): boolean` (false bei 3), `removeObject(m, id): boolean` (nicht das letzte; `active` bleibt gültig), `activeObject(m): TrackedObject`
  - `seriesFor(obj: TrackedObject, indices: number[], captureFps: number): SamplePoint[]` – indices = gewählte Bildindizes (ohne ausgeschlossene), nr = Position in indices, t = (frame − indices[0]) / fps, nur Bilder mit Punkt.
  - `nextOpenPosition(obj, indices, from = 0): number | null` – erste Positionsnummer ≥ from ohne Punkt, sonst erste überhaupt, sonst null.
  - `originFor(m, obj, indices): Pt` – originAtFirst: erster gemessener Punkt des Objekts (in Positionsreihenfolge), sonst `calibration.a`, sonst (0,0).
  - `hitPoint(obj, indices, p: Pt, radiusPx: number): number | null` – Positionsnummer des nächsten Punktes innerhalb Radius (Video-Pixel).

- [ ] **Step 1: Failing tests:** Standards (`overlays.v === false`, `arrows.aPos === 'mid'`, 1 Objekt „Objekt 1“ rot); addObject bis 3 dann false, Namen „Objekt 2/3“, Farben der Reihe nach; removeObject letzter → false, entfernt aktives → active auf vorhandenes; `seriesFor` mit Punkten auf Frames 0,10,20,30 und indices [0,20,40] (Schritt geändert) → 2 samples nr 0 und 1, t 0 und 20/fps; danach indices [0,10,20,30] → 4 samples (Punkte kamen zurück); `nextOpenPosition` und `hitPoint` (Radius-Grenze).
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** `git commit -m "feat: Messmodell mit Objekten, Punkten je Bildindex"`

### Task 3: Kandidaten und Zuordnung (`measure/detect.ts`) — Modell: Standard (opus)

**Files:**
- Create: `src/lib/measure/detect.ts`
- Test: `tests/unit/detect.test.ts`

**Interfaces:**
- Consumes: `MeasuredPoint`, `TrackedObject` (Task 2), `Pt`.
- Produces:
  - `interface Candidate { x: number; y: number; area: number }` (x,y Video-Pixel; area Anteil 0..1)
  - `interface FrameCandidates { index: number; candidates: Candidate[] }`
  - `DETECT_GRID = 320`, `MIN_AREA = 0.0002`, `MAX_CANDIDATES = 5`
  - `findCandidates(mask: Float32Array, w: number, h: number, scaleToVideo: number): Candidate[]` – Maske (0/1, Werte > 0.5 = Bewegung) wird auf ein Raster mit längster Kante ≤ `DETECT_GRID` heruntergerechnet (Zelle = Bewegung, wenn ≥ 50 % ihrer Pixel Bewegung), 4er-Nachbarschaft labeln (iterativ, kein Rekursionsstack), Schwerpunkt in Maskenpixeln × `scaleToVideo`, Fläche = Zellen/Rasterzellen; < MIN_AREA verwerfen; nach Fläche absteigend, höchstens MAX_CANDIDATES.
  - `assignTrack(frames: FrameCandidates[], existing: Record<number, MeasuredPoint>, taken: Record<number, Pt[]>, imageLongEdge: number): Record<number, MeasuredPoint>` – frames in Zeitreihenfolge; Ergebnis = neue Punkte nur für Bilder, deren vorhandener Punkt fehlt oder unsicher ist; Regeln exakt Spec §5 (Vorhersage konstante Geschwindigkeit aus den zwei letzten Punkten — vorhandene sichere Punkte zählen als Anker —, sonst letzter Punkt, sonst größter Kandidat; `taken[index]` = Punkte anderer Objekte, Kandidaten innerhalb 2 % der langen Kante davon überspringen; unsicher bei Entfernung > 0,25·imageLongEdge, Flächenabweichung > 2,5 × Median der gewählten Flächen, oder zweitbester Abstand < 1,3 × bester; kein Kandidat → kein Punkt).

- [ ] **Step 1: Failing tests:**
  - `findCandidates`: 200×100-Maske mit Quadrat 10×10 bei (50,40) → 1 Kandidat, x ≈ 55·s, y ≈ 45·s (s = scaleToVideo = 2 → 110, 90; toBeCloseTo 0), area ≈ 100/20000 (toBeCloseTo 3); zwei Quadrate (groß und klein) → 2, größeres zuerst; ein 1-Pixel-Fleck → verworfen; 1000×500-Maske wird gerastert (Ergebnis-Schwerpunkt bleibt innerhalb ±4 px Video).
  - `assignTrack`: Ball auf Gerade (x = 10 + 20·i) mit je einem Kandidaten → alle Punkte sicher, korrekte Position; zusätzlicher Störkandidat weit weg in Bild 3 → richtiger gewählt; Bild 4 ohne Kandidat → kein Punkt für 4, Bild 5 wieder sicher; vorhandener sicherer Punkt bleibt unverändert und lenkt die Vorhersage; zweites Objekt: `taken` enthält die Punkte von Objekt 1 → Objekt 2 bekommt den anderen Kandidaten; Kandidat 0,3·imageLongEdge von der Vorhersage → unsure true.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** `git commit -m "feat: Positions-Kandidaten aus der Bewegungsmaske und Zuordnung"`

### Task 4: Kandidaten aus dem Render

**Files:**
- Modify: `src/lib/engine/render.ts` (Compose-Schleife), `src/lib/engine/protocol.ts` (`RenderResult.detections`), `src/lib/engine/strobe.worker.ts` (Feld durchreichen)
- Test: `tests/unit/render.test.ts` (neuer Test)

**Interfaces:**
- Consumes: `findCandidates`, `FrameCandidates` (Task 3), `binaryDiffMask` / `motionMaskScratch` aus `compose/mask.ts`.
- Produces: `RenderResult.detections: FrameCandidates[]` (eine Liste je gewähltem Bild in Zeitreihenfolge; Koordinaten in Video-Pixeln: scaleToVideo = `src.info.width / width`).

- [ ] **Step 1: Failing test** in `render.test.ts`: synthetische Quelle (bestehende Helfer im Test) mit bewegtem Quadrat → `r.detections.length === positions`, je Bild ≥ 1 Kandidat, Schwerpunkt des ersten innerhalb 3 px der Soll-Position in Video-Pixeln; bei `maxSize` kleiner als Video (z. B. halbe Breite) bleiben die Koordinaten in Video-Pixeln.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** In der Compose-Schleife je Bild Binärmaske mit `threshold` (auch für Modus `average`, dort Schwelle aus `autoThreshold` des mittleren Bildes, wenn `compose.threshold < 0`) und `region` berechnen (eigener vorallokierter Puffer, Feather 0), `findCandidates` aufrufen. Worker-`post` um `detections` erweitern; Hauptthread-Pfad in `engine.ts` reicht `r` bereits durch.
- [ ] **Step 4:** `npm test` → PASS (alle).
- [ ] **Step 5:** `git commit -m "feat: Render liefert Positions-Kandidaten je Bild"`

### Task 5: Projektzustand Messung

**Files:**
- Modify: `src/lib/state/project.svelte.ts`
- Test: `tests/unit/project-measure.test.ts` (Muster wie `project-preview.test.ts` mit Fake-Engine)

**Interfaces:**
- Consumes: Task 2 (`createMeasurement`, `seriesFor` …), Task 3 (`assignTrack`), Task 4 (`preview.detections`).
- Produces auf `Project`:
  - `measure = $state<Measurement>(createMeasurement())`, in `#load` nach erfolgreichem Öffnen auf `createMeasurement()` zurückgesetzt
  - `get measureIndices(): number[]` = `selectFrameIndices(this.selection)`
  - `get metersPerPixel(): number | null`
  - `suggesting = $state(false)`
  - `async suggestPositions(): Promise<void>` – wartet (`suggesting = true`), bis keine Vorschau läuft und `preview.settingsKey === settingsKey(this.renderSettings())` (sonst `requestPreview(true)` und erneut warten; Abbruch bei neuem Video); dann `assignTrack` mit Kandidaten der gewählten Bilder, `taken` = sichere Punkte der anderen Objekte, `imageLongEdge = max(info.width, info.height)`; Ergebnis in `activeObject(measure).points` mischen.
  - `setPoint(nr: number, p: Pt): void` (unsure false), `deletePoint(nr: number): void`, `clearPoints(): void` (aktives Objekt)

- [ ] **Step 1: Failing tests:** neues Video → `measure.objects[0].points` leer und `calibration` null; `suggestPositions` mit Fake-Vorschau (detections) setzt Punkte; ist die Vorschau veraltet (anderer settingsKey), wird erst gerendert und dann zugeordnet (Fake-Engine zählt render-Aufrufe = 2); `setPoint` überschreibt unsicheren Punkt mit unsure false.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** `npm test` PASS.
- [ ] **Step 5:** `git commit -m "feat: Messung im Projektzustand, Vorschlagen"`

### Task 6: Einblendungen zeichnen + Export-Abbildung (`overlay/`)

**Files:**
- Create: `src/lib/overlay/scene.ts`, `src/lib/overlay/draw.ts`, `src/lib/overlay/map.ts`
- Test: `tests/unit/overlay.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2.
- Produces:
  - `interface SceneObject { color: string; points: { nr: number; p: Pt; unsure: boolean }[]; v: Arrow[]; a: Arrow[] }`
  - `interface Scene { objects: SceneObject[]; showNumbers: boolean; showPath: boolean; vScale: number | null; aScale: number | null; mpp: number | null; scaleBar: boolean; dtText: string | null; calibration: { a: Pt; b: Pt; label: string } | null; highlight: Pt | null }` (vScale/aScale = effektiver Maßstab in s bzw. s², null = Pfeiltyp aus)
  - `buildScene(m: Measurement, indices: number[], captureFps: number, imageLongEdge: number, opts: { showCalibration: boolean; highlight: { object: number; nr: number } | null; dtText: string | null }): Scene` – Pfeile nur mit gültigem Maßstab; automatischer Maßstab via `autoArrowScale` über alle Objekte; `imageLongEdge` = lange Kante des (zugeschnittenen) Bildes in Video-Pixeln.
  - `formatScaleLabel(L: number, kind: 'v' | 'a'): string` → z. B. `"1 m/s ≙ 10 cm"` (L in m; < 1 m in cm, sonst m; Dezimalkomma, max. 2 Nachkommastellen ohne Endnullen)
  - `drawOverlay(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, map: (p: Pt) => Pt, unit: number, target: { width: number; height: number; screen: boolean }): void` – Maße exakt Spec §6.6; `screen: false` zeichnet keine Unsicher-Markierung (normale Punktfarbe) und keine Hervorhebung; Legende braucht `mpp` für den Maßstabsbalken (Balkenlänge in Video-Pixeln → Zielpixel über `map` zweier Punkte).
  - `exportMap(crop: CropRect | null, rotation: 0|90|180|270, videoW: number, videoH: number, scale: number): (p: Pt) => Pt` – identisch zur Pixelabbildung von `cropRotate` (gleiche Drehrichtung im Uhrzeigersinn) gefolgt von Skalierung.
- [ ] **Step 1: Failing tests:** `exportMap` ohne Zuschnitt/Drehung skaliert; mit crop {x:10,y:20,w:100,h:50} und rotation 90: Ecke (10,20) → (50·s, 0), (110,70) → (0, 100·s) (stimmt mit `cropRotate` eines 1-Pixel-Markers überein – Test erzeugt Bild mit markiertem Pixel und vergleicht); `buildScene` ohne Maßstab → keine Pfeile, `vScale` null; mit Maßstab und `overlays.v` → `vScale` = autoArrowScale-Wert, Pfeilanzahl = Punkte − 1; `formatScaleLabel(0.1,'v') === '1 m/s ≙ 10 cm'`, `formatScaleLabel(0.025,'a') === '1 m/s² ≙ 2,5 cm'`, `formatScaleLabel(1.5,'v') === '1 m/s ≙ 1,5 m'`; `drawOverlay` gegen einen aufzeichnenden Fake-Kontext (Proxy, protokolliert `arc`, `fillText`, `strokeStyle`) – Export-Modus enthält kein `#ff9500`, Bildschirm-Modus schon; Nummern „0“, „1“ … per `fillText`; Legendentext „≙ 1 m/s“.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: Einblendungen (Nummern, Bahn, Pfeile, Legende, Maßstab) für Bühne und Export"`

### Task 7: Viewer-Werkzeug, Einblendungs-Ebene, Lupe

**Files:**
- Modify: `src/ui/components/Viewer.svelte`
- Create: `src/ui/components/Magnifier.svelte`
- Test: `tests/e2e/measure-viewer.spec.ts` (über Task 8 genutzt; hier nur Regression: `bild-tab.spec.ts`, `video-tab.spec.ts` bleiben grün)

**Interfaces:**
- Produces:
  - Viewer-Props neu: `tool?: StageTool | null`, `paint?: ((ctx: CanvasRenderingContext2D, map: (p: Pt) => Pt, unit: number, size: { width: number; height: number }) => void) | null` (nach dem Bild gezeichnet; map = `videoToViewer`·dpr; unit = dpr), Ansicht-Zurücksetzen-Knopf (Symbol close/„1:1“, `data-testid="zoom-reset"`) sichtbar bei zoom > 1, wenn `tool` gesetzt ist.
  - `export interface StageTool { press(p: Pt): boolean; drag(p: Pt, client: Pt): void; release(): void; tap(p: Pt): void; cancel(): void }` in `src/lib/viewer-coords.ts` (p = Video-Pixel über `viewerToVideo`; client = Viewer-Box-Koordinaten in CSS-px)
  - Verhalten: ein Finger: `press` → true ⇒ alle Bewegungen gehen an `drag`, Ende `release`; sonst bisheriges Pan; Tipp ohne Bewegung ⇒ `tap` (bei gesetztem `tool` kein Doppeltipp-Reset); zweiter Finger während `press` ⇒ `cancel` und Zoom wie bisher.
  - `Magnifier.svelte` Props `{ image: ImageBitmap; videoWidth: number; at: Pt /* Video-Pixel */; client: Pt; boxHeight: number }` – Kreis 120 px, zeigt einen Ausschnitt von 40×40 Vorschau-Pixeln um `at` (umgerechnet mit `image.width / videoWidth`), also Faktor 3; Fadenkreuz; 90 px über `client` (wenn `client.y < 150`: darunter); `data-testid="magnifier"`.
- [ ] **Step 1:** Implementieren.
- [ ] **Step 2:** `npm run check` grün; `npx playwright test --project=edge bild-tab video-tab` PASS.
- [ ] **Step 3:** `git commit -m "feat: Viewer mit Werkzeug-Schnittstelle, Zeichenebene und Lupe"`

### Task 8: Phase „Maßstab“

**Files:**
- Create: `src/ui/profi/MassstabTab.svelte`, `src/ui/profi/StageMeasure.svelte` (gemeinsame Bühne für Maßstab/Messen/Auswerten: Viewer + paint aus `buildScene` + BusyOverlay + Hinweiszeile + Lupe)
- Modify: `src/ui/profi/ProfiView.svelte` (Phasen massstab/messen/auswerten aktiv; Platzhalter für messen/auswerten bis Task 9/10: `MassstabTab` nur für massstab)
- Test: `tests/e2e/massstab.spec.ts`

**Interfaces:**
- Consumes: Task 5 (`project.measure`, `metersPerPixel`), Task 6, Task 7.
- Produces: `StageMeasure.svelte` Props `{ project: Project; tool: StageTool | null; hint: string | null; showCalibration: boolean; highlight?: { object: number; nr: number } | null; drag?: { at: Pt; client: Pt } | null }`.
- Bedienung §6.2: kein Maßstab → erster Tipp setzt `a` (Kalibrierung mit b = a, length aus Feld), zweiter `b`; danach `press` innerhalb 22 CSS-px (umgerechnet in Video-Pixel über die Geometrie) eines Endpunktes zieht ihn. Länge-Feld `data-testid="scale-length"`, Einheiten-Segment „Einheit“, Zeile `data-testid="scale-info"` mit Text `≙ {px} Pixel · 1 Pixel = {formatNumber(mpp in mm, 2)} mm`.
- [ ] **Step 1: Failing E2E** `massstab.spec.ts`: Video `ball-60.mp4` öffnen, Phase Maßstab, zwei Klicks auf das Viewer-Canvas mit 300 CSS-px Abstand, Länge „1,00“ + „m“ → `scale-info` enthält „1 Pixel =“ und „mm“; Switch „y nach oben“ umschaltbar; Knopf „Weiter zu Messen“ wechselt Phase.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS + `npm run check`.
- [ ] **Step 5:** `git commit -m "feat: Phase Maßstab mit Lupe und Koordinaten"`

### Task 9: Phase „Messen“

**Files:**
- Create: `src/ui/profi/MessenTab.svelte`, `src/ui/profi/ObjectChips.svelte`
- Modify: `src/ui/components/Filmstrip.svelte` (optionale Prop `marks?: Record<number, 'set' | 'unsure'>` je Bildindex + `markColor?: string`, `current` hebt die aktuelle Position hervor), `ProfiView.svelte`
- Test: `tests/e2e/messen.spec.ts`

**Interfaces:**
- Consumes: Tasks 5–8.
- Bedienung §6.3 exakt (Karten Objekte, Positionen, Einblendungen, Pfeile; Hinweistexte wörtlich). Knöpfe „Vorschlagen“ (`suggesting` → Text „Wird berechnet …“, disabled), „Punkt löschen“, „Alle löschen“ (Bestätigung über `confirm()`-freies Inline-Nachfragen: zweiter Tipp innerhalb 3 s auf „Wirklich löschen?“). Pfeil-Maßstabsfelder `data-testid="v-scale"` / `"a-scale"` in cm; „Auto“ setzt `vScale`/`aScale` auf null. Zähler `data-testid="pos-count"` Text „6 / 8“.
- [ ] **Step 1: Failing E2E** `messen.spec.ts`: Maßstab setzen (Helfer aus Task 8 wiederverwenden), Messen, „Vorschlagen“ → `pos-count` zeigt „n / n“ (n = Positionsanzahl); Switch „v-Pfeile“ an → Legende sichtbar: Pixelprobe der linken oberen Ecke des Viewer-Canvas (Legendenkarte weiß 85 %) unterscheidet sich vom Zustand vorher; „Punkt löschen“ verringert Zähler; Klick auf Bühne setzt ihn wieder; ohne Maßstab ist „v-Pfeile“ deaktiviert.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: Phase Messen mit Objekten, Vorschlagen, Einblendungen und Pfeilen"`

### Task 10: Phase „Auswerten“ + CSV

**Files:**
- Create: `src/lib/export/csv.ts`, `src/ui/profi/AuswertenTab.svelte`, `src/ui/components/MeasureTable.svelte`, `src/ui/CsvDialog.svelte`
- Modify: `ProfiView.svelte`
- Test: `tests/unit/csv.test.ts`, `tests/e2e/auswerten.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`computeRows`, `Row`), Task 2, `shareOrDownload` aus `export/image.ts`.
- Produces:
  - `type CsvStyle = 'de' | 'intl'`
  - `toCsv(objects: { name: string; rows: Row[] }[], style: CsvStyle): string` – beginnt mit `﻿`; Trenner `;`/`,`, Dezimal `,`/`.`; Kopf exakt `Nr;t in s;x in m;y in m;vx in m/s;vy in m/s;|v| in m/s;ax in m/s²;ay in m/s²;|a| in m/s²`; Zahlen 4 Nachkommastellen; null → leer; Zeilenende `\r\n`; mehrere Objekte: je Block Zeile `Objekt: Name`, Kopf, Daten, Leerzeile dazwischen (bei einem Objekt keine Objektzeile).
  - `csvFileName(videoName: string): string` → `ball_messung.csv`
  - Tabelle §6.4: Spalten-Ids `t,x,y,s,vx,vy,v,ax,ay,a`, Standard an: t,x,y,vx,vy,v,a; Nachkommastellen 2/3 (Standard 3; v/a mit 2); Zeile `data-testid="row"`, Klick setzt Hervorhebung (Bühne über `StageMeasure.highlight`), Tipp auf Punkt in der Bühne (StageTool.tap → `hitPoint`) markiert Zeile.
- [ ] **Step 1: Failing unit tests** `csv.test.ts`: BOM, deutscher Kopf, `0,1000` vs `0.1000` (intl, Trenner `,`), null leer → `;;`, zwei Objekte mit `Objekt: Ball`-Zeilen, `csvFileName('ball.mp4') === 'ball_messung.csv'`.
- [ ] **Step 2: Failing E2E** `auswerten.spec.ts`: Maßstab + Vorschlagen, Phase Auswerten → ≥ 3 `row`, erste Zelle t „0,000“; Dezimalkomma in x; Klick auf Zeile 2 setzt `aria-selected="true"`; CSV-Knopf → Dialog → „Teilen / Sichern“ löst Download aus (`page.waitForEvent('download')`), Inhalt beginnt nach BOM mit `Nr;t in s`.
- [ ] **Step 3:** FAIL. **Step 4:** Implementieren. **Step 5:** PASS (unit + e2e).
- [ ] **Step 6:** `git commit -m "feat: Phase Auswerten mit Messtabelle und CSV-Export"`

### Task 11: Bild-Export mit Einblendungen

**Files:**
- Modify: `src/lib/export/image.ts` (`overlays: true` ⇒ Szene zeichnen), `src/ui/ExportDialog.svelte` (Switch „Einblendungen“, Standard an bei Punkten oder Maßstab; Teil des Schlüssels `key`)
- Test: `tests/unit/export-image.test.ts` (neuer Fall), `tests/e2e/export.spec.ts` (neuer Fall)

**Interfaces:**
- Consumes: `buildScene`, `drawOverlay`, `exportMap` (Task 6).
- Verhalten: nach Skalierung auf Zielgröße `drawOverlay(ctx, buildScene(..., { showCalibration: false, highlight: null, dtText: infoLine ? null : dtText-wenn-overlays.dt }), exportMap(p.crop, p.rotation, info.width, info.height, t.width / w), unit = max(1, max(t.width,t.height)/1000), { screen: false, ... })`.
- [ ] **Step 1: Failing tests:** Unit: `renderExportImage` mit Fake-Projekt und gesetzten Punkten zeichnet (Proxy-Kontext oder Pixelprobe) an der abgebildeten Punktposition eine weiße Füllung; `overlays: false` nicht. E2E: Export mit und ohne „Einblendungen“ nach Vorschlagen ergibt unterschiedliche Dateigrößen.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: Bild-Export mit Einblendungen"`

### Task 12: Sichtprüfung, Layout, Abnahme-Checkliste

**Files:**
- Modify: `tests/e2e/screens.spec.ts` (Screenshots hell/dunkel für Maßstab, Messen, Auswerten), `tests/e2e/layout.spec.ts` (Hochformat 820×1180 ohne horizontales Scrollen in den drei Phasen)
- Create: `docs/abnahme-plan2.md` (iPad-Checkliste: Maßstab mit Lupe am Finger, Vorschlagen am eigenen Video, Punkt ziehen mit Apple Pencil, Pfeile/Legende, Tabelle, CSV in Numbers öffnen, Export mit Einblendungen, hell/dunkel, Hoch-/Querformat)
- [ ] **Step 1:** Tests ergänzen; `npx playwright test --project=edge` PASS; Screenshots sichten (Read der PNGs), Auffälligkeiten beheben.
- [ ] **Step 2:** `npm test && npm run check && npm run build` grün.
- [ ] **Step 3:** `git commit -m "test: Sichtprüfung und Layout Plan 2; docs: Abnahme-Checkliste Plan 2"`
