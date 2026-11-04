import type { Pt } from '../physics/kinematics';
import type { CropRect } from '../state/project.svelte';

/** Video-Pixel -> Exportpixel: Zuschnitt, Drehung im Uhrzeigersinn (wie cropRotate), dann Skalierung. */
export function exportMap(
  crop: CropRect | null, rotation: 0 | 90 | 180 | 270, videoW: number, videoH: number, scale: number,
): (p: Pt) => Pt {
  let x0 = 0, y0 = 0, w = videoW, h = videoH;
  if (crop) {
    x0 = Math.min(videoW, Math.max(0, Math.round(crop.x)));
    y0 = Math.min(videoH, Math.max(0, Math.round(crop.y)));
    const x1 = Math.min(videoW, Math.max(x0, Math.round(crop.x + crop.w)));
    const y1 = Math.min(videoH, Math.max(y0, Math.round(crop.y + crop.h)));
    w = x1 - x0;
    h = y1 - y0;
  }
  return (p) => {
    const x = p.x - x0, y = p.y - y0;
    let dx: number, dy: number;
    switch (rotation) {
      case 90: dx = h - y; dy = x; break;
      case 180: dx = w - x; dy = h - y; break;
      case 270: dx = y; dy = w - x; break;
      default: dx = x; dy = y;
    }
    return { x: dx * scale, y: dy * scale };
  };
}
