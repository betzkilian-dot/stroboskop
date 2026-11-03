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
}
