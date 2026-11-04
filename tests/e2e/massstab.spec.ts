import { test, expect } from '@playwright/test';
import { openPhase, tapScale, setScale } from './helpers';

test('Maßstab setzen, Koordinaten, weiter zu Messen', async ({ page }) => {
  await setScale(page);
  await expect(page.getByTestId('scale-info')).toContainText('mm');
  await expect(page.getByTestId('scale-info')).toContainText('Pixel');

  const sw = page.getByRole('switch', { name: 'y nach oben' });
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await expect(sw).not.toHaveAttribute('aria-checked', before!);

  await page.getByRole('button', { name: /Weiter zu Messen/ }).click();
  await expect(page.getByRole('radio', { name: 'Messen' })).toHaveAttribute('aria-checked', 'true');
});

test('Strecke neu setzen und Hinweise', async ({ page }) => {
  await openPhase(page);
  await expect(page.getByText('Anfang der bekannten Strecke antippen')).toBeVisible();
  await tapScale(page, 200);
  await expect(page.getByText('Endpunkte ziehen zum Korrigieren')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toHaveCount(0); // Länge leer
  await page.getByRole('button', { name: 'Strecke neu setzen' }).click();
  await expect(page.getByText('Anfang der bekannten Strecke antippen')).toBeVisible();
});

test('Erster Punkt bleibt über Phasenwechsel erhalten: Ende antippen', async ({ page }) => {
  await openPhase(page);
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.3, y: box.height / 2 } });
  await expect(page.getByText('Ende antippen')).toBeVisible();
  await page.getByRole('radio', { name: 'Messen' }).click();
  await page.getByRole('radio', { name: 'Maßstab' }).click();
  await expect(page.getByText('Ende antippen')).toBeVisible();
  await canvas.click({ position: { x: box.width * 0.6, y: box.height / 2 } });
  await expect(page.getByText('Endpunkte ziehen zum Korrigieren')).toBeVisible();
});

test('Koordinatensystem: Ursprung ziehen, Achse drehen, ausrichten, zurücksetzen', async ({ page }) => {
  await setScale(page);
  const canvas = page.getByTestId('viewer-canvas');
  const ready = () => expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  // Video 320 x 240 px, zentriert und einpassend im Viewer; Video-Pixel -> Bildschirm
  const toScreen = async (vx: number, vy: number) => {
    const box = (await canvas.boundingBox())!;
    const fit = Math.min(box.width / 320, box.height / 240);
    return {
      x: box.x + box.width / 2 + (vx - 160) * fit,
      y: box.y + box.height / 2 + (vy - 120) * fit,
      fit,
    };
  };
  // eine Position setzen, damit der Ursprung (Position 0) abseits des Maßstabs liegt
  await page.getByRole('radio', { name: 'Messen' }).click();
  await ready();
  const click = await toScreen(80, 200);
  await canvas.click({ position: { x: click.x - 12, y: click.y - 78 } });
  await page.getByRole('radio', { name: 'Maßstab' }).click();
  await ready();

  const sw = page.getByRole('switch', { name: 'Ursprung bei Position 0' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  };
  const o = await toScreen(80, 200);
  const o2 = await toScreen(100, 180);
  await drag(o, o2);
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  const len = 0.12 * 320 * o2.fit;
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 0°');
  await drag({ x: o2.x + len, y: o2.y }, { x: o2.x + 3, y: o2.y - len });
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 90°');

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 0°');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('An Maßstab ausrichten übernimmt die Richtung eines schrägen Maßstabs', async ({ page }) => {
  await openPhase(page, 'Maßstab');
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.width / 2, cy = box.height / 2;
  await canvas.click({ position: { x: cx - 100, y: cy + 50 } });
  await canvas.click({ position: { x: cx + 100, y: cy - 50 } });
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 0°');
  await page.getByRole('button', { name: 'An Maßstab ausrichten' }).click();
  const txt = (await page.getByTestId('axes-angle').textContent())!;
  const deg = Number(txt.replace('Drehung:', '').replace('°', '').replace('−', '-').replace(',', '.').trim());
  expect(deg).not.toBe(0);
  const expected = (Math.atan2(100, 200) * 180) / Math.PI; // Maßstab zeigt nach oben rechts
  expect(Math.abs(deg - expected)).toBeLessThanOrEqual(1);
});

test('Achsenschaft ziehen verschiebt den Ursprung, Maßstab bleibt', async ({ page }) => {
  await setScale(page);
  const info = await page.getByTestId('scale-info').textContent();
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  const fit = Math.min(box.width / 320, box.height / 240);
  const sw = page.getByRole('switch', { name: 'Ursprung bei Position 0' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  // Ursprung = Maßstabs-Anfang; Schaftmitte der x-Achse liegt 0,06 * 320 px daneben
  const from = { x: box.x + box.width / 2 - 150 + 0.06 * 320 * fit, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 80, { steps: 10 });
  await page.mouse.up();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('scale-info')).toHaveText(info!);
});
