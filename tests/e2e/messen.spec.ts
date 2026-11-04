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

test('Wiedereinstieg: Hinweis nennt erste offene Position, Tipp verschiebt Punkt 0 nicht', async ({ page }) => {
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  const [n, total] = await count(page);
  expect(n).toBeLessThan(total);
  const hint = page.getByText(/^Position \d+ antippen$/);
  await expect(hint).toBeVisible();
  const text = (await hint.textContent())!;

  await page.getByRole('radio', { name: 'Bild' }).click();
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText(text, { exact: true })).toBeVisible();

  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.9, y: box.height * 0.9 } });
  expect((await count(page))[0]).toBe(n + 1); // neue Position gesetzt, kein vorhandener Punkt überschrieben
});

test('Punkt ziehen: Lupe erscheint und die Tabelle ändert sich', async ({ page }) => {
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect(page.getByTestId('pos-count')).toHaveText(/^2 \//);

  const cellText = async () => {
    await page.getByRole('radio', { name: 'Auswerten' }).click();
    await expect(page.getByTestId('row').nth(1)).toBeVisible();
    const t = await page.getByTestId('row').nth(1).locator('td').nth(2).textContent();
    await page.getByRole('radio', { name: 'Messen' }).click();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
    return t;
  };
  const before = await cellText();

  const from = at(0.3, 0.5);
  const to = at(0.4, 0.6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.getByTestId('magnifier')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('magnifier')).toHaveCount(0);
  expect(await cellText()).not.toBe(before);
});

test('Positionsleiste: ausgeschlossene Bilder ohne Nummer, Nummern zählen nur Messpositionen', async ({ page }) => {
  await openPhase(page, 'Bild');
  const items = page.getByTestId('film-item');
  await expect(items.first()).toBeVisible();
  await items.nth(1).click(); // Bild ausschließen
  await expect(items.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(items.nth(1)).toHaveAttribute('aria-label', /ausgeschlossen/);
  await expect(items.nth(1).locator('.n')).toHaveCount(0);
  await expect(items.nth(2).locator('.n')).toHaveText('1'); // direkt nach der Lücke: Position 1, nicht 2
});
