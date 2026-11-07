import { useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { countMagnetsLeft, thumbPathFromPhoto } from "@/lib/magnets";
import {
  ensureGuestSession,
  getEventCardBySlug,
  getPublishedFrameWindow,
  listOwnPrintJobs,
  signedMediaUrl,
  subscribeOwnPrintJobs,
} from "@/services/api";
import type { PrintJob } from "@/services/types";
import { inAppBrowser } from "./browser";
import { GuestLanding, type GuestFrame } from "./GuestLanding";
import type { GuestShot } from "./MagnetMeter";

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
      const url = path ? await signedMediaUrl(path, { width: 480, resize: "contain" }) : null;
      return { id: job.id, url, status: job.status, frameId: job.frame_id };
    }),
  );
}

export function GuestPage() {
  const { slug = "" } = useParams();
  const [view, setView] = useState<"loading" | "missing" | "closed" | "live">("loading");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [shots, setShots] = useState<GuestShot[]>([]);
  const [landscape, setLandscape] = useState<GuestFrame | null>(null);
  const [portrait, setPortrait] = useState<GuestFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    let stop = () => {};
    setError(null);
    setView("loading");
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
        const guestId = await ensureGuestSession();
        const [jobs, cover, land, port] = await Promise.all([
          listOwnPrintJobs(card.id).catch(() => [] as PrintJob[]),
          card.cover_path ? signedMediaUrl(card.cover_path, { width: 800, resize: "cover" }) : Promise.resolve(null),
          loadFrame(card.frame_id, card.screen_path),
          loadFrame(card.frame_portrait_id, card.screen_path_portrait),
        ]);
        const photos = await shotsFrom(jobs);
        if (cancelled) return;
        const apply = (nextJobs: PrintJob[], nextShots: GuestShot[]) => {
          setTitle(card.title);
          setWhen(dateLabel(card.event_date));
          setCoverUrl(cover);
          setLandscape(land);
          setPortrait(port);
          setShots(nextShots);
          setLeft(countMagnetsLeft(card.print_quota, nextJobs));
          setView("live");
        };
        apply(jobs, photos);
        const unsubscribe = subscribeOwnPrintJobs(card.id, guestId, () => {
          void listOwnPrintJobs(card.id)
            .then(async (next) => {
              const nextShots = await shotsFrom(next);
              if (!cancelled) apply(next, nextShots);
            })
            .catch(() => undefined);
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

  if (error) {
    return <main className="guest-stage px-5 pt-10 text-base text-primary">{error}</main>;
  }
  if (view === "loading") {
    return <main className="guest-stage px-5 pt-10 text-base text-ink">טוענים…</main>;
  }
  return (
    <GuestLanding
      mode={view}
      title={title}
      dateLabel={when}
      coverUrl={coverUrl}
      magnetsLeft={left}
      shots={shots}
      landscape={landscape}
      portrait={portrait}
      inApp={inAppBrowser(navigator.userAgent)}
      cameraTo={`/e/${slug}/camera`}
    />
  );
}
