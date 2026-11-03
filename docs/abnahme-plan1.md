# Abnahme Plan 1 auf dem iPad (Stroboskopbild)

Diese Checkliste wird einmal auf einem echten iPad durchgegangen. Sie deckt, was die automatischen Tests (Edge/Windows) nicht prüfen können: HEVC, Teilen-Menü, Home-Bildschirm, Offline.

## 0. App aufs iPad bringen

### Variante A: Im WLAN vom PC (nur zum schnellen Ausprobieren)

1. Auf dem PC: `npm run build`, danach `npx vite preview --host --port 4173`.
2. PC-IP ermitteln (`ipconfig`, IPv4-Adresse), iPad im selben WLAN.
3. Auf dem iPad in Safari öffnen: `http://<PC-IP>:4173`.
4. Ggf. Windows-Firewall für Port 4173 (privates Netz) erlauben.

**Einschränkung:** Service Worker (Offline) und Installation als Web-App funktionieren in Safari nur über **HTTPS** (oder `localhost`). Eine `http://192.168...`-Adresse zählt nicht als sicher. Über diese Variante lassen sich deshalb alle Punkte außer 8 (Offline / Home-Bildschirm) prüfen.

### Variante B: Statisches HTTPS-Hosting (für Offline und Home-Bildschirm)

1. Die App wird bei jedem Push auf `main` **automatisch** unter https://betzkilian-dot.github.io/stroboskop/ veröffentlicht (GitHub Pages). Es ist nichts hochzuladen; nach einem Push kurz warten, bis der Build-Lauf grün ist.
2. Auf dem iPad https://betzkilian-dot.github.io/stroboskop/ in Safari öffnen.
3. (Alternativ von Hand: `npm run build` erzeugt `dist/`, das z. B. per Netlify Drop hochgeladen werden kann; die App benutzt relative Pfade.)
4. Teilen-Symbol, **Zum Home-Bildschirm**, **Hinzufügen**. Symbol „Stroboskop“ erscheint.

## 1. Testmaterial

- [ ] iPad-Video **quer** (Aufnahme mit der iPad-Kamera, Standard-Format HEVC/„Hohe Effizienz“)
- [ ] iPad-Video **hochkant** (HEVC)
- [ ] **Zeitlupe 240 fps** (Kamera, Modus Zeitlupe)
- [ ] **4K-Video, ca. 30 s**
- [ ] Ein **aus der Hand gefilmtes** Video (Kamera wird bewegt)
- [ ] Je ein Video **aus Fotos** und **aus Dateien** gewählt (siehe Abschnitt 2a)
- [ ] **Hochkant- oder 4K-Video** auf einem iPad mit nur 3 GB RAM (z. B. iPad 9. Generation)
- [ ] Ein **HDR-Video** (HEVC Main10 / Dolby Vision; auf neueren iPads Standard der Kamera)

## 2. Video laden und dekodieren (HEVC)

HEVC konnte unter Windows/Edge nicht getestet werden. Das muss hier sicher funktionieren.

- [ ] Querformat-Video laden: Bild erscheint, Ausrichtung stimmt, keine Fehlermeldung
- [ ] Hochkant-Video laden: Ausrichtung stimmt (nicht um 90° gedreht, nicht gestaucht)
- [ ] Positionsleiste/Miniaturen werden angezeigt (8 Miniaturen am Bereichsregler, Miniaturen in der Positionsleiste)
- [ ] Aufnahme-fps wird erkannt (30/60 normal); bei unsicherer Rate erscheint die Warnung „Bildrate nicht eindeutig“ und lässt sich korrigieren
- [ ] Hinweis zur **Bildgenauigkeit**: Falls die App meldet, dass Einzelbilder nur ungefähr (Ersatzverfahren) getroffen werden, ist der Hinweis verständlich und die Positionen stimmen trotzdem plausibel

## 2a. Auswahlweg: Fotos und Dateien

Der Fotos-Dialog kann das Video beim Auswählen umwandeln (z. B. Zeitlupe als 30 fps), die Dateien-App liefert das Original.

- [ ] Video über **Fotos** wählen: lädt, Ausrichtung stimmt
- [ ] Dasselbe Video über **Dateien** wählen: lädt, Ausrichtung stimmt
- [ ] Zeitlupe-Video über beide Wege: **„Zeitlupe erkannt“** und angezeigte Aufnahme-fps (Video-Tab) vergleichen; kommt es über Fotos mit 30 fps an, Aufnahme-fps von Hand korrigieren und Δt prüfen

## 3. Zeitlupe 240 fps

- [ ] Zeitlupen-Video laden, Anzeige „Aufnahme: 240 Bilder/s“
- [ ] Δt (Zeit zwischen Positionen) passt zur gewählten Schrittweite
- [ ] Bildauswahl/Positionen lassen sich setzen, kein Absturz, kein Speicherfehler

## 4. 4K-Video, 30 s

- [ ] Laden und Dekodieren ohne Absturz der Seite (kein Neuladen durch Safari)
- [ ] Bild berechnen/Vorschau dauert vertretbar (Wert notieren: ______ s)
- [ ] Export in voller Auflösung gelingt
- [ ] **Hochkant- oder 4K-Video auf einem iPad mit 3 GB RAM** (z. B. 9. Generation): laden, Vorschau, Export ohne Absturz/Neuladen der Seite
- [ ] **HDR-Video** (HEVC Main10 / Dolby Vision): lädt, Farben und Helligkeit wirken plausibel (nicht grau/ausgewaschen), kein Fehler

## 5. Alle vier Modi

Je Modus ein Bild berechnen, Ergebnis sieht plausibel aus:

- [ ] **Differenz**
- [ ] **Aufhellen**
- [ ] **Abdunkeln**
- [ ] **Transparent**
- [ ] Wechsel zwischen den Modi aktualisiert die Vorschau ohne Neuladen

## 6. Schwelle mit Maske

- [ ] Schwelle verstellen: Vorschau reagiert flüssig
- [ ] **„Bereich zeichnen“**: Polygon einzeichnen, nur darin werden Positionen eingefügt; Wirkung sofort sichtbar, „Bereich löschen“ hebt es wieder auf
- [ ] Mit handgefilmtem Clip: Warnung **„Kamera bewegt“** erscheint
- [ ] **Zuschnitt und Drehung**: Vorschau entspricht exakt dem exportierten Bild
- [ ] **„Bild wählen…“**: ein Bild aus der Positionsleiste antippen; es wird als Hintergrund verwendet (Eintrag „Gewähltes Bild (n)“)

## 7. Export über das Teilen-Menü in Fotos

Der Export läuft zweistufig: erst Bild erzeugen, danach in einem eigenen Klick „Teilen / Sichern“.

- [ ] PNG exportieren: Schritt 1 erzeugt das Bild, Schaltfläche „Teilen / Sichern“ erscheint
- [ ] „Teilen / Sichern“ öffnet das **iPad-Teilen-Menü** (nicht nur ein Download)
- [ ] „Bild sichern“ speichert in **Fotos**; Bild dort öffnen, Auflösung und Aussehen stimmen
- [ ] Dasselbe mit JPEG
- [ ] **Δt in der Vorschau** entspricht der **Infozeile im exportierten Bild** (bei ungleichmäßigen Positionen steht „(nicht gleichmäßig)“ dahinter)
- [ ] Abbrechen im Teilen-Menü führt zu keiner Fehlermeldung, erneutes Teilen funktioniert

## 8. Offline-Start vom Home-Bildschirm (nur Variante B, HTTPS)

- [ ] App einmal online in Safari geöffnet und zum Home-Bildschirm hinzugefügt (Name „Stroboskop“, Symbol mit fünf Kreisen)
- [ ] Vom Home-Bildschirm gestartet: Vollbild ohne Safari-Leiste
- [ ] **Flugmodus an**, App komplett schließen (nach oben wischen), erneut vom Home-Bildschirm starten: Startseite „Stroboskop“ erscheint
- [ ] Offline ein Video laden und Bild berechnen (prüft, dass auch der Rechen-Worker offline vorhanden ist)
- [ ] Offline exportieren und Teilen-Menü funktioniert
- [ ] Flugmodus aus, App neu starten: lädt weiterhin (Aktualisierung geschieht im Hintergrund)

## 9. Plan 1b: Überarbeitung der Oberfläche

- [ ] **Hell/Dunkel**: iPad unter Einstellungen → Anzeige & Helligkeit zwischen Hell und Dunkel umschalten; die App folgt sofort, beide Darstellungen gut lesbar, keine weißen Flächen im Dunkelmodus
- [ ] Startseite: **„Video aufnehmen“** öffnet die Kamera; **„Video auswählen“** öffnet Fotos/Dateien
- [ ] **Video abspielen** (Play/Pause), **Anfang hier / Ende hier** setzen; Auswahl und Anzahl Positionen aktualisieren sich
- [ ] **Anfang/Ende bei Zeitlupe** trifft das sichtbare Bild (gesetzte Marke zeigt genau das Bild, das im Player stand)
- [ ] **Einzelbild-Tasten** (zurück/vor) springen genau ein Bild
- [ ] **Hochkant-Video** (iPad-Kamera hochkant) ist im Player und beim **Zuschneiden** richtig ausgerichtet und nicht verzerrt
- [ ] **4K-Video**: während der Berechnung erscheint die **Rechen-Anzeige**, die Bedienung bleibt verständlich, kein Absturz
- [ ] **Empfindlichkeit** wirkt in den Darstellungen **Aufhellen** und **Abdunkeln** sichtbar (nicht nur bei Differenz)
- [ ] **Export**: „Bild erzeugen“, danach erscheint **„Gespeichert ✓“**, das Fenster lässt sich schließen
- [ ] **Abbruch im Teilen-Menü** führt zu keiner Fehlermeldung, erneutes Teilen funktioniert
- [ ] **Hochformat** (iPad hochkant): Bühne oben, Bedienung darunter scrollbar, nichts abgeschnitten, kein Seitwärts-Scrollen
- [ ] Alle Schaltflächen sind mit dem Finger sicher zu treffen (keine zu kleinen Ziele)

## Ergebnis

| Punkt | OK | Auffälligkeit |
|---|---|---|
| 2 HEVC / Ausrichtung | | |
| 3 Zeitlupe | | |
| 4 4K | | |
| 5 Modi | | |
| 6 Schwelle / Maske | | |
| 7 Export | | |
| 8 Offline | | |
| 9 Plan 1b Oberfläche | | |

Datum: __________ Gerät/iPadOS: __________ Unterschrift: __________
