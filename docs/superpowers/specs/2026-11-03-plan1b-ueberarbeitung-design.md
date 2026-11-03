# Plan 1b – Überarbeitung Design & Fehler (Spezifikation)

Stand: 2026-11-03 · Grundlage: iPad-Abnahme von Plan 1 (Rückmeldung der Lehrkraft) und freigegebene Entwürfe „Variante A – folgt dem iPad“ (`.superpowers/brainstorm/3959-1793729735/content/design-a-hell-dunkel.html`).
Übergeordnete Spezifikation: `docs/superpowers/specs/2026-11-03-stroboskop-app-design.md` (bleibt gültig; dieses Dokument ändert nur UI, Bild-Modi und Export-Rückmeldung).

## 1. Ziel

Die App soll modern, schlicht und übersichtlich aussehen, sich an den iPad-Einstellungen orientieren und die in der Abnahme gefundenen Fehler beheben. Funktionsumfang von Plan 1 bleibt; neu sind Video-Wiedergabe mit Anfang/Ende-Markierung, eine Rechen-Anzeige und Export-Rückmeldung.

## 2. Abnahme-Befunde → Maßnahme

| Befund | Ursache | Maßnahme |
|---|---|---|
| Design langweilig, unübersichtlich, Serifenschrift | keine Schrift/Gestaltung festgelegt | Abschnitt 3–5 |
| „Komische Bilder“ über Δt | Positionsleiste in der Höhe abgeschnitten | neue Miniaturleiste unten (5.3) |
| Verirrtes Pfeilsymbol neben Δt | Layoutfehler | entfällt mit neuem Layout; Test prüft, dass keine ungestylten Elemente auftauchen |
| 4K/60 fps „schwarz“ | Rechnung lief noch, keine sichtbare Anzeige | Rechen-Anzeige (6) |
| Schwelle wirkungslos | wirkt nur in „Differenz“, Regler aber immer sichtbar | Maske auch in Aufhellen/Abdunkeln; Regler nur wo wirksam (7) |
| Nur „Differenz“ brauchbar | Aufhellen/Abdunkeln ohne Bewegungsmaske | (7) |
| Export ohne Rückmeldung, Fenster bleibt offen | fehlte | (8) |
| Wunsch: Video abspielen, Anfang/Ende antippen | fehlte | Video-Phase (5.2) |
| Offene Fehler A (Hänger bei schnellem Öffnen), B (veraltete Schwelle beim schnellen Export) | siehe Plan-1-Abschluss | (9) |

## 3. Erscheinungsbild

- **Hell/Dunkel automatisch** über `prefers-color-scheme`; kein eigener Umschalter.
- **Farb-Tokens** (CSS-Variablen auf `:root`, Werte nach Apple-Systemfarben):

| Token | hell | dunkel |
|---|---|---|
| `--bg` | `#f2f2f7` | `#000000` |
| `--card` | `#ffffff` | `#1c1c1e` |
| `--fill` | `#e9e9ef` | `#2c2c2e` |
| `--fg` | `#1c1c1e` | `#f2f2f7` |
| `--muted` | `#8a8a8e` | `#8e8e93` |
| `--sep` | `#e3e3e8` | `#38383a` |
| `--acc` | `#007aff` | `#0a84ff` |
| `--acc-soft` | `#e5f0ff` | `#0a84ff26` |
| `--stage` | `#dfe3e8` | `#111111` |
| `--ok` | `#34c759` | `#30d158` |
| `--warn` | `#ff9500` | `#ff9f0a` |
| `--danger` | `#ff3b30` | `#ff453a` |

- **Schrift:** `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`; Grundgröße 16 px; Zahlen mit `font-variant-numeric: tabular-nums`.
- **Formen:** Karten Radius 12 px, Schaltflächen 9–10 px; Abstände 8/12/16 px.
- **Tippflächen** mindestens 44 × 44 px.
- **Symbole:** eigene Inline-SVG-Strichsymbole (Strichstärke 2, `currentColor`), keine Emojis. Symbolsatz: video, strobe, ruler, pin, chart, share, camera, folder, play, pause, step-back, step-forward, rotate, crop, more, check, close, warning.
- Ungestylte Browser-Standardelemente (Radio-Buttons, Selects mit Systemoptik neben gestylten Elementen) kommen nicht mehr vor; Auswahl erfolgt über Segment-Schalter/Kacheln.

## 4. Grundlayout (Querformat, Hochformat siehe 4.1)

- **Kopfleiste** (Karte, 52 px): Projektname links; Phasen-Umschalter (Segment-Control mit Symbol + Text: Video, Bild, Maßstab, Messen, Auswerten; noch nicht gebaute Phasen sichtbar, aber ausgegraut und nicht tippbar); rechts „Neu“ und primär „Teilen“ (öffnet Export).
- **Arbeitsfläche:** links Bühne (Bild/Video, Radius 12, Hintergrund `--stage`), rechts Einstellungsspalte 300 px aus Karten mit Überschrift in Versalien (`--muted`, 11 px).
- **Unten** (nur Phase Bild): Miniaturleiste.

### 4.1 Hochformat
Unter 900 px Breite rückt die Einstellungsspalte unter die Bühne (volle Breite, scrollbar); die Bühne bekommt mindestens 50 % der Höhe.

## 5. Bildschirme

### 5.1 Startseite
- Titel „Stroboskop“, kurzer Untertitel.
- Zwei große Kacheln: **„Video aufnehmen“** (Symbol camera; `<input type=file accept="video/*" capture="environment">`) und **„Video auswählen“** (Symbol folder; ohne `capture` → iPad bietet Fotos/Dateien an).
- Während des Ladens: Rechen-Anzeige (6) mit „Video wird geöffnet …“; Fehler als Hinweiskarte mit verständlichem Text.

### 5.2 Phase „Video“
- **Player:** `<video playsinline muted>` mit dem geladenen Video (Object-URL), Tippen auf das Video = Abspielen/Pause; Play-Symbol mittig, solange pausiert.
- **Zeitleiste** (Karte unter dem Video): 12 Miniaturen, roter Wiedergabe-Kopf (ziehbar = Spulen), zwei Markierungen (Akzentfarbe, ziehbar) für Anfang und Ende; Bereich außerhalb abgedunkelt. Darunter Zeiten in Sekunden mit Komma: Gesamtanfang, „Auswahl a s – b s (d s)“, Gesamtende.
- **Rechte Spalte:**
  - Karte „Video“: Chips Bildrate (`60 Bilder/s ✓` grün bei sicherer Erkennung; orange `Bildrate prüfen` bei unsicherer → öffnet die bestehende Korrektur), Auflösung, Dauer.
  - Karte „Bereich festlegen“: große Tasten **„Anfang hier“** / **„Ende hier“**; darunter ◀︎ Bild, Abspielen/Pause, Bild ▶︎, Geschwindigkeit (Umschalten 1× → ½× → ¼×).
  - Karte „Ausrichtung“: Drehen, Zuschneiden (bestehende Editoren).
  - Primär: **„Weiter zu Bild ›“**.
- **Regeln:**
  - „Anfang hier“/„Ende hier“ setzen die Auswahl auf das Videobild, dessen Zeitstempel der aktuellen Wiedergabezeit am nächsten liegt (Zeitstempel aus dem Demux).
  - Liegt ein neuer Anfang hinter dem Ende (oder ein Ende vor dem Anfang), wird die andere Markierung auf Videoende bzw. -anfang zurückgesetzt.
  - Einzelbild-Tasten pausieren und springen genau ein Videobild (nächster/voriger Zeitstempel).
  - Die Auswahl bleibt intern in Bildindizes (`FrameSelection`); Positions-Vorschau aktualisiert sich wie bisher.

### 5.3 Phase „Bild“
- **Bühne:** Stroboskop-Vorschau.
- **Karte „Zeitabstand“:** groß `Δt = 0,133 s`, daneben „8 Positionen“; ein Schieberegler für den Abstand (in Videobildern). Tippen auf den Δt-Wert öffnet ein Eingabefeld für Wunsch-Δt (Komma erlaubt), das auf den nächstmöglichen Abstand rundet. Die bisherigen Felder „Abstand“ und „Wunsch-Δt“ entfallen.
- **Karte „Darstellung“:** 2×2-Kacheln Differenz, Aufhellen, Abdunkeln, Transparent.
- **Karte „Empfindlichkeit“** (bisher „Schwelle“): Regler + „Auto“; nur sichtbar bei Differenz, Aufhellen, Abdunkeln. Während des Ziehens wird wie bisher die Maske eingeblendet.
- **„Mehr …“** (aufklappbar, standardmäßig zu): Weiche Kante, Verlauf, Spätere oben (nur Differenz), Hintergrund (Segment: Automatisch / Erstes / Letztes / Gewähltes Bild + „Bild wählen“), Bereich zeichnen / löschen.
- **Miniaturleiste unten** (feste Höhe 64 px, horizontal scrollbar): Miniaturen der Positionen im richtigen Seitenverhältnis, nicht abgeschnitten; im Modus „Bild wählen“ antippbar.

## 6. Rechen-Anzeige

- Erscheint, wenn eine Berechnung (Öffnen, Vorschau, Export) länger als 300 ms läuft; schwebende Karte mittig über der Bühne, darunter bleibt das letzte Bild abgedunkelt sichtbar (oder leere Bühne).
- Inhalt: fette Zeile (Tätigkeit), graue Zeile mit Schritt (z. B. „Hintergrund ermitteln“), Fortschrittsbalken aus dem bestehenden gewichteten Fortschritt.
- Texte: „Video wird geöffnet …“, „Bild wird berechnet …“, „Export wird erstellt …“; Schritte: „Video lesen“, „Hintergrund ermitteln“, „Bild zusammensetzen“.
- Die Bedienung bleibt möglich; eine neue Einstellung bricht die laufende Vorschau ab (bestehendes Supersede).

## 7. Bild-Modi mit Bewegungsmaske

- **Differenz:** unverändert.
- **Aufhellen / Abdunkeln:** starten vom gewählten Hintergrund (nicht vom ersten Bild). Je Bild: Bewegungsmaske `m` wie bei Differenz (Schwelle, weiche Kante, Bereich); Kandidat `c = max(out, f)` bzw. `min(out, f)` je Kanal; `out = out + (c − out) · m · opacity` (opacity aus „Verlauf“ wie bei Differenz).
- **Transparent:** unverändert (Mittelwert aller Bilder, ohne Maske).
- Auto-Schwelle wird für alle maskierten Modi berechnet.

## 8. Export-Rückmeldung

- Export bleibt zweistufig (Bild erzeugen → „Teilen / Sichern“).
- Teilen erfolgreich → kurze Meldung **„Gespeichert ✓“** (Toast unten mittig, 2,5 s), Export-Fenster schließt.
- Rückfall Download → Meldung **„Heruntergeladen ✓“**, Fenster schließt.
- Abbruch im Teilen-Menü → Fenster bleibt offen, keine Meldung, erneutes Teilen möglich.
- Fehler → Hinweis im Fenster, Fenster bleibt offen.

## 9. Technische Restfehler aus Plan 1

- **A:** `engine.open()` hält die laufende Operation synchron fest (`const busy = inflight`) und wartet in `openImpl` darauf → kein Hänger bei schnell aufeinanderfolgendem Öffnen.
- **B:** Die Vorschau speichert den Einstellungs-Schlüssel, mit dem ihre Auto-Schwelle berechnet wurde; der Export nutzt `preview.autoThreshold` nur bei passendem Schlüssel, sonst berechnet er sie neu.

## 10. Tests

- Unit: maskiertes Aufhellen/Abdunkeln (Hintergrund bleibt außerhalb der Maske unverändert; bewegtes Objekt erscheint an allen Positionen), Zeit → Bildindex (nächster Zeitstempel, Grenzen), Anfang/Ende-Regeln, Fehler A und B.
- E2E (Edge): Video-Phase (Abspielen, Anfang/Ende setzen ändert Positionsanzahl), Empfindlichkeit nur in maskierten Modi sichtbar und ändert die Vorschau in Aufhellen, Rechen-Anzeige erscheint bei langer Berechnung, Export schließt nach Erfolg mit Meldung, Darstellung in hell und dunkel (`colorScheme`-Emulation) ohne Serifenschrift (berechnete `font-family` enthält keine Serifenschrift) und mit sichtbaren, nicht abgeschnittenen Miniaturen.
- Screenshots hell/dunkel jeder Phase werden als Testartefakte abgelegt (Sichtprüfung, kein Pixelvergleich).
- Abnahme-Checkliste für das iPad wird um die neuen Punkte ergänzt.

## 11. Nicht Teil von Plan 1b

Maßstab, Messen, Auswerten, Projektspeicher, Klassenvorlage/PIN, Schülerassistent (Plan 2–4; sie übernehmen dieses Design).
