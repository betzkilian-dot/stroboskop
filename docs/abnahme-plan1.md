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

1. `npm run build` erzeugt den Ordner `dist/` (die App benutzt relative Pfade und läuft auch unter einem Unterpfad).
2. `dist/` hochladen, z. B. per **Netlify Drop** (Ordner in app.netlify.com/drop ziehen) oder als **GitHub Pages**.
3. Auf dem iPad die https-Adresse in Safari öffnen.
4. Teilen-Symbol, **Zum Home-Bildschirm**, **Hinzufügen**. Symbol „Stroboskop“ erscheint.

## 1. Testmaterial

- [ ] iPad-Video **quer** (Aufnahme mit der iPad-Kamera, Standard-Format HEVC/„Hohe Effizienz“)
- [ ] iPad-Video **hochkant** (HEVC)
- [ ] **Zeitlupe 240 fps** (Kamera, Modus Zeitlupe)
- [ ] **4K-Video, ca. 30 s**
- [ ] Ein **aus der Hand gefilmtes** Video (Kamera wird bewegt)
- [ ] Ein Hintergrundfoto in der Fotomediathek

## 2. Video laden und dekodieren (HEVC)

HEVC konnte unter Windows/Edge nicht getestet werden. Das muss hier sicher funktionieren.

- [ ] Querformat-Video laden: Bild erscheint, Ausrichtung stimmt, keine Fehlermeldung
- [ ] Hochkant-Video laden: Ausrichtung stimmt (nicht um 90° gedreht, nicht gestaucht)
- [ ] Positionsleiste/Miniaturen werden angezeigt, Scrubben ruckelt nicht dauerhaft
- [ ] Aufnahme-fps wird erkannt (30/60 normal); bei unsicherer Rate erscheint die Warnung „Bildrate nicht eindeutig“ und lässt sich korrigieren
- [ ] Hinweis zur **Bildgenauigkeit**: Falls die App meldet, dass Einzelbilder nur ungefähr (Ersatzverfahren) getroffen werden, ist der Hinweis verständlich und die Positionen stimmen trotzdem plausibel

## 3. Zeitlupe 240 fps

- [ ] Zeitlupen-Video laden, Anzeige „Aufnahme: 240 Bilder/s“
- [ ] Δt (Zeit zwischen Positionen) passt zur gewählten Schrittweite
- [ ] Bildauswahl/Positionen lassen sich setzen, kein Absturz, kein Speicherfehler

## 4. 4K-Video, 30 s

- [ ] Laden und Dekodieren ohne Absturz der Seite (kein Neuladen durch Safari)
- [ ] Bild berechnen/Vorschau dauert vertretbar (Wert notieren: ______ s)
- [ ] Export in voller Auflösung gelingt

## 5. Alle vier Modi

Je Modus ein Bild berechnen, Ergebnis sieht plausibel aus:

- [ ] Modus 1: ______________ (Name laut App)
- [ ] Modus 2: ______________
- [ ] Modus 3: ______________
- [ ] Modus 4: ______________
- [ ] Wechsel zwischen den Modi aktualisiert die Vorschau ohne Neuladen

## 6. Schwelle mit Maske

- [ ] Schwelle verstellen: Vorschau reagiert flüssig
- [ ] Maske (Bereiche ein-/ausschließen) zeichnen/anwenden: Wirkung sofort sichtbar
- [ ] Mit handgefilmtem Clip: Warnung **„Kamera bewegt“** erscheint
- [ ] **Zuschnitt und Drehung**: Vorschau entspricht exakt dem exportierten Bild
- [ ] **„Bild wählen…“** als Hintergrund: Foto aus der Mediathek lässt sich wählen und wird als Hintergrund verwendet

## 7. Export über das Teilen-Menü in Fotos

Der Export läuft zweistufig: erst Bild erzeugen, danach in einem eigenen Klick „Teilen / Sichern“.

- [ ] PNG exportieren: Schritt 1 erzeugt das Bild, Schaltfläche „Teilen / Sichern“ erscheint
- [ ] „Teilen / Sichern“ öffnet das **iPad-Teilen-Menü** (nicht nur ein Download)
- [ ] „Bild sichern“ speichert in **Fotos**; Bild dort öffnen, Auflösung und Aussehen stimmen
- [ ] Dasselbe mit JPEG
- [ ] Abbrechen im Teilen-Menü führt zu keiner Fehlermeldung, erneutes Teilen funktioniert

## 8. Offline-Start vom Home-Bildschirm (nur Variante B, HTTPS)

- [ ] App einmal online in Safari geöffnet und zum Home-Bildschirm hinzugefügt (Name „Stroboskop“, Symbol mit fünf Kreisen)
- [ ] Vom Home-Bildschirm gestartet: Vollbild ohne Safari-Leiste
- [ ] **Flugmodus an**, App komplett schließen (nach oben wischen), erneut vom Home-Bildschirm starten: Startseite „Stroboskop“ erscheint
- [ ] Offline ein Video laden und Bild berechnen (prüft, dass auch der Rechen-Worker offline vorhanden ist)
- [ ] Offline exportieren und Teilen-Menü funktioniert
- [ ] Flugmodus aus, App neu starten: lädt weiterhin (Aktualisierung geschieht im Hintergrund)

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

Datum: __________ Gerät/iPadOS: __________ Unterschrift: __________
