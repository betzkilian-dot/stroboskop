# Plan 2c – Korrekturen nach zweitem iPad-Test (Spezifikation)

Stand: 2026-11-04 · ändert `2026-11-04-plan2b-ueberarbeitung-design.md` §5 und `2026-11-04-plan2-messen-anzeigen-design.md` §4/§6.5.

## 1. Koordinatensystem unabhängig vom Maßstab, Ursprung fest

- Bleibt in Phase **Maßstab** als eigene Karte **„Koordinatensystem“** (keine neue Phase).
- `Axes { origin: Pt | null; angle: number; yUp: boolean; dims: 'xy' | 'x' | 'y' }` – `originAtFirst` entfällt.
- Ursprung: `origin` wenn gesetzt, sonst **Mitte des sichtbaren Bildes** (Zuschnitt bzw. ganzes Bild). Kein Rückfall auf die Maßstabsstrecke, kein automatisches Springen auf Position 0. Der Ursprung wird überall (Maßstab, Messen, Auswerten, Export) an derselben Stelle gezeichnet und verwendet.
- Karte „Koordinatensystem“: Zeile „Drehung: N°“; Segment **„Achsen: x und y | nur x | nur y“**; Switch „y nach oben“; Knöpfe **„Auf Position 0 setzen“** (setzt `origin` auf den ersten gemessenen Punkt des aktiven Objekts; deaktiviert ohne Punkt), „An Maßstab ausrichten“ (nur mit Maßstab), „Zurücksetzen“ (origin null, angle 0, dims 'xy'; yUp bleibt).
- Die Switch-Zeile „Ursprung bei Position 0“ entfällt.
- `dims` wirkt **nur auf die Zeichnung**: bei „nur x“ wird nur die x-Achse (mit Ursprung) gezeichnet und gegriffen, bei „nur y“ nur die y-Achse. Tabelle, Diagramme und CSV bleiben unverändert.

## 2. a-Pfeile an denselben Ansatzpunkten wie v

- aᵢ = (vᵢ₊₁ − vᵢ) / ((tᵢ₊₂ − tᵢ)/2) gehört zur Tabellenzeile i (unverändert).
- Ansatzpunkte für a wie für v im Intervall i: **Anfang = Pᵢ, Mitte = (Pᵢ+Pᵢ₊₁)/2, Ende = Pᵢ₊₁**. Stehen v und a auf derselben Einstellung, sitzen vᵢ und aᵢ im selben Punkt.
- Standard: v Ende, a **Ende**.

## 3. Phase Bild: „Weiter zu Maßstab ›“

Primärknopf am Ende der Einstellungsspalte (wie „Weiter zu Bild ›“ in Video).

## 4. Export-Größe verständlich

Segment „Größe“: **„Klein (für Arbeitsblätter)“** = lange Kante 1600 px, **„Original (volle Auflösung)“**; darunter graue Zeile mit der tatsächlichen Pixelgröße, z. B. „1600 × 900 Pixel“.

## 5. Tests

Unit: Ursprung-Standard = Bildmitte (mit/ohne Zuschnitt), „Auf Position 0 setzen“, a-Ansatzpunkte (Anfang/Mitte/Ende identisch mit v), dims nur Zeichnung (Tabelle unverändert). E2E: Ursprung in Maßstab und Messen an derselben Stelle (Pixelprobe/`data`-Attribut), „nur x“ zeichnet keine y-Beschriftung, Bild → „Weiter zu Maßstab“, Export-Größenzeile.
