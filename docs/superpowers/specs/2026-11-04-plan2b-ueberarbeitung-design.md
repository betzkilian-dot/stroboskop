# Plan 2b – Überarbeitung nach iPad-Test (Spezifikation)

Stand: 2026-11-04 · Grundlage: iPad-Test von Plan 2 durch die Lehrkraft (Screenshots `Testungen-vom-ipad/20261104_0903*.png`) und Antworten vom 2026-11-04.
Übergeordnet: `2026-11-04-plan2-messen-anzeigen-design.md` (bleibt gültig, dieses Dokument ändert/ergänzt), Design aus Plan 1b.

## 1. Befunde → Maßnahmen

| Befund | Ursache | Maßnahme |
|---|---|---|
| Messen: Tippen setzt keinen Punkt | Viewer wertet jede Fingerbewegung > 2 px (je Schritt) als „bewegt“ → kein `tap` | 2 |
| Zuschneiden: Rechteck erst beim Tippen, verschwindet danach | Editor zeigt nur den Entwurf | 3 |
| Rechte Spalte lässt sich seitlich verschieben, „Gewählt“ abgeschnitten, Schieberegler schwer bedienbar | Inhalt breiter als 300 px (Hintergrund-Segment), Spalte scrollt in beide Richtungen | 4 |
| „Mehr …“ in Bild wird immer geöffnet | unnötiger Aufklapper | 4 |
| Ursprung und Achsen nicht sichtbar, Achse nicht frei drehbar | nicht gezeichnet | 5 |
| Legende verdeckt das Bild | feste Position oben links | 6 |
| Diagramme fehlen | geplant für Plan 3 | 7 |

## 2. Tippen auf der Bühne

- Ein Finger gilt als **Tipp**, solange er sich seit dem Aufsetzen insgesamt weniger als **10 CSS-px** bewegt hat (Abstand Aufsetzpunkt → aktueller Punkt), unabhängig von einzelnen Bewegungsschritten.
- Bei aktivem Werkzeug und Zoom > 1 verschiebt ein Finger das Bild erst, wenn die 10-px-Grenze überschritten ist.
- Wurde ein Punkt gegriffen (`press` = true), beginnt `drag` ebenfalls erst nach 10 px; sonst `release` = Auswahl (bisherige Regel).
- Apple Pencil verhält sich wie ein Finger.

## 3. Zuschneiden (Phase Video)

- „Zuschneiden“ öffnet das Standbild mit einem **sichtbaren Rahmen** (beim ersten Mal: ganzes Bild, sonst bestehender Zuschnitt). Außerhalb abgedunkelt (schwarz 55 %).
- Rahmen anpassen: **vier Ecken** (runde Griffe, Tippfläche 44 px) und **vier Kanten** ziehen; im Inneren ziehen verschiebt den Rahmen. Mindestgröße 8 Video-px (bestehend), Rahmen bleibt im Bild.
- Unter/neben dem Bild: Knöpfe **„Zurücksetzen“** (ganzes Bild) und primär **„Fertig“** (übernimmt), Escape/„Abbrechen“ verwirft.
- Außerhalb des Bearbeitens zeigt der Player den Zuschnitt als Rahmen mit abgedunkeltem Außenbereich, damit sichtbar ist, was eingestellt ist.

## 4. Phase Bild – rechte Spalte

- Die Einstellungsspalte scrollt **nur senkrecht**; nie waagerecht (`overflow-x: hidden`, alle Inhalte `min-width: 0`, Text bricht um). Gilt für alle Phasen.
- Schieberegler: `touch-action: none` auf dem Regler, damit das Ziehen nicht die Spalte scrollt; Höhe 44 px.
- „Mehr …“ entfällt: Inhalt steht direkt als Karte **„Weitere Einstellungen“** (Weiche Kante, Verlauf, Spätere oben, Hintergrund, Bereich).
- „Hintergrund“ als **2×2-Kacheln** (Automatisch, Erstes, Letztes, Gewählt) wie „Darstellung“.

## 5. Koordinatensystem

- Modell: `Axes { originAtFirst: boolean; origin: Pt | null; angle: number; yUp: boolean }` – `origin` = frei gesetzter Ursprung (Video-px), `angle` = Drehung der x-Achse gegen die Bild-x-Achse in Rad (positiv = im Bild gegen den Uhrzeigersinn, wie die Mathematik bei y nach oben). `alignToScale` entfällt (ersetzt durch Knopf).
- Ursprung: `originAtFirst` → Position 0 des jeweiligen Objekts; sonst `origin`; sonst Startpunkt der Maßstabsstrecke; sonst (0,0).
- Umrechnung (`toWorld`): Verschiebung zum Ursprung, Drehung um −angle (im mathematischen Sinn mit y nach oben), Spiegelung wenn `yUp` = false.
- **Zeichnen** (`overlay`): Ursprung als Kreis (r = 5·unit, weiß, Rand 2·unit `#1c1c1e`), x-Achse und y-Achse als Pfeile (Länge 12 % der langen Bildkante, Strich 2·unit `#1c1c1e` mit weißem Halo 4·unit), beschriftet „x“ und „y“ an den Spitzen. Die y-Achse steht senkrecht zur x-Achse, Richtung nach `yUp`.
- **Phase Maßstab:** Koordinatensystem immer sichtbar. Ursprung ziehen → setzt `origin`, schaltet „Ursprung bei Position 0“ aus. Spitze der x-Achse ziehen → dreht (`angle`), rastet bei Vielfachen von 90° ein (± 3°). Karte „Koordinaten“: Switch „Ursprung bei Position 0“, Switch „y nach oben“, Zeile „Drehung: 0°“ (ganze Grad), Knöpfe „An Maßstab ausrichten“ (angle = Richtung a→b) und „Zurücksetzen“ (angle 0, origin null, originAtFirst true).
- **Messen/Export:** neuer Switch **„Koordinatensystem“** in „Einblendungen“ (Standard aus); dann wird es wie oben gezeichnet (Ursprung bei originAtFirst = Position 0 des aktiven Objekts).

## 6. Legende verschieben

- Modell: `Measurement.legendPos: { x: number; y: number }` – linke obere Ecke der Legende als Anteil (0..1) an Breite/Höhe des sichtbaren Bildes (Zuschnitt, gedreht); Standard `{ x: 0.02, y: 0.02 }`.
- `legendRect(scene, target, unit)` liefert das Rechteck in Zielpixeln (eine Funktion für Zeichnen und Treffertest); die Legende wird so begrenzt, dass sie ganz im Bild bleibt.
- In **Messen** und **Auswerten**: Legende antippen und ziehen verschiebt sie (Vorrang vor Punkten); Hinweis beim ersten Ziehen nicht nötig. Die Position gilt auch im Export.

## 7. Diagramme (Phase Auswerten)

- Unter der Messtabelle (Querformat: rechte Spalte unter der Tabelle; Hochformat: unter der Tabelle) Karte **„Diagramm“**.
- Kopf: Auswahl (Kacheln/Segmente, umbrechend) **t-x, t-y, t-vₓ, t-v_y, t-|v|, t-aₓ, t-a_y, t-|a|**; Standard t-x.
- Inhalt: Punktdiagramm (eigene SVG-Zeichnung, keine Bibliothek) für das gewählte Objekt bzw. alle Objekte mit Punkten (Farbe je Objekt), Achsen mit runden Teilstrichen (1/2/5·10ᵏ), Beschriftung „t in s“ / „x in m“ usw., Dezimalkomma, Gitterlinien `--sep`. Werte aus `computeRows` (v/a an ihrem Zeilen-t, wie Tabelle).
- **Ausgleich** (Segment): **keine / Gerade / Ursprungsgerade / Parabel**; Standard keine. Methode: kleinste Quadrate; Parabel y = a·t² + b·t + c; Ursprungsgerade y = m·t; Gerade y = m·t + b. Kurve in Objektfarbe gestrichelt über den Datenbereich.
- Switches **„Gleichung“** (Standard an) und **„R²“** (Standard an): Anzeige im Diagramm oben links, z. B. „x = 1,52·t + 0,01“, „y = −4,91·t² + 2,03·t + 0,00“, „R² = 0,998“; Koeffizienten 3 signifikante Stellen, Dezimalkomma, Minus „−“; Variablenname nach Größe (x, y, vₓ, v_y, |v|, aₓ, a_y, |a|). Bei weniger Punkten als nötig (Gerade 2, Ursprungsgerade 1, Parabel 3) Hinweis „Zu wenige Punkte für den Ausgleich“.
- Tippen auf einen Diagrammpunkt hebt die Zeile und den Punkt im Bild hervor (gleiche Auswahl wie Tabelle) und umgekehrt.
- Die Wahl (Größe, Ausgleich, Schalter) bleibt beim Phasenwechsel erhalten (im Messmodell gespeichert, `Measurement.chart`).

## 8. Tests

- Unit: Ausgleich (Gerade, Ursprungsgerade, Parabel, R², zu wenige Punkte, Prüfwerte freier Fall a ≈ −9,81/2 als t²-Koeffizient), Gleichungstext, Achsen-Umrechnung mit angle/origin, `legendRect` (Begrenzung), Teilstriche.
- E2E (Edge): Tipp mit 5 px Bewegung setzt in Messen einen Punkt; Zuschneiden mit Ecke ziehen + „Fertig“ zeigt Rahmen; Bild-Spalte ohne waagerechtes Scrollen (scrollWidth ≤ clientWidth) und „Gewählt“ sichtbar; Ursprung ziehen ändert Tabelle (x von Punkt 0 ≠ 0); Legende ziehen verschiebt sie (Pixelprobe); Diagramm t-x mit Gerade zeigt Gleichung und R²; Screenshots hell/dunkel der geänderten Ansichten.
- Abnahme-Checkliste `docs/abnahme-plan2.md` ergänzen.

## 9. Nicht Teil von Plan 2b

Diagramm-Export als Bild/PDF, s-t-Diagramm, Exponential-/andere Ausgleiche, Datengrundlage „alle Bilder“ (Plan 3).
