import { createFile, DataStream, MP4BoxBuffer, type Sample } from 'mp4box';
import type { VideoInfo } from '../types';
import { detectFps, rotationFromMatrix } from './metadata';

export type VideoErrorCode = 'unsupported-format' | 'no-video-track' | 'decode-failed';

export class VideoError extends Error {
  code: VideoErrorCode;
  constructor(code: VideoErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'VideoError';
    this.code = code;
  }
}

export interface EncodedSample {
  index: number;
  timestampUs: number;
  durationUs: number;
  isKey: boolean;
  /** Byte-Offset und Groesse der Sample-Daten in der Datei (lazy via readSample) */
  offset: number;
  size: number;
}

export interface DemuxedTrack {
  info: VideoInfo;
  config: VideoDecoderConfig;
  samples: EncodedSample[];
  readSample(s: EncodedSample): Promise<Uint8Array>;
}

const SUPPORTED_ENTRIES = ['avc1', 'avc3', 'hvc1', 'hev1'];

/** Liest nur die Top-Level-Box-Header (ueber Blob.slice) und liefert ftyp + moov als zusammenhaengenden Puffer. */
async function readHeaderBoxes(file: Blob): Promise<ArrayBuffer> {
  const parts: ArrayBuffer[] = [];
  let pos = 0;
  let hasMoov = false;
  while (pos + 8 <= file.size) {
    const hdr = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    if (hdr.byteLength < 8) break;
    let size = hdr.getUint32(0);
    const type = String.fromCharCode(hdr.getUint8(4), hdr.getUint8(5), hdr.getUint8(6), hdr.getUint8(7));
    if (size === 1) {
      if (hdr.byteLength < 16) break;
      size = Number(hdr.getBigUint64(8));
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < 8) break;
    if (type === 'ftyp' || type === 'moov') {
      parts.push(await file.slice(pos, pos + size).arrayBuffer());
      if (type === 'moov') hasMoov = true;
    }
    pos += size;
  }
  if (!hasMoov) throw new VideoError('unsupported-format', 'keine moov-Box gefunden');
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p), o);
    o += p.byteLength;
  }
  return out.buffer;
}

function extractDescription(entry: any): Uint8Array | undefined {
  const box = entry?.avcC ?? entry?.hvcC;
  if (!box) return undefined;
  const stream = new DataStream(); // Standard: big endian
  box.write(stream);
  // 8-Byte-Box-Header (size + fourcc) abschneiden
  return new Uint8Array(stream.buffer.slice(8, stream.getPosition()));
}

export async function demux(file: Blob): Promise<DemuxedTrack> {
  const buf = await readHeaderBoxes(file);
  const iso = createFile();
  let error: VideoError | undefined;
  iso.onError = (_m: string, msg: string) => {
    error = new VideoError('unsupported-format', msg);
  };
  let ready: any;
  iso.onReady = (info: any) => {
    ready = info;
  };
  try {
    // Sample-Offsets stammen aus stco/co64 (absolute Dateioffsets); mdat wird nie gelesen.
    iso.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buf, 0), true);
    iso.flush();
  } catch (e) {
    throw new VideoError('unsupported-format', String(e));
  }
  if (error) throw error;
  if (!ready) throw new VideoError('unsupported-format', 'moov konnte nicht gelesen werden');

  const track = ready.videoTracks?.[0];
  if (!track) throw new VideoError('no-video-track');

  const trak = iso.getTrackById(track.id);
  const entry: any = trak.mdia.minf.stbl.stsd.entries[0];
  if (!SUPPORTED_ENTRIES.includes(entry?.type)) {
    throw new VideoError('unsupported-format', `Codec ${entry?.type ?? '?'} wird nicht unterstuetzt`);
  }
  const description = extractDescription(entry);

  const raw: Sample[] = iso.getTrackSamplesInfo(track.id);
  if (!raw.length) throw new VideoError('unsupported-format', 'keine Samples in der Sample-Tabelle (fragmentiertes MP4?)');

  const ts = track.timescale;
  const samples: EncodedSample[] = raw.map((s, i) => ({
    index: i,
    timestampUs: Math.round((s.cts * 1e6) / ts),
    durationUs: Math.round((s.duration * 1e6) / ts),
    isKey: s.is_sync,
    offset: s.offset,
    size: s.size,
  }));

  const edits = trak.edts?.elst?.entries as { segment_duration: number }[] | undefined;
  const editDuration = edits?.length ? edits.reduce((a, e) => a + e.segment_duration, 0) : undefined;
  const sampleDurations = raw.map((s) => s.duration);
  const mediaDuration = sampleDurations.reduce((a, b) => a + b, 0);
  const fps = detectFps({
    timescale: ts,
    sampleDurations,
    mediaDuration,
    editDuration,
    movieTimescale: ready.timescale,
  });

  const rotation = rotationFromMatrix(Array.from(track.matrix));
  const codedWidth = track.video?.width ?? track.track_width;
  const codedHeight = track.video?.height ?? track.track_height;
  const swap = rotation === 90 || rotation === 270;

  const sortedCts = samples.map((s) => s.timestampUs).sort((a, b) => a - b);
  const frameTimesS = sortedCts.map((u) => (u - sortedCts[0]) / 1e6);

  const info: VideoInfo = {
    codec: track.codec,
    width: swap ? codedHeight : codedWidth,
    height: swap ? codedWidth : codedHeight,
    codedWidth,
    codedHeight,
    rotation,
    frameCount: raw.length,
    durationS: mediaDuration / ts,
    ...fps,
    frameTimesS,
  };

  const config: VideoDecoderConfig = { codec: track.codec, codedWidth, codedHeight };
  if (description) config.description = description;
  const readSample = async (smp: EncodedSample) =>
    new Uint8Array(await file.slice(smp.offset, smp.offset + smp.size).arrayBuffer());
  return { info, config, samples, readSample };
}
