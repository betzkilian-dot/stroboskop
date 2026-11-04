/** Minimaler PDF-Schreiber: je Seite ein JPEG, das die A4-Seite füllt. */

export interface PdfJpegPage {
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
}

const enc = new TextEncoder();

/** Pixelgröße aus SOF0/SOF1/SOF2-Marker; null falls nicht gefunden. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

const num = (n: number) => String(+n.toFixed(2));

export function jpegPagesToPdf(pages: PdfJpegPage[], pageWpt = 595.28, pageHpt = 841.89): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (c: Uint8Array) => { chunks.push(c); len += c.length; };
  const text = (s: string) => push(enc.encode(s));

  push(new Uint8Array([...enc.encode('%PDF-1.4\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const n = pages.length;
  // Objekte: 1 Catalog, 2 Pages, danach je Seite 3 (Page, Content, Image)
  const startObj = (id: number) => { offsets[id] = len; };
  startObj(1);
  text('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  const kids = pages.map((_, k) => `${3 + 3 * k} 0 R`).join(' ');
  text(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);

  const W = num(pageWpt), H = num(pageHpt);
  pages.forEach((p, k) => {
    const pid = 3 + 3 * k, cid = pid + 1, iid = pid + 2;
    startObj(pid);
    text(`${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im1 ${iid} 0 R >> >> /Contents ${cid} 0 R >>\nendobj\n`);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im1 Do Q`;
    startObj(cid);
    text(`${cid} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObj(iid);
    text(`${iid} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    text('\nendstream\nendobj\n');
  });

  const size = 3 + 3 * n;
  const xrefPos = len;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  text(xref);
  text(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
