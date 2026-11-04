import { AppError } from "@/lib/errors";

const MAX_EDGE = 1600;
const MAX_BYTES = 4_000_000;

export async function prepareCover(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new AppError("אפשר להעלות רק תמונה. בחרו קובץ JPG או PNG.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new AppError("הדפדפן לא הצליח לעבד את התמונה. נסו קובץ אחר.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });
  if (!blob) {
    throw new AppError("התמונה לא הוכנה להעלאה. נסו קובץ אחר.");
  }
  if (blob.size > MAX_BYTES) {
    throw new AppError("התמונה גדולה מדי גם אחרי הכיווץ. בחרו תמונה קלה יותר.");
  }
  return blob;
}
