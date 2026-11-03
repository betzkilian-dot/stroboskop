import { test, expect } from '@playwright/test';

test('Startseite zeigt App-Titel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
