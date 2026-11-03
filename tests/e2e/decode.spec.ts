import { test, expect } from '@playwright/test';

test('bildgenaue Dekodierung, Drehung, Skalierung, Rueckfallebene', async ({ page }) => {
  page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto('/tests/e2e/pages/decode.html');
  await page.waitForFunction(() => (window as any).__result, null, { timeout: 60000 });
  const result: any = await page.evaluate(() => (window as any).__result);
  expect(result.error).toBeUndefined();

  expect(result.exact).toBe(true);
  // Fixture (per ffmpeg unabhaengig verifiziert): Quadrat bei x = 24 + 4k (overlay-n beginnt bei 1), Mitte 24 + 4k + 7.5;
  // ab k = 74 ist es aus dem 320 px breiten Bild gewandert (k = 119 -> kein Quadrat, prueft das Stromende).
  const col = (k: number) => 24 + 4 * k + 7.5;
  for (const k of [0, 37, 70]) expect(result[k]).toBeCloseTo(col(k), -0.5);
  expect(result[119]).toBe(-1);
  expect(result.band).toMatchObject({ width: 320, height: 16 });
  expect(result.band.col).toBeCloseTo(col(37), -0.5);
  expect(result.back[0]).toBe(-1);
  expect(result.back[1]).toBeCloseTo(col(3), -0.5);
  expect(result.portrait.width).toBe(240);
  expect(result.portrait.height).toBe(320);
  // Quadrat codiert bei x 24..39, y 100..115; 90 Grad im Uhrzeigersinn -> x' = 239 - y, y' = x
  expect(result.portrait.cx).toBeCloseTo(239 - 107.5, -0.5);
  expect(result.portrait.cy).toBeCloseTo(31.5, -0.5);
  expect(result.scaled.width).toBeLessThanOrEqual(160);
  expect(result.fallbackExact).toBe(false);
  expect(result.fallbackFrame.width).toBeLessThanOrEqual(160);
});
