import { useEffect, useRef } from "react";
import { shouldRecheck } from "@/lib/eventClosed";
import { getEventCardBySlug } from "@/services/api";

/**
 * Re-reads the event when the guest comes back to the page (at most every 10
 * seconds), and calls onClosed if the admin closed it meanwhile. No polling
 * while the page stays open: the camera's send refusal covers that case.
 */
export function useEventRecheck(slug: string, onClosed: () => void): void {
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    let lastAt: number | null = Date.now();
    let cancelled = false;

    const check = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!shouldRecheck(lastAt, now)) return;
      lastAt = now;
      getEventCardBySlug(slug)
        .then((card) => {
          if (!cancelled && card?.status === "closed") onClosedRef.current();
        })
        .catch(() => undefined);
    };

    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
    };
  }, [slug]);
}
