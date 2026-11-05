import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { chooseMode } from './helpers';

test('Startseite zeigt die Versionsnummer aus package.json', async ({ page }) => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
  await page.goto('/');
  await expect(page.getByTestId('app-version')).toHaveText(`Version ${version}`);
});

test('Startseite: Einfach und Erweitert, Erweitert und zurück, Verwerfen-Rückfrage', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mode-einfach')).toContainText('Einfach');
  await expect(page.getByTestId('mode-erweitert')).toContainText('Erweitert');
  await expect(page.getByTestId('pick-file')).toHaveCount(0);
  await chooseMode(page, 'erweitert');
  await expect(page.getByTestId('pick-file')).toBeVisible();
  await page.getByRole('button', { name: '‹ Start' }).click();
  await expect(page.getByTestId('mode-einfach')).toBeVisible();
  await chooseMode(page, 'erweitert');
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('home').click();
  await expect(page.getByRole('dialog', { name: 'Projekt verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Video' })).toBeVisible();
  await page.getByTestId('home').click();
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByTestId('mode-einfach')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('mode-einfach')).toBeVisible();
  await expect(page.getByTestId('pick-file')).toHaveCount(0);
});

test('Startseite Erweitert: eine Kachel Video', async ({ page }) => {
  await page.goto('/');
  await chooseMode(page, 'erweitert');
  await expect(page.getByTestId('pick-file')).toContainText('Video');
  await expect(page.getByTestId('pick-camera')).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(1);
  await expect(page.locator('input[type=file]')).toHaveAttribute('accept', 'video/*');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pick-file').click();
  await chooser;
});

test('Startseite: Video laden, Profimodus, Fehlerfall', async ({ page }) => {
  await page.goto('/');
  await chooseMode(page, 'erweitert');
  await expect(page.getByRole('heading', { name: 'Stroboskop' })).toBeVisible();
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-60.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await expect(page.getByText('Δt = 0,100 s')).toBeVisible();
  // Fehlerfall
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/not-a-video.mp4');
  await expect(page.getByRole('alert').filter({ hasText: 'MP4 oder MOV' })).toBeVisible();
});
