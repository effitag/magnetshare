import { useEffect, useState } from "react";
import { releasePrint, startPrint } from "@/services/api";
import type { StationFrame, StationJob } from "@/services/types";
import { composePrintSheet } from "./drawMagnet";
import { downloadFiles, ensureFolderPermission, savedHotFolder, writeToFolder, type StationSettings } from "./output";
import { printFileName } from "./printFiles";
import { CopiesStepper, Dialog } from "./StationParts";
import { button } from "./stationJobs";

type Props = {
  job: StationJob;
  frame: StationFrame;
  eventSlug: string;
  kind: "print" | "reprint";
  initialCopies: number;
  settings: StationSettings;
  onClose: () => void;
  onDone: () => void;
};

const TITLE = { print: "הדפסה", reprint: "הדפסה מחדש (במקום הדפסה פגומה)" } as const;

/**
 * Composes the print file, shows exactly what will print, and sends it: the
 * magnet is locked for this station (start_print), then one file per copy goes
 * to the hot folder or to downloads. If the files cannot be written, the
 * print is cancelled (release_print) and the magnet goes back to the queue.
 */
export function PrintDialog({ job, frame, eventSlug, kind, initialCopies, settings, onClose, onDone }: Props) {
  const [copies, setCopies] = useState(initialCopies);
  const [sheet, setSheet] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    if (!job.storagePath) {
      setError("לתמונה הזו אין קובץ להדפסה.");
      return undefined;
    }
    composePrintSheet(job.storagePath, frame)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSheet({ blob, url });
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message || "לא הצלחנו להכין את קובץ ההדפסה.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [job.storagePath, frame]);

  async function send() {
    if (!sheet || sending) return;
    if (!settings.name.trim()) {
      setError("קבעו שם לעמדה במסך העמדה לפני הדפסה.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const folder = settings.output === "folder" ? await savedHotFolder() : null;
      if (settings.output === "folder") {
        if (!folder) throw new Error("בחרו את תיקיית ההדפסה במסך העמדה.");
        await ensureFolderPermission(folder);
      }
      const runId = await startPrint({ jobId: job.id, copies, station: settings.name, kind, printer: settings.printer || null });
      const files = Array.from({ length: copies }, (_, index) => ({
        name: printFileName(eventSlug, job.id, runId, index + 1, copies),
        blob: sheet.blob,
      }));
      try {
        if (folder) await writeToFolder(folder, files);
        else downloadFiles(files);
      } catch {
        await releasePrint(runId).catch(() => undefined);
        throw new Error("לא הצלחנו לשמור את קובץ ההדפסה. ההדפסה בוטלה והמגנט חזר לתור.");
      }
      onDone();
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message === "folder_permission" ? "Chrome לא אישר כתיבה לתיקיית ההדפסה." : message || "לא הצלחנו להדפיס.");
      setSending(false);
    }
  }

  return (
    <Dialog title={TITLE[kind]} onClose={onClose}>
      <div className="flex justify-center rounded-2xl border-[3px] border-ink bg-sticker p-2">
        {sheet ? (
          <img src={sheet.url} alt="קובץ ההדפסה" className="max-h-[50svh] w-auto max-w-full" />
        ) : (
          <p className="py-16 text-base">{error ? "" : "מכינים את קובץ ההדפסה…"}</p>
        )}
      </div>
      <p className="mt-2 text-base">דף זמני: מגנט אחד לדף 4×6 עם סימני חיתוך, עד שתיקבע מדיית ההדפסה.</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base">עותקים</span>
        <CopiesStepper value={copies} onChange={setCopies} label="עותקים" />
      </div>
      <p className="mt-2 text-base">
        {settings.name ? `עמדה: ${settings.name}` : "לא נקבע שם לעמדה"} · {settings.output === "folder" ? "לתיקיית ההדפסה" : "להורדות"}
      </p>
      {error ? (
        <p className="mt-2 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={`${button} mt-4 w-full bg-pop font-display text-xl`}
        disabled={!sheet || sending}
        onClick={() => void send()}
        autoFocus
      >
        {sending ? "שולחים…" : "שליחה למדפסת"}
      </button>
    </Dialog>
  );
}
