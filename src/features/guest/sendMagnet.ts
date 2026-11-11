import { guestPhotoPaths } from "@/lib/guestSend";
import { activeSends, outbox, type OutboxItem } from "@/lib/outbox";
import { SendFailed, startSend, type SendEnv, type SendRun, type SendState } from "@/lib/sendRetry";
import { createGuestPrint, refreshGuestSession, uploadGuestFile } from "@/services/api";

/** Shown when a send gave up after about 2 minutes of retries online. The photo stays on the phone. */
export const SEND_EXHAUSTED = "לא הצלחנו לשלוח. התמונה שמורה אצלכם, נסו שוב.";

function browserEnv(onState?: (state: SendState) => void): SendEnv {
  return {
    online: () => navigator.onLine !== false,
    waitUntilOnline: (wake) =>
      new Promise<void>((resolve) => {
        const done = () => {
          window.removeEventListener("online", done);
          resolve();
        };
        window.addEventListener("online", done);
        void wake.then(done);
      }),
    sleep: (ms, wake) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, ms);
        void wake.then(() => {
          window.clearTimeout(timer);
          resolve();
        });
      }),
    now: () => Date.now(),
    onState,
  };
}

/** Keeps the photo on the phone until its magnet exists. */
export async function saveToOutbox(item: OutboxItem): Promise<void> {
  try {
    await (await outbox()).put(item);
  } catch {
    // Without storage the send still runs; only a reload would lose the photo, as before.
  }
}

/** Removes the photo from the phone, for example when the guest retakes instead of sending. */
export async function dropFromOutbox(sendId: string): Promise<void> {
  try {
    await (await outbox()).delete(sendId);
  } catch {
    // Nothing stored.
  }
}

/** The Hebrew message for a send that failed. */
export function sendFailureMessage(error: unknown): string {
  if (error instanceof SendFailed && error.reason === "stop" && error.cause instanceof Error)
    return error.cause.message;
  return SEND_EXHAUSTED;
}

/**
 * Sends one photo: uploads the photo and thumbnail, then creates the magnet,
 * retrying what can pass. The photo leaves the outbox once the magnet exists,
 * or when the server refused it for good (quota, event closed, frame changed).
 * It stays after a give-up, so the next visit tries again.
 */
export function sendOutboxItem(item: OutboxItem, onState?: (state: SendState) => void): SendRun {
  const paths = guestPhotoPaths(item.eventId, item.guestId, item.sendId);
  activeSends.add(item.sendId);
  const run = startSend(
    {
      uploadPhoto: () => uploadGuestFile(paths.photo, item.photo),
      uploadThumb: () => uploadGuestFile(paths.thumb, item.thumb),
      createMagnet: () => createGuestPrint(item.eventId, paths.photo, item.copies, item.frameId),
      refreshSession: refreshGuestSession,
    },
    browserEnv(onState),
  );
  // Back online or back to the page: try at once instead of waiting.
  const wakeUp = () => {
    if (document.visibilityState !== "hidden") run.retryNow();
  };
  window.addEventListener("online", wakeUp);
  document.addEventListener("visibilitychange", wakeUp);
  const done = run.done
    .then(
      async (job) => {
        await dropFromOutbox(item.sendId);
        return job;
      },
      async (error: unknown) => {
        if (error instanceof SendFailed && error.reason === "stop")
          await dropFromOutbox(item.sendId);
        throw error;
      },
    )
    .finally(() => {
      activeSends.delete(item.sendId);
      window.removeEventListener("online", wakeUp);
      document.removeEventListener("visibilitychange", wakeUp);
    });
  return { done, retryNow: run.retryNow };
}
