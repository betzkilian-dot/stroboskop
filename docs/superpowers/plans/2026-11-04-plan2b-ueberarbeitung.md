# Plan 2b – Überarbeitung nach iPad-Test – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tipp-Fehler in Messen beheben, Zuschneiden mit sichtbarem Rahmen, feste Einstellungsspalte ohne „Mehr …“, sichtbares/drehbares Koordinatensystem, verschiebbare Legende, Diagramme mit Ausgleich (Gerade, Ursprungsgerade, Parabel, R²).

**Architecture:** Bestehende Module erweitern: `Viewer.svelte` (Tipp-Toleranz), `CropEditor.svelte`, `src/app.css` + `BildTab.svelte`, `physics/kinematics.ts` + `measure/model.ts` (Achsen, Legende, Diagramm-Einstellungen), `overlay/` (Achsen, `legendRect`), neu `physics/fit.ts`, `charts/ticks.ts`, `ui/components/Chart.svelte`.

**Tech Stack:** TypeScript, Svelte 5 (Runes), Vite, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-04-plan2b-ueberarbeitung-design.md` („§“ unten).

## Global Constraints

- Texte deutsch, Dezimalkomma, Minus „−“ in Anzeigen; Tippflächen ≥ 44 px; Design-Tokens/Komponenten aus Plan 1b.
- Koordinaten in Video-Pixeln (vor Zuschnitt/Drehung).
- Bestehende Tests bleiben grün (`npm test`, `npm run check`, `npx playwright test --project=edge`); neue Tests verwenden kein `waitForTimeout`.
- Modelle: Umsetzer sonnet; Gesamtprüfung opus.

## Review Focus

1. Tipp-Toleranz darf Pinch/Pan und das Ziehen von Punkten nicht verschlechtern → Test in Task 1 (Ziehen über 30 px verschiebt weiterhin).
2. Achsen-Migration: alter Zustand `alignToScale` entfällt überall; `toWorld` mit angle = 0 und origin = null liefert dieselben Werte wie bisher → Test in Task 4.
3. Legende bei kleinem Bild/Hochformat bleibt ganz sichtbar → Test in Task 6 (`legendRect` begrenzt).
4. Ausgleich mit identischen t (alle gleich) oder < nötige Punkte: keine NaN, Hinweis → Test in Task 7.
5. Zuschneiden: Rahmen bleibt im Bild und ≥ Mindestgröße beim Ziehen über den Rand → Test in Task 3.

---

### Task 1: Tipp-Toleranz im Viewer (§2)

**Files:** Modify `src/ui/components/Viewer.svelte`; Test `tests/e2e/messen.spec.ts`.
- Aufsetzpunkt je Pointer merken; `moved` = Abstand Aufsetzpunkt→aktuell ≥ `TAP_SLOP = 10` CSS-px. Bei gegriffenem Werkzeug (`press` true) `drag` erst ab TAP_SLOP; bei Zoom > 1 ohne Griff Pan erst ab TAP_SLOP. Zwei Finger unverändert.
- [ ] Failing E2E: in Messen (Maßstab gesetzt) `page.mouse.down` auf leere Stelle, `move` um 5 px, `up` → Zähler `pos-count` steigt um 1. Zweiter Test: Punkt greifen und 30 px ziehen ändert seine Position (Tabelle in Auswerten ändert sich – vorhandenen Drag-Test weiter grün).
- [ ] Implementieren; `npx playwright test --project=edge messen massstab bild-tab video-tab` PASS.
- [ ] Commit `fix: Tippen auf der Bühne mit 10-px-Toleranz`.

### Task 2: Einstellungsspalte fest, Bild ohne „Mehr …“ (§4)

**Files:** Modify `src/app.css`, `src/ui/profi/BildTab.svelte`; Test `tests/e2e/layout.spec.ts`, `tests/e2e/bild-tab.spec.ts`.
- `.work > .col`: `overflow-x: hidden; overflow-y: auto;` Kinder `min-width: 0`. Range-Inputs der App: `touch-action: none; min-height: 44px`.
- BildTab: `<details>` ersetzt durch `Card title="Weitere Einstellungen"`; Hintergrund als 2×2-Kacheln (Muster wie „Darstellung“, `role="radio"`).
- [ ] Failing E2E: in Bild (Querformat 1194×834 und Hochformat 834×1194) gilt für die Spalte `scrollWidth <= clientWidth + 1`; Kachel „Gewählt“ vollständig in der Spalte sichtbar (BoundingBox innerhalb der Spalte); kein Element `[data-testid=more]` mehr; bestehende bild-tab-Tests an die Kacheln anpassen.
- [ ] Implementieren; Tests PASS.
- [ ] Commit `fix: Einstellungsspalte ohne seitliches Scrollen, Weitere Einstellungen direkt sichtbar`.

### Task 3: Zuschneiden mit Rahmen (§3)

**Files:** Modify `src/ui/components/CropEditor.svelte`, `src/ui/profi/VideoTab.svelte`, `src/lib/viewer-coords.ts` (reine Hilfsfunktion); Test `tests/unit/viewer-coords.test.ts`, `tests/e2e/video-tab.spec.ts`.
- **Interfaces:** `type CropHandle = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'move'`; `adjustCrop(c: CropRect, handle: CropHandle, dx: number, dy: number, videoW: number, videoH: number): CropRect` (Video-px, bleibt im Bild, Mindestgröße `MIN_CROP`, `move` verschiebt ohne Größenänderung).
- CropEditor: Startrahmen = `current ?? ganzes Bild`; Abdunkelung außen (55 % schwarz); Griffe 44 px; Knöpfe „Zurücksetzen“, „Abbrechen“, „Fertig“ (primär) in VideoTab; `oncommit` erst bei „Fertig“. Player außerhalb des Bearbeitens: Rahmen + Abdunkelung über dem Video (nur Anzeige, `pointer-events: none`).
- [ ] Failing unit tests `adjustCrop`: Ecke `se` +10/+5 vergrößert; über den Rand → geklemmt auf Bildgröße; `nw` über `se` hinaus → Mindestgröße 8 bleibt; `move` am Rand geklemmt.
- [ ] Failing E2E: Zuschneiden öffnen → Rahmen sichtbar (`data-testid=crop-frame`); Ecke ziehen; „Fertig“ → Rahmen weiterhin auf dem Player sichtbar (`data-testid=crop-shown`) und Bild-Phase zeigt kleineres Seitenverhältnis/geänderte Vorschau.
- [ ] Implementieren; Tests PASS.
- [ ] Commit `feat: Zuschneiden mit sichtbarem, anpassbarem Rahmen`.

### Task 4: Achsen-Modell und Zeichnung (§5 Modell, Zeichnen, Messen-Switch)

**Files:** Modify `src/lib/physics/kinematics.ts`, `src/lib/measure/model.ts`, `src/lib/overlay/scene.ts`, `src/lib/overlay/draw.ts`, `src/ui/profi/MessenTab.svelte`, `src/ui/profi/MassstabTab.svelte` (nur Entfernen von alignToScale), `src/lib/export/image.ts` (falls Szene-Optionen); Tests `tests/unit/kinematics.test.ts`, `tests/unit/measure-model.test.ts`, `tests/unit/overlay.test.ts`.
- **Interfaces:**
  - `Axes { originAtFirst: boolean; origin: Pt | null; angle: number; yUp: boolean }`; Standard `{ originAtFirst: true, origin: null, angle: 0, yUp: true }`.
  - `toWorld(p, origin, c, axes)`: Drehung um −angle (math., y nach oben) nach Verschiebung; dann yUp-Spiegelung.
  - `originFor(m, obj, indices)`: originAtFirst → erster Punkt; sonst `axes.origin`; sonst `calibration.a`; sonst (0,0).
  - `Overlays.axes: boolean` (Standard false).
  - `Scene.axes: { origin: Pt; angle: number; yUp: boolean; lengthPx: number } | null` (lengthPx = 0,12 × imageLongEdge in Video-px); `buildScene` opts neu `showAxes: boolean` (Maßstab: true; Messen/Export: `overlays.axes`), Ursprung über `originFor` des aktiven Objekts.
  - `axisTip(axes: NonNullable<Scene['axes']>): Pt` (Spitze der x-Achse in Video-px; für Task 5).
  - Zeichnen exakt §5.
- [ ] Failing tests: angle 0/origin null → Werte wie bisher (bestehende Tests grün); angle = π/2 mit yUp: Bildpunkt oberhalb des Ursprungs (y kleiner) ergibt x > 0, y ≈ 0; origin gesetzt + originAtFirst false → `originFor` liefert origin; `buildScene` mit showAxes → `axes` nicht null, Zeichnen protokolliert `fillText('x')` und `fillText('y')`.
- [ ] Implementieren; Messen: Switch „Koordinatensystem“ in „Einblendungen“; MassstabTab: Switch „Achse an Maßstab ausrichten“ entfernen (Ersatz in Task 5).
- [ ] `npm test`, `npm run check`, `npx playwright test --project=edge` PASS.
- [ ] Commit `feat: Koordinatensystem mit Ursprung und Drehung, einblendbar`.

### Task 5: Koordinatensystem in Phase Maßstab bedienen (§5 Phase Maßstab)

**Files:** Modify `src/ui/profi/MassstabTab.svelte`; Test `tests/e2e/massstab.spec.ts`.
- Szene mit `showAxes: true`. Werkzeug: `press` trifft (22 CSS-px) Maßstabs-Endpunkte (wie bisher) → sonst Ursprung → sonst x-Spitze (`axisTip`). Ursprung ziehen: `axes.origin = p`, `originAtFirst = false`. Spitze ziehen: `angle = atan2(−(p.y−o.y), p.x−o.x)`, Einrasten auf k·90° bei |Δ| < 3°.
- Karte „Koordinaten“: Switch „Ursprung bei Position 0“, Switch „y nach oben“, Zeile `data-testid="axes-angle"` „Drehung: 0°“, Knöpfe „An Maßstab ausrichten“ (nur mit Maßstab; angle = atan2(−(b.y−a.y), b.x−a.x)) und „Zurücksetzen“.
- [ ] Failing E2E: Maßstab setzen; Ursprung ziehen → Switch „Ursprung bei Position 0“ aus; x-Spitze um 90° ziehen → „Drehung: 90°“; „Zurücksetzen“ → „Drehung: 0°“; „An Maßstab ausrichten“ bei waagerechter Strecke → 0°.
- [ ] Implementieren; Tests PASS.
- [ ] Commit `feat: Ursprung und Achsen in Phase Maßstab ziehen und drehen`.

### Task 6: Legende verschieben (§6)

**Files:** Modify `src/lib/measure/model.ts`, `src/lib/overlay/scene.ts`, `src/lib/overlay/draw.ts`, `src/ui/profi/StageMeasure.svelte`, `MessenTab.svelte`, `AuswertenTab.svelte`, `src/lib/export/image.ts`; Tests `tests/unit/overlay.test.ts`, `tests/e2e/messen.spec.ts`.
- **Interfaces:** `Measurement.legendPos: { x: number; y: number }` Standard `{0.02, 0.02}`; `Scene.legendPos`; `legendRect(ctx, scene, target, unit): { x: number; y: number; w: number; h: number } | null` (null ohne Legendeninhalt; im Bild begrenzt), von `drawOverlay` genutzt. `StageMeasure` stellt `legendHit(clientPt): boolean` und `moveLegend(clientPt, grabOffset)` bereit (Umrechnung Ziel-px ↔ Anteil über die sichtbare Bildfläche in der Geometrie).
- Werkzeuge in Messen/Auswerten prüfen zuerst die Legende (Vorrang), dann Punkte.
- [ ] Failing tests: `legendRect` mit legendPos {0.98, 0.98} bleibt vollständig im Ziel; Export nutzt dieselbe relative Position (`exportOverlay`-Szene enthält legendPos). E2E: Legende in Messen von oben links nach unten rechts ziehen → Pixelprobe oben links zeigt keine Legende mehr, unten rechts schon.
- [ ] Implementieren; Tests PASS.
- [ ] Commit `feat: Legende verschiebbar, Position gilt im Export`.

### Task 7: Ausgleichsrechnung und Teilstriche (§7 Rechnung)

**Files:** Create `src/lib/physics/fit.ts`, `src/lib/charts/ticks.ts`; Tests `tests/unit/fit.test.ts`, `tests/unit/ticks.test.ts`.
- **Interfaces:**
  - `type FitKind = 'none' | 'line' | 'origin' | 'parabola'`
  - `interface Fit { kind: Exclude<FitKind,'none'>; coef: number[]; r2: number }` (line: [m, b]; origin: [m]; parabola: [a, b, c])
  - `fitPoints(pts: { t: number; y: number }[], kind: Exclude<FitKind,'none'>): Fit | null` (null bei zu wenigen Punkten: line 2, origin 1, parabola 3, oder singulärem System)
  - `evalFit(f: Fit, t: number): number`
  - `fitEquation(f: Fit, varName: string): string` z. B. `x = 1,52·t + 0,01`, `y = −4,91·t² + 2,03·t − 0,05`, `v = 9,81·t`; 3 signifikante Stellen, Dezimalkomma; alle Terme werden angezeigt, das Vorzeichen eines Folgeterms steht als „ + “ bzw. „ − “ zwischen den Termen, ein negativer erster Koeffizient beginnt mit „−“.
  - `formatR2(r2: number): string` → `R² = 0,998` (3 Nachkommastellen)
  - `niceTicks(min: number, max: number, maxCount = 6): number[]` (Schritt aus {1,2,5}·10ᵏ, Bereich umfasst min..max; min = max → Bereich ±1 um den Wert bzw. [0,1])
- [ ] Failing tests: Gerade exakt (R² = 1); Ursprungsgerade; Parabel freier Fall y = 2 + 3t − 4,905t² → coef ≈ [−4,905, 3, 2]; R² < 1 bei Rauschen; zu wenige Punkte → null; alle t gleich → null; `fitEquation` Beispiele exakt; `niceTicks(0, 0.93)` → [0, 0.2, 0.4, 0.6, 0.8, 1]; `niceTicks(-2.1, 2.5)` enthält 0 und Schritt 1.
- [ ] Implementieren (Normalgleichungen; 3×3 per Gauß mit Pivotsuche); Tests PASS.
- [ ] Commit `feat: Ausgleich (Gerade, Ursprungsgerade, Parabel, R²) und Teilstriche`.

### Task 8: Diagramm in Auswerten (§7 Oberfläche)

**Files:** Create `src/ui/components/Chart.svelte`; Modify `src/ui/profi/AuswertenTab.svelte`, `src/lib/measure/model.ts` (`Measurement.chart`); Test `tests/e2e/auswerten.spec.ts`.
- **Interfaces:** `Measurement.chart: { quantity: 'x'|'y'|'vx'|'vy'|'v'|'ax'|'ay'|'a'; fit: FitKind; showEquation: boolean; showR2: boolean }` Standard `{ 'x', 'none', true, true }`. `Chart.svelte` Props `{ series: { color: string; name: string; points: { t: number; y: number; nr: number }[] }[]; xLabel: string; yLabel: string; varName: string; fit: FitKind; showEquation: boolean; showR2: boolean; selected: number | null; onselect: (nr: number) => void }`; SVG, `data-testid="chart"`, Punkte `data-testid="chart-point"`, Gleichung `data-testid="chart-equation"`, R² `data-testid="chart-r2"`, Hinweis bei `fitPoints` = null.
- Größenauswahl als umbrechende Kacheln/Segmente; Ausgleich-Segment „keine / Gerade / Ursprungsgerade / Parabel“; Switches „Gleichung“, „R²“. Ausgleich nur für das gewählte (aktive) Objekt; mehrere Objekte als Punktreihen in Objektfarbe.
- [ ] Failing E2E: nach Maßstab + Vorschlagen in Auswerten ≥ 3 `chart-point`; Ausgleich „Gerade“ → `chart-equation` enthält „x =“ und „·t“, `chart-r2` enthält „R² = 0,9“; Größe „t-|v|“ → Achsenbeschriftung „|v| in m/s“; Klick auf Diagrammpunkt setzt `aria-selected` der Tabellenzeile; Phasenwechsel und zurück behält „Gerade“.
- [ ] Implementieren; `npm run check`, Tests PASS.
- [ ] Commit `feat: Diagramme in Auswerten mit Ausgleich, Gleichung und R²`.

### Task 9: Sichtprüfung und Checkliste

**Files:** Modify `tests/e2e/screens.spec.ts`, `docs/abnahme-plan2.md`.
- Screenshots hell/dunkel quer/hoch: Video mit Zuschneiden-Rahmen, Bild (Spalte), Maßstab mit Achsen, Messen mit verschobener Legende, Auswerten mit Diagramm + Parabel. PNGs ansehen, echte Layoutfehler beheben.
- Checkliste um §2–§7 ergänzen (iPad: Tippen mit dem Finger setzt Punkt, Rahmen ziehen, Spalte wackelt nicht, Achse drehen, Legende ziehen und im Export prüfen, Diagramm mit Parabel beim Wurf).
- [ ] `npx playwright test --project=edge`, `npm test`, `npm run check`, `npm run build` grün.
- [ ] Commit `test: Sichtprüfung Plan 2b; docs: Checkliste ergänzt`.
