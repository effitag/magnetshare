import { useEffect, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { MagnetFrame } from "@/features/guest/camera/MagnetFrame";
import { PRINT_STATUS_LABEL, thumbPathFromPhoto } from "@/lib/magnets";
import { SignedUrlCache } from "@/lib/ownMagnets";
import { signedMediaUrl } from "@/services/api";
import type { PrintRun, StationFrame, StationJob } from "@/services/types";
import { MAX_COPIES, clampStationCopies } from "./printFiles";
import { REJECT_REASONS, waitedLabel, type RejectReason } from "./stationErrors";
import { button, countedCopies, openRun } from "./stationJobs";

/** Thumbnails and frame screens for the station, each signed once. */
const stationUrls = new SignedUrlCache((path) => signedMediaUrl(path, { width: 480, resize: "contain" }));

function useSigned(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return undefined;
    }
    void stationUrls.get(path).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

/** The guest's photo in its frame, as the card shows it (screen-size images, not the print file). */
export function JobPreview({ job, frame, width }: { job: StationJob; frame: StationFrame | null; width: number }) {
  const thumb = useSigned(job.storagePath ? thumbPathFromPhoto(job.storagePath) : null);
  const screen = useSigned(frame?.screenPath ?? null);
  if (!frame) {
    return thumb ? <img src={thumb} alt="" className="w-full rounded-xl" /> : <div className="aspect-[4/3] w-full rounded-xl bg-paper" />;
  }
  return (
    <MagnetFrame frame={frame} overlayUrl={screen} width={width}>
      {thumb ? <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
    </MagnetFrame>
  );
}

export function CopiesStepper({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={`${button} min-w-11 px-0`}
        aria-label="פחות עותקים"
        disabled={value <= 1}
        onClick={() => onChange(clampStationCopies(value - 1))}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output className="min-w-8 text-center font-display text-2xl" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={`${button} min-w-11 px-0`}
        aria-label="עוד עותק"
        disabled={value >= MAX_COPIES}
        onClick={() => onChange(clampStationCopies(value + 1))}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

type CardProps = {
  job: StationJob;
  frame: StationFrame | null;
  runs: PrintRun[];
  now: number;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onKey?: (key: "print" | "reject") => void;
  children: ReactNode;
};

/** One magnet in a tab. Focusable: Enter prints, R rejects. */
export function JobCard({ job, frame, runs, now, selected, onSelect, onKey, children }: CardProps) {
  const printed = countedCopies(runs, job.id);
  const open = openRun(runs, job.id);
  return (
    <li
      className={`sticker-card flex flex-col gap-3 bg-sticker p-3 text-ink ${selected ? "outline outline-[3px] outline-pop" : ""}`}
      tabIndex={onKey ? 0 : undefined}
      aria-label={`מגנט, ${PRINT_STATUS_LABEL[job.status]}`}
      onKeyDown={(event) => {
        if (!onKey || event.target !== event.currentTarget) return;
        if (event.key === "Enter") onKey("print");
        if (event.code === "KeyR") onKey("reject");
      }}
    >
      <JobPreview job={job} frame={frame} width={260} />
      <div className="flex flex-wrap items-center gap-2 text-base">
        <span className="magnet-sticker">{PRINT_STATUS_LABEL[job.status]}</span>
        <span>{waitedLabel(job.createdAt, now)}</span>
        {printed ? <span>· הודפסו {printed}</span> : null}
        {open ? <span>· {open.kind === "reprint" ? "הדפסה מחדש" : "בהדפסה"} ({open.copies}) ב{open.station}</span> : null}
        {onSelect ? (
          <label className="ms-auto inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={Boolean(selected)} onChange={(event) => onSelect(event.target.checked)} />
            לסמן
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[100svh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-[3px] border-ink bg-paper p-4 text-ink sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl leading-none">{title}</h2>
          <button type="button" className="min-h-11 px-2 text-base" onClick={onClose}>
            סגירה
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function RejectDialog({ onReject, onClose }: { onReject: (reason: RejectReason) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title="דחיית המגנט" onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base">סיבה</legend>
        {REJECT_REASONS.map((option) => (
          <label key={option.code} className="flex min-h-11 items-center gap-3 rounded-2xl border-[3px] border-ink bg-sticker px-3 text-base">
            <input type="radio" name="reject-reason" value={option.code} checked={reason === option.code} onChange={() => setReason(option.code)} />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p className="mt-3 text-base">האורח יוכל לשלוח תמונה אחרת במקומה.</p>
      {error ? (
        <p className="mt-2 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={`${button} mt-4 w-full bg-primary text-primary-ink`}
        disabled={!reason || pending}
        onClick={async () => {
          if (!reason) return;
          setPending(true);
          setError(null);
          try {
            await onReject(reason);
            onClose();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "לא הצלחנו לדחות.");
            setPending(false);
          }
        }}
      >
        {pending ? "דוחים…" : "דחייה"}
      </button>
    </Dialog>
  );
}
