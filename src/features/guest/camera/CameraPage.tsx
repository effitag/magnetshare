import { useCallback, useEffect, useState } from "react";
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
import { GuestQuiet } from "../GuestQuiet";
import { MagnetCamera, type CameraChoice } from "./MagnetCamera";

type Ready = {
  eventId: string;
  quota: number;
  guestId: string;
  landscape: CameraChoice | null;
  portrait: CameraChoice | null;
  jobs: PrintJob[];
};

async function loadChoice(id: string | null, screen: string | null): Promise<CameraChoice | null> {
  if (!id || !screen) return null;
  const row = await getPublishedFrameWindow(id);
  if (!row) return null;
  const overlayUrl = await signedMediaUrl(screen);
  return {
    id,
    overlayUrl,
    frame: {
      widthMm: row.width_mm,
      heightMm: row.height_mm,
      windowX: row.window_x,
      windowY: row.window_y,
      windowW: row.window_w,
      windowH: row.window_h,
    },
  };
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
        const guestId = await ensureGuestSession();
        const [landscape, portrait, jobs] = await Promise.all([
          loadChoice(card.frame_id, card.screen_path),
          loadChoice(card.frame_portrait_id, card.screen_path_portrait),
          listOwnPrintJobs(card.id),
        ]);
        if (cancelled) return;
        if (!landscape && !portrait) {
          setNote("missing");
          return;
        }
        const next: Ready = { eventId: card.id, quota: card.print_quota, guestId, landscape, portrait, jobs };
        setReady(next);
        const unsubscribe = subscribeOwnPrintJobs(card.id, guestId, () => {
          void listOwnPrintJobs(card.id).then((rows) => {
            if (!cancelled) setReady((current) => (current ? { ...current, jobs: rows } : current));
          });
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
    <CameraLive
      eventId={ready.eventId}
      quota={ready.quota}
      guestId={ready.guestId}
      landscape={ready.landscape}
      portrait={ready.portrait}
      jobs={ready.jobs}
      onJobs={(jobs) => setReady((current) => (current ? { ...current, jobs } : current))}
      onClose={() => navigate(`/e/${slug}`)}
    />
  );
}

function CameraLive({
  eventId,
  quota,
  guestId,
  landscape,
  portrait,
  jobs,
  onJobs,
  onClose,
}: {
  eventId: string;
  quota: number;
  guestId: string;
  landscape: CameraChoice | null;
  portrait: CameraChoice | null;
  jobs: PrintJob[];
  onJobs: (jobs: PrintJob[]) => void;
  onClose: () => void;
}) {
  const reloadJobs = useCallback(async () => {
    const next = await listOwnPrintJobs(eventId);
    onJobs(next);
    return next;
  }, [eventId, onJobs]);

  const refreshJobs = useCallback(async () => {
    await ensureGuestSession();
    return reloadJobs();
  }, [reloadJobs]);

  return (
    <MagnetCamera
      eventId={eventId}
      guestId={guestId}
      quota={quota}
      landscape={landscape}
      portrait={portrait}
      jobs={jobs}
      onClose={onClose}
      onPrinted={reloadJobs}
      onRefreshJobs={refreshJobs}
    />
  );
}
