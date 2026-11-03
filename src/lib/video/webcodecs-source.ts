import type { FrameSource, RGBAImage, VideoInfo } from '../types';
import { VideoError, type DemuxedTrack, type EncodedSample } from './demux';
import { clampRows, drawRotated, targetSize } from './draw';

/** Wie viele der folgenden angeforderten Bilder zwischengespeichert werden duerfen (Umordnung durch B-Frames). */
const LOOKAHEAD = 2;

class WebCodecsSource implements FrameSource {
  exact = true;
  info: VideoInfo;
  private track: DemuxedTrack;
  /** Praesentationsreihenfolge -> Sample */
  private pres: EncodedSample[];
  private decoder: VideoDecoder | null = null;
  /** Naechste in Dekodierreihenfolge zu fuettende Sample-Position; -1 = ab Keyframe neu starten */
  private next = -1;
  private stash = new Map<number, VideoFrame>();
  private dropped = new Set<number>();
  private wanted = new Set<number>();
  private error: VideoError | null = null;
  private wake: (() => void) | null = null;
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;

  constructor(track: DemuxedTrack) {
    this.track = track;
    this.info = track.info;
    this.pres = [...track.samples].sort((a, b) => a.timestampUs - b.timestampUs || a.index - b.index);
  }

  private notify() {
    const w = this.wake;
    this.wake = null;
    w?.();
  }

  private async waitEvent() {
    if (this.error) throw this.error;
    await new Promise<void>((r) => {
      this.wake = r;
      setTimeout(r, 50); // Sicherheitsnetz gegen verpasste Ereignisse
    });
    if (this.error) throw this.error;
  }

  private clearStash() {
    for (const f of this.stash.values()) f.close();
    this.stash.clear();
  }

  private ensureDecoder() {
    if (this.decoder && this.decoder.state !== 'closed') {
      if (this.decoder.state === 'unconfigured') this.decoder.configure(this.track.config);
      return;
    }
    this.decoder = new VideoDecoder({
      output: (f) => {
        if (this.wanted.has(f.timestamp) && !this.stash.has(f.timestamp)) {
          this.stash.set(f.timestamp, f);
        } else {
          this.dropped.add(f.timestamp);
          f.close();
        }
        this.notify();
      },
      error: (e) => {
        this.error = new VideoError('decode-failed', String(e?.message ?? e));
        this.notify();
      },
    });
    this.decoder.addEventListener('dequeue', () => this.notify());
    this.decoder.configure(this.track.config);
  }

  private keyframeAtOrBefore(pos: number): number {
    const s = this.track.samples;
    let i = pos;
    while (i > 0 && !s[i].isKey) i--;
    return i;
  }

  private async feed(pos: number) {
    const s = this.track.samples[pos];
    const data = await this.track.readSample(s);
    // Gegendruck: nicht beliebig viel in die Warteschlange legen
    while (this.decoder!.decodeQueueSize > 8) await this.waitEvent();
    this.decoder!.decode(
      new EncodedVideoChunk({
        type: s.isKey ? 'key' : 'delta',
        timestamp: s.timestampUs,
        duration: s.durationUs,
        data,
      }),
    );
    this.next = pos + 1;
  }

  private restart() {
    this.clearStash();
    this.dropped.clear();
    if (this.decoder && this.decoder.state !== 'closed') {
      try {
        this.decoder.reset();
      } catch {
        // Decoder bereits geschlossen: wird in ensureDecoder neu angelegt
      }
    }
    this.next = -1;
  }

  /** Dekodiert (ab dem passenden Keyframe bzw. fortlaufend) bis das Bild mit Zeitstempel ts ausgegeben wurde. */
  private async obtain(ts: number, decodePos: number): Promise<VideoFrame> {
    if (this.error) throw this.error;
    const n = this.track.samples.length;
    if (!this.stash.has(ts)) {
      // Ziel wurde schon gefuettert und verworfen -> zurueck zum Keyframe
      if (this.dropped.has(ts)) this.restart();
      this.ensureDecoder();
      const kf = this.keyframeAtOrBefore(decodePos);
      // Neustart, oder vorwaerts auf einen naeheren Keyframe springen statt durchzudekodieren
      if (this.next < 0 || kf > this.next) this.next = kf;
      while (!this.stash.has(ts) && this.next < n) {
        await this.feed(this.next);
        if (this.next > decodePos + 1) {
          // Zielsample ist gefuettert: Umordnung abwarten, bevor weitere Samples folgen
          await this.waitEvent();
          if (!this.stash.has(ts)) await new Promise((r) => setTimeout(r, 0));
        }
      }
      if (!this.stash.has(ts)) {
        // Stromende: restliche Bilder ausgeben lassen; danach braucht der Decoder einen Keyframe
        await this.decoder!.flush();
        this.next = -1;
        this.dropped.clear();
        if (this.error) throw this.error;
      }
    }
    const f = this.stash.get(ts);
    if (!f) throw new VideoError('decode-failed', 'Bild wurde nicht ausgegeben');
    this.stash.delete(ts);
    return f;
  }

  private render(frame: VideoFrame, maxSize: number, rows?: [number, number]): RGBAImage {
    const { width, height } = targetSize(this.info.width, this.info.height, maxSize);
    if (!this.canvas) {
      this.canvas = new OffscreenCanvas(width, height);
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const r = clampRows(rows, height);
    const img = drawRotated(this.ctx!, frame, this.info.rotation, width, height, r);
    return { width: img.width, height: img.height, data: img.data };
  }

  async *readFrames(indices: number[], opts: { maxSize: number; rows?: [number, number] }) {
    try {
      for (let i = 0; i < indices.length; i++) {
        const k = indices[i];
        const s = this.pres[k];
        if (!s) throw new RangeError(`Bildindex ${k} ausserhalb`);
        this.wanted = new Set(
          indices
            .slice(i, i + 1 + LOOKAHEAD)
            .map((j) => this.pres[j]?.timestampUs)
            .filter((t): t is number => t !== undefined),
        );
        const frame = await this.obtain(s.timestampUs, s.index);
        let image: RGBAImage;
        try {
          image = this.render(frame, opts.maxSize, opts.rows);
        } finally {
          frame.close();
        }
        yield { index: k, image };
      }
    } finally {
      this.wanted = new Set();
      this.clearStash();
    }
  }

  close() {
    this.clearStash();
    if (this.decoder && this.decoder.state !== 'closed') this.decoder.close();
    this.decoder = null;
    this.next = -1;
  }
}

export function createWebCodecsSource(track: DemuxedTrack): FrameSource {
  return new WebCodecsSource(track);
}
