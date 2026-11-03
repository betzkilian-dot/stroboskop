import { test, expect } from '@playwright/test';

for (const scheme of ['light', 'dark'] as const) {
  test(`Grundlayout ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === 'light' ? 'rgb(242, 242, 247)' : 'rgb(0, 0, 0)');
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).not.toMatch(/Times|(?<!sans-)serif$/i);
    expect(font).toMatch(/system-ui|-apple-system|Segoe UI/);
  });
}
