import { test, expect } from '@playwright/test';

async function openVideo(page: import('@playwright/test').Page, fixture: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.setInputFiles('input[type=file]', `tests/fixtures/${fixture}`);
  await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Video' }).click();
}

test('Aufnahme-fps und Zuschnitt', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  await expect(page.getByText('Aufnahme: 60 Bilder/s')).toBeVisible();
  await page.getByLabel('Aufnahme-fps').fill('120');
  await page.getByLabel('Aufnahme-fps').press('Enter');
  await expect(page.getByText('Δt = 0,0500 s')).toBeVisible();
  await page.getByLabel('Ende').fill('59');
  await expect(page.getByText(/\d+ Positionen/)).toHaveText(/^\d+ Positionen$/);
  await expect(page.getByText('10 Positionen')).toBeVisible();
});

test('unsichere Bildrate warnt', async ({ page }) => {
  await openVideo(page, 'ball-vfr.mp4');
  await expect(page.getByRole('alert')).toContainText('Bildrate nicht eindeutig');
});

test('240 fps erkannt', async ({ page }) => {
  await openVideo(page, 'ball-240.mp4');
  await expect(page.getByText('Aufnahme: 240 Bilder/s')).toBeVisible();
});

test('Dezimalkomma bei Aufnahme-fps und Auswahl mit weniger als 2 Positionen', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  const fps = page.getByLabel('Aufnahme-fps');
  await fps.fill('59,94');
  await fps.press('Enter');
  await expect(page.getByText('Aufnahme: 59,94 Bilder/s')).toBeVisible();
  await fps.fill('50');
  await fps.press('Enter');
  await expect(page.getByText('Δt = 0,120 s')).toBeVisible();
  await fps.fill('abc');
  await fps.press('Enter');
  await expect(page.getByText('Aufnahme: 50 Bilder/s')).toBeVisible();
  await page.getByLabel('Ende').fill('0');
  await expect(page.getByRole('alert')).toContainText('mindestens 2 Positionen');
});
