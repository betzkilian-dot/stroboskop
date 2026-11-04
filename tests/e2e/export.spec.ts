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

// R20: zweistufig: rendern, dann im eigenen Klick teilen/sichern
async function exportOnce(page: Page): Promise<Download> {
  await page.getByRole('button', { name: 'Bild erzeugen', exact: true }).click();
  const share = page.getByRole('button', { name: 'Teilen / Sichern', exact: true });
  await expect(share).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), share.click()]);
  await expect(page.getByTestId('toast')).toHaveText('Heruntergeladen');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return dl;
}

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
