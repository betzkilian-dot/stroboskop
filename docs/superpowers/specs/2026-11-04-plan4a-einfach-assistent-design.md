# Plan 4a – Modus „Einfach“: Schritt-Assistent (Spezifikation)

Stand: 2026-11-04 · Grundlage: Entwurf `.superpowers/brainstorm/782-1793800530/content/plan4a-schueler-v3.html` (freigegeben) und Antworten des Nutzers.
Übergeordnet: `2026-11-03-stroboskop-app-design.md` §6.1, §6.3. Ändert dort: Modi heißen **„Einfach“** und **„Erweitert“** (statt Schüler/Profi); es gibt **keine PIN** (gilt auch für Plan 4b).

## 1. Ziel und Rahmen
- Jeder Schüler hat ein eigenes iPad. Ziel: ein Schüler erzeugt in wenigen Minuten aus einem Video ein Stroboskopbild mit korrektem Δt, auf Wunsch mit markierten Punkten und Bahn, und teilt es.
- Nicht enthalten: Klassenvorlage und Freigaben (Plan 4b), Projektspeicher/.strobo (Plan 4c), Maßstab, Pfeile, Tabelle, Diagramme, PDF, CSV im Modus „Einfach“.

## 2. Startseite
- Titel „Stroboskop“, zwei große Kacheln (je ≥ 44 px hoch, nebeneinander, im Hochformat untereinander):
  - **Einfach** – „Schritt für Schritt zum Stroboskopbild“.
  - **Erweitert** – „Alle Funktionen: Maßstab, Messen, Auswerten“.
- Keine gemerkte Wahl: die Startseite erscheint bei jedem App-Start und nach „Beenden“.
- „Erweitert“ zeigt danach die bisherige Videoauswahl („Video aufnehmen“ / „Video wählen“) und dann die bisherige Ansicht mit Reitern; deren Kopfzeile erhält links einen Knopf „‹ Start“ zurück zur Startseite (Projekt wird verworfen; Rückfrage „Projekt verwerfen?“ nur, wenn ein Video geladen ist).
- Installationshinweis „Zum Home-Bildschirm“ bleibt.

## 3. Assistent – gemeinsamer Rahmen
- Kopfzeile: links **„✕ Beenden“** (Rückfrage „Beenden? Das Bild geht verloren.“, wenn ein Video geladen ist; dann zurück zur Startseite), rechts davon die **Fortschrittsleiste** mit fünf Feldern „1 Video · 2 Zuschneiden · 3 Bild · 4 Markieren · 5 Teilen“ (erledigt: hell hinterlegt in Akzentfarbe, aktuell: gefüllt). Erledigte Felder sind antippbar (Rücksprung); spätere nicht.
- Fußzeile: links „‹ Zurück“ (in Schritt 1: „Anderes Video“), rechts Primärknopf **„Weiter ›“** (in Schritt 5: links „‹ Zurück“, rechts „Neues Video“).
- Große Bedienelemente (Kacheln, Tippfläche ≥ 44 px, Schrift ≥ 15 px für Bedientexte), Design-Tokens aus `src/app.css`, hell/dunkel automatisch, Hoch- und Querformat (Querformat: Bild links, Bedienung rechts; Hochformat: Bild oben).
- Ein Projektzustand (`Project`) wie im Modus „Erweitert“; nichts wird gespeichert.

## 4. Schritte

### 4.1 Video
- Ohne Video: zwei große Kacheln „Video aufnehmen“ / „Video wählen“ (gleiche Dateiwahl wie bisher); Fehler als Hinweis.
- Mit Video: Videobild, darüber Satz **„Wo beginnt und endet die Bewegung?“**, Filmleiste mit Markierungen Anfang/Ende (ziehbar wie im Modus „Erweitert“) und drei Kacheln **„⏮ Anfang hier“**, **„▶ Abspielen“** (bzw. „⏸ Pause“), **„Ende hier ⏭“**.
- „Weiter“ ist aktiv, sobald ein Video geladen ist.

### 4.2 Zuschneiden
- Satz **„Ziehe den Rahmen um den Bereich der Bewegung.“**, Zuschnitt-Rahmen wie im Modus „Erweitert“ (Eckgriffe, verschieben), Kacheln **„Ganzes Bild“** (setzt Zuschnitt zurück) und **„↻ Drehen“** (90°-Schritte).
- Überspringbar: „Weiter“ ohne Änderung = ganzes Bild.

### 4.3 Bild
- Live-Vorschau des Stroboskopbildes.
- Große Anzeige **„Δt = 0,10 s“** (Dezimalkomma, Formatierung und Berechnung wie im Modus „Erweitert“), darunter grau „7 Positionen · jedes 3. Bild“.
- Regler für den Bildabstand mit Beschriftung „dichter“ / „weiter“ (gleiche Wertebereiche wie der Abstand-Regler im Modus „Erweitert“).
- **Darstellung** als drei Kacheln (eine gewählt):
  - **Automatisch** – „passt meistens“ (= Modus `difference`, Standard),
  - **Helles Objekt** – „z. B. Ball vor dunkler Wand“ (= `lighten`),
  - **Dunkles Objekt** – „z. B. vor heller Wand“ (= `darken`).
- Empfindlichkeit, Hintergrund und übrige Feinoptionen bleiben auf den Standardwerten des Modus „Erweitert“ (inkl. automatischer Schwelle) und sind nicht sichtbar.

### 4.4 Markieren (freiwillig)
- Ein Objekt; Bedienung wie Phase Messen im Modus „Erweitert“ (gleiche Bühne mit Lupe, Tipp-Toleranz, Ziehen zum Korrigieren): Anzeige **„Position 3 antippen“** bzw. „Alle Positionen markiert“, Kacheln **„‹ Vorige“** / **„Nächste ›“**, Kachel **„✨ Vorschlagen“** – „App setzt alle Punkte, du korrigierst“; grau „3 von 7 markiert“.
- Sobald mindestens ein Punkt gesetzt ist, werden **Punkte, Nummern (ab 0) und Bahn automatisch** eingezeichnet – ohne Schalter. Kein Maßstab, kein Koordinatensystem, keine Pfeile, keine Legende.
- Zusätzlicher Knopf **„Alle Punkte löschen“** (Rückfrage).
- „Weiter“ immer aktiv; ohne Punkte wird das Bild ohne Einblendungen geteilt.

### 4.5 Teilen
- Vorschau des fertigen Bildes (mit Punkten, Nummern, Bahn, falls markiert) und grau „Mit Infozeile „Δt = 0,10 s“ unten im Bild“.
- Ein Primärknopf **„⬆ Bild teilen“**; Datei wie Bild-Export „Klein (für Arbeitsblätter)“ (lange Kante 1600 px), JPEG, Infozeile an, Einblendungen wie in 4.4. Vorbereitung im Hintergrund wie im Teilen-Fenster (Knopf „Wird vorbereitet …“, dann „Bild teilen“; ein Tippen öffnet das Teilen-Menü; Toasts „Gespeichert“/„Heruntergeladen“; Abbruch im Teilen-Menü bleibt auf der Seite; Fehler mit „Erneut versuchen“).
- Grau darunter: „In Fotos sichern, per AirDrop an die Lehrkraft, in Dateien …“.
- „Neues Video“: Rückfrage wie Beenden, dann Schritt 1 ohne Video.

## 5. Technik
- Neue Oberfläche `src/ui/einfach/` (Assistent-Rahmen + je Schritt eine Komponente); wiederverwendet `Project`, Viewer, Filmleiste, Zuschnitt-Editor, Mess-Bühne, `renderExportImage`/Zwischenspeicher und `shareOrDownload`. Keine Änderung an Rechenlogik.
- `App.svelte` bekommt einen Zustand `mode: 'start' | 'einfach' | 'erweitert'`.
- Keine neuen npm-Abhängigkeiten; Deutsch, Dezimalkomma, „−“.

## 6. Tests
- Unit: Abbildung Kachel → Darstellung; Schrittfreigabe (Weiter in Schritt 1 erst mit Video); Einblendungen in „Einfach“ (mit Punkten: numbers + path an, alles andere aus; ohne Punkte: keine).
- E2E (Edge): Startseite zeigt „Einfach“/„Erweitert“; „Erweitert“ führt zur bisherigen Ansicht und „‹ Start“ zurück; „Einfach“: Video laden → Anfang/Ende setzen → Zuschneiden überspringen → Darstellung „Helles Objekt“ wählen, Δt-Anzeige ändert sich mit dem Regler → Vorschlagen setzt Punkte → „Bild teilen“ lädt JPEG herunter; Fortschrittsleiste springt zurück; Beenden mit Rückfrage.
- Screenshots hell/dunkel, Quer- und Hochformat; Abnahme-Checkliste `docs/abnahme-plan4a.md`.
