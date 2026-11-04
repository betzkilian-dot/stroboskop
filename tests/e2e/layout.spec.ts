import { test, expect, type Page } from '@playwright/test';
import { chooseMode, setScale } from './helpers';

async function load(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/');
  await chooseMode(page, 'erweitert');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
}

test('Querformat: Spalte rechts neben der Bühne', async ({ page }) => {
  await load(page, 1180, 820);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const stage = (await page.locator('.work .stage').boundingBox())!;
  const col = (await page.locator('.work .col').boundingBox())!;
  expect(col.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
});

test('Hochformat: Spalte unter der Bühne, kein Seitwärts-Scrollen', async ({ page }) => {
  await load(page, 820, 1180);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const stage = (await page.locator('.work .stage').boundingBox())!;
  const col = (await page.locator('.work .col').boundingBox())!;
  expect(col.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  expect(stage.height).toBeGreaterThanOrEqual(0.45 * 1180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
});

test('Miniaturen sind nicht abgeschnitten', async ({ page }) => {
  await load(page, 1180, 820);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const strip = (await page.getByTestId('filmstrip').boundingBox())!;
  const items = page.getByTestId('film-item');
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    const b = (await items.nth(i).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(40);
    expect(b.y).toBeGreaterThanOrEqual(strip.y - 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(strip.y + strip.height + 0.5);
  }
});

test('Phasen Maßstab, Messen, Auswerten sind mit Video aktiv', async ({ page }) => {
  await load(page, 1180, 820);
  for (const n of ['Maßstab', 'Messen', 'Auswerten']) await expect(page.getByRole('radio', { name: n })).toBeEnabled();
});

test('Hochformat: Positionsleiste bleibt beim Scrollen unten sichtbar', async ({ page }) => {
  await load(page, 820, 1180);
  await page.getByRole('radio', { name: 'Bild' }).click();
  const strip = page.getByTestId('filmstrip');
  await expect(strip).toBeVisible();
  // Inhalt ist höher als der Bildschirm (sonst wäre der Test bedeutungslos)
  const scrolls = await page.evaluate(() => {
    const p = document.querySelector('.panel')!;
    p.scrollTop = 0;
    return p.scrollHeight > p.clientHeight;
  });
  expect(scrolls).toBe(true);
  const b = (await strip.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(1180 + 0.5);
  expect(b.y).toBeGreaterThan(1180 / 2);
});

test('Hochformat: Maßstab, Messen, Auswerten ohne Seitwärts-Scrollen', async ({ page }) => {
  await load(page, 820, 1180);
  for (const n of ['Maßstab', 'Messen', 'Auswerten']) {
    await page.getByRole('radio', { name: n }).click();
    await expect(page.getByTestId('stage')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), n).toBeLessThanOrEqual(820);
    expect(await page.evaluate(() => document.body.scrollWidth), n).toBeLessThanOrEqual(820);
  }
});

test('Querformat: Auswerten-Tabelle zeigt alle Spalten ohne Abschneiden, Zeilen 44 px', async ({ page }) => {
  await load(page, 1180, 820);
  await setScale(page);
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Vorschlagen' }).click();
  await expect(page.getByTestId('pos-count')).not.toHaveText(/^0 \//, { timeout: 60_000 });
  await page.getByRole('radio', { name: 'Auswerten' }).click();
  await expect(page.getByTestId('row').first()).toBeVisible();
  const head = page.getByRole('columnheader', { name: /\|a\|/ });
  await expect(head).toBeVisible();
  const wrap = (await page.locator('.col .wrap').boundingBox())!;
  const b = (await head.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(wrap.x - 0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(wrap.x + wrap.width + 0.5);
  expect(await page.locator('.col .wrap').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const row = (await page.getByTestId('row').first().boundingBox())!;
  expect(row.height).toBeLessThanOrEqual(45);
  expect(row.height).toBeGreaterThanOrEqual(44);
});

for (const [w, h] of [[1194, 834], [834, 1194]]) {
  test(`Einstellungsspalte ohne Überlauf in allen Phasen (${w}×${h})`, async ({ page }) => {
    await load(page, w, h);
    await setScale(page);
    for (const n of ['Video', 'Bild', 'Maßstab', 'Messen', 'Auswerten']) {
      await page.getByRole('radio', { name: n }).click();
      await expect(page.locator('.work .stage')).toBeVisible();
      const col = page.locator('.work .col');
      await expect(col).toBeVisible();
      expect(await col.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), n).toBe(true);
      // keine Segment-Beschriftung (Phasen, Einheit, Pfeilposition …) abgeschnitten
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll('.seg span')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent),
      );
      expect(cut, n).toEqual([]);
      if (n === 'Bild') {
        const cb = (await col.boundingBox())!;
        const tile = page.getByRole('radiogroup', { name: 'Hintergrund' }).getByRole('radio', { name: 'Gewählt' });
        await tile.scrollIntoViewIfNeeded();
        const tb = (await tile.boundingBox())!;
        expect(tb.x).toBeGreaterThanOrEqual(cb.x - 0.5);
        expect(tb.x + tb.width).toBeLessThanOrEqual(cb.x + cb.width + 0.5);
        await expect(page.getByTestId('more')).toHaveCount(0);
      }
    }
  });
}

/** Plan 4a: Modus Einfach, Fußzeile immer vollständig sichtbar, Bild links bzw. oben. */
for (const [fmt, w, h] of [['quer', 1180, 820], ['hoch', 820, 1180]] as const) {
  test(`Einfach ${fmt}: Weiter vollständig im Viewport, kein Seitwärts-Scrollen`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await chooseMode(page, 'einfach');
    await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
    await expect(page.getByTestId('player')).toBeVisible();
    const next = page.getByTestId('einfach-next');
    const check = async (name: string) => {
      const b = (await next.boundingBox())!;
      expect(b.x, name).toBeGreaterThanOrEqual(0);
      expect(b.y, name).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, name).toBeLessThanOrEqual(w);
      expect(b.y + b.height, name).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), name).toBeLessThanOrEqual(w);
      expect(await page.evaluate(() => document.documentElement.scrollHeight), name).toBeLessThanOrEqual(h);
    };
    await check('schritt1');
    await next.click();
    await next.click();
    await expect(page.getByTestId('einfach-dt')).toBeVisible();
    await check('schritt3');
    const canvas = (await page.getByTestId('viewer-canvas').boundingBox())!;
    const dt = (await page.getByTestId('einfach-dt').boundingBox())!;
    if (fmt === 'quer') expect(dt.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1);
    else expect(dt.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    await next.click();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
    await check('schritt4');
    await next.click();
    await expect(page.getByTestId('einfach-new')).toBeVisible();
    const nb = (await page.getByTestId('einfach-new').boundingBox())!;
    expect(nb.y + nb.height).toBeLessThanOrEqual(h);
  });
}

test('Erweitert: Kopfzeile mit „‹ Start“ im schmalen Hochformat ohne Überlappung', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 1000 });
  await page.goto('/');
  await chooseMode(page, 'erweitert');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  const boxes = [] as { x: number; y: number; width: number; height: number }[];
  const btns = page.locator('header button, header [role=radio]');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const loc = btns.nth(i);
    if (!(await loc.isVisible())) continue;
    const b = (await loc.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(600);
    for (const o of boxes) {
      const overlap = b.x < o.x + o.width - 1 && o.x < b.x + b.width - 1 && b.y < o.y + o.height - 1 && o.y < b.y + b.height - 1;
      expect(overlap).toBe(false);
    }
    boxes.push(b);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
});
