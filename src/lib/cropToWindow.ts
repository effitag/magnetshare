/**
 * Centered cover-crop into the frame's photo window.
 * The print station places overlay.png on top, so this never draws the frame.
 * Pixels = window fraction × frame millimetres × 25, long edge capped at 3000.
 */
export const PRINT_PX_PER_MM = 25;
export const MAX_PHOTO_EDGE = 3000;
export const JPEG_QUALITY = 0.92;

export type WindowFrame = {
  widthMm: number;
  heightMm: number;
  windowW: number;
  windowH: number;
};

export type CropRect = { sx: number; sy: number; sw: number; sh: number };

export function printWindowPixels(frame: WindowFrame): { width: number; height: number } {
  const width = frame.windowW * frame.widthMm * PRINT_PX_PER_MM;
  const height = frame.windowH * frame.heightMm * PRINT_PX_PER_MM;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("invalid_window");
  }
  return capLongEdge(width, height, MAX_PHOTO_EDGE);
}

export function capLongEdge(
  width: number,
  height: number,
  maxLong: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  const scale = long > maxLong ? maxLong / long : 1;
  let nextWidth = Math.max(1, Math.round(width * scale));
  let nextHeight = Math.max(1, Math.round(height * scale));
  if (nextWidth > maxLong) nextWidth = maxLong;
  if (nextHeight > maxLong) nextHeight = maxLong;
  return { width: nextWidth, height: nextHeight };
}

/** Same crop as object-fit: cover with object-position: center. */
export function coverCropSource(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
): CropRect {
  if (!(sourceWidth > 0) || !(sourceHeight > 0) || !(targetAspect > 0)) {
    throw new Error("invalid_crop");
  }
  const sourceAspect = sourceWidth / sourceHeight;
  if (sourceAspect > targetAspect) {
    const sw = sourceHeight * targetAspect;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / targetAspect;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

export function cropCanvasToWindow(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  frame: WindowFrame,
): HTMLCanvasElement {
  const target = printWindowPixels(frame);
  const crop = coverCropSource(sourceWidth, sourceHeight, target.width / target.height);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, target.width, target.height);
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("jpeg"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Longest side 480. The landing signs this file and never the print photo. */
export function canvasToThumb(source: CanvasImageSource, width: number, height: number, edge = 480): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("canvas"));
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return encodeThumb(
    (type, quality) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality)),
  );
}

/** Thumbnail quality for both WebP and the JPEG fallback. */
export const THUMB_QUALITY = 0.8;

/**
 * WebP when the browser can encode it. iPhone browsers cannot: they quietly
 * return a PNG (about 200 KB for a thumbnail), so the thumbnail is encoded as
 * JPEG instead (about 30 KB). The file keeps its fixed name; its content type
 * says which format it is.
 */
export async function encodeThumb(
  encode: (type: string, quality: number) => Promise<Blob | null>,
): Promise<Blob> {
  const webp = await encode("image/webp", THUMB_QUALITY);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", THUMB_QUALITY);
  if (jpeg) return jpeg;
  if (webp) return webp;
  throw new Error("thumb");
}

export async function blobToThumb(blob: Blob, edge = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await canvasToThumb(bitmap, bitmap.width, bitmap.height, edge);
  } finally {
    bitmap.close();
  }
}
