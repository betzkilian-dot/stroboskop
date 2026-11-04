# Plan 3 – Bericht, Diagramm-Export, s-t, Komponenten (Spezifikation)

Stand: 2026-11-04 · Grundlage: Entwurf `.superpowers/brainstorm/782-1793800530/content/plan3-bericht.html` (freigegeben: „sehr gut“) und Antworten: Diagramme im Bericht frei wählbar, Name wird abgefragt.
Übergeordnet: `2026-11-03-stroboskop-app-design.md` §5.2, §5.5, §7; Plan 2/2b/2c.

## 1. Umfang

1. s-t-Diagramm (Weg entlang der Bahn).
2. Komponentenpfeile (vₓ, v_y bzw. aₓ, a_y) im Bild und Export.
3. Diagramm als Bild (PNG) teilen.
4. PDF-Bericht (A4) mit frei wählbaren Diagrammen.
Nicht enthalten: Tracking über alle Videobilder (zurückgestellt), SVG-Export, Ausgleichskurve als Bahn im Bild.

## 2. s-t

- Größe `s` (Row.s, Weg entlang der Bahn, schon berechnet) als zusätzliche Kachel **t-s** im Diagramm (zwischen t-y und t-vₓ); Achse „s in m“, Gleichungsvariable „s“.

## 3. Komponentenpfeile

- Neuer Switch **„Komponenten“** in Messen → Karte „Pfeile“ (nur sichtbar, wenn v- oder a-Pfeile an), Modell `Overlays.components: boolean` (Standard aus).
- Komponenten entlang der Koordinatenachsen (mit Drehung und yUp): für jeden v-Pfeil zwei Pfeile vom selben Ansatzpunkt, Länge = Projektion des Pfeils auf x- bzw. y-Achse; gleiche Farbe wie der Hauptpfeil, Strich 1,5·unit, gestrichelt (5·unit, 3·unit), einfache Spitze 7·unit; Komponenten < 2·unit werden nicht gezeichnet. a analog (Doppelspitze entfällt bei Komponenten). Legende zusätzlich Zeile „– – Komponenten“.
- Bei `axes.dims` = 'x' bzw. 'y' wird nur die Komponente dieser Achse gezeichnet.
- Gilt für Bühne und Export.

## 4. Diagramm als Bild

- Knopf **„Diagramm als Bild teilen“** (Symbol share) unter dem Diagramm in Auswerten.
- PNG 1600 × 1000 px, immer **helles Farbschema** (weißer Hintergrund, Text `#1c1c1e`, Gitter `#e3e3e8`), gleiche Inhalte wie die Ansicht (Punkte aller Objekte, Ausgleich, Gleichung/R² nach Schaltern), oben Titelzeile „t-x · Objekt 1“. Datei `‹Video›_diagramm_t-x.png` (Größe ohne Sonderzeichen: x, y, s, vx, vy, v, ax, ay, a).
- Teilen über `shareOrDownload` mit Meldungen „Gespeichert“ / „Heruntergeladen“ wie beim Bild-Export.
- Bildschirm-Diagramm (SVG) und Bild-Diagramm (Canvas) nutzen dieselbe reine Layout-Funktion (Achsenbereiche, Teilstriche, Punkte, Kurvenpunkte, Gleichungstext), nur die Zeichenfunktion unterscheidet sich.

## 5. PDF-Bericht

### 5.1 Teilen-Fenster
- Oben Segment **„Bild | PDF-Bericht | Messdaten (CSV)“** (bisheriges Bild-Export-Fenster wird erweitert; CSV-Teil übernimmt die Optionen des CSV-Fensters, das CSV-Fenster in Auswerten bleibt zusätzlich bestehen).
- PDF-Bericht:
  - Felder **Titel** (Standard: Videoname ohne Endung) und **Name / Klasse** (Textfeld, leer erlaubt; der zuletzt eingegebene Name wird lokal im Browser gemerkt). Datum automatisch (TT.MM.JJJJ).
  - Switches: **Stroboskopbild mit Einblendungen**, **Kenndaten**, **Messtabelle(n)**, **Diagramme** (alle Standard an; ohne Maßstab sind Tabelle/Diagramme deaktiviert mit Hinweis „Für Tabelle und Diagramme zuerst den Maßstab festlegen“).
  - Bei „Diagramme“: Kacheln zur **Mehrfachauswahl** der Größen (t-x, t-y, t-s, t-vₓ, t-v_y, t-|v|, t-aₓ, t-a_y, t-|a|), vorausgewählt die aktuelle Auswahl in Auswerten; Segment **Ausgleich** (keine / Gerade / Ursprungsgerade / Parabel, vorausgewählt wie in Auswerten); Gleichung/R² wie in Auswerten.
  - Primär **„PDF erstellen“** → Rechen-Anzeige „Bericht wird erstellt …“ → dann „Teilen / Sichern“ (zweistufig wie Bild-Export wegen iPad-Benutzeraktion). Datei `‹Video›_bericht.pdf`.

### 5.2 Seitenaufbau (A4 hoch, Ränder 15 mm, helles Schema)
1. Titel (fett, 18 pt), darunter Zeile „Name: … · Datum“ links/rechts, Trennlinie.
2. Stroboskopbild mit Einblendungen (wie Bild-Export „Klein“, Einblendungen an, Infozeile aus), volle Breite, höchstens 40 % der Seitenhöhe.
3. Kenndaten als zweispaltige Tabelle: Aufnahme (fps, ggf. „Zeitlupe“), Δt, Positionen, Maßstab („1,00 m ≙ 812 Pixel“ oder „kein Maßstab“), Pfeilmaßstäbe (nur wenn Pfeile an).
4. Messtabelle je Objekt mit Überschrift „Messtabelle · Objekt 1“: Spalten wie in Auswerten sichtbar, Nachkommastellen wie dort.
5. Diagramme: je Diagramm volle Breite, Höhe 70 mm, mit Titelzeile.
- Inhalte fließen auf Folgeseiten weiter (Tabellenzeilen werden umbrochen, Kopfzeile auf jeder Seite wiederholt; ein Diagramm wird nie geteilt).
- Fußzeile jeder Seite: „Erstellt mit Stroboskop“ links, „Seite n von m“ rechts.

### 5.3 Technik
- Seiten werden als Bilder gerendert (Canvas, 200 dpi ≙ 1654 × 2339 px, JPEG Qualität 0,9) und in ein selbst geschriebenes, minimales PDF (eine JPEG-Grafik je Seite, `DCTDecode`) eingebettet – keine neue Bibliothek, funktioniert offline, alle Zeichen (Δ, ≙, ², −, Tiefstellung) korrekt.
- Text im PDF ist dadurch nicht markierbar (bewusst in Kauf genommen).

## 6. Tests

- Unit: PDF-Schreiber (Kopf `%PDF-1.4`, Objekte, gültige xref-Offsets, Seitenzahl, `%%EOF`); Diagramm-Layout (Bereiche, Teilstriche, Kurve über Datenbereich, gleiche Ergebnisse für SVG und Canvas); Komponenten (Projektion auf gedrehte Achsen, dims); Seitenumbruch (Anzahl Seiten bei vielen Tabellenzeilen, Diagramm nicht geteilt); Dateinamen.
- E2E: t-s-Kachel zeigt „s in m“; Komponenten-Switch ändert die Bühne; „Diagramm als Bild teilen“ lädt PNG; PDF-Bericht: Felder, Diagramm-Mehrfachauswahl, Download beginnt mit `%PDF` und enthält ≥ 1 Seite; Name wird beim nächsten Öffnen vorbelegt.
- Screenshots hell/dunkel; Abnahme-Checkliste `docs/abnahme-plan3.md`.
