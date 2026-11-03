import { test, expect, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function pngSize(dl: Download) {
  const buf = readFileSync((await dl.path())!);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function open(page: Page) {
  // R4: Download-Pfad deterministisch (kein Teilen-Menü)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.setInputFiles('input[type=file]', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
}

test('Export Original als PNG', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Export' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Bild exportieren', exact: true }).last().click(),
  ]);
  expect(dl.suggestedFilename()).toBe('ball-60_stroboskop.png');
  expect(await pngSize(dl)).toEqual({ width: 320, height: 240 });
});

test('Drehung 90 vertauscht die Maße; JPEG-Name', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Drehen' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Bild exportieren', exact: true }).last().click(),
  ]);
  expect(await pngSize(dl)).toEqual({ width: 240, height: 320 });
  await page.getByRole('radio', { name: 'JPEG' }).check();
  await expect(page.getByText('Qualität')).toBeVisible();
  const [dl2] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Bild exportieren', exact: true }).last().click(),
  ]);
  expect(dl2.suggestedFilename()).toBe('ball-60_stroboskop.jpg');
});
