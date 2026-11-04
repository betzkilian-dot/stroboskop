import { fixedNoNegZero } from '../format';
import type { Row } from '../physics/kinematics';

export type CsvStyle = 'de' | 'intl';

const HEADER = ['Nr', 't in s', 'x in m', 'y in m', 'vx in m/s', 'vy in m/s', '|v| in m/s', 'ax in m/s²', 'ay in m/s²', '|a| in m/s²'];

function quote(s: string, sep: string): string {
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(objects: { name: string; rows: Row[] }[], style: CsvStyle): string {
  const sep = style === 'de' ? ';' : ',';
  const num = (v: number | null) => (v === null || !Number.isFinite(v) ? '' : style === 'de' ? fixedNoNegZero(v, 4).replace('.', ',') : fixedNoNegZero(v, 4));
  const blocks = objects.map((o) => {
    const lines: string[] = [];
    if (objects.length > 1) lines.push(quote(`Objekt: ${o.name}`, sep));
    lines.push(HEADER.join(sep));
    for (const r of o.rows) {
      lines.push([String(r.nr), num(r.t), num(r.x), num(r.y), num(r.vx), num(r.vy), num(r.v), num(r.ax), num(r.ay), num(r.a)].join(sep));
    }
    return lines.join('\r\n');
  });
  return '\uFEFF' + blocks.join('\r\n\r\n') + '\r\n';
}

export function csvFileName(videoName: string): string {
  const dot = videoName.lastIndexOf('.');
  const base = dot > 0 ? videoName.slice(0, dot) : videoName;
  return `${base}_messung.csv`;
}
