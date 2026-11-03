# Stroboskop-App – Design-Spezifikation

**Datum:** 2026-11-03
**Status:** Entwurf zur Freigabe

## 1. Ziel und Kontext

Eine Web-App (PWA) für das iPad, mit der im Physikunterricht (Schwerpunkt Kinematik, z. B. Klasse 8) aus Videos Stroboskopbilder erzeugt, beschriftet und ausgewertet werden.

- **Lehrkraft (Profimodus):** voller Funktionsumfang – Bilderzeugung mit Feinoptionen, Kalibrierung, Tracking, Pfeile, Bahn, Tabellen, Diagramme mit Ausgleichskurven, alle Exporte. Erstellt Klassenvorlagen, die festlegen, was Schüler nutzen dürfen.
- **Schüler (Schülermodus):** geführter Assistent. Kernaufgabe ist das Erstellen des Stroboskopbildes; Bahn, Pfeile, Messung usw. nur nach Freigabe durch die Lehrkraft.

**Erfolg:** Ein Schüler erzeugt aus einem selbst gefilmten Video in wenigen Minuten ein sauberes Stroboskopbild mit korrektem Δt; die Lehrkraft erstellt damit Material in Arbeitsblatt-Qualität (vgl. Beispiele in `Beispiele/`).

## 2. Rahmenbedingungen

| Thema | Festlegung |
|---|---|
| Plattform | Web-App/PWA, Safari auf iPadOS ≥ 16.4; installierbar über „Zum Home-Bildschirm“; voll offline-fähig nach erstem Aufruf |
| Entwicklung | Komplett unter Windows; statisches Hosting (z. B. GitHub Pages/Netlify), keine Server-Logik |
| Datenschutz | Alles lokal auf dem Gerät. Kein Video verlässt das iPad. Keine Konten, kein Backend |
| Austausch | Ausschließlich über Dateien (Teilen-Menü: AirDrop, Dateien, Schulplattform) |
| Sprache | Deutsch; Zahlen mit Dezimalkomma |
| Aufnahme | Immer vom Stativ/fest aufgelegt. Keine Bildstabilisierung (ggf. spätere Erweiterung) |
| Videoquellen | iPad-Kamera (30/60 fps), Zeitlupe (120/240 fps), fremde Videos inkl. Hochgeschwindigkeit; Formate MP4/MOV |
| Tech-Stack | TypeScript, Vite, Svelte; WebCodecs + mp4box.js; Web Worker; uPlot; pdf-lib; Vitest, Playwright (WebKit) |

## 3. Bilderzeugung

### 3.1 Videoeinlesen und Zeitbasis
- Einlesen per mp4box.js (Container) und WebCodecs `VideoDecoder` (bildgenau, mit Zeitstempeln).
- **Aufnahme-fps** wird aus den Metadaten bestimmt (inkl. Zeitlupen-Kennung). Ist sie nicht eindeutig, fragt die App nach. Das Feld „Aufnahme-fps“ ist immer manuell überschreibbar (getrennt von der Wiedergabe-fps der Datei).
- **Rückfallebene** ohne WebCodecs: HTML-Video-Element + Seek + Canvas, mit dauerhaftem Hinweis „Bildgenauigkeit eingeschränkt“.
- Nicht unterstütztes Format → Meldung mit Hinweis, das Video als MP4/MOV zu speichern.

### 3.2 Bildauswahl
- Zuschneiden auf Start/Ende.
- Jedes n-te Bild wird verwendet; **Δt = n / Aufnahme-fps**, live angezeigt mit Anzahl der Positionen.
- Alternativ Eingabe eines Wunsch-Δt → App wählt n und zeigt das tatsächliche Δt.
- Profimodus: einzelne Positionen abwählbar; dann Warnung „Δt nicht mehr gleichmäßig“.

### 3.3 Überlagerungsmodi
1. **Hintergrund-Differenz (Standard):** Hintergrund = pixelweiser Median über Stichprobenbilder; aus jedem ausgewählten Bild wird nur der bewegte Teil (Differenz > Schwelle, weiche Kante) auf den Hintergrund gesetzt.
2. **Aufhellen / Abdunkeln:** pixelweises Maximum bzw. Minimum.
3. **Transparent / Mittelwert:** klassische Mehrfachbelichtung.

### 3.4 Feinoptionen (Profimodus; im Schülermodus nur nach Freigabe)
- **Schwellen-Schieberegler** mit Live-Maskenansicht (erkannte Bewegung halbtransparent eingefärbt) und „Auto“-Knopf.
- Wirkbereich: eingezeichnete Region, außerhalb wird keine Bewegung übernommen.
- Hintergrundquelle: Median / erstes Bild / letztes Bild / frei gewähltes Bild.
- Deckkraft-Verlauf (frühere Positionen blasser).
- Reihenfolge (spätere Positionen oben oder unten).
- Zuschneiden und Drehen des Ergebnisbildes.

### 3.5 Kamerabewegung
Die App prüft die Hintergrundverschiebung und warnt: „Kamera hat sich bewegt – Ergebnis unscharf“.

## 4. Kalibrierung und Positionserfassung

### 4.1 Maßstab
- **Zweimal tippen** (Start- und Endpunkt einer bekannten Strecke im Bild), jeweils mit Lupe und Fadenkreuz; anschließend Eingabe der realen Länge mit Einheit (mm/cm/m). Punkte nachträglich verschiebbar. Gilt in beiden Modi.
- Hinweis: Maßstab gilt nur in der Bewegungsebene (Lineal auf Höhe der Bahn).
- Maßstabslinie im Bild/Export einblendbar.
- Optionales Koordinatensystem: Ursprung, Drehung der Achse, y nach oben (Standard).

### 4.2 Objekte
- Bis zu **3 Objekte** gleichzeitig, je mit eigener Farbe, eigener Tabelle und eigenen Diagrammreihen.

### 4.3 Positionen erfassen
- **Manuell:** pro Position Referenzpunkt antippen (Lupe mit Fadenkreuz, Apple Pencil unterstützt), nachträglich verschiebbar.
- **Automatisches Tracking:** Objekt im ersten Bild antippen; Verfolgung über Hintergrund-Differenz + Template-Matching. Unsichere Punkte werden gelb markiert und sind korrigierbar. Tracking wahlweise über alle Bilder oder nur die Stroboskop-Positionen.
- **Nummerierung** 0, 1, 2 … automatisch, Beschriftungen verschiebbar.

## 5. Auswertung

### 5.1 Berechnung
Für Positionen Pᵢ (in Metern, im gewählten Koordinatensystem) mit Zeitabstand Δt:
- **vᵢ = (Pᵢ₊₁ − Pᵢ) / Δt** – Vektor (vₓ, v_y) und Betrag |v|.
- **aᵢ = (vᵢ₊₁ − vᵢ) / Δt** – Vektor (aₓ, a_y) und Betrag |a|.
- s = Weg entlang der Bahn (Summe der Teilstrecken).
- Bei abgewählten Positionen wird mit den tatsächlichen Zeitabständen gerechnet.

### 5.2 Pfeile
- v-Pfeile und a-Pfeile getrennt ein-/ausblendbar; je Objekt eigene Farbe; v durchgezogen, a mit Doppelspitze.
- **Pfeilposition** (getrennt für v und a einstellbar): **Anfang** (bei Pᵢ), **Mitte** (zwischen Pᵢ und Pᵢ₊₁), **Ende** (bei Pᵢ₊₁) des jeweiligen Intervalls. Für a ist das Intervall das zwischen den beiden zugrundeliegenden v-Werten. **Standard: Ende.**
- **Pfeilmaßstab** eingebbar als „1 m/s ≙ L“ (L als reale Länge im Bildmaßstab, z. B. 10 cm) bzw. „1 m/s² ≙ L“, oder automatisch gewählt.
- Im Bild steht immer eine **Legende** (Musterpfeil mit „≙ 1 m/s“ bzw. „≙ 1 m/s²“).
- Optional **Komponentenpfeile** (vₓ, v_y bzw. aₓ, a_y).

### 5.3 Bahn
Wahlweise: Verbindungslinie der Positionen, glatte Kurve durch alle getrackten Bilder, oder Ausgleichskurve (z. B. Parabel).

### 5.4 Messtabelle
Pro Objekt; Spalten Nr., t, x, y, Δx im Bild, Δx real, v, a – einzeln ein-/ausblendbar; Nachkommastellen einstellbar.

### 5.5 Diagramme
- x-t, y-t, s-t, v-t (|v|, vₓ, v_y), a-t.
- Datengrundlage: Stroboskop-Positionen oder alle getrackten Bilder.
- Ausgleichsgerade und -parabel mit Formel, R² und physikalischer Deutung (z. B. „v = 1,23 m/s“, „a = 9,7 m/s²“).
- Verknüpfung: Tippen auf Diagrammpunkt hebt Position im Bild hervor und umgekehrt.

## 6. Benutzeroberfläche

### 6.1 Startseite
Projektgalerie; „Neues Projekt“ (Video aufnehmen / aus Fotos / aus Dateien); „Datei öffnen“ (.strobo, .strobovorlage); Wahl Schüler-/Profimodus; Installationshinweis „Zum Home-Bildschirm“.

### 6.2 Profimodus (Layout B: Arbeitsphasen als Reiter)
- Bild oben maximal groß (Zoom/Pan per Geste), darunter die Optionen der aktiven Phase, unten Reiter: **Video → Bild → Maßstab → Messen → Auswerten**; frei springbar.
- Kopfzeile: Projektname, Δt-Anzeige, Export.
- Im Reiter **Auswerten** wechselt die Ansicht auf geteilte Darstellung: Bild links, Tabelle und Diagramm rechts.
- Bedienziele ≥ 44 pt; Hoch- und Querformat.

### 6.3 Schülermodus (geführter Assistent)
- Fortschrittsleiste oben, große Bedienelemente, „Zurück/Weiter“ unten. Kein Aufgabentext.
- **Feste Schritte:** 1 Video → 2 Zuschneiden → 3 Bild (Abstand-Regler mit großer Δt-Anzeige, Live-Vorschau, Modus automatisch) → Export.
- **Optionale Schritte**, nur sichtbar wenn freigegeben:
  - **Maßstab** – erscheint automatisch, sobald etwas freigegeben ist, das reale Einheiten braucht (v-/a-Pfeile, Tabelle, Diagramme); entfällt, wenn der Maßstab in der Vorlage fest vorgegeben ist.
  - **Messen** (Positionen antippen; Tracking nur wenn freigegeben).
  - **Anzeigen** – Schalter für freigegebene Einblendungen (Nummern, Bahn, v-Pfeile, a-Pfeile, Komponenten); gesperrte erscheinen ausgegraut mit Schloss.
  - **Auswerten** – Tabelle und/oder Diagramme, wenn freigegeben.
- Ohne Vorlage: reiner Bild-Assistent (nur feste Schritte, Export als Bild).

### 6.4 Klassenvorlage (Lehrkraft)
- Im Profimodus erstellt; Datei `.strobovorlage`; einmal auf dem Schüler-iPad geöffnet, gilt sie für **alle neuen Projekte**, bis eine andere Vorlage geöffnet oder sie entfernt wird.
- **Freigaben (Schalter):** Positionsnummern, Bahn, v-Pfeile, a-Pfeile, Komponenten, Maßstab & Messen, Tracking, Tabelle, Diagramme, Schwellen-Regler.
- **Feste Vorgaben:** Pfeilposition, Pfeilmaßstäbe, Δt (frei oder fest), Maßstab (frei oder fest), erlaubte Exportformate (Bild, PDF, CSV), optional beigelegtes Video.
- Profimodus ist auf Schüler-iPads mit aktiver Vorlage durch eine einfache Lehrkraft-PIN geschützt.

## 7. Export

| Format | Inhalt |
|---|---|
| **Bild (PNG/JPEG)** | Alle aktiven Einblendungen inkl. Legenden, Maßstabslinie, optionale Infozeile (Δt, Maßstab). Auflösung: Original oder „für Arbeitsblatt“. Variante ohne Einblendungen. Bildausschnitt wählbar. |
| **Auswertungsbericht (PDF, A4)** | Titel, Name, Datum; Stroboskopbild; Kenndaten (Aufnahme-fps, Δt, Maßstab, Pfeilmaßstäbe); Messtabelle(n); Diagramme mit Ausgleichsformel. Nur freigegebene/eingeblendete Inhalte. |
| **Messdaten (CSV)** | Standard: Semikolon + Dezimalkomma; optional international (Komma + Punkt). Spalten je Objekt t, x, y, vₓ, v_y, \|v\|, aₓ, a_y, \|a\| mit Einheiten im Kopf. Stroboskop-Positionen oder alle getrackten Bilder. Im Profimodus immer, für Schüler nach Freigabe. |
| **Diagramme** | Einzeln als PNG oder SVG. |
| **Projektdatei (.strobo)** | ZIP: Video + JSON mit allen Einstellungen, Punkten, Maßstäben. |
| **Klassenvorlage (.strobovorlage)** | ZIP/JSON: Freigaben + Vorgaben, optional Video. |

Ausgabe über das iPad-Teilen-Menü; Bilder optional direkt in die Fotomediathek.

## 8. Architektur

| Modul | Verantwortung |
|---|---|
| `video/` | Demux (mp4box.js), Metadaten/Aufnahme-fps, Dekodierung (WebCodecs), Rückfallebene |
| `frames/` | Zuschnitt, Auswahl jedes n-ten Bildes, Δt (reine Logik) |
| `compose/` | Median-Hintergrund, Differenzmaske, Überlagerungsmodi, Deckkraft-Verlauf (Web Worker) |
| `tracking/` | Automatische Verfolgung mit Unsicherheitswert (Web Worker) |
| `physics/` | Kalibrierung, Koordinatensystem, px→m, v/a-Vektoren, Pfeilposition, Ausgleichsrechnung (reine Mathematik) |
| `overlay/` | Zeichnen von Nummern, Bahn, Pfeilen, Legenden, Maßstab – identisch für Bildschirm und Export |
| `charts/` | Diagramme (uPlot) |
| `export/` | PNG/JPEG, PDF (pdf-lib), CSV, SVG, .strobo, .strobovorlage |
| `project/` | Projektzustand, Speicherung (OPFS/IndexedDB), Freigabe-Logik der Vorlage |
| `ui/` | Svelte: Startseite, Profimodus, Schüler-Assistent, Vorlagen-Editor |

**Datenfluss:** Video → frames → compose → Kalibrierung + Positionen (manuell/tracking) → physics → overlay/charts/Tabelle → export.

**Speicherstrategie:** Nie alle Bilder gleichzeitig im Speicher. Median-Hintergrund aus 30–50 Stichprobenbildern; Verarbeitung im Datenstrom; Vorschau in reduzierter Arbeitsauflösung; Export rechnet in voller Auflösung neu. Bei Speichermangel automatische Reduktion der Arbeitsauflösung.

**Fehlerbehandlung (verständliche Meldungen):** nicht unterstütztes Format; fehlendes WebCodecs (Rückfallebene); unklare fps (Nachfrage); Kamerabewegung (Warnung); Speichermangel (Auflösung reduzieren); Tracking verloren (gelber Punkt).

**Offline:** Service Worker cacht die gesamte App.

## 9. Tests
- **Unit (Vitest):** `physics`, `frames`, CSV-Formatierung – Prüfwerte u. a. aus den Arbeitsblättern (z. B. Δt = 1/12 s = 0,083 s; 4 fps → Δt = 0,25 s).
- **compose/tracking:** synthetische Testvideos (Objekt auf bekannter Bahn) mit bekannten Soll-Positionen.
- **Ende-zu-Ende (Playwright, WebKit):** Schüler-Assistent mit und ohne Vorlage; Profimodus Export.
- **Manuell:** Abnahme auf einem echten iPad (Kamera-Video, Zeitlupe, Offline-Betrieb, Teilen-Menü).

## 10. Abgrenzung

**Nicht in Version 1 (spätere Erweiterungen):**
- Arbeitsblatt-Generator (Bild + leere Tabelle als PDF/Word)
- Animation des entstehenden Stroboskopbildes (Video/GIF)
- Bildstabilisierung für freihändige Aufnahmen

**Bewusst ausgeschlossen:**
- Server, Konten, Klassenverwaltung, Cloud-Speicher
- Aufgabentexte in der App; automatische Prüfung von Schülerrechnungen
- Andere Formate als MP4/MOV
