import { test, expect } from '@playwright/test';

test('Startseite: Video laden, Profimodus, Fehlerfall', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.setInputFiles('input[type=file]', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await expect(page.getByText('Δt = 0,100 s')).toBeVisible();
  // Fehlerfall
  await page.setInputFiles('input[type=file]', 'tests/fixtures/not-a-video.mp4');
  await expect(page.getByRole('alert').filter({ hasText: 'MP4 oder MOV' })).toBeVisible();
});
