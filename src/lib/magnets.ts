import type { PrintJob, PrintJobStatus } from "@/services/types";

export const THUMB_EDGE = 480;

export const PRINT_STATUS_LABEL: Record<PrintJobStatus, string> = {
  queued: "בתור",
  printing: "בהדפסה",
  ready: "מוכן לאיסוף",
  delivered: "נמסר",
  rejected: "לא אושר",
};

/** Photos the guest sent and that were not rejected: what the per-guest quota counts (copies do not count). */
export function countPhotosUsed(jobs: { status: string; copies?: number }[]): number {
  return jobs.filter((job) => job.status !== "rejected").length;
}

/** Photos the guest can still send. The quota counts photos, one print job each, whatever its copies. */
export function countPhotosLeft(quota: number, jobs: { status: string; copies?: number }[]): number {
  return Math.max(0, quota - countPhotosUsed(jobs));
}

export function photoLine(left: number): string {
  if (left <= 0) return "ניצלתם את כל התמונות, תודה!";
  if (left === 1) return "נשארה לכם תמונה אחת";
  return `נשארו לכם ${left} תמונות`;
}

/** The sent screen's title: one magnet, or N copies of the photo. */
export function sentTitle(copies: number): string {
  return copies > 1 ? `${copies} מגנטים בדרך אליכם!` : "המגנט בדרך אליכם!";
}

/** The "×N" mark on a photo with copies, or null for a single magnet. */
export function copiesMark(copies: number): string | null {
  return copies > 1 ? `×${copies}` : null;
}

/** The copies a guest may pick for one photo: 1 up to the event's maximum (1 to 5). */
export function clampCopies(value: number, maxCopies: number): number {
  const max = Math.min(5, Math.max(1, Math.floor(maxCopies || 1)));
  return Math.min(max, Math.max(1, Math.floor(value || 1)));
}

/** Landing never loads the print file. The thumb shares the photo's name prefix (send id, or a timestamp on older photos). */
export function thumbPathFromPhoto(storagePath: string): string {
  const slash = storagePath.lastIndexOf("/");
  const dir = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const stamp = name.split("_")[0];
  const thumb = `${stamp}_thumb.webp`;
  return dir ? `${dir}/${thumb}` : thumb;
}

export function newestJob(jobs: PrintJob[]): PrintJob | null {
  if (!jobs.length) return null;
  return [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export type FrameSlot = "landscape" | "portrait";

export function slotForSize(widthMm: number, heightMm: number): FrameSlot {
  return Number(widthMm) > Number(heightMm) ? "landscape" : "portrait";
}
