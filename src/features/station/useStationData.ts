import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEventMagnetCounts,
  getStationEvent,
  getStationFrames,
  listStationJobs,
  listStationRuns,
  subscribeStationJobs,
} from "@/services/api";
import type { MagnetCounts, PrintRun, StationEvent, StationFrame, StationJob } from "@/services/types";

/** A fallback read in case a live update is missed (Realtime is the main path). */
export const STATION_REFRESH_MS = 10_000;

export type StationData = {
  event: StationEvent | null;
  jobs: StationJob[];
  runs: PrintRun[];
  frames: Map<string, StationFrame>;
  counts: MagnetCounts | null;
  error: string | null;
  loaded: boolean;
};

/**
 * The event's magnets, prints and frames, kept current by Realtime on
 * print_jobs (one connection per station), a read every 10 s while the page
 * is visible, and a read right after each of the station's own actions.
 */
export function useStationData(eventId: string): StationData & { refresh: () => Promise<void> } {
  const [data, setData] = useState<StationData>({
    event: null,
    jobs: [],
    runs: [],
    frames: new Map(),
    counts: null,
    error: null,
    loaded: false,
  });
  const frames = useRef(new Map<string, StationFrame>());
  const reading = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (reading.current) return reading.current;
    reading.current = (async () => {
      try {
        const [event, jobs, runs, counts] = await Promise.all([
          getStationEvent(eventId),
          listStationJobs(eventId),
          listStationRuns(eventId),
          getEventMagnetCounts([eventId]).catch(() => null),
        ]);
        const missing = [...new Set(jobs.map((job) => job.frameId).filter((id): id is string => Boolean(id)))].filter(
          (id) => !frames.current.has(id),
        );
        for (const frame of await getStationFrames(missing)) frames.current.set(frame.id, frame);
        setData({
          event,
          jobs,
          runs,
          frames: new Map(frames.current),
          counts: counts?.get(eventId) ?? null,
          error: null,
          loaded: true,
        });
      } catch (cause) {
        setData((current) => ({ ...current, loaded: true, error: cause instanceof Error ? cause.message : "לא הצלחנו לטעון." }));
      } finally {
        reading.current = null;
      }
    })();
    return reading.current;
  }, [eventId]);

  useEffect(() => {
    void refresh();
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void refresh(), 300);
    };
    const stop = subscribeStationJobs(eventId, soon);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, STATION_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      window.clearTimeout(pending);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId, refresh]);

  return { ...data, refresh };
}
