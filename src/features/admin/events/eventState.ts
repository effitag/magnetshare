export type EventPhase = "no-frame" | "unpublished" | "ready" | "live" | "closed";

export function eventPhase(event: { status: string; frameId: string | null; framePublished: boolean }): EventPhase {
  if (event.status === "live") return "live";
  if (event.status === "closed") return "closed";
  if (!event.frameId) return "no-frame";
  if (!event.framePublished) return "unpublished";
  return "ready";
}

export const phaseLabel: Record<EventPhase, string> = {
  "no-frame": "בלי מסגרת",
  unpublished: "מסגרת לא פורסמה",
  ready: "מוכן להפעלה",
  live: "חי",
  closed: "הסתיים",
};

export function canGoLive(event: { frameId: string | null; framePublished: boolean }): boolean {
  return Boolean(event.frameId) && event.framePublished;
}
