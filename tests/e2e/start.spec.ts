import { test, expect } from '@playwright/test';

test('Startseite: zwei Kacheln', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('pick-camera')).toBeVisible();
  await expect(page.getByTestId('pick-file')).toBeVisible();
  await expect(page.locator('input[type=file][capture=environment]')).toHaveAttribute('accept', 'video/*');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pick-file').click();
  await chooser;
});

test('Startseite: Video laden, Profimodus, Fehlerfall', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await expect(page.getByText('Δt = 0,100 s')).toBeVisible();
  // Fehlerfall
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/not-a-video.mp4');
  await expect(page.getByRole('alert').filter({ hasText: 'MP4 oder MOV' })).toBeVisible();
});
