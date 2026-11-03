import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { demux } from '../../src/lib/video/demux';

const fixture = (name: string) => new Blob([readFileSync(new URL(`../fixtures/${name}`, import.meta.url))]);

describe('demux', () => {
  it('ball-60', async () => {
    const t = await demux(fixture('ball-60.mp4'));
    expect(t.info).toMatchObject({ width: 320, height: 240, frameCount: 120, captureFps: 60, fpsCertain: true });
    expect(t.config.codec).toMatch(/^avc1/);
    expect(t.config.description).toBeInstanceOf(Uint8Array);
    expect(t.config.description!.byteLength).toBeGreaterThan(0);
    expect(t.config.description![0]).toBe(1);
    expect(t.samples).toHaveLength(120);
    expect((await t.readSample(t.samples[0])).byteLength).toBe(t.samples[0].size);
    expect(t.samples[0].isKey).toBe(true);
    expect(t.samples[1].timestampUs).toBeGreaterThan(t.samples[0].timestampUs);
  });
  it('ball-240', async () => {
    expect((await demux(fixture('ball-240.mp4'))).info).toMatchObject({ frameCount: 480, captureFps: 240, slowMotion: false });
  });
  it('portrait', async () => {
    expect((await demux(fixture('ball-portrait.mp4'))).info).toMatchObject({ width: 240, height: 320, rotation: 90, codedWidth: 320, codedHeight: 240 });
  });
  it('hevc', async () => {
    const h = await demux(fixture('ball-hevc.mp4'));
    expect(h.config.codec).toMatch(/^hvc1/);
    expect(h.config.description!.byteLength).toBeGreaterThan(20);
    expect(h.samples[0].isKey).toBe(true);
  });
  it('vfr', async () => {
    expect((await demux(fixture('ball-vfr.mp4'))).info.fpsCertain).toBe(false);
  });
  it('kein Video', async () => {
    await expect(demux(fixture('not-a-video.mp4'))).rejects.toMatchObject({ code: 'unsupported-format' });
  });

  describe('generierte Dateien (tmp)', () => {
    const ffmpeg: string = createRequire(import.meta.url)('ffmpeg-static');
    const dir = mkdtempSync(join(tmpdir(), 'strobo-'));
    const gen = (name: string, args: string[]) => {
      const p = join(dir, name);
      const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30:d=8', ...args, p]);
      expect(r.status).toBe(0);
      return p;
    };
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('grosse Datei, mdat vor moov (>5 MB)', async () => {
      const p = gen('big.mp4', ['-c:v', 'libx264', '-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-g', '30']);
      const buf = readFileSync(p);
      expect(buf.length).toBeGreaterThan(5 * 1024 * 1024);
      const t = await demux(new Blob([buf]));
      expect(t.info.frameCount).toBe(240);
      expect(t.samples).toHaveLength(240);
      for (const s of t.samples) {
        expect(s.size).toBeGreaterThan(0);
        expect(s.offset + s.size).toBeLessThanOrEqual(buf.length);
      }
      const bytes = await t.readSample(t.samples[0]);
      expect(bytes.byteLength).toBe(t.samples[0].size);
      expect(Buffer.from(bytes).equals(buf.subarray(t.samples[0].offset, t.samples[0].offset + t.samples[0].size))).toBe(true);
      expect(t.samples[0].isKey).toBe(true);
    });

    it('nicht unterstuetzter Codec (mpeg4)', async () => {
      const p = gen('mpeg4.mp4', ['-c:v', 'mpeg4']);
      await expect(demux(new Blob([readFileSync(p)]))).rejects.toMatchObject({ code: 'unsupported-format' });
    });
  });
});
