import { countMagnetsLeft, magnetLine, newestJob, PRINT_STATUS_LABEL } from "@/lib/magnets";
import type { PrintJob } from "@/services/types";
import { MagnetIcons } from "../MagnetMeter";
import { MagnetFrame, type CameraFrame } from "./MagnetFrame";

type Props = {
  jobs: PrintJob[];
  quota: number;
  photoUrl: string;
  frame: CameraFrame;
  overlayUrl: string | null;
  onAgain: () => void;
  onClose: () => void;
};

export function PrintStatus({ jobs, quota, photoUrl, frame, overlayUrl, onAgain, onClose }: Props) {
  const left = countMagnetsLeft(quota, jobs);
  const used = jobs
    .filter((job) => job.status !== "rejected")
    .reduce((sum, job) => sum + Number(job.copies ?? 0), 0);
  const latest = newestJob(jobs);
  const width = Math.min(280, typeof window !== "undefined" ? window.innerWidth - 72 : 280);

  return (
    <div className="cam-root" dir="rtl" role="dialog" aria-modal="true" aria-label="המגנט בדרך">
      <div className="cam-sheet">
        <div className="cam-sent-card">
          <MagnetFrame frame={frame} overlayUrl={overlayUrl} width={width}>
            <img src={photoUrl} alt="התמונה שנשלחה" className="absolute inset-0 h-full w-full object-fill" />
          </MagnetFrame>
          {latest ? <p className="magnet-sticker">{PRINT_STATUS_LABEL[latest.status]}</p> : null}
        </div>
        <h1 className="font-display text-4xl leading-none text-ink">המגנט בדרך אליכם!</h1>
        {left > 0 ? (
          <>
            <MagnetIcons used={used} left={left} />
            <p className="text-base text-ink">{magnetLine(left)}</p>
          </>
        ) : (
          <p className="text-base text-ink">ניצלתם את כל המגנטים, תודה!</p>
        )}
      </div>
      <div className="cam-dock">
        {left > 0 ? (
          <button type="button" className="cam-send" onClick={onAgain}>
            עוד תמונה
          </button>
        ) : null}
        <button type="button" className="cam-text" onClick={onClose}>
          חזרה לאירוע
        </button>
      </div>
    </div>
  );
}
