import { useEffect, useRef, useState } from "react";
import { activeSends, outbox, pendingSends } from "@/lib/outbox";
import { SendFailed } from "@/lib/sendRetry";
import { sendOutboxItem } from "./sendMagnet";

export const RESUME_SENDING = "שולחים את התמונה ששמרנו…";
export const RESUME_SENT = "התמונה שלכם נשלחה";
export const RESUME_LATER = "לא הצלחנו לשלוח את התמונה ששמרנו. ננסה שוב בפעם הבאה שתיכנסו.";

/**
 * Finishes sends that a reload, a closed tab or a killed browser interrupted.
 * Runs once when the event page or the camera opens, for this guest and this
 * event only, and returns a line to show the guest (or null).
 */
export function useOutboxResume(
  eventId: string,
  guestId: string,
  onSent: () => void,
): string | null {
  const [note, setNote] = useState<string | null>(null);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let items;
      try {
        items = await pendingSends(await outbox(), eventId, guestId);
      } catch {
        return;
      }
      for (const item of items) {
        if (cancelled) return;
        if (activeSends.has(item.sendId)) continue;
        setNote(RESUME_SENDING);
        try {
          await sendOutboxItem(item).done;
          if (cancelled) return;
          setNote(RESUME_SENT);
          onSentRef.current();
        } catch (error) {
          if (cancelled) return;
          const refused =
            error instanceof SendFailed && error.reason === "stop" && error.cause instanceof Error;
          setNote(
            refused ? `התמונה ששמרנו לא נשלחה: ${(error.cause as Error).message}` : RESUME_LATER,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, guestId]);

  return note;
}
