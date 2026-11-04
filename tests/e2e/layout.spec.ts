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

test('Phasen Maßstab, Messen, Auswerten sind mit Video aktiv', async ({ page }) => {
  await load(page, 1180, 820);
  for (const n of ['Maßstab', 'Messen', 'Auswerten']) await expect(page.getByRole('radio', { name: n })).toBeEnabled();
});

test('Hochformat: Positionsleiste bleibt beim Scrollen unten sichtbar', async ({ page }) => {
  await load(page, 820, 1180);
  await page.getByRole('radio', { name: 'Bild' }).click();
  await page.getByTestId('more').locator('summary').click(); // mehr Inhalt -> Bereich scrollt
  const strip = page.getByTestId('filmstrip');
  await expect(strip).toBeVisible();
  // Inhalt ist höher als der Bildschirm (sonst wäre der Test bedeutungslos)
  const scrolls = await page.evaluate(() => {
    const p = document.querySelector('.panel')!;
    p.scrollTop = 0;
    return p.scrollHeight > p.clientHeight;
  });
  expect(scrolls).toBe(true);
  const b = (await strip.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(1180 + 0.5);
  expect(b.y).toBeGreaterThan(1180 / 2);
});

test('„Mehr …“ ohne Browser-Dreieck, mit Pfeil-Symbol', async ({ page }) => {
  await load(page, 1180, 820);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const summary = page.getByTestId('more').locator('summary');
  expect(await summary.evaluate((el) => getComputedStyle(el).listStyleType)).toBe('none');
  await expect(summary.locator('svg')).toHaveCount(1);
});

test('Hochformat: Maßstab, Messen, Auswerten ohne Seitwärts-Scrollen', async ({ page }) => {
  await load(page, 820, 1180);
  for (const n of ['Maßstab', 'Messen', 'Auswerten']) {
    await page.getByRole('radio', { name: n }).click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), n).toBeLessThanOrEqual(820);
    expect(await page.evaluate(() => document.body.scrollWidth), n).toBeLessThanOrEqual(820);
  }
});
