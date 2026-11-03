import { test, expect } from '@playwright/test';

async function openBild(page: import('@playwright/test').Page, fixture = 'ball-60.mp4') {
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', `tests/fixtures/${fixture}`);
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Bild' }).click();
}
const alert = (page: import('@playwright/test').Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });

test('Abstand, Wunsch-Δt, Modus, Schwelle, Positionen', async ({ page }) => {
  await openBild(page);
  const abstand = page.getByLabel('Abstand', { exact: true });
  await abstand.fill('15');
  await expect(page.getByText('Δt = 0,250 s')).toBeVisible();
  await expect(page.getByLabel('Abstand-Regler')).toHaveValue('15');
  await page.getByLabel('Wunsch-Δt').fill('0,133');
  await page.getByLabel('Wunsch-Δt').press('Enter');
  await expect(abstand).toHaveValue('8');
  for (const m of ['Differenz', 'Aufhellen', 'Abdunkeln', 'Transparent'])
    await page.getByRole('radio', { name: m }).check();
  await page.getByRole('radio', { name: 'Differenz' }).check();

  await page.getByLabel('Schwelle').fill('40');
  await expect(page.getByTestId('mask-overlay')).toBeVisible(); // während Ziehen
  await expect(page.getByTestId('mask-overlay')).toBeHidden({ timeout: 4000 }); // 1,5 s danach weg
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.getByLabel('Schwelle')).not.toHaveValue('40');

  await abstand.fill('6');
  await expect(page.getByTestId('film-item').nth(2)).toBeVisible();
  await page.getByTestId('film-item').nth(2).click();
  await expect(alert(page, 'Δt nicht mehr gleichmäßig')).toBeVisible();
  await page.getByTestId('film-item').nth(2).click(); // wieder einschalten
  await expect(alert(page, 'Δt nicht mehr gleichmäßig')).toHaveCount(0);

  // zu wenige Positionen
  await abstand.fill('500');
  await expect(alert(page, 'mindestens 2 Positionen')).toBeVisible();
});

test('Hintergrund Bild wählen, Weiche Kante, Verlauf, Spätere oben', async ({ page }) => {
  await openBild(page);
  await page.getByRole('button', { name: 'Bild wählen…' }).click();
  await page.getByTestId('film-item').nth(3).click();
  await expect(page.getByLabel('Hintergrund')).toHaveValue('frame');
  await expect(page.getByTestId('film-item').nth(3)).toHaveAttribute('aria-current', 'true');
  // erneut wählen und abbrechen
  await page.getByRole('button', { name: 'Bild wählen…' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Bild wählen…' }).click();
  await page.getByTestId('film-item').nth(5).click();
  await expect(page.getByTestId('film-item').nth(5)).toHaveAttribute('aria-current', 'true');
  await page.getByLabel('Weiche Kante').fill('4');
  await expect(page.getByText('4 px')).toBeVisible();
  await page.getByLabel('Verlauf').fill('30');
  await expect(page.getByText('30 %').first()).toBeVisible();
  await page.getByLabel('Spätere oben').uncheck();
  await expect(page.getByLabel('Spätere oben')).not.toBeChecked();
});

test('Bereich zeichnen und löschen, Drehen, Zuschneiden', async ({ page }) => {
  await openBild(page);
  const canvas = page.getByTestId('viewer-canvas');
  await expect(canvas).toBeVisible();
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

  await page.getByRole('button', { name: 'Drehen' }).click();
  await page.getByRole('button', { name: 'Zuschneiden' }).click();
  const a = at(0.3, 0.3);
  const b = at(0.7, 0.7);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zuschnitt zurücksetzen' }).click();
  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeDisabled();
});

test('Maske bleibt nicht haengen: Transparent, Schwelle ziehen, zurueck zu Differenz', async ({ page }) => {
  await openBild(page);
  await page.getByRole('radio', { name: 'Transparent' }).check();
  await page.getByLabel('Schwelle').fill('40');
  await page.getByRole('radio', { name: 'Differenz' }).check();
  await expect(page.getByTestId('mask-overlay')).toBeHidden({ timeout: 6000 });
});
