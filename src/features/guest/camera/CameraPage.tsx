import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  SIGN_IN_WAIT,
  ensureGuestSession,
  getEventCardBySlug,
  getPublishedFrameWindow,
  listOwnPrintJobs,
  signedMediaUrl,
} from "@/services/api";
import type { PrintJob } from "@/services/types";
import { GuestQuiet } from "../GuestQuiet";
import { useEventRecheck } from "../useEventRecheck";
import { useOwnMagnets } from "../useOwnMagnets";
import { useOutboxResume } from "../useOutboxResume";
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
  const [note, setNote] = useState<"missing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventCardBySlug(slug)
      .then(async (card) => {
        if (cancelled) return;
        if (!card) {
          setNote("missing");
          return;
        }
        if (card.status === "closed") {
          // The event page shows the closed event's thank-you screen.
          navigate(`/e/${slug}`, { replace: true });
          return;
        }
        const guestId = await ensureGuestSession({ onWait: () => setWaiting(true) });
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
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  if (error) return <main className="guest-stage px-5 pt-10 text-base text-primary">{error}</main>;
  if (note) return <GuestQuiet mode={note} />;
  if (!ready) {
    return <main className="guest-stage px-5 pt-10 text-base text-ink">{waiting ? SIGN_IN_WAIT : "טוענים…"}</main>;
  }

  return (
    <CameraLive
      key={ready.eventId}
      eventId={ready.eventId}
      quota={ready.quota}
      guestId={ready.guestId}
      landscape={ready.landscape}
      portrait={ready.portrait}
      jobs={ready.jobs}
      slug={slug}
      onClose={() => navigate(`/e/${slug}`)}
      onEventClosed={() => navigate(`/e/${slug}`, { replace: true })}
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
  slug,
  onClose,
  onEventClosed,
}: {
  eventId: string;
  quota: number;
  guestId: string;
  landscape: CameraChoice | null;
  portrait: CameraChoice | null;
  jobs: PrintJob[];
  slug: string;
  onClose: () => void;
  onEventClosed: () => void;
}) {
  // Back on the camera after the admin closed the event: go to the thank-you screen.
  useEventRecheck(slug, onEventClosed);
  // The guest's magnets stay current without Realtime: a read right after a
  // send, on return to the page, and every ~20 s while a magnet is pending.
  const magnets = useOwnMagnets(eventId, jobs);
  const { refresh, catchUp } = magnets;
  // A photo that a reload interrupted is sent in the background; the counter follows.
  useOutboxResume(eventId, guestId, () => {
    void refresh().catch(() => undefined);
  });

  const refreshJobs = useCallback(async () => {
    await ensureGuestSession();
    return catchUp();
  }, [catchUp]);

  return (
    <MagnetCamera
      eventId={eventId}
      guestId={guestId}
      quota={quota}
      landscape={landscape}
      portrait={portrait}
      jobs={magnets.jobs}
      onClose={onClose}
      onPrinted={refresh}
      onRefreshJobs={refreshJobs}
      onEventClosed={onEventClosed}
    />
  );
}
