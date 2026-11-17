/** File names for the print station's output, one file per copy. */
export function printFileName(eventSlug: string, jobId: string, runId: string, copy: number, copies: number): string {
  const safe = eventSlug.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "event";
  return `${safe}_${jobId.slice(0, 8)}_${runId.slice(0, 8)}_${copy}of${copies}.jpg`;
}

/** Copies the operator may choose for one print. */
export const MAX_COPIES = 5;

export function clampStationCopies(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_COPIES, Math.max(1, Math.floor(value)));
}
