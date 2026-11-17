import type { PrintRun } from "@/services/types";

/** The station's button style (theme tokens only). */
export const button =
  "inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base text-ink disabled:opacity-50";

/** Printed copies that count (first prints and added copies); reprints replace and do not count. */
export function countedCopies(runs: PrintRun[], jobId: string): number {
  return runs
    .filter((run) => run.jobId === jobId && run.kind === "print" && run.status === "printed")
    .reduce((sum, run) => sum + run.copies, 0);
}

/** The print of this magnet that is still waiting for "הודפס" or "נכשל", if any. */
export function openRun(runs: PrintRun[], jobId: string): PrintRun | null {
  return runs.find((run) => run.jobId === jobId && run.status === "sent") ?? null;
}
