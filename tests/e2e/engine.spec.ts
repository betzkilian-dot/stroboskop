import { test, expect } from '@playwright/test';

test('Worker-Engine: Render, Verdraengung, Abbruch, Fortschritt, Fehlercodes', async ({ page }) => {
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', String(e)));
  await page.goto('/tests/e2e/pages/engine.html');
  await page.waitForFunction(() => (window as any).__result, null, { timeout: 120000 });
  const r: any = await page.evaluate(() => (window as any).__result);
  expect(r.error).toBeUndefined();

  expect(r.opened).toMatchObject({ exact: true, frameCount: 120, width: 320 });
  // step 14 ueber 0..70 -> k = 0,14,...,70 -> 6 Positionen, 6 getrennte 16x16-Quadrate
  expect(r.single).toMatchObject({ positions: 6, width: 320, height: 240, hasMask: true, bitmap: true, cameraMoved: false });
  expect(r.single.autoThreshold).toBeGreaterThanOrEqual(0.05);
  expect(r.single.autoThreshold).toBeLessThanOrEqual(0.95);
  expect(r.single.bright).toBeGreaterThan(6 * 256 * 0.9);
  expect(r.single.bright).toBeLessThan(6 * 256 * 1.1);
  expect(r.singleProgressLast).toEqual([6, 6]);

  expect(r.race).toEqual({ a: 'superseded', positions: 6 });
  expect(r.raceProgressLast).toEqual([6, 6]);
  expect(r.midflight).toEqual({ c: 'superseded', positions: 3 });

  expect(r.stale.stale).toEqual([]);
  expect(r.stale.last).toBe(8);

  expect(r.thumbAbort).toEqual({ first: 0, second: 3 });

  expect(r.twoOpens.second).toBe(r.twoOpens.soloFrameCount);
  expect(r.twoOpens.renderOk).toBe(true);
  expect(r.twoOpens.renderWidth).toBeLessThanOrEqual(64);
  expect(r.twoOpens.first).not.toBe(r.twoOpens.second); // ball-60 (120 Bilder) wurde nicht als Endzustand uebernommen

  expect(r.openAfterRender).toEqual({ a: expect.any(Number), b: 480, fast: true }); // open() direkt nach render() haengt nicht

  expect(r.bad).toEqual({ isVideoError: true, code: expect.stringMatching(/^(unsupported-format|no-video-track|decode-failed)$/) });
});
