export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface VideoInfo {
  codec: string;
  /** bereits gedreht (Anzeigeorientierung) */
  width: number;
  height: number;
  codedWidth: number;
  codedHeight: number;
  rotation: 0 | 90 | 180 | 270;
  frameCount: number;
  durationS: number;
  nominalFps: number;
  captureFps: number;
  fpsCertain: boolean;
  slowMotion: boolean;
  /** Praesentationszeit je Bildindex in Sekunden, aufsteigend, erstes Bild = 0 (fehlt beim Element-Rueckfall) */
  frameTimesS?: number[];
}

export interface FrameSource {
  info: VideoInfo;
  /** true = bildgenau (WebCodecs), false = Naeherung ueber <video> */
  exact: boolean;
  /**
   * Liefert die Bilder (Index = Position in Praesentationsreihenfolge) in der angegebenen Reihenfolge.
   * maxSize: laengste Kante <= maxSize (nie hochskaliert). rows [start, end): nur dieses Zeilenband
   * des fertig gedrehten/skalierten Bildes.
   */
  readFrames(
    indices: number[],
    opts: { maxSize: number; rows?: [number, number] },
  ): AsyncGenerator<{ index: number; image: RGBAImage }>;
  close(): void;
}
