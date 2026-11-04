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
  await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.75 } });
  await expect(page.getByText('Ende antippen')).toBeVisible();
  await page.getByRole('radio', { name: 'Messen' }).click();
  await page.getByRole('radio', { name: 'Maßstab' }).click();
  await expect(page.getByText('Ende antippen')).toBeVisible();
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.75 } });
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
  const stageEl = page.getByTestId('stage');
  await ready();
  // Standard-Ursprung = Bildmitte
  await expect(stageEl).toHaveAttribute('data-origin', '160.0,120.0');
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  };
  const o = await toScreen(160, 120);
  const o2 = await toScreen(180, 100);
  await drag(o, o2);
  await expect(stageEl).toHaveAttribute('data-origin', /^1[78]\d\.\d,(9\d|10\d)\.\d$/);

  const len = 0.12 * 320 * o2.fit;
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 0°');
  await drag({ x: o2.x + len, y: o2.y }, { x: o2.x + 3, y: o2.y - len });
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 90°');

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 0°');
  await expect(stageEl).toHaveAttribute('data-origin', '160.0,120.0');
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
  const stageEl = page.getByTestId('stage');
  await expect(stageEl).toHaveAttribute('data-origin', '160.0,120.0');
  // Ursprung = Bildmitte; Schaftmitte der x-Achse liegt 0,06 * 320 px daneben
  const from = { x: box.x + box.width / 2 + 0.06 * 320 * fit, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 80, { steps: 10 });
  await page.mouse.up();
  await expect(stageEl).not.toHaveAttribute('data-origin', '160.0,120.0');
  await expect(page.getByTestId('scale-info')).toHaveText(info!);
});

test('Ursprung liegt in Maßstab und Messen an derselben Stelle (Bildmitte)', async ({ page }) => {
  await setScale(page);
  const stageEl = page.getByTestId('stage');
  await expect(stageEl).toHaveAttribute('data-origin', '160.0,120.0');
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(stageEl).toHaveAttribute('data-ready', 'true');
  await expect(stageEl).toHaveAttribute('data-origin', '160.0,120.0');
});

test('Achsen nur x / nur y und Auf Position 0 setzen', async ({ page }) => {
  await setScale(page);
  const stageEl = page.getByTestId('stage');
  await expect(stageEl).toHaveAttribute('data-axes', 'x,y');
  await page.getByRole('radio', { name: 'nur x' }).click();
  await expect(stageEl).toHaveAttribute('data-axes', 'x');
  await page.getByRole('radio', { name: 'nur y' }).click();
  await expect(stageEl).toHaveAttribute('data-axes', 'y');
  await page.getByRole('radio', { name: 'x und y' }).click();
  await expect(page.getByRole('button', { name: 'Auf Position 0 setzen' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Messen' }).click();
  await expect(stageEl).toHaveAttribute('data-ready', 'true');
  const canvas = page.getByTestId('viewer-canvas');
  await canvas.click({ position: { x: 40, y: 50 } });
  await page.getByRole('radio', { name: 'Maßstab' }).click();
  await page.getByRole('button', { name: 'Auf Position 0 setzen' }).click();
  await expect(stageEl).not.toHaveAttribute('data-origin', '160.0,120.0');
});

test('Koordinatensystem ohne Maßstab: Ursprung ziehen, Spitze drehen; Tipp daneben setzt die Strecke', async ({ page }) => {
  await openPhase(page);
  const stageEl = page.getByTestId('stage');
  await expect(stageEl).toHaveAttribute('data-ready', 'true');
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  const fit = Math.min(box.width / 320, box.height / 240);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };
  await drag({ x: cx, y: cy }, { x: cx, y: cy - 60 });
  await expect(stageEl).not.toHaveAttribute('data-origin', '160.0,120.0');
  const len = 0.12 * 320 * fit;
  await drag({ x: cx + len, y: cy - 60 }, { x: cx, y: cy - 60 - len });
  await expect(page.getByTestId('axes-angle')).toHaveText('Drehung: 90°');
  // Tipp abseits der Achsen setzt den ersten Strecken-Punkt
  await canvas.click({ position: { x: box.width * 0.2, y: box.height * 0.8 } });
  await expect(page.getByText('Ende antippen')).toBeVisible();
  // mit nur einem Strecken-Punkt lässt sich das Koordinatensystem weiter ziehen
  const before = await stageEl.getAttribute('data-origin');
  await drag({ x: cx, y: cy - 60 }, { x: cx + 30, y: cy - 60 });
  await expect(stageEl).not.toHaveAttribute('data-origin', before!);
  await expect(page.getByText('Ende antippen')).toBeVisible();
});
