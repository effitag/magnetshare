import { useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { countPhotosLeft, thumbPathFromPhoto } from "@/lib/magnets";
import {
  SIGN_IN_WAIT,
  currentGuestId,
  ensureGuestSession,
  getEventCardBySlug,
  getPublishedFrameWindow,
  listOwnPrintJobs,
  signedMediaUrl,
} from "@/services/api";
import type { PrintJob } from "@/services/types";
import { inAppBrowser } from "./browser";
import { GuestClosed } from "./GuestClosed";
import { GuestLanding, type GuestFrame } from "./GuestLanding";
import type { GuestShot } from "./MagnetMeter";
import { useEventRecheck } from "./useEventRecheck";
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
      return { id: job.id, url, status: job.status, frameId: job.frame_id, copies: Number(job.copies) || 1 };
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

type ClosedEvent = {
  eventId: string;
  title: string;
  when: string | null;
  landscape: GuestFrame | null;
  portrait: GuestFrame | null;
  /** Null when this browser has no guest yet: nothing to show, and no new guest is made. */
  jobs: PrintJob[] | null;
  shots: GuestShot[];
};

export function GuestPage() {
  const { slug = "" } = useParams();
  const [view, setView] = useState<"loading" | "missing" | "closed" | "live">("loading");
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [closed, setClosed] = useState<ClosedEvent | null>(null);
  // Bumped when the event closes while the guest is on the page: the page loads again as closed.
  const [reload, setReload] = useState(0);
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
    setClosed(null);
    setWaiting(false);
    getEventCardBySlug(slug)
      .then(async (card) => {
        if (cancelled) return;
        if (!card) {
          setView("missing");
          return;
        }
        if (card.status === "closed") {
          // The guest's own magnets keep their status, read only. A browser
          // without a guest gets the thank-you screen without making one.
          const guestId = await currentGuestId();
          const [jobs, land, port] = await Promise.all([
            guestId ? listOwnPrintJobs(card.id).catch(() => [] as PrintJob[]) : Promise.resolve(null),
            loadFrame(card.frame_id, card.screen_path),
            loadFrame(card.frame_portrait_id, card.screen_path_portrait),
          ]);
          const shots = jobs ? await shotsFrom(jobs) : [];
          if (cancelled) return;
          setClosed({
            eventId: card.id,
            title: card.title,
            when: dateLabel(card.event_date),
            landscape: land,
            portrait: port,
            jobs,
            shots,
          });
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
  }, [slug, reload]);

  if (error) {
    return <main className="guest-stage px-5 pt-10 text-base text-primary">{error}</main>;
  }
  if (view === "loading") {
    return <main className="guest-stage px-5 pt-10 text-base text-ink">{waiting ? SIGN_IN_WAIT : "טוענים…"}</main>;
  }
  if (view === "live" && live) {
    return (
      <GuestLive
        key={live.eventId}
        event={live}
        slug={slug}
        cameraTo={`/e/${slug}/camera`}
        onClosed={() => setReload((value) => value + 1)}
      />
    );
  }
  if (view === "closed" && closed) {
    return closed.jobs ? <ClosedWithMagnets key={closed.eventId} event={closed} jobs={closed.jobs} /> : <GuestClosedView event={closed} shots={[]} />;
  }
  return (
    <GuestLanding
      mode="missing"
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

function GuestClosedView({ event, shots }: { event: ClosedEvent; shots: GuestShot[] }) {
  return (
    <GuestClosed
      title={event.title}
      dateLabel={event.when}
      landscape={event.landscape}
      portrait={event.portrait}
      shots={shots}
    />
  );
}

/** After closing, queued magnets still print: their status keeps updating, as on the live page. */
function ClosedWithMagnets({ event, jobs: initial }: { event: ClosedEvent; jobs: PrintJob[] }) {
  const { jobs } = useOwnMagnets(event.eventId, initial);
  const [shots, setShots] = useState(event.shots);

  useEffect(() => {
    if (jobs === initial) return;
    let cancelled = false;
    void shotsFrom(jobs).then((next) => {
      if (!cancelled) setShots(next);
    });
    return () => {
      cancelled = true;
    };
  }, [jobs, initial]);

  return <GuestClosedView event={event} shots={shots} />;
}

/** The live landing: the guest's magnets stay current through useOwnMagnets, without Realtime. */
function GuestLive({
  event,
  slug,
  cameraTo,
  onClosed,
}: {
  event: LiveEvent;
  slug: string;
  cameraTo: string;
  onClosed: () => void;
}) {
  const { jobs, refresh } = useOwnMagnets(event.eventId, event.jobs);
  // Back on the page after the admin closed the event: show the thank-you screen.
  useEventRecheck(slug, onClosed);
  // A photo that a reload or a closed tab interrupted is sent now.
  const notice = useOutboxResume(event.eventId, event.guestId, () => {
    void refresh().catch(() => undefined);
  });
  const [magnets, setMagnets] = useState(() => ({
    shots: event.shots,
    left: countPhotosLeft(event.quota, event.jobs),
  }));

  useEffect(() => {
    if (jobs === event.jobs) return;
    let cancelled = false;
    void shotsFrom(jobs).then((shots) => {
      if (!cancelled) setMagnets({ shots, left: countPhotosLeft(event.quota, jobs) });
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
