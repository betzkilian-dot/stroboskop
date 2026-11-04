import { test, expect } from '@playwright/test';
import { openPhase, tapScale, setScale } from './helpers';

test('Maßstab setzen, Koordinaten, weiter zu Messen', async ({ page }) => {
  await setScale(page);
  await expect(page.getByTestId('scale-info')).toContainText('mm');
  await expect(page.getByTestId('scale-info')).toContainText('Pixel');

  const sw = page.getByRole('switch', { name: 'y nach oben' });
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await expect(sw).not.toHaveAttribute('aria-checked', before!);

  await page.getByRole('button', { name: /Weiter zu Messen/ }).click();
  await expect(page.getByRole('radio', { name: 'Messen' })).toHaveAttribute('aria-checked', 'true');
});

test('Strecke neu setzen und Hinweise', async ({ page }) => {
  await openPhase(page);
  await expect(page.getByText('Anfang der bekannten Strecke antippen')).toBeVisible();
  await tapScale(page, 200);
  await expect(page.getByText('Endpunkte ziehen zum Korrigieren')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toHaveCount(0); // Länge leer
  await page.getByRole('button', { name: 'Strecke neu setzen' }).click();
  await expect(page.getByText('Anfang der bekannten Strecke antippen')).toBeVisible();
});
