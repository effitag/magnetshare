export type EventPhase = "draft" | "ready" | "live" | "closed";

export type EventSlots = {
  status: string;
  frameId: string | null;
  framePublished: boolean;
  portraitId?: string | null;
  portraitPublished?: boolean;
};

/** At least one frame, and every frame the event shows is ready for guests. */
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
  return canGoLive(event) ? "ready" : "draft";
}

export const phaseLabel: Record<EventPhase, string> = {
  draft: "טיוטה",
  ready: "מוכן להפעלה",
  live: "חי",
  closed: "נסגר",
};

export type ActivationInput = {
  title: string;
  eventDate: string | null;
  printQuota: number;
  eventType: string | null;
  hasFrame: boolean;
  hasLink: boolean;
};

export type ChecklistItem = { id: "details" | "frame" | "qr"; label: string; ok: boolean; missing: string };

/** What the event page shows above "הפעלת האירוע": details, frame and QR. */
export function activationChecklist(event: ActivationInput): ChecklistItem[] {
  const missingDetails = [
    event.title.trim() ? null : "שם",
    event.eventDate ? null : "תאריך",
    event.eventType ? null : "סוג אירוע",
    Number.isInteger(event.printQuota) && event.printQuota >= 1 ? null : "מגנטים לאורח",
  ].filter((value): value is string => Boolean(value));
  return [
    { id: "details", label: "פרטים", ok: missingDetails.length === 0, missing: `חסר: ${missingDetails.join(", ")}` },
    { id: "frame", label: "מסגרת", ok: event.hasFrame, missing: "בחרו מסגרת" },
    { id: "qr", label: "QR", ok: event.hasLink, missing: "שמרו את האירוע" },
  ];
}
