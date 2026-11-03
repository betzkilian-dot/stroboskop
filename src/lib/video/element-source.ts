import type { FrameSource, VideoInfo } from '../types';
import { VideoError, type DemuxedTrack, type EncodedSample } from './demux';
import { clampRows, drawRotated, targetSize } from './draw';

/** Rueckfall ueber <video>: nur Hauptthread. Browser wenden die Rotation selbst an. Nicht bildgenau. */
class ElementSource implements FrameSource {
  exact = false;
  info: VideoInfo;
  private video: HTMLVideoElement;
  private url: string;
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

  private pres: EncodedSample[];

  constructor(track: DemuxedTrack, video: HTMLVideoElement, url: string) {
    this.info = track.info;
    this.pres = [...track.samples].sort((a, b) => a.timestampUs - b.timestampUs || a.index - b.index);
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
      const smp = this.pres[k];
      if (!smp) throw new RangeError(`Bildindex ${k} ausserhalb`);
      // Praesentationszeit auf die Zeitachse des Elements skalieren (Zeitlupe: Elementdauer != Mediendauer)
      const scale = Number.isFinite(v.duration) && this.info.durationS > 0 ? v.duration / this.info.durationS : 1;
      const dur = smp.durationUs || 1e6 / (this.info.captureFps || 30);
      await this.seek(((smp.timestampUs - this.pres[0].timestampUs + 0.5 * dur) / 1e6) * scale);
      // gleiche Groesse wie renderStrobe (info), nicht videoWidth/-Height
      const { width, height } = targetSize(this.info.width, this.info.height, opts.maxSize);
      this.canvas.width = width;
      this.canvas.height = height;
      // Die Rotation ist im <video> bereits angewendet
      const image = drawRotated(this.ctx, v, 0, width, height, clampRows(opts.rows, height));
      yield { index: k, image };
    }
  }

  close() {
    this.video.removeAttribute('src');
    this.video.load();
    URL.revokeObjectURL(this.url);
  }
}

export async function createElementSource(file: Blob, track: DemuxedTrack): Promise<FrameSource> {
  if (typeof document === 'undefined') {
    throw new VideoError('decode-failed', 'Weder WebCodecs noch ein DOM (<video>) verfuegbar');
  }
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
  return new ElementSource(track, video, url);
}
