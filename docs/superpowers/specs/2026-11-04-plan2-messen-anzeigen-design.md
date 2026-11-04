# Plan 2 – Maßstab, Messen, Auswerten (Spezifikation)

Stand: 2026-11-04 · Grundlage: freigegebene Entwürfe `.superpowers/brainstorm/3959-1793729735/content/plan2-phasen.html` und Entscheidungen der Lehrkraft vom 2026-11-04.
Übergeordnet: `2026-11-03-stroboskop-app-design.md` (Abschnitte 4, 5.1–5.4, 7) und Design aus `2026-11-03-plan1b-ueberarbeitung-design.md` (Tokens, Card, Segmented, Switch, Icon, Grundlayout).

## 1. Ziel

Die Phasen **Maßstab**, **Messen** und **Auswerten** werden freigeschaltet. Lehrkraft (Profimodus) kann einen Maßstab festlegen, Positionen von bis zu 3 Objekten setzen (oder vorschlagen lassen), Nummern, Bahn, v-/a-Pfeile, Legende, Maßstabsbalken und Δt einblenden, eine Messtabelle ansehen und als CSV exportieren. Alle Einblendungen erscheinen auch im exportierten Bild.

## 2. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Positionen automatisch? | Knopf **„Vorschlagen“** (aus der Bewegungsmaske); unsichere Punkte orange; immer von Hand korrigierbar. Sperre in der Klassenvorlage kommt mit Plan 4. |
| Wo liegen Einblendungen/Pfeile? | In der Phase **Messen** (keine eigene Phase „Anzeigen“). Rechte Spalte: „Positionen“ → „Einblendungen“ → „Pfeile“ (eingeklappt/deaktiviert, bis genug Punkte gesetzt sind). |
| Standard-Pfeilposition | v: **Ende**, a: **Mitte** (a sitzt dann bei Pᵢ₊₁, wo die Geschwindigkeitsänderung stattfindet). Beide umstellbar. |
| Zeitbasis | tᵢ = (Bildindexᵢ − Bildindex₀) / Aufnahme-fps (passt zu Δt = n / fps, auch bei Zeitlupe). |
| Speicherung | Noch keine (Projektspeicher = Plan 4). Neues Video setzt Maßstab und Messung zurück. |

## 3. Datenmodell (`src/lib/measure/model.ts`)

Alle Bildkoordinaten in **Video-Pixeln** (Anzeigeorientierung `info.width × info.height`, vor Zuschnitt/Drehung; wie `compose.region`).

```ts
type Pt = { x: number; y: number };
interface Calibration { a: Pt; b: Pt; length: number; unit: 'mm' | 'cm' | 'm' }   // length in unit
interface Axes { originAtFirst: boolean; yUp: boolean; alignToScale: boolean }
interface MeasuredPoint { x: number; y: number; unsure: boolean }
interface TrackedObject { id: number; name: string; color: string; points: Record<number, MeasuredPoint> } // Schlüssel = Bildindex
type ArrowPos = 'start' | 'mid' | 'end';
interface Overlays { numbers: boolean; path: boolean; v: boolean; a: boolean; scaleBar: boolean; dt: boolean }
interface ArrowSettings { vPos: ArrowPos; aPos: ArrowPos; vScale: number | null; aScale: number | null } // Scale: Meter Bildlänge je 1 m/s bzw. 1 m/s²; null = automatisch
interface Measurement { calibration: Calibration | null; axes: Axes; objects: TrackedObject[]; active: number; overlays: Overlays; arrows: ArrowSettings }
```

- Standard: `axes = { originAtFirst: true, yUp: true, alignToScale: false }`, ein Objekt „Objekt 1“, `overlays = { numbers: true, path: true, v: false, a: false, scaleBar: true, dt: true }`, `arrows = { vPos: 'end', aPos: 'mid', vScale: null, aScale: null }`.
- Objektfarben: 1 `#e2382b` (rot), 2 `#1f9d55` (grün), 3 `#0a8fb0` (türkis). v-Pfeile `#007aff` (blau), a-Pfeile `#af52de` (lila), unsicher `#ff9500` (orange). Farben gelten in hell und dunkel (sie liegen auf dem Bild, nicht auf der Oberfläche).
- Punkte werden nach Bildindex gespeichert: Ändert sich der Zeitabstand, bleiben Punkte auf weiterhin gewählten Bildern erhalten; andere werden ausgeblendet (nicht gelöscht). Abgewählte (`excluded`) Positionen zählen nicht.
- Objekte: hinzufügen bis 3 (Name „Objekt n“), umbenennen (Doppeltipp auf Chip → Eingabe), löschen (nicht das letzte).

## 4. Physik (`src/lib/physics/`, reine Funktionen, Unit-getestet)

- **Maßstab:** `metersPerPixel = toMeters(length, unit) / |b − a|` (px). Ungültig, wenn |b − a| < 4 px oder length ≤ 0.
- **Koordinaten:** Pixel → Meter: Verschiebung zum Ursprung (Position 0 des jeweiligen Objekts, sonst Startpunkt `a` der Maßstabsstrecke), optional Drehung so, dass die x-Achse entlang a→b zeigt (`alignToScale`), dann `y` gespiegelt, wenn `yUp`.
- **Reihen:** Für ein Objekt die gewählten Positionen (`selectFrameIndices(selection)`) mit Punkt; Positionsnummer = Index in der Liste der gewählten Positionen (0, 1, 2 …), auch wenn dazwischen ein Punkt fehlt.
- **v:** für aufeinanderfolgende gewählte Positionen i, i+1 **beide gemessen**: vᵢ = (Pᵢ₊₁ − Pᵢ) / (tᵢ₊₁ − tᵢ), Vektor und Betrag. Fehlt ein Punkt, entfallen die angrenzenden v.
- **a:** aus vᵢ und vᵢ₊₁ (beide vorhanden): aᵢ = (vᵢ₊₁ − vᵢ) / ((tᵢ₊₂ − tᵢ) / 2) (bei gleichmäßigem Δt = (vᵢ₊₁ − vᵢ)/Δt).
- **s:** Weg entlang der Bahn (Summe der Teilstrecken bis i).
- **Tabelle Zeile i:** Nr. i, t, x, y, s, vₓ, v_y, |v| (= vᵢ), aₓ, a_y, |a| (= aᵢ); fehlende Werte „–“.
- **Pfeile im Bild** (Pixelraum, unabhängig von den Achsen): Ist Lv die reale Pfeillänge in m je 1 m/s (also in s), gilt `pfeil_px = v_px_pro_s · Lv` mit v_px_pro_s = (Pᵢ₊₁ − Pᵢ)/Δtᵢ in Video-Pixeln. Analog a mit La in s².
  - v-Ansatzpunkt: Anfang = Pᵢ, Mitte = (Pᵢ+Pᵢ₊₁)/2, Ende = Pᵢ₊₁.
  - a-Ansatzpunkt: Anfang = (Pᵢ+Pᵢ₊₁)/2, Mitte = Pᵢ₊₁, Ende = (Pᵢ₊₁+Pᵢ₊₂)/2.
- **Automatischer Pfeilmaßstab:** so, dass der längste Pfeil (über alle Objekte) ≈ 18 % der längeren Bildkante (Zuschnitt) lang ist; gerundet auf 1/2/5·10ᵏ der realen Länge; Anzeige z. B. „1 m/s ≙ 10 cm“.

## 5. Positionen vorschlagen (`src/lib/measure/detect.ts`)

- Der Vorschau-Render (`renderStrobe`) liefert zusätzlich je gewähltem Bild bis zu 5 **Kandidaten** (zusammenhängende Flächen der binären Bewegungsmaske mit derselben Schwelle und demselben Bereich wie das Bild; 4er-Nachbarschaft auf einem Raster mit höchstens 320 px langer Kante): Schwerpunkt (in Video-Pixeln), Fläche (Anteil am Bild). Flächen < 0,02 % des Bildes werden verworfen. Ergebnis `RenderResult.detections: { index: number; candidates: { x: number; y: number; area: number }[] }[]`; gilt für die Einstellungen in `settingsKey`.
- **Zuordnung** (reine Funktion, Hauptthread): Positionen in Zeitreihenfolge; Vorhersage aus den zwei letzten zugeordneten Punkten (konstante Geschwindigkeit), sonst letzter Punkt, sonst (erste Position) größter Kandidat. Ist für das aktive Objekt bereits ein Punkt gesetzt, der *nicht* unsicher ist, bleibt er stehen und dient als Anker. Kandidaten, die in diesem Bild schon einem anderen Objekt (nicht unsicher) zugeordnet sind, werden übersprungen.
- **Unsicher**, wenn kein Kandidat, wenn der gewählte Kandidat weiter als 25 % der längeren Bildkante von der Vorhersage liegt, wenn die Fläche um mehr als Faktor 2,5 vom Median der übrigen abweicht, oder wenn ein zweiter Kandidat ähnlich nah ist (Abstand < 1,3 × bester). Ohne Kandidat wird kein Punkt gesetzt.
- Knopf **„Vorschlagen“** in der Karte „Positionen“: nutzt die Kandidaten der aktuellen Vorschau (passender `settingsKey`); ist die Vorschau noch nicht fertig, zeigt der Knopf „Wird berechnet …“ und führt nach Ende der Vorschau aus. Überschreibt nur leere und unsichere Punkte des aktiven Objekts.

## 6. Oberfläche

Grundlayout und Komponenten wie Plan 1b. Phasen-Umschalter: Video, Bild, Maßstab, Messen, Auswerten – alle tippbar, sobald ein Video geladen ist.

### 6.1 Bühne in Maßstab/Messen/Auswerten
- Zeigt das Stroboskopbild (Vorschau) mit Zoom/Pan wie bisher (Doppeltipp = zurücksetzen, zwei Finger = zoomen/verschieben; mit einem Finger wird bei Zoom > 1 *nicht* verschoben, wenn die Berührung auf einem Punkt beginnt oder ein Werkzeug aktiv ist).
- Darüber eine **Einblendungs-Ebene** (Canvas), gezeichnet von demselben Modul wie der Export (`src/lib/overlay/draw.ts`), mit Strichstärken in Bildschirmpixeln.
- **Lupe** beim Ziehen eines Punktes: Kreis 120 px, 3-fache Vergrößerung des Vorschaubildes, Fadenkreuz, sitzt 90 px oberhalb des Fingers (am oberen Rand: unterhalb). Der Punkt liegt genau unter dem Fadenkreuz-Zentrum = Fingerposition.
- Bedienziel Punkt: Treffer innerhalb 22 CSS-px.

### 6.2 Phase „Maßstab“
- Hinweis auf der Bühne: ohne Maßstab „Anfang der bekannten Strecke antippen“, nach dem ersten Tipp „Ende antippen“, danach „Endpunkte ziehen zum Korrigieren“.
- Maßstabslinie blau (`--acc`) mit runden Endpunkten und Beschriftung (Länge mit Einheit).
- Rechte Spalte:
  - Karte **„Bekannte Strecke“**: Erklärsatz; Eingabefeld Länge (Dezimalkomma, `inputmode="decimal"`), Segment mm / cm / m (Standard cm, Länge Standard leer); Zeile „≙ 812 Pixel · 1 Pixel = 1,23 mm“; Knopf „Strecke neu setzen“.
  - Karte **„Koordinaten“**: Switches „Ursprung bei Position 0“, „y nach oben“, „Achse an Maßstab ausrichten“.
  - Hinweiskarte (orange-weich): „Der Maßstab gilt nur in der Ebene der Bewegung – das Lineal sollte auf Höhe der Bahn liegen.“
  - Primär: „Weiter zu Messen ›“.

### 6.3 Phase „Messen“
- **Bühne:** Tippen setzt den Punkt der **aktuellen Position** des aktiven Objekts (erste Position ohne Punkt; nach dem Setzen weiter zur nächsten). Tippen nahe an einen vorhandenen Punkt (beliebige Position, aktives Objekt) wählt ihn; Ziehen verschiebt ihn (Lupe), danach ist er nicht mehr unsicher. Hinweis unten links: „Position 3 antippen“ / „Alle Positionen gesetzt“ / „Punkt 6 unsicher – antippen und ziehen zum Korrigieren“.
- **Miniaturleiste unten** (wie Phase Bild): Positionen mit Nummer; gesetzte mit Häkchen-Punkt in Objektfarbe, unsichere orange; Tippen wählt die aktuelle Position.
- Rechte Spalte:
  - Karte **„Objekte“**: Chips mit Farbpunkt und Name (aktives umrandet), „＋“ (bis 3). Langes Drücken/Doppeltipp auf Chip → Umbenennen/Löschen (kleines Menü).
  - Karte **„Positionen“**: groß „6 / 8“ + „gesetzt · 1 unsicher“; Knöpfe „Vorschlagen“, „Punkt löschen“ (aktuelle Position), „Alle löschen“ (mit Rückfrage).
  - Karte **„Einblendungen“**: Switches Nummern, Bahn, Maßstabsbalken (nur mit Maßstab), Δt.
  - Karte **„Pfeile“**: Switches v-Pfeile (ab 2 gesetzten aufeinanderfolgenden Punkten und mit Maßstab), a-Pfeile (ab 3); sonst deaktiviert mit grauer Zeile „Ab 2 Punkten und mit Maßstab“ bzw. „Ab 3 Punkten“. Darunter (nur wenn ein Pfeil an ist): „Position im Intervall“ Segment Anfang/Mitte/Ende je für v und a; Maßstab „1 m/s ≙ [10] cm“ und „1 m/s² ≙ [2] cm“ (Eingabe in cm, Dezimalkomma) mit Knopf „Auto“ (aktiv = automatisch).
- Ohne Maßstab: Hinweiskarte „Für Pfeile und Tabelle zuerst den Maßstab festlegen“ mit Knopf „Zum Maßstab“.

### 6.4 Phase „Auswerten“
- Geteilte Ansicht: Bühne links (flex 0.85), rechts Karte **„Messtabelle · ‹Objekt›“** (flex 1.15). Hochformat: untereinander.
- Kopf der Karte: Objektwahl (Segment, wenn > 1 Objekt), „Spalten …“ (Aufklapper mit Switches je Spalte und Segment Nachkommastellen 2 / 3; Standard t, x, y, vₓ, v_y, |v|, |a| an; s, aₓ, a_y aus), „CSV“ (Symbol share).
- Tabelle: Kopf „t in s“, „x in m“ … ; Zahlen mit Dezimalkomma, `tabular-nums`, rechtsbündig; Minus als „−“. Tippen auf Zeile hebt den Punkt im Bild hervor (großer Kreis in `--acc` mit weißem Rand) und umgekehrt Tippen auf Punkt markiert Zeile.
- Ohne Maßstab: Karte mit Text und Knopf „Zum Maßstab“. Ohne Punkte: „Noch keine Positionen gemessen“ mit Knopf „Zum Messen“.
- Unter der Tabelle grau: „Diagramme folgen in einer späteren Version.“

### 6.5 Export
- Bild-Export: Switch **„Einblendungen“** (Standard an, wenn Punkte oder Maßstab vorhanden). Zeichnet Nummern, Bahn, Pfeile, Legende, Maßstabsbalken mit denselben Einstellungen wie die Bühne, Strichstärken relativ zur Bildgröße (lange Kante/1000 als Einheit). Unsicher-Markierung und Hervorhebung erscheinen nicht. Δt-Einblendung ersetzt die Infozeile nicht; ist „Infozeile“ an, wird die Δt-Einblendung nicht doppelt gezeichnet.
- CSV (`src/lib/export/csv.ts`): Standard Semikolon + Dezimalkomma; Option „International (Komma, Punkt)“ im CSV-Dialog (kleines Fenster mit Segment und „Teilen / Sichern“). Spalten je Objekt `Nr;t in s;x in m;y in m;vx in m/s;vy in m/s;|v| in m/s;ax in m/s²;ay in m/s²;|a| in m/s²` (alle Spalten, unabhängig von der Anzeige), bei mehreren Objekten nacheinander mit Leerzeile und Kopfzeile „Objekt: Name“. Dateiname `‹Video›_messung.csv`. UTF-8 mit BOM (Excel). Fehlende Werte leer.

### 6.6 Einblendungen zeichnen (`src/lib/overlay/draw.ts`)
`drawOverlay(ctx, scene, map, unit)`: `map(p)` bildet Video-Pixel auf Zielpixel ab (Viewer: `videoToViewer`·dpr; Export: Zuschnitt+Drehung+Skalierung), `unit` = Grundstrichstärke in Zielpixeln. Text wird nie gedreht.
- Punkt: Kreis r = 3,5·unit, weiß gefüllt, Rand 2·unit in Objektfarbe; unsicher: Rand orange, r = 4,5·unit (nur Bildschirm).
- Nummern: fett, 11·unit, Objektfarbe mit weißem Rand (Halo 3·unit), versetzt 8·unit nach unten links des Punktes.
- Bahn: Polylinie der gesetzten Punkte in Zeitreihenfolge, 1,5·unit, gestrichelt (4·unit, 3·unit), Objektfarbe.
- v-Pfeil: Linie 2,5·unit blau, gefüllte Spitze (Länge 9·unit); a-Pfeil: lila, Doppelspitze. Pfeile < 2·unit Länge werden nicht gezeichnet.
- Legende (oben links, weiße Karte 85 % deckend, Radius 8·unit): je eingeblendetem Pfeiltyp Musterpfeil in Länge des Maßstabs (gekappt auf 30 % Bildbreite) mit „≙ 1 m/s“ bzw. „≙ 1 m/s²“; Maßstabsbalken (schwarz, Endstriche) mit runder Länge (1/2/5·10ᵏ, ≈ 15 % Bildbreite) und Beschriftung „50 cm“.
- Δt unten rechts „Δt = 0,133 s“ (Halo).
- Hervorhebung (nur Bildschirm): Kreis r = 9·unit, Füllung `#007aff`, weißer Rand.
- Maßstabsstrecke (nur in Phase Maßstab): Linie 2,5·unit `#007aff`, Endpunkte r = 6·unit weiß mit blauem Rand, Beschriftung in blauer Pille.

## 7. Zustand und Anbindung

- `Project.measure: Measurement` (`$state`), zurückgesetzt bei `load()`.
- `Project.preview.detections` wie 5. Der Render berechnet sie immer mit (Kosten: ein Labeling je Bild auf ≤ 320 px).
- ProfiView: Phasen `massstab`, `messen`, `auswerten` aktiv (deaktiviert ohne Video). Neue Komponenten: `MassstabTab.svelte`, `MessenTab.svelte`, `AuswertenTab.svelte` (in `src/ui/profi/`), `MeasureLayer.svelte` (Zeichen- und Eingabeebene mit Lupe, in `src/ui/components/`), `MeasureTable.svelte`, `CsvDialog.svelte`.
- Viewer bekommt optional `onTransform`-freie Nutzung: die Ebene liegt im `tools`-Snippet und bekommt `geo()` + Vorschaubild (für die Lupe).

## 8. Tests

- **Unit:** Maßstab (px→m, Einheiten), Achsen (Ursprung, y nach oben, Drehung), v/a mit gleichmäßigem und ungleichmäßigem Δt (Prüfwerte: freier Fall mit g = 9,81 → a ≈ 9,81; gleichförmig 1,5 m/s), fehlende Punkte, Pfeilansatzpunkte, Auto-Pfeilmaßstab (runde Werte), Kandidatensuche (synthetische Masken mit 1 und 2 Objekten, Flächenfilter), Zuordnung (Vorhersage, Anker, unsicher-Regeln, zweites Objekt), CSV (deutsch/international, BOM, Mehrobjekt, leere Werte), Overlay-Zeichnen gegen einen aufzeichnenden Kontext (Anzahl Pfeile, keine Unsicher-Markierung im Export-Modus), Export-Abbildung (Zuschnitt/Drehung).
- **E2E (Edge):** Maßstab setzen (zwei Tipps + Länge) zeigt „1 Pixel = …“; Messen: Vorschlagen setzt Punkte auf dem synthetischen Ballvideo, Punkt ziehen ändert Tabelle; Pfeile ein → Legende sichtbar (Pixelprobe auf der Einblendungs-Ebene); Auswerten zeigt Tabellenzeilen mit Dezimalkomma; CSV-Download enthält Kopfzeile; Export mit Einblendungen unterscheidet sich vom Export ohne; Sichtprüfung hell/dunkel der drei Phasen (Screenshots als Artefakte); Hochformat ohne horizontales Scrollen.
- Abnahme-Checkliste `docs/abnahme-plan2.md` für das iPad.

## 9. Nicht Teil von Plan 2

Diagramme, Ausgleichskurven, glatte Bahn/Parabel, Template-Tracking über alle Bilder, Komponentenpfeile, PDF (Plan 3); Projektspeicher, Vorlagen-Sperren, Schülerassistent (Plan 4); verschiebbare Beschriftungen.
