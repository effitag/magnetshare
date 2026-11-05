// A template from a ready frame picture (a PNG the user designed or bought): the picture becomes a
// locked layer over the whole magnet, and its transparent window becomes the photo area.
import { photoArea } from './layoutKit';
import { presetSize, SIZE_PRESETS } from './presets';
import { createBackground, createTemplateDoc, newId } from './schema';
import { roundMm } from './units';

const OPAQUE_BELOW = 16; // alpha under this counts as transparent
const MIN_WINDOW = 0.05; // the window must cover at least 5% of the picture

/** The standard magnet whose proportions are closest to the picture's. */
export function closestPreset(width, height) {
  const ratio = width / height;
  const options = SIZE_PRESETS.flatMap((p) => [
    { sizeId: p.id, orientation: 'landscape', ratio: p.long / p.short },
    { sizeId: p.id, orientation: 'portrait', ratio: p.short / p.long },
  ]);
  const best = options.reduce((a, b) => (Math.abs(Math.log(b.ratio / ratio)) < Math.abs(Math.log(a.ratio / ratio)) ? b : a));
  return { sizeId: best.sizeId, orientation: best.orientation };
}

/**
 * The largest transparent region of the picture (its photo window), as fractions of its size:
 * { x, y, width, height }, or null when the picture has no real window.
 * @param image  { width, height, data } as in ImageData (RGBA bytes)
 */
export function findWindow({ width, height, data }) {
  const seen = new Uint8Array(width * height);
  const isClear = (i) => data[i * 4 + 3] < OPAQUE_BELOW;
  let best = null;
  const stack = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !isClear(start)) continue;
    // Flood fill one transparent region and keep its bounding box.
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const next = [x > 0 && i - 1, x < width - 1 && i + 1, y > 0 && i - width, y < height - 1 && i + width];
      for (const n of next) {
        if (n !== false && !seen[n] && isClear(n)) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (!best || count > best.count) best = { count, minX, minY, maxX, maxY };
  }
  if (!best || best.count < MIN_WINDOW * width * height) return null;
  return {
    x: best.minX / width,
    y: best.minY / height,
    width: (best.maxX - best.minX + 1) / width,
    height: (best.maxY - best.minY + 1) / height,
  };
}

/**
 * The template for a frame picture. `window` (from findWindow) places the photo area; without one
 * it gets a standard place the user can move.
 */
export function frameImportDoc(name, { width, height }, src, window) {
  const preset = closestPreset(width, height);
  const size = presetSize(preset.sizeId, preset.orientation);
  const { widthMm: W, heightMm: H } = size;
  const box = window ?? { x: 0.06, y: 0.06, width: 0.88, height: 0.7 };
  const photo = photoArea({ x: box.x * W, y: box.y * H, width: box.width * W, height: box.height * H });
  const frame = {
    id: newId(),
    type: 'image',
    name: 'מסגרת',
    visible: true,
    // Locked, so clicks reach the photo area through the window. Unlock it in the layers list to move it.
    locked: true,
    x: 0,
    y: 0,
    width: roundMm(W),
    height: roundMm(H),
    rotation: 0,
    opacity: 1,
    src,
  };
  return { ...createTemplateDoc(name), size, elements: [createBackground(), photo, frame] };
}
