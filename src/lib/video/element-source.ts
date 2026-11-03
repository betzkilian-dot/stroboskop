import type { FrameSource, RGBAImage, VideoInfo } from '../types';
import { VideoError } from './demux';
import { clampRows, drawRotated, targetSize } from './draw';

/** Rueckfall ueber <video>: nur Hauptthread. Browser wenden die Rotation selbst an. Nicht bildgenau. */
class ElementSource implements FrameSource {
  exact = false;
  info: VideoInfo;
  private video: HTMLVideoElement;
  private url: string;
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

  constructor(info: VideoInfo, video: HTMLVideoElement, url: string) {
    this.info = info;
    this.video = video;
    this.url = url;
  }

  private seek(t: number): Promise<void> {
    const v = this.video;
    return new Promise((resolve, reject) => {
      const done = () => {
        v.removeEventListener('seeked', onSeeked);
        v.removeEventListener('error', onErr);
      };
      const onSeeked = () => {
        done();
        resolve();
      };
      const onErr = () => {
        done();
        reject(new VideoError('decode-failed', 'Suchen im Video fehlgeschlagen'));
      };
      v.addEventListener('seeked', onSeeked);
      v.addEventListener('error', onErr);
      if (Math.abs(v.currentTime - t) < 1e-6) {
        // Gleiche Position loest kein seeked aus
        done();
        resolve();
        return;
      }
      v.currentTime = t;
    });
  }

  async *readFrames(indices: number[], opts: { maxSize: number; rows?: [number, number] }) {
    const v = this.video;
    for (const k of indices) {
      const fps = this.info.captureFps || this.info.nominalFps || 30;
      await this.seek((k + 0.5) / fps);
      const { width, height } = targetSize(v.videoWidth, v.videoHeight, opts.maxSize);
      this.canvas.width = width;
      this.canvas.height = height;
      // Die Rotation ist im <video> bereits angewendet
      const img = drawRotated(this.ctx, v, 0, width, height, clampRows(opts.rows, height));
      const image: RGBAImage = { width: img.width, height: img.height, data: img.data };
      yield { index: k, image };
    }
  }

  close() {
    this.video.removeAttribute('src');
    this.video.load();
    URL.revokeObjectURL(this.url);
  }
}

export async function createElementSource(file: Blob, info: VideoInfo): Promise<FrameSource> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new VideoError('decode-failed', 'Video konnte nicht geladen werden'));
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return new ElementSource(info, video, url);
}
