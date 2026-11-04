export const COLUMNS = [
  { id: 't', head: 't', sub: '', unit: 's', kind: 'base' },
  { id: 'x', head: 'x', sub: '', unit: 'm', kind: 'base' },
  { id: 'y', head: 'y', sub: '', unit: 'm', kind: 'base' },
  { id: 's', head: 's', sub: '', unit: 'm', kind: 'base' },
  { id: 'vx', head: 'v', sub: 'x', unit: 'm/s', kind: 'der' },
  { id: 'vy', head: 'v', sub: 'y', unit: 'm/s', kind: 'der' },
  { id: 'v', head: '|v|', sub: '', unit: 'm/s', kind: 'der' },
  { id: 'ax', head: 'a', sub: 'x', unit: 'm/s²', kind: 'der' },
  { id: 'ay', head: 'a', sub: 'y', unit: 'm/s²', kind: 'der' },
  { id: 'a', head: '|a|', sub: '', unit: 'm/s²', kind: 'der' },
] as const;
export const DEFAULT_COLUMNS: string[] = ['t', 'x', 'y', 'vx', 'vy', 'v', 'a'];
