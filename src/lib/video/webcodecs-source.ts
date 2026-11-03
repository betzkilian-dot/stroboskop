import type { FrameSource, RGBAImage, VideoInfo } from '../types';
import { VideoError, type DemuxedTrack, type EncodedSample } from './demux';
import { keyframeFor, needsRestart } from './gop';
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
  /** Zeitstempel aller seit dem letzten Neustart ausgegebenen Bilder */
  private emitted = new Set<number>();
  /** Dekodierindex, bei dem der aktuelle Lauf begann */
  private runStart = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
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
      this.timer = setTimeout(r, 50); // Sicherheitsnetz gegen verpasste Ereignisse
    });
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.error) throw this.error;
  }

  private clearStash() {
    for (const f of this.stash.values()) f.close();
    this.stash.clear();
  }

  private ensureDecoder() {
    if (this.decoder && this.decoder.state !== 'closed') {
      if (this.decoder.state === 'unconfigured') this.configure();
      return;
    }
    this.decoder = new VideoDecoder({
      output: (f) => {
        this.emitted.add(f.timestamp);
        if (this.wanted.has(f.timestamp) && !this.stash.has(f.timestamp)) this.stash.set(f.timestamp, f);
        else f.close();
        this.notify();
      },
      error: (e) => {
        this.error = new VideoError('decode-failed', String(e?.message ?? e));
        this.notify();
      },
    });
    this.decoder.addEventListener('dequeue', () => this.notify());
    this.configure();
  }

  private configure() {
    try {
      this.decoder!.configure(this.track.config);
    } catch (e) {
      throw new VideoError('decode-failed', String((e as Error)?.message ?? e));
    }
  }

  private async feed(pos: number) {
    const s = this.track.samples[pos];
    const data = await this.track.readSample(s);
    if (this.error) throw this.error;
    // Gegendruck: nicht beliebig viel in die Warteschlange legen
    while (this.decoder!.decodeQueueSize > 8) await this.waitEvent();
    try {
      this.decoder!.decode(
        new EncodedVideoChunk({
          type: s.isKey ? 'key' : 'delta',
          timestamp: s.timestampUs,
          duration: s.durationUs,
          data,
        }),
      );
    } catch (e) {
      throw new VideoError('decode-failed', String((e as Error)?.message ?? e));
    }
    this.next = pos + 1;
  }

  private restart() {
    this.clearStash();
    this.emitted.clear();
    if (this.decoder && this.decoder.state !== 'closed') {
      try {
        this.decoder.reset();
      } catch {
        // Decoder bereits geschlossen: wird in ensureDecoder neu angelegt
      }
    }
    this.next = -1;
    this.runStart = -1;
  }

  /** Nach einem Fehler: Decoder verwerfen, damit der naechste Aufruf neu konfiguriert. */
  private hardReset() {
    this.clearStash();
    this.emitted.clear();
    if (this.decoder && this.decoder.state !== 'closed') {
      try {
        this.decoder.close();
      } catch {
        // ignorieren
      }
    }
    this.decoder = null;
    this.next = -1;
    this.runStart = -1;
    this.error = null;
  }

  /** Dekodiert (ab dem passenden Keyframe bzw. fortlaufend) bis das Bild mit Zeitstempel ts ausgegeben wurde. */
  private async obtain(ts: number, decodePos: number): Promise<VideoFrame> {
    if (this.error) throw this.error;
    const n = this.track.samples.length;
    if (!this.stash.has(ts)) {
      // Bild wurde schon ausgegeben (und abgeliefert/verworfen) oder liegt vor dem aktuellen Lauf -> Neustart
      const kf = keyframeFor(this.track.samples, decodePos, ts);
      if (needsRestart(this.emitted.has(ts), this.next, this.runStart, kf)) this.restart();
      this.ensureDecoder();
      // Neustart, oder vorwaerts auf einen naeheren Keyframe springen statt durchzudekodieren
      if (this.next < 0 || kf > this.next) {
        this.next = kf;
        this.runStart = kf;
      }
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
        try {
          await this.decoder!.flush();
        } catch (e) {
          throw this.error ?? new VideoError('decode-failed', String((e as Error)?.message ?? e));
        }
        this.next = -1;
        this.runStart = -1;
        if (this.error) throw this.error;
        this.emitted.clear();
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
    return drawRotated(this.ctx!, frame, this.info.rotation, width, height, r);
  }

  async *readFrames(indices: number[], opts: { maxSize: number; rows?: [number, number] }) {
    if (this.error) this.hardReset();
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
    } catch (e) {
      if (!(e instanceof RangeError)) this.hardReset();
      throw e;
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
    this.runStart = -1;
    this.emitted.clear();
  }
}

export function createWebCodecsSource(track: DemuxedTrack): FrameSource {
  return new WebCodecsSource(track);
}
