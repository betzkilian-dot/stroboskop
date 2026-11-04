# Plan 3b – Korrekturen nach iPad-Test von Plan 3 (Spezifikation)

Stand: 2026-11-04 · ändert Plan 2/3-Spezifikationen an den genannten Stellen.

## 1. Texte und Weiter-Knopf
- Phase Maßstab: Hinweiskarte „Der Maßstab gilt nur in der Ebene der Bewegung …“ entfällt. Karte „Bekannte Strecke“: Erklärsatz endet nach „… im Bild.“ – der Zusatz „z. B. am Lineal“ entfällt.
- Phase Messen: Primärknopf **„Weiter zu Auswerten ›“** am Ende der Einstellungsspalte (wie „Weiter zu Messen ›“ in Maßstab).

## 2. x-y-Diagramm
- Neue Kachel **„x-y“** in der Größenauswahl (nach t-|a|; eigene Gruppe „Bahn“ nicht nötig). Waagerechte Achse x („x in m“), senkrechte y („y in m“). Punkte in Zeitreihenfolge, zusätzlich dünne Verbindungslinie in Objektfarbe.
- **Gleicher Maßstab:** 1 m auf beiden Achsen gleich lang; der Datenbereich wird so erweitert, dass das Seitenverhältnis des Plotbereichs passt (zentriert), Teilstriche mit `niceTicks`.
- Ausgleich wie bei den t-Diagrammen, aber als **y = f(x)** (Gerade, Ursprungsgerade, Parabel); Gleichung z. B. „y = −0,512·x² + 0,98·x + 0,01“, R² wie gehabt. Die Kurve läuft über den x-Datenbereich.
- Gilt für Bildschirm, PNG und PDF (gemeinsames Layout).

## 3. Diagramme für den Bericht sammeln
- In Auswerten unter dem Diagramm Knopf **„Zum Bericht hinzufügen“** (Symbol plus). Er speichert die aktuelle Einstellung (Größe, Ausgleich, Gleichung, R²) als Eintrag in `Measurement.reportCharts` (Liste, keine Doppelten mit gleicher Größe und gleichem Ausgleich; höchstens 8).
- Darunter Liste **„Im Bericht“**: je Eintrag „t-x · Parabel“ mit Knopf „Entfernen“ (Symbol close, 44 px). Antippen eines Eintrags stellt das Diagramm darauf ein (Vorschau).
- Teilen-Fenster, PDF-Bericht: Die Diagramm-Mehrfachauswahl und das Ausgleich-Segment entfallen. Switch „Diagramme“ bleibt; darunter grau: „3 Diagramme aus Auswerten“ bzw., wenn die Liste leer ist, „Aktuelles Diagramm aus Auswerten (t-x)“. Der Bericht verwendet die gesammelten Einträge in ihrer Reihenfolge, sonst das aktuell eingestellte Diagramm.

## 4. Erstellen und Teilen in einem Schritt
- Das Teilen-Fenster hat für Bild, PDF und CSV nur noch **einen** Primärknopf **„Teilen“**.
- Die Datei wird **im Hintergrund vorbereitet**: sofort beim Öffnen des Fensters, beim Wechsel des Formats und nach jeder Änderung einer Option (entprellt 400 ms; eine neue Vorbereitung verdrängt die laufende). Während der Vorbereitung zeigt der Knopf „Wird vorbereitet …“ (deaktiviert, mit Fortschritt bei Bild/PDF); danach „Teilen“. Tippen ruft direkt das Teilen-Menü auf (Benutzeraktion bleibt erhalten).
- Während der Vorbereitung gilt die Export-Sperre (Vorschauen werden vorgemerkt, R19). Schließt man das Fenster, wird die Vorbereitung abgebrochen und die Sperre aufgehoben.
- Toasts und Schließen nach Erfolg wie bisher; Abbruch im Teilen-Menü lässt das Fenster offen; Fehler als Hinweis im Fenster mit Knopf „Erneut versuchen“.

## 5. Tests
- Unit: x-y-Layout (gleicher Maßstab: px je m auf beiden Achsen gleich), Ausgleich y(x), reportCharts (hinzufügen ohne Doppelte, Grenze 8, entfernen), Bericht nutzt Liste bzw. aktuelles Diagramm.
- E2E: Texte entfernt; Messen → „Weiter zu Auswerten“; x-y-Kachel zeigt „x in m“ waagerecht; Zum Bericht hinzufügen/Entfernen; Teilen-Fenster: ein Knopf, wird nach Vorbereitung aktiv, ein Klick lädt herunter (Bild, PDF, CSV); Option ändern → Knopf zeigt kurz „Wird vorbereitet …“; Schließen während der Vorbereitung hebt die Sperre auf (Vorschau rendert danach).
