/**
 * Where everything goes on a printed magnet, in printer pixels. Pure, so it
 * is tested without a browser; drawMagnet.ts does the drawing.
 */

/** The DNP DS620's resolution. To be confirmed with the importer (PR C). */
export const PRINT_DPI = 300;

export type FrameGeometry = {
  widthMm: number;
  heightMm: number;
  /** The photo window, as fractions of the frame (0 to 1). */
  windowX: number;
  windowY: number;
  windowW: number;
  windowH: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export function mmToPx(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * The magnet at print size, and the photo window inside it. The photo is
 * placed by millimetres (the window), never by its own pixel count: guest
 * photos are 20 px/mm and the studio's overlay is 25 px/mm.
 */
export function magnetLayout(frame: FrameGeometry, dpi = PRINT_DPI): { width: number; height: number; window: Rect } {
  const width = mmToPx(frame.widthMm, dpi);
  const height = mmToPx(frame.heightMm, dpi);
  return {
    width,
    height,
    window: {
      x: Math.round(frame.windowX * width),
      y: Math.round(frame.windowY * height),
      w: Math.round(frame.windowW * width),
      h: Math.round(frame.windowH * height),
    },
  };
}

/**
 * The part of a source image that fills a box without stretching (centred
 * crop). The guest's phone already cropped the photo to the window, so this
 * only trims rounding differences.
 */
export function coverCrop(sourceW: number, sourceH: number, box: { w: number; h: number }): Rect {
  const sourceRatio = sourceW / sourceH;
  const boxRatio = box.w / box.h;
  if (sourceRatio > boxRatio) {
    const w = Math.round(sourceH * boxRatio);
    return { x: Math.round((sourceW - w) / 2), y: 0, w, h: sourceH };
  }
  const h = Math.round(sourceW / boxRatio);
  return { x: 0, y: Math.round((sourceH - h) / 2), w: sourceW, h };
}
