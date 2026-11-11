import { useEffect, useRef, useState } from "react";
import { getEventMagnetCounts } from "@/services/api";
import type { MagnetCounts } from "@/services/types";

/** About every 20 seconds while the page is visible, with jitter so open admin pages do not read together. */
export const COUNTS_EVERY_MS = 20_000;
const JITTER_MS = 3_000;

type State = {
  /** Null until the first read, and while the database has no counter yet. */
  counts: Map<string, MagnetCounts> | null;
  /** False once the database said it has no counter (before its migration). */
  available: boolean;
  error: string | null;
};

/**
 * Magnet counts for the given events, read at once, again about every 20
 * seconds while the page is visible (`poll`), and right away when the page
 * becomes visible again. No Realtime. Pass the same ids in the same order to
 * avoid extra reads.
 */
export function useMagnetCounts(eventIds: string[], options: { poll: boolean }): State {
  const [state, setState] = useState<State>({ counts: null, available: true, error: null });
  const key = eventIds.join(",");
  const ids = useRef(eventIds);
  ids.current = eventIds;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let reading = false;

    async function read() {
      if (reading || cancelled) return;
      reading = true;
      try {
        const counts = await getEventMagnetCounts(ids.current);
        if (cancelled) return;
        setState(counts ? { counts, available: true, error: null } : { counts: null, available: false, error: null });
      } catch (cause) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: cause instanceof Error ? cause.message : "לא הצלחנו לטעון את מספר המגנטים.",
          }));
        }
      } finally {
        reading = false;
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      if (!options.poll || cancelled || document.visibilityState === "hidden") return;
      const wait = COUNTS_EVERY_MS + Math.round((Math.random() * 2 - 1) * JITTER_MS);
      timer = window.setTimeout(() => {
        void read().finally(schedule);
      }, wait);
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        return;
      }
      void read().finally(schedule);
    }

    void read().finally(schedule);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, options.poll]);

  return state;
}
