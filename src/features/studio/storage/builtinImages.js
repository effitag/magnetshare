// Images that ship with the app (Fluent Emoji in public/icons/emoji), used by ready-made frames.
// A frame refers to them as "emoji:<id>" until it becomes a template; then each one is uploaded
// into the template's own folder, like an image the user added.
import { emojiUrl } from '@/features/studio/icons/catalog';
import { BUILTIN_IMAGE_PREFIX } from '@/features/studio/model/layoutKit';

export const isBuiltinImage = (src) => typeof src === 'string' && src.startsWith(BUILTIN_IMAGE_PREFIX);

const idOf = (src) => src.slice(BUILTIN_IMAGE_PREFIX.length);

/** @returns Blob of the image file */
export async function fetchBuiltinImage(src, fetchFn = fetch) {
  const res = await fetchFn(emojiUrl(idOf(src)));
  if (!res.ok) throw new Error(`Built-in image ${src}: ${res.status}`);
  return res.blob();
}

/** Uploads every built-in image of `doc` into its template folder and returns the doc with real paths. */
export async function uploadBuiltinImages(repo, doc, fetchFn = fetch) {
  const uploaded = new Map(); // "emoji:id" → "assets/id.svg"
  const elements = [];
  for (const el of doc.elements) {
    if (el.type !== 'image' || !isBuiltinImage(el.src)) {
      elements.push(el);
      continue;
    }
    if (!uploaded.has(el.src)) {
      const blob = await fetchBuiltinImage(el.src, fetchFn);
      const file = new File([blob], `${idOf(el.src)}.svg`, { type: 'image/svg+xml' });
      uploaded.set(el.src, await repo.uploadAsset(doc.id, file));
    }
    elements.push({ ...el, src: uploaded.get(el.src) });
  }
  return { ...doc, elements };
}
