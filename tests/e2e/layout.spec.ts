import { test, expect, type Page } from '@playwright/test';
import { setScale } from './helpers';

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
    await expect(page.getByTestId('stage')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), n).toBeLessThanOrEqual(820);
    expect(await page.evaluate(() => document.body.scrollWidth), n).toBeLessThanOrEqual(820);
  }
});

test('Querformat: Auswerten-Tabelle zeigt alle Spalten ohne Abschneiden, Zeilen 44 px', async ({ page }) => {
  await load(page, 1180, 820);
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  await page.getByRole('radio', { name: 'Auswerten' }).click();
  await expect(page.getByTestId('row').first()).toBeVisible();
  const head = page.getByRole('columnheader', { name: /\|a\|/ });
  await expect(head).toBeVisible();
  const wrap = (await page.locator('.col .wrap').boundingBox())!;
  const b = (await head.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(wrap.x - 0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(wrap.x + wrap.width + 0.5);
  expect(await page.locator('.col .wrap').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const row = (await page.getByTestId('row').first().boundingBox())!;
  expect(row.height).toBeLessThanOrEqual(45);
  expect(row.height).toBeGreaterThanOrEqual(44);
});
