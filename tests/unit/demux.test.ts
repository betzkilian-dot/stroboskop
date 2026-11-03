import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { demux } from '../../src/lib/video/demux';

const fixture = (name: string) => new Blob([readFileSync(new URL(`../fixtures/${name}`, import.meta.url))]);

describe('demux', () => {
  it('ball-60', async () => {
    const t = await demux(fixture('ball-60.mp4'));
    expect(t.info).toMatchObject({ width: 320, height: 240, frameCount: 120, captureFps: 60, fpsCertain: true });
    expect(t.config.codec).toMatch(/^avc1/);
    expect(t.config.description).toBeInstanceOf(Uint8Array);
    expect(t.samples).toHaveLength(120);
    expect(t.samples[0].isKey).toBe(true);
    expect(t.samples[1].timestampUs).toBeGreaterThan(t.samples[0].timestampUs);
  });
  it('ball-240', async () => {
    expect((await demux(fixture('ball-240.mp4'))).info).toMatchObject({ frameCount: 480, captureFps: 240, slowMotion: false });
  });
  it('portrait', async () => {
    expect((await demux(fixture('ball-portrait.mp4'))).info).toMatchObject({ width: 240, height: 320, rotation: 90 });
  });
  it('hevc', async () => {
    const h = await demux(fixture('ball-hevc.mp4'));
    expect(h.config.codec).toMatch(/^hvc1/);
    expect(h.config.description!.byteLength).toBeGreaterThan(20);
  });
  it('vfr', async () => {
    expect((await demux(fixture('ball-vfr.mp4'))).info.fpsCertain).toBe(false);
  });
  it('kein Video', async () => {
    await expect(demux(fixture('not-a-video.mp4'))).rejects.toMatchObject({ code: 'unsupported-format' });
  });
});
