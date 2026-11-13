import { useCallback, useEffect, useState } from "react";
import { MagnetPoller, SignedUrlCache } from "@/lib/ownMagnets";
import { guestSignedMediaUrl, listOwnPrintJobs } from "@/services/api";
import type { PrintJob } from "@/services/types";

/**
 * Thumbnail URLs of the guest's magnets for this visit. Each path is signed
 * once and reused until 5 minutes before its 30-minute signature ends, so a
 * refresh of the magnets does not sign or download the thumbnails again.
 */
export const thumbUrls = new SignedUrlCache((path) =>
  guestSignedMediaUrl(path, { width: 480, resize: "contain" }),
);

function pageVisible(): boolean {
  return document.visibilityState !== "hidden";
}

/**
 * The guest's own magnets for one event, kept current without Realtime.
 *
 * - `initial` is the list the screen already read when it loaded.
 * - While the page is visible and a magnet is still on its way, it reads again
 *   about every 20 seconds (with jitter). It stops when the page is hidden or
 *   every magnet is final.
 * - When the page becomes visible again it reads at once.
 * - `refresh()` always reads, for example right after a send.
 * - `catchUp()` reads unless a read just happened.
 *
 * Every read goes through RLS, so a guest only ever gets their own magnets.
 * A screen that shows another event mounts a new instance (React `key`).
 */
export function useOwnMagnets(eventId: string, initial: PrintJob[]) {
  const [jobs, setJobs] = useState<PrintJob[]>(initial);
  const [poller] = useState(
    () =>
      new MagnetPoller<PrintJob>(initial, {
        read: () => listOwnPrintJobs(eventId),
        visible: pageVisible,
        onJobs: setJobs,
      }),
  );

  useEffect(() => {
    poller.start();
    const onReturn = () => {
      poller.visibilityChanged().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onReturn);
    document.addEventListener("resume", onReturn);
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      document.removeEventListener("resume", onReturn);
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("focus", onReturn);
      poller.stop();
    };
  }, [poller]);

  const refresh = useCallback(() => poller.refresh(), [poller]);
  const catchUp = useCallback(() => poller.visibilityChanged(), [poller]);

  return { jobs, refresh, catchUp };
}
