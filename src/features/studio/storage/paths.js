// Where a template's files live in cloud storage (bucket studio-files, one library shared by
// all admins):
//   {templateId}/assets/<file>     images used by the template
//   {templateId}/thumbnail.png     library preview
// Inside template.json an image is referenced by the part after the template id ("assets/leaf.svg"),
// so a zip backup has exactly the same layout.
import { splitExtension } from '@/features/studio/model/names';
import { UnsupportedImageError } from './errors';

export const PREVIEW_FILE = 'preview.png';
export const OVERLAY_FILE = 'overlay.png';
export const SCREEN_FILE = 'screen.webp';
export const FRAME_FILES = [OVERLAY_FILE, PREVIEW_FILE, SCREEN_FILE];
export const THUMBNAIL_FILE = PREVIEW_FILE;

const FRAME_OBJECT = new RegExp(
  `^frames/[0-9a-f-]{36}/(?:${FRAME_FILES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
  'i',
);

export function isFrameObjectPath(key) {
  return FRAME_OBJECT.test(key ?? '');
}

export const frameFolder = (frameId) => `frames/${frameId}`;
export const frameObjectPath = (frameId, fileName) => `${frameFolder(frameId)}/${fileName}`;

const EXT_BY_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};
const TYPE_BY_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

export const templatePrefix = (templateId) => templateId;

/** MIME type of an image file, from its type or, failing that, its extension. Null if unsupported. */
export function imageTypeOf(fileName, declaredType) {
  if (EXT_BY_TYPE[declaredType]) return declaredType;
  return TYPE_BY_EXT[splitExtension(fileName ?? '').ext] ?? null;
}

/**
 * Storage keys must be plain ASCII, so the name is reduced to letters, digits, "-" and "_".
 * A Hebrew name becomes "image". Clashes get "-2", "-3"…
 */
export function assetFileName(originalName, type, takenNames = []) {
  const ext = EXT_BY_TYPE[type];
  if (!ext) throw new UnsupportedImageError(type);
  const stem =
    splitExtension(originalName ?? '')
      .stem.normalize('NFKD')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'image';
  const taken = new Set(takenNames.map((n) => n.toLowerCase()));
  let name = `${stem}${ext}`;
  for (let i = 2; taken.has(name.toLowerCase()); i += 1) name = `${stem}-${i}${ext}`;
  return name;
}
