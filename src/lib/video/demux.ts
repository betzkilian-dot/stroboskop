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
  data: Uint8Array;
}

export interface DemuxedTrack {
  info: VideoInfo;
  config: VideoDecoderConfig;
  samples: EncodedSample[];
}

const CHUNK = 4 * 1024 * 1024;

function extractDescription(entry: any): Uint8Array | undefined {
  const box = entry?.avcC ?? entry?.hvcC;
  if (!box) return undefined;
  const stream = new DataStream(); // Standard: big endian
  box.write(stream);
  // 8-Byte-Box-Header (size + fourcc) abschneiden
  return new Uint8Array(stream.buffer.slice(8, stream.getPosition()));
}

export async function demux(file: Blob): Promise<DemuxedTrack> {
  const iso = createFile();
  let error: VideoError | undefined;
  iso.onError = (_m: string, msg: string) => {
    error = new VideoError('unsupported-format', msg);
  };

  let ready: any;
  const raw: Sample[] = [];
  iso.onSamples = (_id: number, _u: unknown, s: Sample[]) => {
    raw.push(...s);
  };
  iso.onReady = (info: any) => {
    ready = info;
    const vt = info.videoTracks?.[0];
    if (vt) {
      iso.setExtractionOptions(vt.id, undefined, { nbSamples: 1000 });
      iso.start();
    }
  };

  try {
    for (let off = 0; off < file.size && !error; off += CHUNK) {
      const ab = await file.slice(off, off + CHUNK).arrayBuffer();
      iso.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, off), off + CHUNK >= file.size);
    }
    iso.flush();
  } catch (e) {
    throw new VideoError('unsupported-format', String(e));
  }
  if (error) throw error;
  if (!ready) throw new VideoError('unsupported-format', 'keine moov-Box gefunden');

  const track = ready.videoTracks?.[0];
  if (!track) throw new VideoError('no-video-track');

  const trak = iso.getTrackById(track.id);
  const entry: any = trak.mdia.minf.stbl.stsd.entries[0];
  const description = extractDescription(entry);

  if (raw.length < track.nb_samples) {
    throw new VideoError('decode-failed', `nur ${raw.length}/${track.nb_samples} Samples gelesen`);
  }
  raw.sort((a, b) => a.number - b.number);

  const ts = track.timescale;
  const samples: EncodedSample[] = raw.map((s, i) => ({
    index: i,
    timestampUs: Math.round((s.cts * 1e6) / ts),
    durationUs: Math.round((s.duration * 1e6) / ts),
    isKey: s.is_sync,
    data: s.data!,
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
  };

  const config: VideoDecoderConfig = { codec: track.codec, codedWidth, codedHeight };
  if (description) config.description = description;
  return { info, config, samples };
}
