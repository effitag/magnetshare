import { SendFailed } from "./sendRetry";

/**
 * True when a send was refused because the event no longer takes photos (the
 * admin closed it). The guest is then shown the event's thank-you screen
 * instead of an error line.
 */
export function isEventClosedRefusal(error: unknown): boolean {
  const cause = error instanceof SendFailed ? (error.reason === "stop" ? error.cause : null) : error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, message } = cause as { code?: unknown; message?: unknown };
  return code === "event_not_live" || (typeof message === "string" && message.includes("event_not_live"));
}

/** Re-reads the event on return to the page at most this often. */
export const EVENT_RECHECK_MS = 10_000;

/** Whether a return to the page should re-read the event now. */
export function shouldRecheck(lastAt: number | null, now: number, minGapMs = EVENT_RECHECK_MS): boolean {
  return lastAt === null || now - lastAt >= minGapMs;
}
