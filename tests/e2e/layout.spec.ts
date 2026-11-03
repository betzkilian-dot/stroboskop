import { test, expect, type Page } from '@playwright/test';

async function load(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
}

test('Querformat: Spalte rechts neben der Bühne', async ({ page }) => {
  await load(page, 1180, 820);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const stage = (await page.locator('.work .stage').boundingBox())!;
  const col = (await page.locator('.work .col').boundingBox())!;
  expect(col.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
});

test('Hochformat: Spalte unter der Bühne, kein Seitwärts-Scrollen', async ({ page }) => {
  await load(page, 820, 1180);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const stage = (await page.locator('.work .stage').boundingBox())!;
  const col = (await page.locator('.work .col').boundingBox())!;
  expect(col.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  expect(stage.height).toBeGreaterThanOrEqual(0.45 * 1180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
});

test('Miniaturen sind nicht abgeschnitten', async ({ page }) => {
  await load(page, 1180, 820);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const strip = (await page.getByTestId('filmstrip').boundingBox())!;
  const items = page.getByTestId('film-item');
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    const b = (await items.nth(i).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(40);
    expect(b.y).toBeGreaterThanOrEqual(strip.y - 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(strip.y + strip.height + 0.5);
  }
});

test('Phasen Maßstab, Messen, Auswerten sind deaktiviert', async ({ page }) => {
  await load(page, 1180, 820);
  for (const n of ['Maßstab', 'Messen', 'Auswerten']) await expect(page.getByRole('radio', { name: n })).toBeDisabled();
});
