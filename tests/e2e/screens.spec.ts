import { test, expect, type Page } from '@playwright/test';

const FORMATS = { quer: { width: 1180, height: 820 }, hoch: { width: 820, height: 1180 } } as const;

/** Liefert Verstöße: Times-Schrift und Kontrast < 3:1 (WCAG-Luminanz) für Elemente mit eigenem Text. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const cm = c.match(/color\(srgb ([^)]+)\)/);
      if (cm) {
        const p = cm[1].split(/[ /]+/).filter(Boolean).map(Number);
        return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
      }
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bad: string[] = [];
    let checked = 0;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (/times/i.test(cs.fontFamily)) bad.push(`Times: ${el.tagName}.${el.className}`);
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!own) continue;
      if ((el as HTMLButtonElement).disabled || el.closest('[disabled],[aria-disabled=true]')) continue;
      if (el.closest('.play-overlay, [data-testid=filmstrip], canvas, video')) continue;
      let bg: { r: number; g: number; b: number } | null = null;
      let overImage = false;
      for (let a: HTMLElement | null = el; a; a = a.parentElement) {
        if (a.matches('canvas,video,img')) { overImage = true; break; }
        const c = parse(getComputedStyle(a).backgroundColor);
        if (c && c.a > 0.99) { bg = c; break; }
      }
      if (overImage) continue;
      const name = `${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (!bg) { bad.push(`bg nicht ermittelbar: ${name}`); continue; }
      const fg = parse(cs.color);
      if (!fg) { bad.push(`Textfarbe nicht lesbar (${cs.color}): ${name}`); continue; }
      // Halbtransparente Tönungen (Chips, Hinweise) werden gegen die Fläche des Elternelements angenähert.
      checked++;
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 3) bad.push(`Kontrast ${ratio.toFixed(2)}: ${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return { bad, checked };
  });
}

for (const mode of ['light', 'dark'] as const) {
  for (const [fmt, size] of Object.entries(FORMATS)) {
    test(`Sichtprüfung ${mode} ${fmt}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize(size);
      const shot = async (name: string) => {
        await page.screenshot({ path: `test-results/screens/${mode}-${fmt}-${name}.png` });
        const { bad, checked } = await audit(page);
        expect(bad, name).toEqual([]);
        expect(checked, `${name}: zu wenige geprüfte Elemente`).toBeGreaterThanOrEqual(5);
      };

      await page.goto('/');
      await expect(page.getByTestId('pick-file')).toBeVisible();
      await shot('start');

      await page.locator('input[type=file]:not([capture])').setInputFiles('tests/fixtures/ball-60.mp4');
      await expect(page.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('open-export')).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('video');

      await page.getByRole('radio', { name: 'Bild' }).click();
      await page.getByTestId('more').locator('summary').click();
      await expect(page.getByTestId('film-item').first()).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('bild');

      await expect(page.getByTestId('open-export')).toBeEnabled({ timeout: 30000 });
      await page.getByTestId('open-export').click();
      await expect(page.getByRole('button', { name: 'Bild erzeugen', exact: true })).toBeVisible();
      await shot('export');
    });
  }
}
