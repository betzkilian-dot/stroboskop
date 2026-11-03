import type { RGBAImage } from '../types';

/** Per-Kanal-Median; bei gerader Anzahl das untere mittlere Element. Alpha = 255. */
export function medianBackground(samples: RGBAImage[]): RGBAImage {
  const n = samples.length;
  if (n === 0) throw new Error('medianBackground: keine Stichproben');
  const { width, height } = samples[0];
  const out = new Uint8ClampedArray(width * height * 4);
  const buf = new Uint8Array(n);
  const mid = (n - 1) >> 1;
  const total = width * height;
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    for (let c = 0; c < 3; c++) {
      for (let s = 0; s < n; s++) {
        const v = samples[s].data[o + c];
        let j = s;
        while (j > 0 && buf[j - 1] > v) { buf[j] = buf[j - 1]; j--; }
        buf[j] = v;
      }
      out[o + c] = buf[mid];
    }
    out[o + 3] = 255;
  }
  return { width, height, data: out };
}

/**
 * Median in Zeilenstreifen, damit nie alle Stichproben komplett im Speicher liegen müssen.
 * Streifenhöhe = floor(budgetBytes / (width*4*sampleCount)), mindestens 1.
 */
export async function medianBackgroundBanded(
  readSamples: (rowStart: number, rowEnd: number) => AsyncIterable<RGBAImage>,
  width: number,
  height: number,
  sampleCount: number,
  budgetBytes: number,
): Promise<RGBAImage> {
  const bandRows = Math.max(1, Math.floor(budgetBytes / (width * 4 * sampleCount)));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let rowStart = 0; rowStart < height; rowStart += bandRows) {
    const rowEnd = Math.min(height, rowStart + bandRows);
    const band: RGBAImage[] = [];
    for await (const img of readSamples(rowStart, rowEnd)) band.push(img);
    const med = medianBackground(band);
    out.set(med.data, rowStart * width * 4);
  }
  return { width, height, data: out };
}
