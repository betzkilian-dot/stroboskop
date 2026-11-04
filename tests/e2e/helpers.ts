import { expect, type Page } from '@playwright/test';

/** Startseite: Modus wählen. */
export async function chooseMode(page: Page, m: 'einfach' | 'erweitert') {
  await page.getByTestId(`mode-${m}`).click();
}

/** Video laden und in die Phase wechseln (Standard: Maßstab); wartet auf die Vorschau. */
export async function openPhase(page: Page, phase = 'Maßstab', fixture = 'ball-60.mp4') {
  await page.goto('/');
  await chooseMode(page, 'erweitert');
  await page.setInputFiles('input[type=file]:not([capture])', `tests/fixtures/${fixture}`);
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: phase }).click();
}

/** Zwei Klicks mit `distance` CSS-px Abstand auf dem Viewer-Canvas (waagerecht, mittig). */
export async function tapScale(page: Page, distance = 300) {
  await expect(page.getByTestId('stage')).toHaveAttribute('data-ready', 'true');
  const box = (await page.getByTestId('viewer-canvas').boundingBox())!;
  const y = box.height * 0.75; // unterhalb von Ursprung/Achsen (Bildmitte)
  const x0 = box.width / 2 - distance / 2;
  const canvas = page.getByTestId('viewer-canvas');
  await canvas.click({ position: { x: x0, y } });
  await canvas.click({ position: { x: x0 + distance, y } });
}

/** Maßstab setzen: Video öffnen, Phase Maßstab, 300 px = 1 m. */
export async function setScale(page: Page, fixture = 'ball-60.mp4') {
  await openPhase(page, 'Maßstab', fixture);
  await tapScale(page, 300);
  await page.getByTestId('scale-length').fill('1,00');
  await page.getByRole('radio', { name: 'm', exact: true }).click();
  await expect(page.getByTestId('scale-info')).toContainText('1 Pixel =');
}
