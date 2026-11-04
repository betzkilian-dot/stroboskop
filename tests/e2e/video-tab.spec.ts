import { test, expect, type Page } from '@playwright/test';

async function openVideo(page: Page, fixture: string) {
  await page.goto('/');
  await page.setInputFiles('input[type=file]:not([capture])', `tests/fixtures/${fixture}`);
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
}
const num = (s: string) => parseFloat(s.replace(',', '.'));
async function trackClick(page: Page, f: number) {
  const box = (await page.getByTestId('timeline-track').boundingBox())!;
  await page.mouse.click(box.x + box.width * f, box.y + box.height / 2);
}
async function positions(page: Page) {
  return Number((await page.getByTestId('positions').textContent())!.match(/\d+/)![0]);
}
const rangeStart = async (page: Page) =>
  num((await page.getByTestId('range-text').textContent())!.match(/Auswahl (\d+,\d+)/)![1]);

test('Phase Video: Player, Anfang/Ende per Zeitleiste, Einzelbild, Bildrate', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  // (a) Phase Video aktiv, Player sichtbar
  await expect(page.getByTestId('player')).toBeVisible();
  await expect(page.locator('[data-testid=player] video')).toBeVisible();
  // (e) Bildrate-Chip
  await expect(page.getByTestId('fps-chip')).toContainText('60 Bilder/s');
  await expect(page.getByTestId('range-text')).toHaveText(/^Auswahl 0,00 – /);

  const dur = num((await page.getByTestId('duration-text').textContent())!);
  expect(dur).toBeGreaterThan(0.5);
  const before = await positions(page);

  // (b) Wiedergabekopf auf 50 %, Anfang hier
  await trackClick(page, 0.5);
  await expect.poll(async () => num((await page.getByTestId('player').getAttribute('data-time'))!)).toBeCloseTo(dur / 2, 1);
  await page.getByTestId('set-start').click();
  await expect.poll(() => rangeStart(page)).toBeGreaterThan(0);
  expect(Math.abs((await rangeStart(page)) - dur / 2)).toBeLessThanOrEqual(1 / 60 + 0.006);
  expect(await positions(page)).toBeLessThan(before);

  // (c) Ende vor dem Anfang -> Anfang springt auf 0
  await trackClick(page, 0.25);
  await page.getByTestId('set-end').click();
  await expect(page.getByTestId('range-text')).toHaveText(/^Auswahl 0,00 – /);

  // (d) Bild vor zweimal -> +2 Bilder (ausgehend vom angezeigten Bild = letzter Zeitstempel <= Zeit)
  const t0 = num((await page.getByTestId('player').getAttribute('data-time'))!);
  const f0 = Math.floor(t0 * 60 + 1e-3);
  await page.getByRole('button', { name: 'Bild vor' }).click();
  await page.getByRole('button', { name: 'Bild vor' }).click();
  await expect
    .poll(async () => num((await page.getByTestId('player').getAttribute('data-time'))!))
    .toBeCloseTo((f0 + 2) / 60, 3);
  await page.getByRole('button', { name: 'Bild zurück' }).click();
  await expect
    .poll(async () => num((await page.getByTestId('player').getAttribute('data-time'))!))
    .toBeCloseTo((f0 + 1) / 60, 3);
});

test('Abspielen/Pause und Tempo', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  const player = page.getByTestId('player');
  await expect(page.getByTestId('play-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Tempo 1×' }).click();
  await expect(page.getByRole('button', { name: 'Tempo ½×' })).toBeVisible();
  await page.getByRole('button', { name: 'Tempo ½×' }).click();
  await page.getByRole('button', { name: 'Tempo ¼×' }).click();
  await expect(page.getByRole('button', { name: 'Tempo 1×' })).toBeVisible();
  await player.click();
  await expect(page.getByTestId('play-overlay')).toBeHidden();
  await expect.poll(async () => num((await player.getAttribute('data-time'))!)).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('play-overlay')).toBeVisible();
});

test('Markierung ziehen setzt den Anfang', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  const box = (await page.getByTestId('timeline-track').boundingBox())!;
  const m = (await page.getByTestId('mark-start').boundingBox())!;
  await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const dur = num((await page.getByTestId('duration-text').textContent())!);
  expect(Math.abs((await rangeStart(page)) - dur * 0.4)).toBeLessThanOrEqual(0.05);
});

test('Aufnahme-fps korrigieren, Δt, Dezimalkomma, zu wenige Positionen', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  await expect(page.getByLabel('Aufnahme-fps')).toHaveCount(0);
  await page.getByTestId('fps-chip').click();
  const fps = page.getByLabel('Aufnahme-fps');
  await fps.fill('120');
  await fps.press('Enter');
  await expect(page.getByText('Δt = 0,0500 s')).toBeVisible();
  await expect(page.getByTestId('fps-chip')).toContainText('120 Bilder/s');
  await fps.fill('59,94');
  await fps.press('Enter');
  await expect(page.getByTestId('fps-chip')).toContainText('59,94 Bilder/s');
  await fps.fill('50');
  await fps.press('Enter');
  await expect(page.getByText('Δt = 0,120 s')).toBeVisible();
  await fps.fill('abc');
  await fps.press('Enter');
  await expect(page.getByTestId('fps-chip')).toContainText('50 Bilder/s');
  // Ende ganz an den Anfang -> Fehler
  await page.getByTestId('set-end').click();
  await expect(page.getByRole('alert').filter({ hasText: 'mindestens 2 Positionen' })).toBeVisible();
});

test('unsichere Bildrate: Chip „Bildrate prüfen“ öffnet die Korrektur, kein Hinweis in der Kopfleiste', async ({
  page,
}) => {
  await openVideo(page, 'ball-vfr.mp4');
  const chip = page.getByRole('button', { name: /Bildrate prüfen/ });
  await expect(chip).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Bildrate nicht eindeutig' })).toHaveCount(0);
  await chip.click();
  await expect(page.getByLabel('Aufnahme-fps')).toBeVisible();
  await page.getByRole('radio', { name: 'Bild' }).click();
  await expect(page.getByText('Bildrate nicht eindeutig')).toHaveCount(0);
});

test('240 fps erkannt', async ({ page }) => {
  await openVideo(page, 'ball-240.mp4');
  await expect(page.getByTestId('fps-chip')).toContainText('240 Bilder/s');
});

test('Drehen und Zuschneiden in der Phase Video', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  const video = page.locator('[data-testid=player] video');
  await expect(video).toBeVisible();
  const b0 = (await video.boundingBox())!;
  await page.getByRole('button', { name: 'Drehen' }).click();
  // 90°: das sichtbare Rechteck wird hochkant
  await expect.poll(async () => {
    const b = (await video.boundingBox())!;
    return b.height > b.width;
  }).toBe(true);
  expect(b0.width).toBeGreaterThan(b0.height);

  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeDisabled();
  await page.getByRole('button', { name: 'Zuschneiden' }).click();
  const canvas = page.getByTestId('viewer-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('player')).toHaveCount(0);
  // Startrahmen = ganzes Bild, sichtbar mit Griffen
  const frame = page.getByTestId('crop-frame');
  await expect(frame).toBeVisible();
  const full = (await frame.boundingBox())!;
  const handle = page.getByTestId('crop-handle-se');
  const hb = (await handle.boundingBox())!;
  expect(hb.width).toBeGreaterThanOrEqual(44);
  expect(hb.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 80, hb.y + hb.height / 2 - 60, { steps: 5 });
  await page.mouse.up();
  // Rahmen bleibt nach dem Loslassen sichtbar und ist kleiner
  const small = (await frame.boundingBox())!;
  expect(small.width * small.height).toBeLessThan(full.width * full.height);
  await expect(page.getByTestId('player')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(page.getByTestId('player')).toBeVisible();
  await expect(page.getByTestId('crop-shown')).toBeVisible();
  const vb = (await video.boundingBox())!;
  const shown = (await page.getByTestId('crop-shown').boundingBox())!;
  expect(shown.width * shown.height).toBeLessThan(vb.width * vb.height);
  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeEnabled();

  // erneut oeffnen: Startrahmen = bisheriger Zuschnitt; Zuruecksetzen + Fertig -> kein Zuschnitt
  await page.getByRole('button', { name: 'Zuschneiden' }).click();
  await expect(frame).toBeVisible();
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(page.getByTestId('crop-shown')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeDisabled();

  // Abbrechen kehrt ohne Zuschnitt zurück
  await page.getByRole('button', { name: 'Zuschneiden' }).click();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('player')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zuschnitt zurücksetzen' })).toBeDisabled();
});

test('Weiter zu Bild wechselt die Phase; neues Video springt zurück auf Video', async ({ page }) => {
  await openVideo(page, 'ball-60.mp4');
  await page.getByRole('button', { name: /Weiter zu Bild/ }).click();
  await expect(page.getByRole('radio', { name: 'Bild' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('step-slider')).toBeVisible();
  await page.setInputFiles('input[type=file]:not([capture])', 'tests/fixtures/ball-240.mp4');
  await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('fps-chip')).toContainText('240 Bilder/s');
});

test('übereinanderliegende Markierungen: erste Bewegung entscheidet (links = Anfang, rechts = Ende)', async ({
  page,
}) => {
  await openVideo(page, 'ball-60.mp4');
  const dur = num((await page.getByTestId('duration-text').textContent())!);
  const box = (await page.getByTestId('timeline-track').boundingBox())!;
  const y = box.y + box.height / 2;
  const center = async (id: string) => {
    const m = (await page.getByTestId(id).boundingBox())!;
    return m.x + m.width / 2;
  };
  const dragFromTo = async (x0: number, x1: number) => {
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x1, y, { steps: 8 });
    await page.mouse.up();
  };
  const range = async () => {
    const m = (await page.getByTestId('range-text').textContent())!.match(/Auswahl (\d+,\d+) – (\d+,\d+)/)!;
    return { start: num(m[1]), end: num(m[2]) };
  };
  // Anfang auf 40 %, Ende direkt daneben (wird auf Anfang + 1 Bild begrenzt)
  await dragFromTo(await center('mark-start'), box.x + box.width * 0.4);
  await dragFromTo(await center('mark-end'), box.x + box.width * 0.4);
  const r0 = await range();
  expect(r0.end - r0.start).toBeLessThan(0.05);
  // beide Greifflächen liegen übereinander: nach links ziehen bewegt den Anfang
  const mid = ((await center('mark-start')) + (await center('mark-end'))) / 2;
  await dragFromTo(mid, box.x + box.width * 0.2);
  const r1 = await range();
  expect(Math.abs(r1.start - dur * 0.2)).toBeLessThanOrEqual(0.05);
  expect(r1.end).toBeCloseTo(r0.end, 2);

  // wieder zusammenschieben, dann nach rechts ziehen bewegt das Ende
  await dragFromTo(await center('mark-start'), box.x + box.width * 0.45);
  const r2 = await range();
  expect(r2.end - r2.start).toBeLessThan(0.05);
  const mid2 = ((await center('mark-start')) + (await center('mark-end'))) / 2;
  await dragFromTo(mid2, box.x + box.width * 0.7);
  const r3 = await range();
  expect(r3.start).toBeCloseTo(r2.start, 2);
  expect(Math.abs(r3.end - dur * 0.7)).toBeLessThanOrEqual(0.05);
});
