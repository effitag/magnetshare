import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ensureGuestSession,
  getEventCardBySlug,
  getPublishedFrameWindow,
  listOwnPrintJobs,
  signedMediaUrl,
  subscribeOwnPrintJobs,
} from "@/services/api";
import type { PrintJob } from "@/services/types";
import { MagnetCamera } from "./MagnetCamera";
import type { CameraFrame } from "./MagnetFrame";
import { GuestQuiet } from "../GuestQuiet";

type Ready = {
  eventId: string;
  quota: number;
  guestId: string;
  frame: CameraFrame;
  overlayUrl: string | null;
  jobs: PrintJob[];
};

function upsert(jobs: PrintJob[], job: PrintJob): PrintJob[] {
  const next = jobs.some((row) => row.id === job.id)
    ? jobs.map((row) => (row.id === job.id ? job : row))
    : [job, ...jobs];
  return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function magnetsLeft(quota: number, jobs: PrintJob[]): number {
  const used = jobs
    .filter((job) => job.status !== "rejected")
    .reduce((sum, job) => sum + Number(job.copies ?? 0), 0);
  return Math.max(0, quota - used);
}

export function CameraPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState<Ready | null>(null);
  const [note, setNote] = useState<"missing" | "closed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    getEventCardBySlug(slug)
      .then(async (card) => {
        if (cancelled) return;
        if (!card) {
          setNote("missing");
          return;
        }
        if (card.status === "closed") {
          setNote("closed");
          return;
        }
        if (!card.frame_id) {
          setNote("missing");
          return;
        }
        const guestId = await ensureGuestSession();
        const frameRow = await getPublishedFrameWindow(card.frame_id);
        if (!frameRow || !card.screen_path) {
          setNote("missing");
          return;
        }
        const [overlayUrl, jobs] = await Promise.all([
          signedMediaUrl(card.screen_path),
          listOwnPrintJobs(card.id),
        ]);
        if (cancelled) return;
        const next: Ready = {
          eventId: card.id,
          quota: card.print_quota,
          guestId,
          overlayUrl,
          jobs,
          frame: {
            widthMm: frameRow.width_mm,
            heightMm: frameRow.height_mm,
            windowX: frameRow.window_x,
            windowY: frameRow.window_y,
            windowW: frameRow.window_w,
            windowH: frameRow.window_h,
          },
        };
        setReady(next);
        const unsubscribe = subscribeOwnPrintJobs(card.id, guestId, (job) => {
          setReady((current) => (current ? { ...current, jobs: upsert(current.jobs, job) } : current));
        });
        if (cancelled) unsubscribe();
        else stop = unsubscribe;
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [slug]);

  if (error) return <main className="guest-stage px-5 pt-10 text-base text-primary">{error}</main>;
  if (note) return <GuestQuiet mode={note} />;
  if (!ready) return <main className="guest-stage px-5 pt-10 text-base text-ink">טוענים…</main>;

  return (
    <MagnetCamera
      eventId={ready.eventId}
      guestId={ready.guestId}
      frame={ready.frame}
      overlayUrl={ready.overlayUrl}
      remaining={magnetsLeft(ready.quota, ready.jobs)}
      jobs={ready.jobs}
      onClose={() => navigate(`/e/${slug}`)}
      onSent={() => {
        void listOwnPrintJobs(ready.eventId).then((jobs) => {
          setReady((current) => (current ? { ...current, jobs } : current));
        });
      }}
    />
  );
}
