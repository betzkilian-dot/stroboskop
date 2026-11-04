import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { chooseMode, tapScale, setScale } from './helpers';

const FORMATS = { quer: { width: 1180, height: 820 }, hoch: { width: 820, height: 1180 } } as const;

/** Liefert Verstöße: Times-Schrift und Kontrast < 3:1 (WCAG-Luminanz) für Elemente mit eigenem Text. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const cm = c.match(/color\(srgb ([^)]+)\)/);
      if (cm) {
        const p = cm[1].split(/[ /]+/).filter(Boolean).map(Number);
        return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
      }
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bad: string[] = [];
    let checked = 0;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (/times/i.test(cs.fontFamily)) bad.push(`Times: ${el.tagName}.${el.className}`);
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!own) continue;
      if ((el as HTMLButtonElement).disabled || el.closest('[disabled],[aria-disabled=true]')) continue;
      // Auf dem Bild liegende Einblendungen haben feste Farben (halbtransparent Schwarz/Weiß)
      if (el.closest('.play-overlay, [data-testid=filmstrip], [data-testid=stage] .hint, .stage .hint, canvas, video')) continue;
      let bg: { r: number; g: number; b: number } | null = null;
      let overImage = false;
      for (let a: HTMLElement | null = el; a; a = a.parentElement) {
        if (a.matches('canvas,video,img')) { overImage = true; break; }
        const c = parse(getComputedStyle(a).backgroundColor);
        if (c && c.a > 0.99) { bg = c; break; }
      }
      if (overImage) continue;
      const name = `${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (!bg) { bad.push(`bg nicht ermittelbar: ${name}`); continue; }
      const fg = parse(cs.color);
      if (!fg) { bad.push(`Textfarbe nicht lesbar (${cs.color}): ${name}`); continue; }
      // Halbtransparente Tönungen (Chips, Hinweise) werden gegen die Fläche des Elternelements angenähert.
      checked++;
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 3) bad.push(`Kontrast ${ratio.toFixed(2)}: ${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return { bad, checked };
  });
}

for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(FORMATS)) {
    test(`Sichtprüfung ${mode} ${fmt}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize(size);
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
      };

      await page.goto('/');
      await chooseMode(page, 'erweitert');
      await expect(page.getByTestId('pick-file')).toBeVisible();
      await shot('start');

      await page.locator('input[type=file]:not([capture])').setInputFiles('tests/fixtures/ball-60.mp4');
      await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('open-export')).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('video');

      await page.getByRole('radio', { name: 'Bild' }).click();
      await expect(page.getByTestId('film-item').first()).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('bild');

      await expect(page.getByTestId('open-export')).toBeEnabled({ timeout: 30000 });
      await page.getByTestId('open-export').click();
      await expect(page.getByRole('button', { name: 'Teilen', exact: true })).toBeVisible();
      await shot('export');
    });
  }
}

/** Plan 2: Maßstab, Messen, Auswerten in einem repräsentativen Zustand. */
for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(FORMATS)) {
    test(`Sichtprüfung Plan 2 ${mode} ${fmt}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize(size);
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name}: Seitwärts-Scrollen`).toBeLessThanOrEqual(size.width);
      };

      await page.goto('/');
      await chooseMode(page, 'erweitert');
      await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
      await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('radio', { name: 'Maßstab' }).click();
      await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
      await shot('massstab-leer');

      await tapScale(page, 300);
      await page.getByTestId('scale-length').fill('1,00');
      await page.getByRole('radio', { name: 'm', exact: true }).click();
      await expect(page.getByTestId('scale-info')).toContainText('1 Pixel =');
      await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
      await shot('massstab');

      await page.getByRole('radio', { name: 'Messen' }).click();
      await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('button', { name: 'Vorschlagen' }).click();
      await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
      await page.getByRole('switch', { name: 'v-Pfeile' }).click();
      await expect(page.getByRole('switch', { name: 'v-Pfeile' })).toHaveAttribute('aria-checked', 'true');
      await shot('messen');

      await page.getByRole('radio', { name: 'Auswerten' }).click();
      await expect(page.getByTestId('row').first()).toBeVisible();
      await page.getByTestId('row').nth(1).click();
      await expect(page.getByTestId('row').nth(1)).toHaveAttribute('aria-selected', 'true');
      await shot('auswerten');
    });
  }
}

/** Plan 2b: iPad-Größen; Zuschnitt-Rahmen, Bild-Spalte, gedrehte Achsen, verschobene Legende, Diagramm mit Parabel. */
const IPAD = { quer: { width: 1194, height: 834 }, hoch: { width: 834, height: 1194 } } as const;

for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(IPAD)) {
    test(`Sichtprüfung Plan 2b ${mode} ${fmt}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize(size);
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-2b-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name}: Seitwärts-Scrollen`).toBeLessThanOrEqual(size.width);
      };
      const stageReady = () => expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');

      await page.goto('/');
      await chooseMode(page, 'erweitert');
      await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
      await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');

      // Video: Zuschneiden-Rahmen verkleinert
      await page.getByRole('button', { name: 'Zuschneiden' }).click();
      await expect(page.getByTestId('crop-frame')).toBeVisible();
      await expect(page.getByTestId('viewer-canvas')).toBeVisible();
      const hb = (await page.getByTestId('crop-handle-se').boundingBox())!;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2 - 80, hb.y + hb.height / 2 - 60, { steps: 5 });
      await page.mouse.up();
      await shot('video-zuschnitt');
      await page.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(page.getByTestId('crop-frame')).toHaveCount(0);

      // Bild: feste Einstellungsspalte
      await page.getByRole('radio', { name: 'Bild' }).click();
      await expect(page.getByTestId('film-item').first()).toBeVisible();
      await shot('bild');

      // Maßstab, Achsen um ca. 30° gedreht
      await page.getByRole('radio', { name: 'Maßstab' }).click();
      await tapScale(page, 200);
      await page.getByTestId('scale-length').fill('1,00');
      await page.getByRole('radio', { name: 'm', exact: true }).click();
      await expect(page.getByTestId('scale-info')).toContainText('1 Pixel =');
      await stageReady();
      const cb = (await page.getByTestId('viewer-canvas').boundingBox())!;
      const fit = Math.min(cb.width / 320, cb.height / 240);
      // Ursprung (Bildmitte) nach oben aus der Maßstabslinie ziehen, dann die x-Spitze drehen
      const cx = cb.x + cb.width / 2;
      const cy = cb.y + cb.height / 2;
      const ox = cx;
      const oy = cy - cb.height * 0.25;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(ox, oy, { steps: 8 });
      await page.mouse.up();
      const len = 0.12 * 320 * fit;
      await page.mouse.move(ox + len, oy);
      await page.mouse.down();
      await page.mouse.move(ox + len * Math.cos(Math.PI / 6), oy - len * Math.sin(Math.PI / 6), { steps: 8 });
      await page.mouse.up();
      await expect(page.getByTestId('axes-angle')).toHaveText(/Drehung: (2[89]|3[012])°/);
      await shot('massstab-achsen');

      // Messen: Koordinatensystem an, Legende unten rechts
      await page.getByRole('radio', { name: 'Messen' }).click();
      await stageReady();
      await page.getByRole('button', { name: 'Vorschlagen' }).click();
      await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
      await page.getByRole('switch', { name: 'v-Pfeile' }).click();
      await page.getByRole('switch', { name: 'Koordinatensystem' }).click();
      await expect(page.getByRole('switch', { name: 'Koordinatensystem' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('stage')).toHaveAttribute('data-legend', /\d/);
      await page.getByTestId('viewer-canvas').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      const lv = (await page.getByTestId('stage').getAttribute('data-legend'))!.split(',').map(Number);
      const mb = (await page.getByTestId('viewer-canvas').boundingBox())!;
      await page.mouse.move(mb.x + lv[0] + lv[2] / 2, mb.y + lv[1] + lv[3] / 2);
      await page.mouse.down();
      await page.mouse.move(mb.x + mb.width * 0.85, mb.y + mb.height - 40, { steps: 12 });
      await page.mouse.up();
      await expect
        .poll(async () => Number((await page.getByTestId('stage').getAttribute('data-legend'))!.split(',')[1]))
        .toBeGreaterThan(lv[1] + mb.height / 3);
      await shot('messen-legende');

      // Auswerten: Diagramm t-x mit Parabel
      await page.getByRole('radio', { name: 'Auswerten' }).click();
      await expect(page.getByTestId('chart')).toBeVisible();
      await page.getByRole('radio', { name: 't-x', exact: true }).click();
      await page.getByRole('radio', { name: 'Parabel', exact: true }).click();
      await expect(page.getByTestId('chart-equation')).toContainText('t²');
      await expect(page.getByTestId('chart-r2')).toHaveText(/R² = /);
      await page.getByTestId('chart').scrollIntoViewIfNeeded();
      await shot('auswerten-diagramm');
    });
  }
}

/** Plan 3: Teilen-Fenster PDF, Komponentenpfeile, t-s-Diagramm. */
for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(IPAD)) {
    test(`Sichtprüfung Plan 3 ${mode} ${fmt}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      // Schalter-Übergänge ausschalten, damit Screenshots den Endzustand zeigen.
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
          document.head.append(st);
        });
      });
      await page.setViewportSize(size);
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-3-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name}: Seitwärts-Scrollen`).toBeLessThanOrEqual(size.width);
      };

      await setScale(page);
      await page.getByRole('radio', { name: 'Messen' }).click();
      await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('button', { name: 'Vorschlagen' }).click();
      await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
      await page.getByRole('switch', { name: 'v-Pfeile' }).click();
      await page.getByRole('switch', { name: 'Komponenten' }).click();
      await expect(page.getByRole('switch', { name: 'Komponenten' })).toHaveAttribute('aria-checked', 'true');
      await shot('messen-komponenten');

      await page.getByRole('radio', { name: 'Auswerten' }).click();
      await expect(page.getByTestId('chart')).toBeVisible();
      await page.getByRole('radio', { name: 't-s', exact: true }).click();
      await expect(page.getByRole('radio', { name: 't-s', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('chart').scrollIntoViewIfNeeded();
      await shot('auswerten-ts');

      await page.getByRole('button', { name: /Teilen/ }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
      await dlg.getByLabel('Name / Klasse').fill('Max Mustermann 9b');
      await shot('teilen-pdf');
    });
  }
}

/** Plan 3: Seiten-JPEGs aus dem PDF und Diagramm-PNG zur manuellen Sichtprüfung ablegen. */
test('Sichtprüfung Plan 3: PDF-Seiten und Diagramm-PNG', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.setViewportSize({ width: 1194, height: 834 });
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  await page.getByRole('switch', { name: 'v-Pfeile' }).click();
  await page.getByRole('switch', { name: 'Komponenten' }).click();

  await page.getByRole('radio', { name: 'Auswerten' }).click();
  await page.getByRole('radio', { name: 't-s', exact: true }).click();
  await expect(page.getByTestId('chart')).toBeVisible();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Diagramm als Bild teilen' }).click(),
  ]);
  await png.saveAs('test-results/screens/chart-ts.png');

  await page.getByRole('button', { name: /Teilen/ }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
  await dlg.getByLabel('Name / Klasse').fill('Max Mustermann 9b');
  const share = dlg.getByRole('button', { name: 'Teilen', exact: true });
  await expect(share).toBeEnabled({ timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), share.click()]);
  const buf = readFileSync((await dl.path())!);
  const latin = buf.toString('latin1');
  const re = /\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g;
  let mt: RegExpExecArray | null;
  let n = 0;
  while ((mt = re.exec(latin))) {
    const start = mt.index + mt[0].length;
    writeFileSync(`test-results/screens/pdf-p${++n}.jpg`, buf.subarray(start, start + Number(mt[1])));
  }
  expect(n, 'Seiten-JPEGs im PDF').toBeGreaterThanOrEqual(2);
});

/** Plan 4a: Startseite (Moduswahl) und Modus Einfach, Schritte 1, 3, 4, 5. */
for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(FORMATS)) {
    test(`Sichtprüfung Plan 4a ${mode} ${fmt}`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize(size);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      });
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-4a-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name}: Seitwärts-Scrollen`).toBeLessThanOrEqual(size.width);
      };
      const next = page.getByTestId('einfach-next');

      await page.goto('/');
      await expect(page.getByTestId('mode-einfach')).toBeVisible();
      await shot('modus');

      await chooseMode(page, 'einfach');
      await page.locator('input[type=file]:not([capture])').setInputFiles('tests/fixtures/ball-60.mp4');
      await expect(page.getByTestId('player')).toBeVisible();
      await page.waitForTimeout(800);
      await shot('schritt1');

      await next.click();
      await next.click();
      await expect(page.getByTestId('einfach-dt')).toBeVisible();
      await expect(page.getByTestId('busy')).toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(500);
      await shot('schritt3');

      await next.click();
      await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('button', { name: /Vorschlagen/ }).click();
      await expect
        .poll(async () => Number(((await page.getByTestId('markiert-count').textContent()) ?? '').match(/^(\d+) von/)?.[1] ?? 0), { timeout: 60000 })
        .toBeGreaterThanOrEqual(10);
      await shot('schritt4');

      await next.click();
      await expect(page.getByTestId('einfach-share')).toHaveText('⬆ Bild teilen', { timeout: 60_000 });
      await shot('schritt5');
    });
  }
}
