// Adding an image file to the open template: upload it to the template's cloud folder.
import { isNetworkError } from '@/features/studio/storage/errors';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** Uploads a picked image to the template's cloud folder and returns { path, img }. */
export async function importImage({ repo, templateId, assets }, file) {
  const path = await repo.uploadAsset(templateId, file);
  const img = await assets.put(path, file);
  return { path, img };
}

/** Hebrew message for a failed image upload. */
export function imageUploadMessage(err) {
  if (err?.name === 'UnsupportedImageError') return 'אפשר להוסיף רק קובצי PNG, JPG, WEBP או SVG.';
  if (isNetworkError(err)) return 'אין חיבור לאינטרנט. אפשר להוסיף תמונה כשהחיבור יחזור.';
  if (/exceeded|too large|payload/i.test(err?.message ?? '') || err?.statusCode === '413') return 'הקובץ גדול מדי. אפשר עד 20MB.';
  return 'לא הצלחתי להוסיף את התמונה. נסה שוב.';
}
