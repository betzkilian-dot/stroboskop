import { test, expect, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setScale } from './helpers';

async function bytes(dl: Download) {
  return readFileSync((await dl.path())!);
}
async function pngSize(dl: Download) {
  const buf = await bytes(dl);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function open(page: Page, inVideo?: (page: Page) => Promise<void>) {
  // R4: Download-Pfad deterministisch (kein Teilen-Menü)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  if (inVideo) await inVideo(page);
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByTestId('open-export')).toBeEnabled();
}

// Ein Knopf: Datei wird im Hintergrund vorbereitet, danach genügt ein Klick auf „Teilen“
function shareBtn(page: Page) {
  return page.getByRole('dialog').getByRole('button', { name: 'Teilen', exact: true });
}
async function exportOnce(page: Page): Promise<Download> {
  const share = shareBtn(page);
  await expect(share).toBeEnabled({ timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), share.click()]);
  await expect(page.getByTestId('toast')).toHaveText('Heruntergeladen');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return dl;
}

test('Teilen-Fenster hat nur einen Primärknopf, der nach der Vorbereitung aktiv wird', async ({ page }) => {
  await open(page);
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('button', { name: 'Bild erzeugen' })).toHaveCount(0);
  await expect(dlg.getByRole('button', { name: 'Teilen / Sichern' })).toHaveCount(0);
  await expect(shareBtn(page)).toBeEnabled({ timeout: 60_000 });
});

test('Optionsänderung startet eine neue Vorbereitung („Wird vorbereitet …“)', async ({ page }) => {
  await open(page);
  await page.getByTestId('open-export').click();
  await expect(shareBtn(page)).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('switch', { name: 'Infozeile' }).click();
  const busy = page.getByRole('dialog').getByRole('button', { name: 'Wird vorbereitet …' });
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();
  await expect(shareBtn(page)).toBeEnabled({ timeout: 60_000 });
});

test('Schließen während der Vorbereitung hebt die Export-Sperre auf', async ({ page }) => {
  await measured(page);
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
  await expect(dlg.getByRole('button', { name: 'Wird vorbereitet …' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('busy')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('film-item').first()).toBeVisible();
});

test('Export Original als PNG, Infozeile verändert das Bild', async ({ page }) => {
  await open(page);
  await page.getByTestId('open-export').click();
  const dl = await exportOnce(page);
  expect(dl.suggestedFilename()).toBe('ball-60_stroboskop.png');
  expect(await pngSize(dl)).toEqual({ width: 320, height: 240 });
  const withInfo = await bytes(dl);

  await page.getByTestId('open-export').click();
  await page.getByRole('switch', { name: 'Infozeile' }).click();
  const dl2 = await exportOnce(page);
  expect(await pngSize(dl2)).toEqual({ width: 320, height: 240 });
  expect((await bytes(dl2)).equals(withInfo)).toBe(false);
});

test('Arbeitsblatt vergrößert nie; Drehung 90 vertauscht die Maße; JPEG-Magic', async ({ page }) => {
  await open(page, (p) => p.getByRole('button', { name: 'Drehen' }).click());
  await page.getByTestId('open-export').click();
  await page.getByRole('radio', { name: 'Klein (für Arbeitsblätter)' }).click();
  const dl = await exportOnce(page);
  expect(await pngSize(dl)).toEqual({ width: 240, height: 320 });
  await page.getByTestId('open-export').click();
  await page.getByRole('radio', { name: 'Klein (für Arbeitsblätter)' }).click();
  await page.getByRole('radio', { name: 'JPEG' }).click();
  await expect(page.getByText('Qualität')).toBeVisible();
  const dl2 = await exportOnce(page);
  expect(dl2.suggestedFilename()).toBe('ball-60_stroboskop.jpg');
  expect((await bytes(dl2)).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
});

test('Escape schließt den Dialog', async ({ page }) => {
  await open(page);
  await page.getByTestId('open-export').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Einblendungen verändern das exportierte Bild', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByTestId('open-export')).toBeEnabled();

  await page.getByTestId('open-export').click();
  await expect(page.getByRole('switch', { name: 'Einblendungen' })).toHaveAttribute('aria-checked', 'true');
  const withOv = await bytes(await exportOnce(page));

  await page.getByTestId('open-export').click();
  await page.getByRole('switch', { name: 'Einblendungen' }).click();
  const without = await bytes(await exportOnce(page));
  expect(without.equals(withOv)).toBe(false);
  expect(withOv.length).toBeGreaterThan(without.length);
});

test('Größenzeile zeigt die tatsächliche Pixelgröße', async ({ page }) => {
  await open(page, (p) => p.getByRole('button', { name: 'Drehen' }).click());
  await page.getByTestId('open-export').click();
  const line = page.getByTestId('export-size');
  await expect(line).toHaveText('240 × 320 Pixel'); // Original, 90° gedreht
  await page.getByRole('radio', { name: 'Klein (für Arbeitsblätter)' }).click();
  await expect(line).toHaveText('240 × 320 Pixel'); // nie hochskaliert
  await expect(page.getByRole('radio', { name: 'Original (volle Auflösung)' })).toBeVisible();
});

const NO_SHARE = () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
};

async function measured(page: Page) {
  await page.addInitScript(NO_SHARE);
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByTestId('open-export')).toBeEnabled();
}

test('PDF-Bericht mit Maßstab: Diagramme t-x und t-y, Download ist ein PDF', async ({ page }) => {
  await measured(page);
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
  await expect(dlg.getByLabel('Titel')).toHaveValue('ball-60');
  await dlg.getByLabel('Name / Klasse').fill('Max 9b');
  await expect(dlg.getByText('Aktuelles Diagramm aus Auswerten (t-x)')).toBeVisible();
  await expect(dlg.getByRole('checkbox', { name: 't-x' })).toHaveCount(0);
  await expect(dlg.getByRole('radio', { name: 'Parabel' })).toHaveCount(0);
  const dl = await exportOnce(page);
  expect(dl.suggestedFilename()).toBe('ball-60_bericht.pdf');
  const buf = readFileSync((await dl.path())!);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const count = /\/Count (\d+)/.exec(buf.toString('latin1'));
  expect(count).not.toBeNull();
  expect(Number(count![1])).toBeGreaterThanOrEqual(1);
  const out = process.env.REPORT_DUMP;
  if (out) (await import('node:fs')).writeFileSync(out, buf);

  // Name wird gemerkt
  await page.getByTestId('open-export').click();
  await page.getByRole('dialog').getByRole('radio', { name: 'PDF-Bericht' }).click();
  await expect(page.getByRole('dialog').getByLabel('Name / Klasse')).toHaveValue('Max 9b');
});

test('PDF-Bericht ohne Maßstab: Tabellen und Diagramme deaktiviert, PDF trotzdem möglich', async ({ page }) => {
  await page.addInitScript(NO_SHARE);
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByTestId('open-export')).toBeEnabled();
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
  await expect(dlg.getByRole('switch', { name: 'Messtabelle(n)' })).toBeDisabled();
  await expect(dlg.getByRole('switch', { name: 'Diagramme' })).toBeDisabled();
  await expect(dlg.getByText('Für Tabelle und Diagramme zuerst den Maßstab festlegen')).toBeVisible();
  const dl = await exportOnce(page);
  expect(readFileSync((await dl.path())!).subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

test('Schließen und sofort neu öffnen: kein Fehler, Teilen lädt herunter', async ({ page }) => {
  await measured(page);
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'PDF-Bericht' }).click();
  await expect(dlg.getByRole('button', { name: 'Wird vorbereitet …' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Schließen' }).click();
  await page.getByTestId('open-export').click();
  await expect(page.getByRole('dialog').getByText('Export fehlgeschlagen.')).toHaveCount(0);
  const dl = await exportOnce(page);
  expect(dl.suggestedFilename()).toBe('ball-60_stroboskop.png');
});

test('Messdaten (CSV) im Teilen-Fenster lädt eine CSV-Datei', async ({ page }) => {
  await measured(page);
  await page.getByTestId('open-export').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'Messdaten (CSV)' }).click();
  await dlg.getByRole('radio', { name: /International/ }).click();
  const dl = await exportOnce(page);
  expect(dl.suggestedFilename()).toBe('ball-60_messung.csv');
  const text = readFileSync((await dl.path())!).toString('utf8');
  expect(text).toContain('Nr,t in s,x in m');
});
