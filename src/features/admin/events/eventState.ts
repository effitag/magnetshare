export type EventPhase = "no-frame" | "unpublished" | "ready" | "live" | "closed";

export type EventSlots = {
  status: string;
  frameId: string | null;
  framePublished: boolean;
  portraitId?: string | null;
  portraitPublished?: boolean;
};

export function canGoLive(event: Omit<EventSlots, "status">): boolean {
  const land = Boolean(event.frameId);
  const port = Boolean(event.portraitId);
  if (land && !event.framePublished) return false;
  if (port && !event.portraitPublished) return false;
  return (land && event.framePublished) || (port && Boolean(event.portraitPublished));
}

export function eventPhase(event: EventSlots): EventPhase {
  if (event.status === "live") return "live";
  if (event.status === "closed") return "closed";
  if (!event.frameId && !event.portraitId) return "no-frame";
  if (!canGoLive(event)) return "unpublished";
  return "ready";
}

export const phaseLabel: Record<EventPhase, string> = {
  "no-frame": "בלי מסגרת",
  unpublished: "מסגרת לא פורסמה",
  ready: "מוכן להפעלה",
  live: "חי",
  closed: "הסתיים",
};

export function slotState(id: string | null, published: boolean): string {
  if (!id) return "אין";
  return published ? "פורסמה" : "לא פורסמה";
}
