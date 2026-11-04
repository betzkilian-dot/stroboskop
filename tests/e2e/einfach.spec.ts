import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { chooseMode } from './helpers';

const FPS_TEXT = /Bildrate nicht eindeutig/;
async function open(page: Page) {
  // Download-Pfad deterministisch (kein Teilen-Menü)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await chooseMode(page, 'einfach');
}
async function load(page: Page, fixture = 'ball-60.mp4') {
  await page.setInputFiles('input[type=file]:not([capture])', `tests/fixtures/${fixture}`);
  await expect(page.getByTestId('player')).toBeVisible();
}
const mark = async (page: Page, id: 'mark-start' | 'mark-end') =>
  Number(await page.getByTestId(id).getAttribute('aria-valuenow'));

test('Schritt Video: Rahmen, Weiter erst mit Video, Markierungen', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('navigation', { name: 'Fortschritt' }).getByRole('button', { name: '1 Video' })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('einfach-next')).toBeDisabled();
  await expect(page.getByTestId('einfach-pick-camera')).toBeVisible();
  await expect(page.getByTestId('einfach-pick-file')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anderes Video' })).toHaveCount(0);

  await load(page);
  await expect(page.getByTestId('einfach-next')).toBeEnabled();
  await expect(page.getByText('Wo beginnt und endet die Bewegung?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anderes Video' })).toBeVisible();

  // Ende hier nach Sprung, dann Anfang hier
  const track = (await page.getByTestId('timeline-track').boundingBox())!;
  await page.mouse.click(track.x + track.width * 0.5, track.y + track.height / 2);
  await page.getByTestId('set-end').click();
  const end = await mark(page, 'mark-end');
  expect(end).toBeGreaterThan(0.1);
  await page.mouse.click(track.x + track.width * 0.2, track.y + track.height / 2);
  await page.getByTestId('set-start').click();
  expect(await mark(page, 'mark-start')).toBeGreaterThan(0.05);
  expect(await mark(page, 'mark-end')).toBeCloseTo(end, 5);

  // Weiter / zurueck ueber Fortschritt
  const nav = page.getByRole('navigation', { name: 'Fortschritt' });
  await expect(nav.getByRole('button', { name: '2 Zuschneiden' })).toBeDisabled();
  await page.getByTestId('einfach-next').click();
  await expect(nav.getByRole('button', { name: '2 Zuschneiden' })).toHaveAttribute('aria-current', 'step');
  await nav.getByRole('button', { name: '1 Video' }).click();
  await expect(nav.getByRole('button', { name: '1 Video' })).toHaveAttribute('aria-current', 'step');
  await expect(nav.getByRole('button', { name: '2 Zuschneiden' })).toBeEnabled();
});

test('Beenden fragt nach und führt zur Startseite', async ({ page }) => {
  await open(page);
  await load(page);
  await page.getByTestId('einfach-quit').click();
  await expect(page.getByRole('dialog')).toContainText('Beenden?');
  await page.getByRole('button', { name: 'Beenden', exact: true }).last().click();
  await expect(page.getByTestId('mode-einfach')).toBeVisible();
});

test('Beenden ohne Video geht direkt zur Startseite', async ({ page }) => {
  await open(page);
  await page.getByTestId('einfach-quit').click();
  await expect(page.getByTestId('mode-einfach')).toBeVisible();
});

test('unsichere Bildrate zeigt Hinweis und Feld', async ({ page }) => {
  await open(page);
  await load(page, 'ball-vfr.mp4');
  await expect(page.getByText(FPS_TEXT).first()).toBeVisible();
  await expect(page.getByLabel('Aufnahme-fps')).toBeVisible();
});

test('sichere Bildrate zeigt keinen Hinweis', async ({ page }) => {
  await open(page);
  await load(page);
  await expect(page.getByLabel('Aufnahme-fps')).toHaveCount(0);
});

test('Schritt Zuschneiden: Rahmen ziehen wird beim Verlassen übernommen, Ganzes Bild setzt zurück', async ({ page }) => {
  await open(page);
  await load(page);
  await page.getByTestId('einfach-next').click();
  await expect(page.getByText('Ziehe den Rahmen um den Bereich der Bewegung.')).toBeVisible();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  const frame = page.getByTestId('crop-frame');
  await expect(frame).toBeVisible();
  const full = (await frame.boundingBox())!;
  const hb = (await page.getByTestId('crop-handle-se').boundingBox())!;
  expect(hb.width).toBeGreaterThanOrEqual(44);
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 80, hb.y + hb.height / 2 - 60, { steps: 5 });
  await page.mouse.up();
  const small = (await frame.boundingBox())!;
  expect(small.width * small.height).toBeLessThan(full.width * full.height);

  // Zurück übernimmt den Rahmen: im Schritt Video ist der Zuschnitt sichtbar
  await page.getByRole('button', { name: '‹ Zurück' }).click();
  await expect(page.getByTestId('crop-shown')).toBeVisible();

  // Wieder hin, Ganzes Bild, Weiter + Zurück -> kein Zuschnitt
  await page.getByTestId('einfach-next').click();
  await expect(frame).toBeVisible();
  await page.getByRole('button', { name: 'Ganzes Bild' }).click();
  await page.getByTestId('einfach-next').click();
  await page.getByRole('navigation', { name: 'Fortschritt' }).getByRole('button', { name: '1 Video' }).click();
  await expect(page.getByTestId('player')).toBeVisible();
  await expect(page.getByTestId('crop-shown')).toHaveCount(0);
});

test('Schritt Zuschneiden: Drehen dreht das Standbild', async ({ page }) => {
  await open(page);
  await load(page);
  await page.getByTestId('einfach-next').click();
  const canvas = page.getByTestId('viewer-canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: /Drehen/ }).click();
  await page.getByRole('button', { name: '‹ Zurück' }).click();
  const video = page.locator('[data-testid=player] video');
  await expect.poll(async () => {
    const b = (await video.boundingBox())!;
    return b.height > b.width;
  }).toBe(true);
});

const canvasHash = (page: Page) =>
  page.getByTestId('viewer-canvas').evaluate((c) => {
    const cv = c as HTMLCanvasElement;
    const d = cv.getContext('2d')?.getImageData(0, 0, cv.width, cv.height).data ?? new Uint8ClampedArray();
    let h = 0;
    for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0;
    return `${cv.width}x${cv.height}:${h}`;
  });

test('Schritt Bild: Δt-Anzeige folgt dem Regler, Darstellung ändert die Vorschau', async ({ page }) => {
  await open(page);
  await load(page);
  await page.getByTestId('einfach-next').click();
  await page.getByTestId('einfach-next').click();
  const dt = page.getByTestId('einfach-dt');
  await expect(dt).toHaveText('Δt = 0,100 s');
  await expect(page.getByText(/Positionen · jedes/)).toBeVisible();
  await expect(page.getByText('dichter', { exact: true })).toBeVisible();
  await expect(page.getByText('weiter', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Automatisch/ })).toHaveAttribute('aria-checked', 'true');

  const slider = page.getByTestId('step-slider');
  const max = Number(await slider.getAttribute('max'));
  expect(max).toBeGreaterThan(1);
  await slider.fill(String(max));
  await expect(dt).not.toHaveText('Δt = 0,100 s');

  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 15000 });
  const before = await canvasHash(page);
  const tile = page.getByRole('radio', { name: /Helles Objekt/ });
  await tile.click();
  await expect(tile).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => canvasHash(page), { timeout: 15000 }).not.toBe(before);
});

test('Schritt Bild: Zuschnitt aus Schritt 2 erscheint in der Vorschau', async ({ page }) => {
  await open(page);
  await load(page);
  await page.getByTestId('einfach-next').click();
  await expect(page.getByTestId('crop-frame')).toBeVisible();
  const hb = (await page.getByTestId('crop-handle-se').boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 120, hb.y + hb.height / 2 - 20, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId('einfach-next').click();
  await expect(page.getByTestId('einfach-dt')).toBeVisible();
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 15000 });
  // Seitenverhältnis des gezeichneten Bildes (Bereich mit Deckkraft > 0 im Canvas)
  const ratio = () =>
    page.getByTestId('viewer-canvas').evaluate((c) => {
      const cv = c as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, x1 = -1, y0 = cv.height, y1 = -1;
      for (let y = 0; y < cv.height; y++)
        for (let x = 0; x < cv.width; x++)
          if (d[(y * cv.width + x) * 4 + 3] > 0) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      return x1 < 0 ? 0 : (x1 - x0 + 1) / (y1 - y0 + 1);
    });
  await expect.poll(ratio, { timeout: 15000 }).toBeLessThan(1.2);
  const cropped = await ratio();

  await page.getByRole('button', { name: '‹ Zurück' }).click();
  await page.getByRole('button', { name: 'Ganzes Bild' }).click();
  await page.getByTestId('einfach-next').click();
  await expect(page.getByTestId('einfach-dt')).toBeVisible();
  await expect.poll(ratio, { timeout: 15000 }).toBeGreaterThan(cropped + 0.1);
});

test('Schritt Markieren: Tippen, Vorschlagen, Positionszahl folgt Schritt Bild, Alle Punkte löschen', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await load(page);
  const next = page.getByTestId('einfach-next');
  await next.click();
  await next.click();
  await next.click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  const counter = page.getByTestId('markiert-count');
  const setCount = async () => Number(((await counter.textContent()) ?? '').match(/^(\d+) von/)?.[1] ?? 0);
  await expect(counter).toHaveText(/^0 von \d+ markiert$/);
  const n = Number((await counter.textContent())!.match(/von (\d+)/)![1]);
  await expect(page.getByText('Position 0 antippen').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alle Punkte löschen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Vorschlagen/ })).toContainText('App setzt alle Punkte, du korrigierst');
  await expect(page.getByText('Punkte, Nummern und Bahn werden automatisch eingezeichnet.')).toBeVisible();

  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
  await expect(counter).toHaveText(`1 von ${n} markiert`);
  await expect(page.getByText('Position 1 antippen').first()).toBeVisible();

  await page.getByRole('button', { name: /Vorschlagen/ }).click();
  // Erkennung findet nicht zwingend jede Position (Fixture: ca. 13 von 20)
  await expect.poll(setCount, { timeout: 60000 }).toBeGreaterThanOrEqual(10);

  // Abstand ändern -> Zähler passt zur neuen Positionszahl
  await page.getByRole('button', { name: '‹ Zurück' }).click();
  const slider = page.getByTestId('step-slider');
  await slider.fill(await slider.getAttribute('max') as string);
  await next.click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  await expect(counter).not.toHaveText(new RegExp(`von ${n} markiert`));
  const m = Number((await counter.textContent())!.match(/von (\d+)/)![1]);
  expect(m).toBeLessThan(n);

  // Löschen mit Dialog
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect.poll(setCount).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Alle Punkte löschen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Alle Punkte löschen?');
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(counter).toHaveText(`0 von ${m} markiert`);
});

async function toTeilen(page: Page, suggest: boolean) {
  const next = page.getByTestId('einfach-next');
  await next.click();
  await next.click();
  await next.click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  if (suggest) {
    const counter = page.getByTestId('markiert-count');
    await page.getByRole('button', { name: /Vorschlagen/ }).click();
    await expect.poll(async () => Number(((await counter.textContent()) ?? '').match(/^(\d+) von/)?.[1] ?? 0), { timeout: 60000 }).toBeGreaterThanOrEqual(10);
  }
  await next.click();
}

test('Schritt Teilen: Knopf wird bereit, Download ist ein JPEG (mit Punkten)', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await load(page);
  await toTeilen(page, true);
  const share = page.getByTestId('einfach-share');
  await expect(page.getByText(/Mit Infozeile „Δt = /)).toBeVisible();
  await expect(share).toHaveText('⬆ Bild teilen', { timeout: 60_000 });
  await expect(page.getByTestId('einfach-share-preview')).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), share.click()]);
  expect(dl.suggestedFilename()).toBe('ball-60_stroboskop.jpg');
  expect(readFileSync((await dl.path())!).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  await expect(page.getByTestId('toast')).toHaveText('Heruntergeladen');
});

test('Schritt Teilen: auch ohne Punkte ein Download', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await load(page);
  await toTeilen(page, false);
  const share = page.getByTestId('einfach-share');
  await expect(share).toHaveText('⬆ Bild teilen', { timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), share.click()]);
  expect(readFileSync((await dl.path())!).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
});

test('Schritt Teilen: Zurück während der Vorbereitung hebt die Sperre auf', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await load(page);
  await toTeilen(page, false);
  await expect(page.getByTestId('einfach-share')).toHaveText('Wird vorbereitet …');
  await page.getByRole('button', { name: '‹ Zurück' }).click();
  await expect(page.getByText('Position 0 antippen').first()).toBeVisible();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
});

test('Schritt Teilen: Neues Video fragt nach', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await load(page);
  await toTeilen(page, false);
  await page.getByTestId('einfach-new').click();
  await expect(page.getByRole('dialog')).toContainText('Neues Video?');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
