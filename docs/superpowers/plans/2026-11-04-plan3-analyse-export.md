# Plan 3 – Bericht, Diagramm-Export, s-t, Komponenten – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** s-t-Diagramm, Komponentenpfeile, Diagramm als PNG, PDF-Bericht mit wählbaren Diagrammen.

**Architecture:** Reine Layout-/Rechenfunktionen in `src/lib/charts/` und `src/lib/export/`; Zeichnen auf Canvas für PNG/PDF; minimaler PDF-Schreiber ohne Bibliothek.

**Tech Stack:** TypeScript, Svelte 5, Vite, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-04-plan3-analyse-export-design.md` („§“).

## Global Constraints
- Deutsch, Dezimalkomma, „−“; Tippflächen ≥ 44 px; Design-Tokens; keine Browser-Selects; keine neuen npm-Abhängigkeiten.
- Bestehende Tests grün; neue Tests ohne `waitForTimeout`.
- Modelle: Umsetzer sonnet; Gesamtprüfung opus.

## Review Focus
1. PDF öffnet in iPad-Safari/Dateien und Acrobat: gültige xref-Offsets (Byte-genau, `\n`-Zeilenenden) → Task 3.
2. Große Videos (4K): Bericht rendert Bild in „Klein“-Größe, Speicher bleibt begrenzt (Canvas nach Gebrauch freigeben) → Task 4.
3. Viele Positionen (60+): Tabelle umbricht über Seiten, Kopf wiederholt → Task 4.
4. Ohne Maßstab: Bericht nur mit Bild und Kenndaten, keine Fehler → Task 5.
5. Dunkles Schema: PNG/PDF immer hell → Task 2/4.

---

### Task 1: s-t und Komponentenpfeile (§2, §3)
**Files:** `src/ui/profi/AuswertenTab.svelte` (Kachel t-s), `src/lib/physics/kinematics.ts` (`componentArrows(arrows: Arrow[], axes: Axes): { x: Arrow[]; y: Arrow[] }` – Projektion auf x-Achse (cos a, −sin a) und y-Achse nach yUp, Ansatz = from), `src/lib/measure/model.ts` (`Overlays.components`), `src/lib/overlay/scene.ts` (`SceneObject.vc`, `ac`: Komponenten, gefiltert nach dims), `src/lib/overlay/draw.ts` (§3 Zeichnung, Legendenzeile), `src/ui/profi/MessenTab.svelte`/`ArrowSettings.svelte` (Switch).
- [ ] Failing unit tests: Pfeil (0,0)→(10,−10) bei angle 0, yUp → x-Komponente (0,0)→(10,0), y-Komponente (0,0)→(0,−10); angle 90° tauscht; dims 'x' → nur x; draw protokolliert gestrichelte Linien nur mit components an.
- [ ] Failing E2E: t-s-Kachel → Achse „s in m“; Komponenten-Switch an → Canvas ändert sich (Pixelprobe).
- [ ] Implementieren; `npm test`, `npm run check`, `npx playwright test --project=edge messen auswerten` grün.
- [ ] Commit `feat: s-t-Diagramm und Komponentenpfeile`.

### Task 2: Diagramm-Layout teilen, PNG-Export (§4)
**Files:** Create `src/lib/charts/layout.ts`, `src/lib/charts/drawChart.ts`; Modify `src/ui/components/Chart.svelte`, `src/ui/profi/AuswertenTab.svelte`; Tests `tests/unit/chart-layout.test.ts`, `tests/e2e/auswerten.spec.ts`.
- **Interfaces:** `ChartInput = { series: { id; color; name; points: {t,y,nr}[] }[]; xLabel; yLabel; varName; fit: FitKind; showEquation; showR2; activeId }`; `chartLayout(input, width, height, pad): { xTicks: {v, px, text}[]; yTicks: …; points: {seriesId, nr, x, y, color}[]; curve: {x,y}[] | null; equation: string | null; r2: string | null; hint: string | null; plot: {x,y,w,h} }`; `drawChart(ctx, layout, theme: { bg, fg, muted, grid }, title?: string)`; `chartFileName(video, quantity)`; `renderChartPng(input, title): Promise<Blob>` (1600×1000, Theme hell).
- Chart.svelte nutzt `chartLayout` (keine eigene Achsen-/Kurvenrechnung mehr).
- [ ] Failing unit tests: Layout liefert Kurve nur über Datenbereich, Teilstrich-Texte mit Komma, Punkte im Plotbereich; `chartFileName('ball.mp4','vx') === 'ball_diagramm_t-vx.png'`.
- [ ] Failing E2E: „Diagramm als Bild teilen“ → Download `*_diagramm_t-x.png` mit PNG-Signatur.
- [ ] Implementieren; Tests grün; Commit `feat: Diagramm als Bild teilen, gemeinsames Diagramm-Layout`.

### Task 3: Minimaler PDF-Schreiber (§5.3)
**Files:** Create `src/lib/export/pdf.ts`; Test `tests/unit/pdf.test.ts`.
- **Interfaces:** `jpegPagesToPdf(pages: { jpeg: Uint8Array; widthPx: number; heightPx: number }[], pageWpt = 595.28, pageHpt = 841.89): Uint8Array` – Objekte: Catalog, Pages, je Seite Page + Content-Stream (`q W 0 0 H 0 0 cm /Im1 Do Q`) + Image XObject (`/Filter /DCTDecode /ColorSpace /DeviceRGB /BitsPerComponent 8`); xref mit exakten Byte-Offsets; trailer; `%%EOF`.
- [ ] Failing tests: Kopf beginnt `%PDF-1.4`; `/Count n` = Seitenzahl; jeder xref-Eintrag zeigt auf `k 0 obj`; `startxref` zeigt auf `xref`; Ende `%%EOF`; JPEG-Bytes unverändert enthalten.
- [ ] Implementieren; Commit `feat: minimaler PDF-Schreiber für Bildseiten`.

### Task 4: Berichtseiten rendern (§5.2)
**Files:** Create `src/lib/export/report.ts`; Test `tests/unit/report.test.ts`.
- **Interfaces:** `ReportOptions = { title; name; date: string; image: boolean; facts: boolean; tables: boolean; charts: Quantity[]; fit: FitKind; showEquation; showR2 }`; `planReport(contentHeights…)`: reine Seitenaufteilung `paginate(blocks: { kind: 'header'|'image'|'facts'|'tableHead'|'row'|'chart'; h: number; keepWithNext?: boolean }[], pageContentH: number): number[][]` (Blockindizes je Seite; Diagramme/Bild nie geteilt; Tabellenkopf vor erster Zeile einer Seite wiederholt – als eigener Block eingefügt); `renderReport(p: Project, o: ReportOptions): Promise<Blob>` (zeichnet Seiten auf OffscreenCanvas 1654×2339, JPEG 0,9, `jpegPagesToPdf`, Canvas nach jeder Seite freigeben; Bild über `renderExportImage` mit size 'worksheet', overlays an, infoLine aus).
- [ ] Failing tests `paginate`: 80 Zeilen → ≥ 2 Seiten, jede Seite mit Zeilen beginnt mit Tabellenkopf; Diagramm passt nicht mehr → nächste Seite; Fußzeilen-Text „Seite 1 von 2“ (`footerText(i, n)`).
- [ ] Implementieren; Commit `feat: Berichtseiten mit Seitenumbruch`.

### Task 5: Teilen-Fenster mit PDF-Bericht und CSV (§5.1)
**Files:** Modify `src/ui/ExportDialog.svelte` (Segment Bild/PDF/CSV; PDF-Felder; Name in `localStorage` `stroboskop.name` mit try/catch), ggf. Create `src/ui/ReportOptions.svelte`; Tests `tests/e2e/export.spec.ts`.
- Rechen-Anzeige während des Erstellens („Bericht wird erstellt …“), danach „Teilen / Sichern“; Toasts wie Bild-Export. CSV-Teil nutzt `toCsv`/`csvFileName`.
- [ ] Failing E2E: PDF mit Maßstab+Vorschlagen, Diagramme t-x und t-y gewählt → Download `*_bericht.pdf` beginnt mit `%PDF`, `/Count` ≥ 1; Name eingeben, Fenster schließen, wieder öffnen → Name vorbelegt; ohne Maßstab: Tabellen/Diagramme deaktiviert, PDF trotzdem erstellbar; CSV-Segment lädt CSV.
- [ ] Implementieren; volle Tests grün; Commit `feat: PDF-Bericht im Teilen-Fenster`.

### Task 6: Sichtprüfung und Checkliste
- Screenshots (hell/dunkel) Teilen-Fenster PDF, Diagramm mit Komponenten; erste PDF-Seite als JPEG/PNG im Test extrahieren und ansehen (Seiten-JPEG aus dem PDF-Byte-Strom). `docs/abnahme-plan3.md` (iPad: PDF in Dateien öffnen, Teilen per AirDrop, Name gemerkt, Diagramm-PNG in Fotos).
- [ ] `npm test`, `npm run check`, `npx playwright test --project=edge`, `npm run build` grün; Commit `test: Sichtprüfung Plan 3; docs: Abnahme-Checkliste Plan 3`.
