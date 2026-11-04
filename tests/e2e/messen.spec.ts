import { test, expect, type Page } from '@playwright/test';
import { openPhase, setScale } from './helpers';

/** Pixelprobe der linken oberen Ecke (Legende) des Viewer-Canvas als Summe der Kanalwerte. */
async function cornerSum(page: Page): Promise<number> {
  return page.getByTestId('viewer-canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, Math.min(160, c.width), Math.min(80, c.height)).data;
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i];
    return s;
  });
}

async function count(page: Page): Promise<[number, number]> {
  const t = (await page.getByTestId('pos-count').textContent())!;
  const m = /(\d+)\s*\/\s*(\d+)/.exec(t)!;
  return [Number(m[1]), Number(m[2])];
}

test('Vorschlagen, Legende, Punkt löschen und wieder setzen', async ({ page }) => {
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');

  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  // Erkennung findet nicht zwingend jede Position (Fixture: ca. 13 von 20)
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  const [n] = await count(page);
  expect(n).toBeGreaterThanOrEqual(10);

  const before = await cornerSum(page);
  await page.getByRole('switch', { name: 'v-Pfeile' }).click();
  await expect.poll(() => cornerSum(page)).not.toBe(before);

  await page.getByRole('button', { name: 'Position 0, Bild' }).click();
  await page.getByRole('button', { name: 'Punkt löschen' }).click();
  expect((await count(page))[0]).toBe(n - 1);

  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.8, y: box.height * 0.8 } });
  expect((await count(page))[0]).toBe(n);
});

test('Ohne Maßstab sind v-Pfeile deaktiviert', async ({ page }) => {
  await openPhase(page, 'Messen');
  await expect(page.getByText('Für Pfeile und Tabelle zuerst den Maßstab festlegen')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'v-Pfeile' })).toBeDisabled();
  await page.getByRole('button', { name: 'Zum Maßstab' }).click();
  await expect(page.getByRole('radio', { name: 'Maßstab' })).toHaveAttribute('aria-checked', 'true');
});
