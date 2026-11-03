import { test, expect } from '@playwright/test';

const FILE = 'input[type=file]:not([capture])';

test('Rechen-Anzeige erscheint nicht flackernd und verschwindet wieder', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles(FILE, 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('tab', { name: 'Bild' })).toHaveAttribute('aria-selected', 'true');
  await page.evaluate(() => {
    (window as unknown as { __busy: number }).__busy = 0;
    let was = false;
    new MutationObserver(() => {
      const now = !!document.querySelector('[data-testid=busy]');
      if (now && !was) (window as unknown as { __busy: number }).__busy++;
      was = now;
    }).observe(document.body, { childList: true, subtree: true });
  });
  for (const m of ['Aufhellen', 'Abdunkeln', 'Transparent', 'Differenz', 'Aufhellen'])
    await page.getByRole('radio', { name: m }).check();
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 5000 });
  const count = await page.evaluate(() => (window as unknown as { __busy: number }).__busy);
  expect(count).toBeLessThanOrEqual(1);
});

test('Rechen-Anzeige beim ersten Render mit Median-Hintergrund', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles(FILE, 'tests/fixtures/ball-240.mp4');
  await expect(page.getByTestId('busy').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('busy').first()).toContainText(/Bild wird berechnet|Video wird geöffnet/);
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 60000 });
});
