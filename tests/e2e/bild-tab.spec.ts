import { test, expect } from '@playwright/test';

async function openBild(page: import('@playwright/test').Page, fixture = 'ball-60.mp4') {
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', `tests/fixtures/${fixture}`);
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Bild' }).click();
}
const alert = (page: import('@playwright/test').Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });

test('Zeitabstand, Darstellung, Empfindlichkeit, Positionen', async ({ page }) => {
  await openBild(page);
  const slider = page.getByTestId('step-slider');
  await slider.fill('15');
  await expect(page.getByTestId('dt-value')).toHaveText('Δt = 0,250 s');
  await page.getByTestId('dt-value').click();
  await page.getByTestId('dt-input').fill('0,133');
  await page.getByTestId('dt-input').press('Enter');
  await expect(slider).toHaveValue('8');
  for (const m of ['Differenz', 'Aufhellen', 'Abdunkeln', 'Transparent'])
    await page.getByRole('radio', { name: m }).click();
  await page.getByRole('radio', { name: 'Differenz' }).click();

  await page.getByLabel('Empfindlichkeit').fill('40');
  await expect(page.getByTestId('mask-overlay')).toBeVisible(); // während Ziehen
  await expect(page.getByTestId('mask-overlay')).toBeHidden({ timeout: 4000 }); // 1,5 s danach weg
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.getByLabel('Empfindlichkeit')).not.toHaveValue('40');

  await slider.fill('6');
  await expect(page.getByTestId('film-item').nth(2)).toBeVisible();
  await page.getByTestId('film-item').nth(2).click();
  await expect(alert(page, 'Δt nicht mehr gleichmäßig')).toBeVisible();
  await page.getByTestId('film-item').nth(2).click(); // wieder einschalten
  await expect(alert(page, 'Δt nicht mehr gleichmäßig')).toHaveCount(0);

  // zu wenige Positionen
  await page.getByTestId('dt-value').click();
  await page.getByTestId('dt-input').fill('100');
  await page.getByTestId('dt-input').press('Enter');
  await expect(alert(page, 'mindestens 2 Positionen')).toBeVisible();
});

test('Δt-Eingabe: 0,2 ergibt 0,200 s; ungültig bleibt unverändert', async ({ page }) => {
  await openBild(page);
  await page.getByTestId('dt-value').click();
  await page.getByTestId('dt-input').fill('0,2');
  await page.getByTestId('dt-input').press('Enter');
  await expect(page.getByTestId('dt-value')).toHaveText('Δt = 0,200 s');
  await expect(page.getByTestId('step-slider')).toHaveValue('12');
  await page.getByTestId('dt-value').click();
  await page.getByTestId('dt-input').fill('abc');
  await page.getByTestId('dt-input').press('Enter');
  await expect(page.getByTestId('dt-value')).toHaveText('Δt = 0,200 s');
});

test('Empfindlichkeit nur in Differenz/Aufhellen/Abdunkeln', async ({ page }) => {
  await openBild(page);
  for (const m of ['Differenz', 'Aufhellen', 'Abdunkeln'] as const) {
    await page.getByRole('radio', { name: m }).click();
    await expect(page.getByTestId('sensitivity')).toBeVisible();
  }
  await page.getByRole('radio', { name: 'Transparent' }).click();
  await expect(page.getByTestId('sensitivity')).toHaveCount(0);
});

test('Aufhellen: Empfindlichkeit ändert das Vorschaubild', async ({ page }) => {
  await openBild(page);
  await page.getByRole('radio', { name: 'Aufhellen' }).click();
  const canvas = page.getByTestId('viewer-canvas');
  await expect(canvas).toBeVisible();
  const hash = () =>
    canvas.evaluate((c) => {
      const cv = c as HTMLCanvasElement;
      const d = cv.getContext('2d')?.getImageData(0, 0, cv.width, cv.height).data ?? new Uint8ClampedArray();
      let h = 0;
      for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0;
      return h;
    });
  await expect(page.getByTestId('busy')).toBeHidden({ timeout: 15000 });
  const before = await hash();
  await page.getByLabel('Empfindlichkeit').fill('2');
  await expect.poll(hash, { timeout: 15000 }).not.toBe(before);
});

test('Mehr ist anfangs zu; keine nativen Radios/Checkboxen/Selects', async ({ page }) => {
  await openBild(page);
  await expect(page.getByTestId('more')).not.toHaveAttribute('open', '');
  const native = page.locator('input[type=radio]:visible, input[type=checkbox]:visible, select:visible');
  await expect(native).toHaveCount(0);
  await page.getByTestId('more').locator('summary').click();
  await expect(native).toHaveCount(0);
});

test('Hintergrund Bild wählen, Weiche Kante, Verlauf, Spätere oben', async ({ page }) => {
  await openBild(page);
  await page.getByTestId('more').locator('summary').click();
  const bgr = page.getByRole('radiogroup', { name: 'Hintergrund' });
  await bgr.getByRole('radio', { name: 'Gewählt' }).click();
  await expect(page.getByText('Bild in der Leiste antippen')).toBeVisible();
  await page.getByTestId('film-item').nth(3).click();
  await expect(bgr.getByRole('radio', { name: 'Gewählt' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('film-item').nth(3)).toHaveAttribute('aria-current', 'true');
  // erneut wählen und abbrechen
  await bgr.getByRole('radio', { name: 'Letztes' }).click();
  await bgr.getByRole('radio', { name: 'Gewählt' }).click();
  await page.keyboard.press('Escape');
  await bgr.getByRole('radio', { name: 'Gewählt' }).click();
  await page.getByTestId('film-item').nth(5).click();
  await expect(page.getByTestId('film-item').nth(5)).toHaveAttribute('aria-current', 'true');
  await page.getByLabel('Weiche Kante').fill('4');
  await expect(page.getByText('4 px')).toBeVisible();
  await page.getByLabel('Verlauf').fill('30');
  await expect(page.getByText('30 %').first()).toBeVisible();
  const later = page.getByRole('switch', { name: 'Spätere oben' });
  await expect(later).toHaveAttribute('aria-checked', 'true');
  await later.click();
  await expect(later).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('radio', { name: 'Aufhellen' }).click();
  await expect(page.getByRole('switch', { name: 'Spätere oben' })).toHaveCount(0);
});

test('Bereich zeichnen und löschen', async ({ page }) => {
  await openBild(page);
  const canvas = page.getByTestId('viewer-canvas');
  await expect(canvas).toBeVisible();
  await page.getByTestId('more').locator('summary').click();
  await page.getByRole('button', { name: 'Bereich zeichnen' }).click();
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.7]]) {
    const p = at(fx, fy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(400);
  }
  const last = at(0.5, 0.7);
  await page.mouse.dblclick(last.x, last.y);
  await expect(page.getByRole('button', { name: 'Bereich zeichnen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bereich löschen' })).toBeEnabled();
  await page.getByRole('button', { name: 'Bereich löschen' }).click();
  await expect(page.getByRole('button', { name: 'Bereich löschen' })).toBeDisabled();

  // Drehen/Zuschneiden liegen jetzt in der Phase Video (video-tab.spec)
  await expect(page.getByRole('button', { name: 'Drehen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zuschneiden' })).toHaveCount(0);
});

test('Maske bleibt nicht haengen: Aufhellen, Empfindlichkeit ziehen, Wechsel zu Transparent', async ({ page }) => {
  await openBild(page);
  await page.getByRole('radio', { name: 'Aufhellen' }).click();
  await page.getByLabel('Empfindlichkeit').fill('40');
  await page.getByRole('radio', { name: 'Transparent' }).click();
  await expect(page.getByTestId('mask-overlay')).toBeHidden({ timeout: 6000 });
});
