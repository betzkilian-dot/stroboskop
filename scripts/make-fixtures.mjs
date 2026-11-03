// Erzeugt synthetische Test-Videos (grauer Hintergrund, weisses 16x16-Quadrat bei x = 20 + 4n, y = 100).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
mkdirSync(out, { recursive: true });

function run(args) {
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}

// Quadrat: x = 20 + 4n (n = Bildnummer)
const src = (fps) =>
  ['-f', 'lavfi', '-i',
    `color=c=gray:s=320x240:r=${fps}:d=2[bg];color=c=white:s=16x16:r=${fps}:d=2[sq];[bg][sq]overlay=x='20+4*n':y=100:eval=frame`];
const h264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-bf', '0', '-preset', 'fast', '-crf', '23'];

run([...src(60), ...h264, join(out, 'ball-60.mp4')]);
run([...src(240), ...h264, join(out, 'ball-240.mp4')]);
// Anzeige-Rotation 90 Grad: Matrix [0,65536,0,-65536,0,...]. ffmpegs -display_rotation ist gegen den Uhrzeigersinn,
// daher -90. Als Input-Option auf bereits kodierte Datei (-c copy), sonst dreht ffmpeg die Pixel per Autorotate.
const upright = join(out, 'ball-portrait-tmp.mp4');
run([...src(60), ...h264, upright]);
run(['-display_rotation', '-90', '-i', upright, '-c', 'copy', join(out, 'ball-portrait.mp4')]);
rmSync(upright);
run([...src(60), '-c:v', 'libx265', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-x265-params', 'keyint=30:log-level=error', '-bf', '0', join(out, 'ball-hevc.mp4')]);
// VFR: 60-fps-Bilder, Abstaende wechseln zwischen 1/60 und 1/30 s (PTS = N + floor(N/2) in 1/60-Einheiten)
run([...src(60), '-vf', 'setpts=(N+floor(N/2))/(60*TB)', ...h264, '-fps_mode', 'passthrough', '-video_track_timescale', '600', join(out, 'ball-vfr.mp4')]);
writeFileSync(join(out, 'not-a-video.mp4'), 'Das ist kein Video.\n');
console.log('Fixtures geschrieben nach', out);
