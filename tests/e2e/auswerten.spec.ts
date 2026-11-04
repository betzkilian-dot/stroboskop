import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setScale } from './helpers';

test('Messtabelle, Zeilenauswahl und CSV-Export', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });

  await page.getByRole('radio', { name: 'Auswerten' }).click();
  const rows = page.getByTestId('row');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await expect(rows.first().locator('td').nth(1)).toHaveText('0,000');
  await expect(rows.first().locator('td').nth(2)).toHaveText(/^[−\d]+,\d{3}$/);

  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'CSV' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Teilen / Sichern', exact: true }).click(),
  ]);
  const text = readFileSync((await dl.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.slice(1)).toMatch(/^Nr;t in s/);
  expect(dl.suggestedFilename()).toMatch(/_messung\.csv$/);
});
