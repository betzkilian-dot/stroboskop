# Plan 1: Fundament & Stroboskopbild – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine offline-fähige iPad-Web-App, die ein MP4/MOV-Video bildgenau einliest, daraus ein Stroboskopbild in vier Überlagerungsmodi erzeugt und es als PNG/JPEG exportiert (Profimodus, Reiter „Video“ und „Bild“).

**Architecture:** Reine Logik (`frames`, `video/metadata`, `compose`) als testbare TypeScript-Funktionen auf `RGBAImage`-Puffern. Dekodierung (mp4box.js + WebCodecs) und Bildberechnung laufen gemeinsam in einem Web Worker; der Hauptthread spricht nur über `StrobeEngine` mit ihm. Svelte-5-Oberfläche mit reaktivem Projektzustand.

**Tech Stack:** TypeScript, Vite, Svelte 5 (Runes), mp4box.js, WebCodecs, OffscreenCanvas, vite-plugin-pwa, Vitest, Playwright, ffmpeg-static (nur zum Erzeugen von Test-Videos).

**Spec:** `docs/superpowers/specs/2026-11-03-stroboskop-app-design.md` (Abschnitte 2, 3, 6.1 teilweise, 6.2 teilweise, 7 „Bild“, 8). Folgepläne: 2 Messen & Anzeigen, 3 Analyse, 4 Schule (Projekte, Vorlagen, Schüler-Assistent).

## Global Constraints

- Zielplattform: Safari auf iPadOS ≥ 16.4; Entwicklung unter Windows (Node 24, npm 11).
- Alles lokal; keinerlei Netzwerkzugriffe außer dem Laden der App selbst.
- Oberfläche komplett Deutsch; Zahlen mit Dezimalkomma.
- Bedienziele ≥ 44 pt; Hoch- und Querformat.
- Formate: MP4/MOV mit H.264 (avc1/avc3) oder HEVC (hvc1/hev1).
- Δt = n / Aufnahme-fps; Aufnahme-fps immer manuell überschreibbar.
- Speicher: nie alle Bilder gleichzeitig im Speicher; Vorschau mit Arbeitsauflösung (lange Kante ≤ 1280 px), Export in Originalauflösung.
- Automatisierte Browser-Tests laufen in **Microsoft Edge** (`channel: 'msedge'`), weil Playwright-WebKit unter Windows kein H.264 dekodiert. Safari wird manuell auf dem iPad abgenommen (Task 11). *Abweichung von Spec §9 – beim Review bestätigen lassen.*

## Review Focus

1. **Hochkant gefilmtes iPad-Video** (Rotationsmatrix 90°/270° im Track-Header) → Stroboskopbild steht aufrecht, Breite/Höhe vertauscht. Test in Task 3 (Metadaten) und Task 5 (Fixture `ball-portrait.mp4`).
2. **HEVC-Video vom iPad** (Standardformat der Kamera) → Decoder-Konfiguration mit `hvcC`-Description; sonst schwarzes Bild. Test in Task 3 (Description-Extraktion aus `ball-hevc.mp4`).
3. **Variable Bildrate** (iPad bei wenig Licht) → `fpsCertain = false`, App fragt nach / warnt statt still falsches Δt zu zeigen. Test in Task 3.
4. **Langes 4K-Video** → kein Speicher-Absturz: Median-Hintergrund in Streifen unter Speicherbudget. Test in Task 4 (banded = unbanded).
5. **Schnelles Ziehen am Regler** → ältere Berechnungen werden verworfen, nur das neueste Ergebnis erscheint. Test in Task 6.

---

### Task 1: Projektgerüst

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `playwright.config.ts`, `vitest.config.ts`
- Test: `tests/e2e/smoke.spec.ts`, `tests/unit/sanity.test.ts`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `preview`, `test` (Vitest), `test:e2e` (Playwright gegen `vite preview`, Projekt `edge` mit `channel: 'msedge'`).

- [ ] **Step 1:** Projekt mit `npm create vite@latest . -- --template svelte-ts` anlegen; Dev-Abhängigkeiten `vitest @playwright/test ffmpeg-static` installieren; Laufzeit `mp4box`.
- [ ] **Step 2: Failing Tests schreiben**

```ts
// tests/e2e/smoke.spec.ts
test('Startseite zeigt App-Titel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
// tests/unit/sanity.test.ts
test('vitest läuft', () => expect(1 + 1).toBe(2));
```

- [ ] **Step 3:** `npm test` → PASS; `npm run test:e2e` → FAIL (Template-Titel).
- [ ] **Step 4:** `App.svelte` auf `<h1>Stroboskop</h1>` reduzieren, `index.html` `lang="de"`, Viewport-Meta mit `viewport-fit=cover`.
- [ ] **Step 5:** `npm run test:e2e` → PASS.
- [ ] **Step 6: Commit** `chore: Projektgerüst Vite + Svelte + Tests`

---

### Task 2: Bildauswahl und Zahlenformat (`frames`, `format`)

**Files:**
- Create: `src/lib/frames.ts`, `src/lib/format.ts`
- Test: `tests/unit/frames.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface FrameSelection { startIndex: number; endIndex: number; step: number; excluded: number[] } // Indizes inklusive
  selectFrameIndices(sel: FrameSelection): number[]
  deltaT(step: number, captureFps: number): number            // Sekunden
  stepForDesiredDt(dtS: number, captureFps: number): number   // gerundet, ≥ 1
  isUniform(indices: number[]): boolean
  formatDt(seconds: number): string        // 3 signifikante Stellen, Dezimalkomma, " s"
  formatNumber(v: number, decimals: number): string
  ```

- [ ] **Step 1: Failing Tests** (Werte aus den Arbeitsblättern):

```ts
expect(selectFrameIndices({ startIndex: 0, endIndex: 10, step: 3, excluded: [] })).toEqual([0, 3, 6, 9]);
expect(selectFrameIndices({ startIndex: 2, endIndex: 10, step: 4, excluded: [6] })).toEqual([2, 10]);
expect(deltaT(1, 12)).toBeCloseTo(0.0833, 4);
expect(deltaT(2, 12)).toBeCloseTo(0.1667, 4);
expect(deltaT(15, 60)).toBe(0.25);               // 4 fps
expect(stepForDesiredDt(0.133, 60)).toBe(8);
expect(stepForDesiredDt(0.001, 60)).toBe(1);     // nie < 1
expect(isUniform([0, 4, 8])).toBe(true);
expect(isUniform([0, 4, 12])).toBe(false);
expect(formatDt(1 / 12)).toBe('0,0833 s');
expect(formatDt(0.25)).toBe('0,250 s');
expect(formatDt(8 / 60)).toBe('0,133 s');
expect(formatDt(1 / 240)).toBe('0,00417 s');
expect(formatNumber(1.5, 2)).toBe('1,50');
```

- [ ] **Step 2:** `npx vitest run tests/unit/frames.test.ts tests/unit/format.test.ts` → FAIL.
- [ ] **Step 3:** Implementieren (`formatNumber` via `Intl.NumberFormat('de-DE')`).
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat: Bildauswahl, Δt und deutsches Zahlenformat`

---

### Task 3: Test-Videos und Video-Metadaten

**Files:**
- Create: `scripts/make-fixtures.mjs`, `tests/fixtures/*.mp4` (committed), `src/lib/video/metadata.ts`, `src/lib/video/demux.ts`, `src/lib/types.ts`
- Test: `tests/unit/metadata.test.ts`, `tests/unit/demux.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }
  interface VideoInfo {
    codec: string; width: number; height: number;          // bereits gedreht (Anzeigeorientierung)
    codedWidth: number; codedHeight: number; rotation: 0 | 90 | 180 | 270;
    frameCount: number; durationS: number;
    nominalFps: number; captureFps: number; fpsCertain: boolean; slowMotion: boolean;
  }
  // metadata.ts – reine Funktionen
  interface TrackTiming { timescale: number; sampleDurations: number[]; mediaDuration: number; editDuration?: number; movieTimescale?: number }
  detectFps(t: TrackTiming): { nominalFps: number; captureFps: number; fpsCertain: boolean; slowMotion: boolean }
  snapFps(raw: number): number
  rotationFromMatrix(m: number[]): 0 | 90 | 180 | 270
  // demux.ts
  interface DemuxedTrack { info: VideoInfo; config: VideoDecoderConfig; samples: EncodedSample[] }
  interface EncodedSample { index: number; timestampUs: number; durationUs: number; isKey: boolean; data: Uint8Array }
  demux(file: Blob): Promise<DemuxedTrack>       // wirft VideoError
  class VideoError extends Error { code: 'unsupported-format' | 'no-video-track' | 'decode-failed' }
  ```

- [ ] **Step 1:** `scripts/make-fixtures.mjs` mit `ffmpeg-static` schreiben. Alle Fixtures: grauer Hintergrund 320×240, weißes 16×16-Quadrat bei `x = 20 + 4·n`, `y = 100` (n = Bildnummer), 2 s, H.264, GOP 30:
  - `ball-60.mp4` (60 fps), `ball-240.mp4` (240 fps)
  - `ball-portrait.mp4` (60 fps, Anzeige-Rotation 90°)
  - `ball-hevc.mp4` (60 fps, libx265, `-tag:v hvc1`)
  - `ball-vfr.mp4` (Zeitstempel mit wechselnden Abständen 1/60 und 1/30 s, via `-vsync vfr` und `setpts`)
  - `not-a-video.mp4` (Textdatei)

  Fixtures erzeugen und committen; `npm run fixtures` als Skript eintragen.
- [ ] **Step 2: Failing Tests**

```ts
expect(snapFps(59.94)).toBe(59.94); expect(snapFps(239.8)).toBe(240); expect(snapFps(29.97)).toBe(29.97);
expect(detectFps({ timescale: 600, sampleDurations: Array(120).fill(10), mediaDuration: 1200 }))
  .toEqual({ nominalFps: 60, captureFps: 60, fpsCertain: true, slowMotion: false });
// Zeitlupe: 240-fps-Medien, Edit-Liste spielt 8× länger ab
expect(detectFps({ timescale: 2400, sampleDurations: Array(480).fill(10), mediaDuration: 4800, editDuration: 16000, movieTimescale: 1000 }).slowMotion).toBe(true);
// variable Bildrate
expect(detectFps({ timescale: 600, sampleDurations: [10, 20, 10, 20, 10, 20], mediaDuration: 90 }).fpsCertain).toBe(false);
expect(rotationFromMatrix([0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824])).toBe(90);

// demux.test.ts (Node, Datei als Blob)
const t = await demux(fixture('ball-60.mp4'));
expect(t.info).toMatchObject({ width: 320, height: 240, frameCount: 120, captureFps: 60, fpsCertain: true });
expect(t.config.codec).toMatch(/^avc1/); expect(t.config.description).toBeInstanceOf(Uint8Array);
expect((await demux(fixture('ball-portrait.mp4'))).info).toMatchObject({ width: 240, height: 320, rotation: 90 });
const h = await demux(fixture('ball-hevc.mp4'));
expect(h.config.codec).toMatch(/^hvc1/); expect(h.config.description!.byteLength).toBeGreaterThan(20);
expect((await demux(fixture('ball-vfr.mp4'))).info.fpsCertain).toBe(false);
await expect(demux(fixture('not-a-video.mp4'))).rejects.toMatchObject({ code: 'unsupported-format' });
```

- [ ] **Step 3:** Tests → FAIL.
- [ ] **Step 4:** Implementieren.
  - Unsicher heißt: Variationskoeffizient der Sample-Dauern > 0,05.
  - Zeitlupe heißt: `editDuration/movieTimescale > 1,5 × mediaDuration/timescale`. Dann ist `captureFps` = Sample-Rate.
  - `snapFps` rastet auf {23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120, 240, 480, 960, 1000} ein, bei einer Abweichung von höchstens 1 %.
  - Description: `avcC`/`hvcC`-Box per `DataStream` serialisieren und den 8-Byte-Header abschneiden.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6: Commit** `feat: Video-Demux und Metadaten (fps, Zeitlupe, Rotation, HEVC)`

---

### Task 4: Bildberechnung (`compose`)

**Files:**
- Create: `src/lib/compose/background.ts`, `src/lib/compose/mask.ts`, `src/lib/compose/compositor.ts`, `src/lib/compose/motion.ts`, `src/lib/compose/transform.ts`
- Test: `tests/unit/compose.test.ts` (synthetische Bilder via Helfer `solid(w,h,rgb)` und `withSquare(img,x,y,size,rgb)`)

**Interfaces:**
- Consumes: `RGBAImage`
- Produces:
  ```ts
  type ComposeMode = 'difference' | 'lighten' | 'darken' | 'average';
  type BackgroundSource = 'median' | 'first' | 'last' | { frameIndex: number };
  interface ComposeOptions {
    mode: ComposeMode; threshold: number /*0..1*/; featherPx: number;
    region: Array<{ x: number; y: number }> | null;   // Polygon in Bildpixeln
    fade: number /*0..1: Deckkraft frühestes Bild = 1-fade*/; latestOnTop: boolean;
    background: BackgroundSource;
  }
  medianBackground(samples: RGBAImage[]): RGBAImage
  medianBackgroundBanded(readSamples: (rowStart: number, rowEnd: number) => AsyncIterable<RGBAImage>,
                         width: number, height: number, sampleCount: number, budgetBytes: number): Promise<RGBAImage>
  motionMask(frame: RGBAImage, bg: RGBAImage, threshold: number, featherPx: number, region: ComposeOptions['region']): Float32Array
  autoThreshold(frame: RGBAImage, bg: RGBAImage): number          // Otsu auf Differenz
  createCompositor(bg: RGBAImage, opts: ComposeOptions, count: number): { add(frame: RGBAImage, order: number): void; result(): RGBAImage }
  detectCameraMotion(samples: RGBAImage[], bg: RGBAImage): { moved: boolean; score: number }
  cropRotate(img: RGBAImage, crop: { x: number; y: number; w: number; h: number } | null, rotation: 0 | 90 | 180 | 270): RGBAImage
  ```

- [ ] **Step 1: Failing Tests**

```ts
// Median ignoriert ein durchlaufendes Objekt
const bg = medianBackground([withSquare(grey,0,0,4,white), withSquare(grey,10,0,4,white), grey]);
expect(pixel(bg,1,1)).toEqual(GREY);
// Differenz = max-Kanal |f-bg|/255; Schwelle 0.3
const m = motionMask(withSquare(grey,5,5,4,white), grey, 0.3, 0, null);
expect(m[idx(6,6)]).toBe(1); expect(m[idx(0,0)]).toBe(0);
// Region schließt außerhalb aus
expect(motionMask(withSquare(grey,5,5,4,white), grey, 0.3, 0, [{x:0,y:0},{x:3,y:0},{x:3,y:3}])[idx(6,6)]).toBe(0);
// Weiche Kante erzeugt Zwischenwerte
expect(motionMask(withSquare(grey,5,5,4,white), grey, 0.3, 2, null)[idx(4,6)]).toBeGreaterThan(0);
// Differenz-Modus: beide Quadrate im Ergebnis, Hintergrund unverändert
const c = createCompositor(grey, { ...defaults, mode: 'difference', threshold: 0.3 }, 2);
c.add(withSquare(grey,0,0,4,white), 0); c.add(withSquare(grey,10,0,4,white), 1);
expect(pixel(c.result(),1,1)).toEqual(WHITE); expect(pixel(c.result(),11,1)).toEqual(WHITE); expect(pixel(c.result(),6,6)).toEqual(GREY);
// fade 1 → frühestes Bild unsichtbar
// lighten = Maximum, darken = Minimum, average = Mittelwert (je ein Pixel-Test)
// latestOnTop: überlappende Quadrate unterschiedlicher Farbe → Farbe des späteren
expect(autoThreshold(withSquare(grey,5,5,4,white), grey)).toBeGreaterThan(0.05);
expect(autoThreshold(withSquare(grey,5,5,4,white), grey)).toBeLessThan(0.6);
// Kamera bewegt: um 6 px verschobenes Muster
expect(detectCameraMotion([stripes, shift(stripes,6)], medianBackground([stripes, shift(stripes,6)])).moved).toBe(true);
expect(detectCameraMotion([withSquare(stripes,0,0,4,white), stripes], stripes).moved).toBe(false);
// Banded = unbanded, bei Budget, das 3 Streifen erzwingt
expect(await medianBackgroundBanded(read, 30, 30, 3, 30*10*4*3)).toEqual(medianBackground(samples));
expect(cropRotate(img4x2, null, 90)).toMatchObject({ width: 2, height: 4 });
```

- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
  - Feder: Box-Blur der binären Maske mit Radius `featherPx`.
  - `difference`: `out = lerp(out, frame, mask·opacity)` in Zeichenreihenfolge.
  - `lighten`/`darken`/`average` ignorieren Maske und Fade und beziehen den Hintergrund nicht mit ein.
  - Kamerabewegung: Anteil der Pixel mit Differenz > 0,15 außerhalb der jeweils größten zusammenhängenden Bewegung. `moved`, wenn der Median dieses Anteils über die Stichproben > 0,25 ist.
  - Banded: Streifenhöhe = `floor(budget / (width·4·sampleCount))`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat: Stroboskop-Bildberechnung (Median, Maske, Modi, Kamerabewegung)`

---

### Task 5: Bilder dekodieren (`FrameSource`)

**Files:**
- Create: `src/lib/video/webcodecs-source.ts`, `src/lib/video/element-source.ts`, `src/lib/video/open.ts`
- Test: `tests/e2e/decode.spec.ts` + Testseite `tests/e2e/pages/decode.html` (lädt Fixture, ruft Quelle auf, legt Ergebnis in `window.__result`)

**Interfaces:**
- Consumes: `demux`, `VideoInfo`, `RGBAImage`
- Produces:
  ```ts
  interface FrameSource {
    info: VideoInfo; exact: boolean;
    readFrames(indices: number[], opts: { maxSize: number; rows?: [number, number] }): AsyncGenerator<{ index: number; image: RGBAImage }>;
    close(): void;
  }
  openFrameSource(file: Blob): Promise<FrameSource>   // WebCodecs falls VideoDecoder vorhanden & config unterstützt, sonst Element-Quelle (exact=false)
  ```

- [ ] **Step 1: Failing Tests** (Edge)

```ts
// Bild k zeigt das Quadrat bei x = 20 + 4k → hellste Spalte in Zeile 108
for (const k of [0, 37, 119]) expect(brightestColumn(result[k], 108)).toBeCloseTo(20 + 4*k + 8, -0.5);
expect(result.portrait.width).toBe(240); expect(result.portrait.height).toBe(320);
expect(result.scaled.width).toBeLessThanOrEqual(160);       // maxSize: 160
expect(result.fallbackExact).toBe(false);                   // Element-Quelle erzwungen
```

- [ ] **Step 2:** `npx playwright test tests/e2e/decode.spec.ts` → FAIL.
- [ ] **Step 3:** Implementieren.
  - WebCodecs: Für jeden angeforderten Index ab dem vorherigen Keyframe dekodieren. Aufsteigend sortierte Indizes werden in einem Durchlauf ohne erneutes Seek gelesen. Nicht benötigte `VideoFrame`s werden sofort mit `close()` freigegeben.
  - Drehen und Skalieren per `OffscreenCanvas`. `rows` liefert nur einen Zeilenstreifen, für die Median-Berechnung in Streifen.
  - Element-Quelle: `currentTime = (index + 0.5) / captureFps`, dann auf `seeked` warten.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat: bildgenaue Dekodierung mit WebCodecs und Rückfallebene`

---

### Task 6: Worker und `StrobeEngine`

**Files:**
- Create: `src/lib/engine/protocol.ts`, `src/lib/engine/strobe.worker.ts`, `src/lib/engine/engine.ts`, `src/lib/engine/render.ts`
- Test: `tests/unit/render.test.ts` (Pipeline mit Fake-`FrameSource`), `tests/e2e/engine.spec.ts`

**Interfaces:**
- Consumes: `FrameSource`, `FrameSelection`, `ComposeOptions`, compose-Funktionen
- Produces:
  ```ts
  interface RenderSettings { selection: FrameSelection; compose: ComposeOptions; captureFps: number }
  interface RenderResult { image: ImageBitmap; maskOverlay: ImageBitmap | null; positions: number; cameraMoved: boolean; autoThreshold: number; width: number; height: number }
  // render.ts (worker-intern, testbar)
  renderStrobe(src: FrameSource, s: RenderSettings, o: { maxSize: number; showMask: boolean; budgetBytes: number; signal: AbortSignal; onProgress(done: number, total: number): void }): Promise<Omit<RenderResult,'image'|'maskOverlay'> & { image: RGBAImage; maskOverlay: RGBAImage | null }>
  // engine.ts (Hauptthread)
  createStrobeEngine(): StrobeEngine
  interface StrobeEngine {
    open(file: Blob): Promise<{ info: VideoInfo; exact: boolean }>;   // wirft VideoError
    render(s: RenderSettings, o: { maxSize: number; showMask: boolean }): Promise<RenderResult | 'superseded'>;
    onProgress(cb: (done: number, total: number) => void): void;
    dispose(): void;
  }
  ```

- [ ] **Step 1: Failing Tests**

```ts
// render.test.ts – Fake-Quelle aus withSquare-Bildern
expect(r.positions).toBe(4);
expect(brightCount(r.image)).toBe(4 * 16);                   // 4 Quadrate 4×4
expect(sampleCalls).toBeLessThanOrEqual(40);                 // Median aus ≤ 40 Stichproben
await expect(renderStrobe(src, s, { ...o, signal: abortedSignal })).rejects.toThrow('aborted');
// engine.spec.ts (Edge, ball-60.mp4)
const [a, b] = await Promise.all([engine.render(s1, o), engine.render(s2, o)]);
expect(a).toBe('superseded'); expect(b.positions).toBe(s2Positions);
expect(progressEvents.at(-1)).toEqual([total, total]);
```

- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
  - Hintergrund aus 40 gleichmäßig verteilten Bildern im Zuschnitt, bei `first`/`last`/`frameIndex` aus dem jeweiligen Einzelbild. Budget 256 MB.
  - Kamerabewegung aus den Stichproben.
  - Bei `threshold < 0` wird `autoThreshold` am mittleren ausgewählten Bild verwendet.
  - Jeder neue `render` bricht den laufenden Render per `AbortController` ab. Der abgebrochene Aufruf liefert `'superseded'`.
  - Ergebnisse werden als transferierbare `ImageBitmap`s übertragen.
  - Die Masken-Überlagerung ist ein halbtransparentes Grün (`rgba(0,200,80,0.45)`) auf erkannten Pixeln des mittleren Bildes.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5: Commit** `feat: Render-Worker mit Abbruch und Fortschritt`

---

### Task 7: Projektzustand, Startseite und Profimodus-Rahmen

**Files:**
- Create: `src/lib/state/project.svelte.ts`, `src/ui/Start.svelte`, `src/ui/profi/ProfiView.svelte`, `src/ui/components/Viewer.svelte`, `src/ui/components/Notice.svelte`
- Modify: `src/App.svelte`
- Test: `tests/e2e/start.spec.ts`

**Interfaces:**
- Consumes: `StrobeEngine`, `VideoInfo`, `VideoError`
- Produces:
  ```ts
  class Project {   // $state-Runes
    file: Blob | null; info: VideoInfo | null; exact: boolean;
    captureFpsOverride: number | null; get captureFps(): number;
    selection: FrameSelection; compose: ComposeOptions;
    crop: { x: number; y: number; w: number; h: number } | null; rotation: 0 | 90 | 180 | 270;
    preview: RenderResult | null; rendering: boolean; progress: number; error: string | null;
    load(file: Blob): Promise<void>;     // setzt Standards: ganzes Video, step = stepForDesiredDt(0.1, fps), mode 'difference', threshold -1 (auto)
    requestPreview(): void;              // entprellt 120 ms, maxSize 1280
  }
  ```
  `Viewer.svelte` props: `{ image: ImageBitmap | null; overlay?: ImageBitmap | null }`, Pinch-Zoom und Pan.
  `ProfiView` Reiter (Reihenfolge fest): Video, Bild, Maßstab, Messen, Auswerten. Die letzten drei sind deaktiviert mit dem Tooltip „folgt“.

- [ ] **Step 1: Failing Tests** (Edge)

```ts
await page.getByRole('button', { name: 'Neues Projekt' }).click();
await page.setInputFiles('input[type=file]', 'tests/fixtures/ball-60.mp4');
await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
await expect(page.getByTestId('viewer-canvas')).toBeVisible();
await expect(page.getByText('Δt = 0,100 s')).toBeVisible();
// Fehlerfall
await page.setInputFiles('input[type=file]', 'tests/fixtures/not-a-video.mp4');
await expect(page.getByRole('alert')).toContainText('MP4 oder MOV');
```

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
  - Startseite: Titel, „Neues Projekt“ (`<input type=file accept="video/*">`; auf dem iPad bietet Safari damit Kamera, Fotos und Dateien an).
  - Ein Hinweis „Zum Home-Bildschirm hinzufügen“ erscheint nur, wenn `navigator.standalone !== true`.
  - Kopfzeile: Projektname (Dateiname), Δt-Anzeige, Knopf „Export“.
  - Fehlertexte nach Code:
    - `unsupported-format` → „Dieses Video kann nicht gelesen werden. Bitte als MP4 oder MOV speichern.“
    - `no-video-track` → „Die Datei enthält kein Video.“
    - `decode-failed` → „Das Video konnte nicht dekodiert werden.“
  - Bei `exact === false` dauerhaft: „Bildgenauigkeit eingeschränkt“.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: Startseite, Projektzustand und Profimodus-Rahmen`

---

### Task 8: Reiter „Video“

**Files:**
- Create: `src/ui/profi/VideoTab.svelte`, `src/ui/components/RangeSlider.svelte`
- Test: `tests/e2e/video-tab.spec.ts`

**Interfaces:**
- Consumes: `Project`
- Produces: `RangeSlider.svelte` props `{ min, max, start = $bindable(), end = $bindable(), thumbs?: ImageBitmap[] }`

- [ ] **Step 1: Failing Tests**

```ts
await expect(page.getByText('Aufnahme: 60 Bilder/s')).toBeVisible();
await page.getByLabel('Aufnahme-fps').fill('120');
await expect(page.getByText('Δt = 0,0500 s')).toBeVisible();           // step 6 bleibt, fps 120
// ball-vfr.mp4 → Warnung
await expect(page.getByRole('alert')).toContainText('Bildrate nicht eindeutig');
// ball-240.mp4 → 240 erkannt
await expect(page.getByText('Aufnahme: 240 Bilder/s')).toBeVisible();
// Zuschnitt ändert Positionszahl
await page.getByLabel('Ende').fill('59'); await expect(page.getByText(/\d+ Positionen/)).toHaveText(/^\d+ Positionen$/);
```

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
  - Zuschnitt mit zwei Griffen und Vorschau-Miniaturen (8 Stück, maxSize 96).
  - Feld „Aufnahme-fps“ mit erkanntem Wert als Platzhalter. Daneben „Zeitlupe erkannt“, falls zutreffend.
  - Bei `fpsCertain === false` die Meldung „Bildrate nicht eindeutig – bitte Aufnahme-fps prüfen.“
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: Reiter Video mit Zuschnitt und Aufnahme-fps`

---

### Task 9: Reiter „Bild“

**Files:**
- Create: `src/ui/profi/BildTab.svelte`, `src/ui/components/RegionEditor.svelte`, `src/ui/components/PositionStrip.svelte`
- Test: `tests/e2e/bild-tab.spec.ts`

**Interfaces:**
- Consumes: `Project`, `formatDt`, `stepForDesiredDt`, `isUniform`

- [ ] **Step 1: Failing Tests**

```ts
await page.getByLabel('Abstand').fill('15');
await expect(page.getByText('Δt = 0,250 s')).toBeVisible();
await page.getByLabel('Wunsch-Δt').fill('0,133'); await expect(page.getByLabel('Abstand')).toHaveValue('8');
for (const m of ['Differenz', 'Aufhellen', 'Abdunkeln', 'Transparent']) await page.getByRole('radio', { name: m }).check();
await page.getByLabel('Schwelle').fill('40'); await expect(page.getByTestId('mask-overlay')).toBeVisible();  // während Ziehen
await page.getByRole('button', { name: 'Auto' }).click(); await expect(page.getByLabel('Schwelle')).not.toHaveValue('40');
await page.getByTestId('position-2').click();
await expect(page.getByRole('alert')).toContainText('Δt nicht mehr gleichmäßig');
// zu wenige Positionen
await page.getByLabel('Abstand').fill('500'); await expect(page.getByRole('alert')).toContainText('mindestens 2 Positionen');
```

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
  - Bedienelemente:
    - Abstand-Regler (1 … Anzahl Bilder im Zuschnitt − 1) mit großer Δt-Anzeige und „N Positionen“.
    - Feld „Wunsch-Δt“.
    - Modus als Segmented Control.
    - Schwelle 1–100 % mit „Auto“.
    - Weiche Kante 0–10 px, Hintergrund (Median / erstes / letztes / „Bild wählen…“ über die Positionsleiste → `{ frameIndex }`).
    - Verlauf 0–100 %, „Spätere oben“.
    - Wirkbereich zeichnen oder löschen (Polygon per Antippen, Doppeltipp schließt).
    - Drehen um 90°, Zuschneiden per Rahmen.
  - Maskenansicht ist aktiv, solange der Schwellen-Regler bedient wird, und noch 1,5 s danach.
  - Bei `cameraMoved` erscheint „Kamera hat sich bewegt – Ergebnis unscharf.“
  - Die Positionsleiste zeigt die ausgewählten Bilder als Miniaturen. Antippen schaltet ein Bild aus oder ein (`excluded`).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: Reiter Bild mit allen Überlagerungsoptionen`

---

### Task 10: Bild-Export

**Files:**
- Create: `src/lib/export/image.ts`, `src/ui/ExportDialog.svelte`
- Test: `tests/unit/export-image.test.ts` (Dateiname/Infozeilen-Text), `tests/e2e/export.spec.ts`

**Interfaces:**
- Consumes: `StrobeEngine.render` mit `maxSize: Infinity`, `cropRotate`, `formatDt`
- Produces:
  ```ts
  interface ImageExportOptions { format: 'png' | 'jpeg'; quality: number; size: 'original' | 'worksheet' /*lange Kante 1600*/; infoLine: boolean; overlays: boolean }
  infoLineText(dt: number): string                        // "Δt = 0,133 s"
  exportFileName(videoName: string, ext: 'png' | 'jpg'): string   // "<videoname>_stroboskop.png"
  renderExportImage(p: Project, o: ImageExportOptions): Promise<Blob>
  shareOrDownload(blob: Blob, fileName: string): Promise<void>   // navigator.share({files}) falls canShare, sonst <a download>
  ```
  `overlays` ist in Plan 1 wirkungslos außer der Infozeile. Plan 2 hängt hier Nummern, Bahn und Pfeile an.

- [ ] **Step 1: Failing Tests**

```ts
expect(infoLineText(8 / 60)).toBe('Δt = 0,133 s');
expect(exportFileName('IMG_0042.MOV', 'png')).toBe('IMG_0042_stroboskop.png');
// e2e: Download abfangen
const dl = await download(() => page.getByRole('button', { name: 'Bild exportieren' }).click());
expect(dl.suggestedFilename()).toBe('ball-60_stroboskop.png');
expect(await pngSize(dl)).toEqual({ width: 320, height: 240 });          // Original
// Arbeitsblatt-Größe beim 4K-Fall nicht testbar mit Fixture → Unit-Test der Zielgröße
expect(targetSize(3840, 2160, 'worksheet')).toEqual({ width: 1600, height: 900 });
```

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementieren.
  - Der Dialog bietet Format, Größe, Infozeile und Qualität (nur bei JPEG, Standard 0,9).
  - Fortschrittsbalken während der Neuberechnung in voller Auflösung.
  - Die Infozeile steht unten links auf einem weißen, halbtransparenten Kasten. Schriftgröße 2,5 % der Bildhöhe.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: Bild-Export PNG/JPEG mit Teilen-Menü`

---

### Task 11: Offline-PWA und iPad-Abnahme

**Files:**
- Modify: `vite.config.ts` (vite-plugin-pwa), `index.html` (Apple-Meta-Tags, Icons)
- Create: `public/icons/*`, `docs/abnahme-plan1.md`
- Test: `tests/e2e/offline.spec.ts`

- [ ] **Step 1: Failing Test**

```ts
await page.goto('/'); await page.waitForFunction(() => navigator.serviceWorker.controller);
await context.setOffline(true); await page.reload();
await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
// Manifest
expect(manifest).toMatchObject({ lang: 'de', display: 'standalone', name: 'Stroboskop' });
```

- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** vite-plugin-pwa mit `registerType: 'autoUpdate'` einrichten. Alle Build-Assets werden vorab gecacht, inklusive Worker-Chunk. Dazu `apple-mobile-web-app-capable` und ein Icon 180×180.
- [ ] **Step 4:** → PASS; `npm test && npm run test:e2e` komplett grün.
- [ ] **Step 5:** `docs/abnahme-plan1.md` als Checkliste schreiben und auf dem iPad durchgehen (App per `npm run preview -- --host` im WLAN oder per Deployment erreichbar). Die Checkliste:
  - iPad-Video quer und hochkant (HEVC)
  - Zeitlupe 240 fps
  - 4K-Video von 30 s
  - alle 4 Modi
  - Schwelle mit Maske
  - Export über das Teilen-Menü in Fotos
  - Offline-Start vom Home-Bildschirm
- [ ] **Step 6: Commit** `feat: Offline-PWA und Abnahme-Checkliste`
