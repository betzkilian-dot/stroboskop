import { describe, expect, it } from 'vitest';
import { jpegPagesToPdf, jpegSize } from '../../src/lib/export/pdf';

// Synthetic JPEG-like bytes: SOI, SOF0 (h=3, w=5), filler, EOI.
function fakeJpeg(w: number, h: number, extra = 20): Uint8Array {
  const body = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00];
  for (let i = 0; i < extra; i++) body.push((i * 37 + 200) & 255);
  body.push(0xff, 0xd9);
  return new Uint8Array(body);
}
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

describe('jpegPagesToPdf', () => {
  const j1 = fakeJpeg(5, 3);
  const j2 = fakeJpeg(7, 9, 50);
  const pdf = jpegPagesToPdf([
    { jpeg: j1, widthPx: 5, heightPx: 3 },
    { jpeg: j2, widthPx: 7, heightPx: 9 },
  ]);
  const s = latin1(pdf);

  it('Kopf und Ende', () => {
    expect(s.startsWith('%PDF-1.4\n')).toBe(true);
    expect(s.endsWith('%%EOF\n') || s.endsWith('%%EOF')).toBe(true);
  });
  it('Count = Seitenzahl', () => {
    expect(s).toContain('/Count 2');
    expect((s.match(/\/Type \/Page\b(?!s)/g) ?? []).length).toBe(2);
  });
  it('xref-Einträge zeigen auf Objekte, startxref auf xref', () => {
    const sx = Number(/startxref\n(\d+)\n/.exec(s)![1]);
    expect(s.slice(sx, sx + 4)).toBe('xref');
    const lines = s.slice(sx).split('\n');
    const [, n] = lines[1].split(' ').map(Number);
    expect(lines[2]).toBe('0000000000 65535 f ');
    const entryStart = sx + 'xref\n'.length + lines[1].length + 1;
    for (let k = 1; k < n; k++) {
      const e = s.slice(entryStart + k * 20, entryStart + (k + 1) * 20);
      expect(e).toMatch(/^\d{10} 00000 n \n$/);
      const off = Number(e.slice(0, 10));
      expect(s.slice(off).startsWith(`${k} 0 obj`)).toBe(true);
    }
    expect(s).toContain(`/Size ${n}`);
  });
  it('JPEG-Bytes unverändert, Length stimmt', () => {
    expect(indexOfBytes(pdf, j1)).toBeGreaterThan(0);
    expect(indexOfBytes(pdf, j2)).toBeGreaterThan(0);
    expect(s).toContain(`/Length ${j2.length}`);
    expect(s).toContain('/Filter /DCTDecode');
    expect(s).toContain('/Width 7');
    expect(s).toContain('q 595.28 0 0 841.89 0 0 cm /Im1 Do Q');
  });
  it('jpegSize liest SOF0', () => {
    expect(jpegSize(j2)).toEqual({ width: 7, height: 9 });
  });
});
