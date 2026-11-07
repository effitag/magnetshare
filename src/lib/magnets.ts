import type { PrintJob, PrintJobStatus } from "@/services/types";

export const THUMB_EDGE = 480;

export const PRINT_STATUS_LABEL: Record<PrintJobStatus, string> = {
  queued: "בתור",
  printing: "בהדפסה",
  ready: "מוכן לאיסוף",
  delivered: "נמסר",
  rejected: "לא אושר",
};

export function countMagnetsLeft(quota: number, jobs: { copies: number; status: string }[]): number {
  const used = jobs
    .filter((job) => job.status !== "rejected")
    .reduce((sum, job) => sum + Number(job.copies ?? 0), 0);
  return Math.max(0, quota - used);
}

export function magnetLine(left: number): string {
  if (left <= 0) return "ניצלתם את כל המגנטים, תודה!";
  if (left === 1) return "נשאר לכם מגנט אחד";
  return `נשארו לכם ${left} מגנטים`;
}

/** Landing never loads the print file. The thumb shares the photo's timestamp. */
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
