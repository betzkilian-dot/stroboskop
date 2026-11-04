import { test, expect, type Page } from '@playwright/test';
import { chooseMode } from './helpers';

const FPS_TEXT = /Bildrate nicht eindeutig/;
async function open(page: Page) {
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
