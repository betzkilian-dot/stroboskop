import { describe, it, expect, vi } from 'vitest';
import { Project } from '../../src/lib/state/project.svelte';
import { settingsKey, type RenderResult } from '../../src/lib/engine/protocol';
import type { VideoInfo } from '../../src/lib/types';

const info = { frameCount: 120, captureFps: 60, width: 100, height: 50 } as VideoInfo;
const bmp = () => ({ close: vi.fn(), width: 10, height: 10 }) as unknown as ImageBitmap;

function fake(keyFor: (p: Project) => string) {
  let project: Project;
  const eng = {
    open: vi.fn(async () => ({ info, exact: true })),
    thumbnails: vi.fn(async () => []),
    render: vi.fn(async (): Promise<RenderResult> => {
      const indices = project.measureIndices;
      return {
        image: bmp(), positions: indices.length,
        detections: indices.map((index, k) => ({ index, candidates: [{ x: 10 + k * 5, y: 20, area: 1 }] })),
        cameraMoved: false, autoThreshold: 0.1, settingsKey: keyFor(project), width: 10, height: 10,
      };
    }),
    onProgress() {},
    dispose() {},
  };
  project = new Project(eng);
  return { eng, project };
}

describe('Project Messung', () => {
  it('neues Video: leere Punkte, keine Kalibrierung', async () => {
    const { project } = fake((p) => settingsKey(p.renderSettings()));
    await project.load(new File([], 'a.mp4'));
    project.measure.calibration = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, length: 1, unit: 'm' };
    project.setPoint(0, { x: 1, y: 1 });
    await project.load(new File([], 'b.mp4'));
    expect(project.measure.objects[0].points).toEqual({});
    expect(project.measure.calibration).toBeNull();
    project.dispose();
  });

  it('suggestPositions setzt Punkte aus der aktuellen Vorschau', async () => {
    const { project } = fake((p) => settingsKey(p.renderSettings()));
    await project.load(new File([], 'a.mp4'));
    await vi.waitFor(() => expect(project.preview).not.toBeNull());
    await project.suggestPositions();
    const pts = project.measure.objects[0].points;
    expect(Object.keys(pts).map(Number)).toEqual(project.measureIndices);
    expect(project.suggesting).toBe(false);
    project.dispose();
  });

  it('veraltete Vorschau: erst rendern, dann zuordnen (2 Renders)', async () => {
    let stale = true;
    const { eng, project } = fake((p) => (stale ? 'alt' : settingsKey(p.renderSettings())));
    await project.load(new File([], 'a.mp4'));
    await vi.waitFor(() => expect(project.preview).not.toBeNull());
    expect(eng.render).toHaveBeenCalledTimes(1);
    stale = false;
    await project.suggestPositions();
    expect(eng.render).toHaveBeenCalledTimes(2);
    expect(Object.keys(project.measure.objects[0].points).length).toBe(project.measureIndices.length);
    project.dispose();
  });

  it('setPoint überschreibt unsicheren Punkt; deletePoint/clearPoints', async () => {
    const { project } = fake((p) => settingsKey(p.renderSettings()));
    await project.load(new File([], 'a.mp4'));
    const f = project.measureIndices[1];
    project.measure.objects[0].points[f] = { x: 1, y: 1, unsure: true };
    project.setPoint(1, { x: 5, y: 6 });
    expect(project.measure.objects[0].points[f]).toEqual({ x: 5, y: 6, unsure: false });
    project.setPoint(9999, { x: 0, y: 0 });
    expect(Object.keys(project.measure.objects[0].points)).toEqual([String(f)]);
    project.deletePoint(1);
    expect(project.measure.objects[0].points).toEqual({});
    project.setPoint(0, { x: 1, y: 1 });
    project.clearPoints();
    expect(project.measure.objects[0].points).toEqual({});
    project.dispose();
  });
});
