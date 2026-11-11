import { useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { countMagnetsLeft, thumbPathFromPhoto } from "@/lib/magnets";
import {
  SIGN_IN_WAIT,
  ensureGuestSession,
  getEventCardBySlug,
  getPublishedFrameWindow,
  listOwnPrintJobs,
  signedMediaUrl,
} from "@/services/api";
import type { PrintJob } from "@/services/types";
import { inAppBrowser } from "./browser";
import { GuestLanding, type GuestFrame } from "./GuestLanding";
import type { GuestShot } from "./MagnetMeter";
import { thumbUrls, useOwnMagnets } from "./useOwnMagnets";
import { useOutboxResume } from "./useOutboxResume";

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(year, month - 1, day));
}

async function loadFrame(id: string | null, screen: string | null): Promise<GuestFrame | null> {
  if (!id) return null;
  try {
    const row = await getPublishedFrameWindow(id);
    if (!row) return null;
    const overlayUrl = screen ? await signedMediaUrl(screen, { width: 480, resize: "contain" }) : null;
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
  } catch {
    return null;
  }
}

async function shotsFrom(jobs: PrintJob[]): Promise<GuestShot[]> {
  const ordered = [...jobs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return Promise.all(
    ordered.map(async (job) => {
      const path = job.storage_path ? thumbPathFromPhoto(job.storage_path) : null;
      const url = path ? await thumbUrls.get(path) : null;
      return { id: job.id, url, status: job.status, frameId: job.frame_id };
    }),
  );
}

type LiveEvent = {
  eventId: string;
  guestId: string;
  quota: number;
  title: string;
  when: string | null;
  coverUrl: string | null;
  landscape: GuestFrame | null;
  portrait: GuestFrame | null;
  jobs: PrintJob[];
  shots: GuestShot[];
};

export function GuestPage() {
  const { slug = "" } = useParams();
  const [view, setView] = useState<"loading" | "missing" | "closed" | "live">("loading");
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const toTop = () => window.scrollTo(0, 0);
    window.addEventListener("pageshow", toTop);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("pageshow", toTop);
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setView("loading");
    setLive(null);
    setWaiting(false);
    getEventCardBySlug(slug)
      .then(async (card) => {
        if (cancelled) return;
        if (!card) {
          setView("missing");
          return;
        }
        if (card.status === "closed") {
          setView("closed");
          return;
        }
        const guestId = await ensureGuestSession({ onWait: () => setWaiting(true) });
        const [jobs, cover, land, port] = await Promise.all([
          listOwnPrintJobs(card.id).catch(() => [] as PrintJob[]),
          card.cover_path ? signedMediaUrl(card.cover_path, { width: 800, resize: "cover" }) : Promise.resolve(null),
          loadFrame(card.frame_id, card.screen_path),
          loadFrame(card.frame_portrait_id, card.screen_path_portrait),
        ]);
        const shots = await shotsFrom(jobs);
        if (cancelled) return;
        setLive({
          eventId: card.id,
          guestId,
          quota: card.print_quota,
          title: card.title,
          when: dateLabel(card.event_date),
          coverUrl: cover,
          landscape: land,
          portrait: port,
          jobs,
          shots,
        });
        setView("live");
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <main className="guest-stage px-5 pt-10 text-base text-primary">{error}</main>;
  }
  if (view === "loading") {
    return <main className="guest-stage px-5 pt-10 text-base text-ink">{waiting ? SIGN_IN_WAIT : "טוענים…"}</main>;
  }
  if (view === "live" && live) {
    return <GuestLive key={live.eventId} event={live} cameraTo={`/e/${slug}/camera`} />;
  }
  return (
    <GuestLanding
      mode={view}
      title=""
      dateLabel={null}
      coverUrl={null}
      magnetsLeft={0}
      shots={[]}
      landscape={null}
      portrait={null}
      inApp={inAppBrowser(navigator.userAgent)}
      cameraTo={`/e/${slug}/camera`}
    />
  );
}

/** The live landing: the guest's magnets stay current through useOwnMagnets, without Realtime. */
function GuestLive({ event, cameraTo }: { event: LiveEvent; cameraTo: string }) {
  const { jobs, refresh } = useOwnMagnets(event.eventId, event.jobs);
  // A photo that a reload or a closed tab interrupted is sent now.
  const notice = useOutboxResume(event.eventId, event.guestId, () => {
    void refresh().catch(() => undefined);
  });
  const [magnets, setMagnets] = useState(() => ({
    shots: event.shots,
    left: countMagnetsLeft(event.quota, event.jobs),
  }));

  useEffect(() => {
    if (jobs === event.jobs) return;
    let cancelled = false;
    void shotsFrom(jobs).then((shots) => {
      if (!cancelled) setMagnets({ shots, left: countMagnetsLeft(event.quota, jobs) });
    });
    return () => {
      cancelled = true;
    };
  }, [jobs, event.jobs, event.quota]);

  return (
    <GuestLanding
      mode="live"
      title={event.title}
      dateLabel={event.when}
      coverUrl={event.coverUrl}
      magnetsLeft={magnets.left}
      shots={magnets.shots}
      landscape={event.landscape}
      portrait={event.portrait}
      inApp={inAppBrowser(navigator.userAgent)}
      cameraTo={cameraTo}
      notice={notice}
    />
  );
}
