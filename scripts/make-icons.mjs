// Erzeugt die PWA-Icons (dunkler Grund, 5 helle Kreise mit steigender Deckkraft = Stroboskop-Motiv).
// Aufruf: node scripts/make-icons.mjs   (nutzt ffmpeg-static, kein Netzwerk)
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
mkdirSync('public/icons', { recursive: true });

// size px; scale = Anteil der Nutzflaeche (maskable braucht Sicherheitszone ~80 %)
function make(file, size, scale) {
  const r = (size * scale) / 14; // Kreisradius; 5 Kreise: 5*2r + 4*0.5r = 12r Breite
  const step = 2.5 * r;
  const x0 = size / 2 - 2 * step;
  const y = size / 2;
  // Kreise per geq: Alpha-Mischung weiss ueber dunkel
  const expr = (ch, bg) => {
    const terms = [];
    for (let i = 0; i < 5; i++) {
      const a = (0.2 + 0.8 * (i / 4)).toFixed(2);
      const cx = (x0 + i * step).toFixed(1);
      terms.push(`gt(${r.toFixed(1)}\,hypot(X-${cx}\,Y-${y}))*${a}`);
    }
    // Deckkraft = max der Kreise (disjunkt)
    return `${bg}+(${ch}-${bg})*(${terms.join('+')})`;
  };
  const vf = `format=rgb24,geq=r='${expr(235, 20)}':g='${expr(238, 22)}':b='${expr(245, 28)}'`;
  const res = spawnSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x14161c:s=${size}x${size}`, '-vf', vf, '-frames:v', '1', file],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) throw new Error('ffmpeg failed for ' + file);
}

make('public/icons/icon-180.png', 180, 1);
make('public/icons/icon-192.png', 192, 1);
make('public/icons/icon-512.png', 512, 1);
make('public/icons/icon-maskable-512.png', 512, 0.7);
