# Abnahme Plan 2 auf dem iPad (Maßstab, Messen, Auswerten)

Diese Checkliste wird einmal auf einem echten iPad durchgegangen, nach der Abnahme von Plan 1 (siehe `abnahme-plan1.md` für App aufs iPad bringen und Testmaterial). Sie deckt, was die automatischen Tests (Edge/Windows) nicht prüfen können: Finger- und Pencil-Eingabe, Lupe, Teilen-Menü, Numbers.

## 1. Testmaterial

- [ ] Ein **eigenes Video** einer Bewegung (z. B. Stroboskop-Ball, Wagen auf der Bahn, Wurf) mit einem **Lineal oder bekannten Maß** im Bild, das auf Höhe der Bahn liegt
- [ ] Ein zweites Video mit **mehreren Objekten** (für den Objekt-Wechsel)

## 2. Maßstab

- [ ] Phase **Maßstab**: Hinweis „Anfang der bekannten Strecke antippen“ erscheint
- [ ] Ersten Punkt mit dem **Finger** setzen (einfaches Antippen, noch keine Lupe), dann den Punkt **greifen und ziehen**: die **Lupe** erscheint am Finger und verdeckt die Stelle nicht (Lupe steht neben bzw. über dem Finger)
- [ ] Zweiten Punkt setzen; Länge eingeben (Komma als Dezimaltrenner), Einheit mm/cm/m wählen: Anzeige „1 Pixel = …“ ist plausibel
- [ ] **Endpunkte ziehen** zum Korrigieren: Lupe folgt, die Anzeige aktualisiert sich
- [ ] „Strecke neu setzen“ löscht die Strecke, neu setzen funktioniert
- [ ] Koordinaten: „Ursprung bei Position 0“, „y nach oben“, „Achse an Maßstab ausrichten“ wirken sich später in der Tabelle aus
- [ ] Maßstabsbalken oben links im Bild ist lesbar, in Hell und Dunkel
- [ ] **Achse drehen**: den Pfeil der x-Achse an der Spitze mit dem Finger greifen und drehen; „Drehung: …°“ folgt, die y-Achse läuft mit; der Schaft der Achse lässt sich ziehen und verschiebt den Ursprung (der Maßstab bleibt)

## 3. Messen

- [ ] **Vorschlagen** am eigenen Video: Die Erkennung setzt die meisten Positionen sinnvoll (nicht zwingend alle); Zähler „n / m gesetzt“ stimmt
- [ ] **Punkt ziehen mit dem Apple Pencil**: gesetzten Punkt greifen und verschieben; die Lupe erscheint, der Punkt landet genau unter der Spitze
- [ ] Dasselbe mit dem **Finger**
- [ ] Position in der Positionsleiste antippen: „Punkt löschen“ entfernt den Punkt; Tipp ins Bild setzt ihn wieder
- [ ] „Alle löschen“ fragt/leert wie erwartet
- [ ] **Objekte**: weiteres Objekt anlegen, umbenennen, wechseln; Punkte und Farben bleiben je Objekt getrennt
- [ ] **Einblendungen** Nummern, Bahn, Maßstabsbalken, Δt lassen sich einzeln ein- und ausschalten
- [ ] **v-Pfeile** (und a-Pfeile) erscheinen; die **Legende** oben links im Bild nennt den Pfeilmaßstab („≙ 1 m/s“) und ist lesbar
- [ ] Ohne Maßstab sind die Pfeile deaktiviert, „Zum Maßstab“ führt zurück
- [ ] **Tippen mit dem Finger setzt den Punkt** dort, wo der Finger war; auch ein leicht verrutschtes Antippen zählt als Tippen (kein ungewolltes Ziehen)
- [ ] **Legende ziehen**: die Legende mit dem Finger packen und nach unten rechts schieben; sie bleibt im Bild; **im Export (Bild erzeugen)** steht sie an derselben Stelle
- [ ] Schalter **Koordinatensystem** blendet die Achsen im Bild (und im Export) ein und aus

## 4. Auswerten

- [ ] **Tabelle** zeigt t, x, y, v und a mit Komma; Werte sind plausibel (Gleichförmige Bewegung: v ungefähr konstant, a ungefähr 0)
- [ ] Zeile antippen: markiert die Zeile und hebt den Punkt im Bild hervor
- [ ] **Spalten …**: Spalten ein-/ausblenden, Nachkommastellen 2/3
- [ ] Im **Querformat** steht die Tabelle breit neben dem Bild und zeigt alle Spalten ohne Wischen; im Hochformat passen ebenfalls alle Spalten
- [ ] Mit mehreren Objekten: Umschalter „Objekt“ wechselt die Tabelle
- [ ] **Diagramm** (t-x, t-y, t-v, t-a): Größe wählbar; „Parabel“ bei einem **Wurf** (Ball im Bogen): y(t) liegt auf der Parabel, Gleichung und R² (nahe 1) werden angezeigt und sind lesbar; „Gerade“ bei gleichförmiger Bewegung; Diagrammpunkt antippen markiert die Tabellenzeile
- [ ] **CSV**: „Teilen / Sichern“ öffnet das Teilen-Menü; Datei in **Numbers** öffnen: Spalten getrennt, Zahlen als Zahlen (Komma), Umlaute und Zeichen (Δ, ²) korrekt

## 5. Export mit Einblendungen

- [ ] Phase Bild (oder Teilen oben): Bild erzeugen: **Einblendungen** (Nummern, Bahn, Pfeile, Legende, Maßstabsbalken) sind im exportierten Bild enthalten und entsprechen der Vorschau
- [ ] Mit ausgeschalteten Einblendungen fehlen sie im Export
- [ ] Teilen-Menü / „Bild sichern“ in Fotos: Auflösung und Aussehen stimmen

## 6. Darstellung

- [ ] **Hell/Dunkel**: iPad zwischen Hell und Dunkel umschalten; Maßstab, Messen und Auswerten gut lesbar, Tabelle und Legende lesbar, keine weißen Flächen im Dunkelmodus (die Einblendungen auf dem Bild haben feste Farben)
- [ ] **Querformat**: Bühne links, Bedienung rechts; nichts abgeschnitten
- [ ] **Hochformat**: Bühne oben, Bedienung darunter scrollbar, Positionsleiste unten sichtbar, kein Seitwärts-Scrollen der Seite
- [ ] Alle Schaltflächen und Tabellenzeilen sind mit dem Finger sicher zu treffen
- [ ] Diagramm in Hell und Dunkel: Achsenbeschriftung, Gitter, Gleichung und R² lesbar, Diagramm nicht gequetscht

## 7. Überarbeitung Plan 2b (iPad)

- [ ] **Video**: „Zuschneiden“ öffnet den Rahmen; er hat acht Griffe, die sich mit dem Finger sicher greifen lassen (auch an den Bildrändern), und bleibt nach dem Loslassen stehen; „Fertig“ übernimmt, „Abbrechen“ verwirft
- [ ] **Bild**: die Spalte mit den Einstellungen ist fest, ohne „Mehr …“; sie **wackelt nicht** und springt nicht beim Wischen oder beim Ändern eines Reglers; alle Einstellungen sind durch Scrollen innerhalb der Spalte erreichbar
- [ ] **Antippen** setzt Punkte auch mit etwas zittrigem Finger zuverlässig (Antipp-Toleranz)
- [ ] **Maßstab**: Achsen drehen und verschieben (siehe 2); Messen zeigt die gedrehten Achsen, wenn „Koordinatensystem“ an ist
- [ ] **Messen**: Legende verschieben und im Export prüfen (siehe 3)
- [ ] **Auswerten**: Diagramm mit Parabel beim Wurf (siehe 4)
- [ ] Hoch- und Querformat, Hell und Dunkel: nichts abgeschnitten (Phasen-Beschriftungen oben, Karten, Diagrammbeschriftung), kein Seitwärts-Scrollen

## Ergebnis

| Punkt | OK | Auffälligkeit |
|---|---|---|
| 2 Maßstab / Lupe | | |
| 3 Messen / Pencil | | |
| 4 Auswerten / CSV | | |
| 5 Export | | |
| 6 Darstellung | | |
| 7 Überarbeitung Plan 2b | | |

Datum: __________ Gerät/iPadOS: __________ Unterschrift: __________
