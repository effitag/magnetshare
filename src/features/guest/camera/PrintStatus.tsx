import type { PrintJob, PrintJobStatus } from "@/services/types";
import { Champagne } from "./SendIllustrations";

const STATUS_LABEL: Record<PrintJobStatus, string> = {
  queued: "בתור",
  printing: "בהדפסה",
  ready: "מוכן",
  delivered: "נמסר",
  rejected: "לא יודפס",
};

type Props = {
  jobs: PrintJob[];
  remaining: number;
  onAgain: () => void;
  onClose: () => void;
};

export function PrintStatus({ jobs, remaining, onAgain, onClose }: Props) {
  return (
    <div className="cam-root bg-paper" dir="rtl" role="dialog" aria-modal="true" aria-label="המגנט נשלח">
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 pb-28 pt-16 text-center">
        <Champagne />
        <h1 className="font-display text-4xl leading-none text-ink">נשלח להדפסה</h1>
        <p className="text-base text-ink">
          {remaining > 0 ? `נשארו לכם ${remaining} מגנטים` : "זה המגנט האחרון שלכם"}
        </p>
        <ul className="mt-2 w-full max-w-sm space-y-2 text-start">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between rounded-2xl border-2 border-ink bg-sticker px-4 py-3 text-base">
              <span>{job.copies === 1 ? "מגנט אחד" : `${job.copies} מגנטים`}</span>
              <span>{STATUS_LABEL[job.status] ?? job.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
        {remaining > 0 ? (
          <button type="button" className="cam-send" onClick={onAgain}>עוד תמונה</button>
        ) : null}
        <button type="button" className="cam-text" onClick={onClose}>חזרה לאירוע</button>
      </div>
    </div>
  );
}
