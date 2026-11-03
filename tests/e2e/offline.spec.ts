import { test, expect } from '@playwright/test';

// Laeuft nur im Projekt "edge-preview" (gebauter Stand, Port 4173): Service Worker gibt es nicht im Dev-Server.
test('offline startfaehig, Manifest, Video laden (Worker-Chunk gecacht)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await page.request.get(new URL(manifestHref!, page.url()).href)).json();
  expect(manifest).toMatchObject({ lang: 'de', display: 'standalone', name: 'Stroboskop', short_name: 'Stroboskop' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();

  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  // Worker-Chunk wirklich aus dem Cache: kein Rueckfall auf den Hauptthread, und die Vorschau wurde berechnet
  await expect(page.getByText('Bildgenauigkeit eingeschränkt')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByText('Bildgenauigkeit eingeschränkt')).toHaveCount(0);
});
