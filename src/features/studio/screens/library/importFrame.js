// "ייבוא מסגרת": a new template from a frame picture the user already has (PNG with a transparent window).
import { findWindow, frameImportDoc } from '@/features/studio/model/frameImport';
import { splitExtension } from '@/features/studio/model/names';

const ANALYSIS_PX = 400; // the window is found on a copy at most this many pixels wide or tall
const PENDING = 'pending-upload';

async function decode(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Picture size and its transparent window (fractions), or window null. */
async function analyze(file) {
  const img = await decode(file);
  // SVGs without a width and height report 0; treat them as the regular magnet.
  const width = img.naturalWidth || 1000;
  const height = img.naturalHeight || 750;
  const scale = Math.min(1, ANALYSIS_PX / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { width, height, window: findWindow(ctx.getImageData(0, 0, canvas.width, canvas.height)) };
}

/** Creates the template in the cloud; returns { id, foundWindow }. */
export async function importFrameFile(repo, file) {
  const { width, height, window } = await analyze(file);
  const doc = frameImportDoc(splitExtension(file.name).stem, { width, height }, PENDING, window);
  const path = await repo.uploadAsset(doc.id, file);
  const ready = { ...doc, elements: doc.elements.map((el) => (el.src === PENDING ? { ...el, src: path } : el)) };
  const { id } = await repo.insert(ready);
  return { id, foundWindow: Boolean(window) };
}
