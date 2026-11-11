import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, WifiOff } from "lucide-react";
import { blobToThumb } from "@/lib/cropToWindow";
import type { SendRun, SendState } from "@/lib/sendRetry";
import { FRAME_UPDATED } from "@/services/api";
import { dropFromOutbox, saveToOutbox, sendFailureMessage, sendOutboxItem } from "../sendMagnet";
import { MagnetFrame, type CameraFrame } from "./MagnetFrame";

/** After this long without an answer, the guest is told the connection is slow. */
const SLOW_AFTER_MS = 8_000;

const STATE_LINE: Record<SendState, string | null> = {
  sending: null,
  retrying: "החיבור נקטע, מנסים שוב…",
  offline: "אין חיבור. נשלח אוטומטית כשהחיבור יחזור.",
};
const SLOW_LINE = "החיבור איטי, ממשיכים לנסות…";

type Props = {
  photoUrl: string;
  blob: Blob;
  /** Made once per captured photo. A second tap or a retry sends the same photo again, never a new one. */
  sendId: string;
  eventId: string;
  guestId: string;
  frameId: string;
  frame: CameraFrame;
  overlayUrl: string | null;
  onRetake: () => void;
  onSent: () => Promise<void>;
};

export function MagnetReview({
  photoUrl,
  blob,
  sendId,
  eventId,
  guestId,
  frameId,
  frame,
  overlayUrl,
  onRetake,
  onSent,
}: Props) {
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<SendState>("sending");
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thumbRef = useRef<Blob | null>(null);
  const runRef = useRef<SendRun | null>(null);
  const width = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 48 : 320);

  useEffect(() => {
    if (!sending) return undefined;
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [sending]);

  async function send() {
    if (sending) return;
    setSending(true);
    setState("sending");
    setError(null);
    try {
      thumbRef.current ??= await blobToThumb(blob);
    } catch {
      setError("לא הצלחנו להכין את התמונה. צלמו שוב.");
      setSending(false);
      return;
    }
    const item = {
      sendId,
      eventId,
      guestId,
      frameId,
      copies: 1,
      photo: blob,
      thumb: thumbRef.current,
      savedAt: Date.now(),
    };
    // The photo stays on the phone until its magnet exists, so a reload does not lose it.
    await saveToOutbox(item);
    const run = sendOutboxItem(item, setState);
    runRef.current = run;
    try {
      await run.done;
    } catch (cause) {
      setError(sendFailureMessage(cause));
      setSending(false);
      return;
    } finally {
      runRef.current = null;
    }
    // The magnet exists: the send succeeded, even if reading the list afterwards fails.
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    try {
      await onSent();
    } catch {
      // The sent screen and the list catch up on their own.
    }
  }

  function retake() {
    void dropFromOutbox(sendId);
    onRetake();
  }

  const line = STATE_LINE[state] ?? (slow ? SLOW_LINE : null);

  return (
    <div className="cam-root" dir="rtl" role="dialog" aria-modal="true" aria-label="אישור התמונה">
      <div className="cam-sheet">
        <MagnetFrame frame={frame} overlayUrl={overlayUrl} width={width}>
          <img src={photoUrl} alt="התמונה שלכם" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
        </MagnetFrame>
        {sending ? (
          <div className="cam-progress" aria-live="polite">
            {state === "offline" ? (
              // Offline nothing moves, so no progress bar: a waiting state until the connection returns.
              <>
                <span className="cam-waiting-icon" aria-hidden="true">
                  <WifiOff className="h-7 w-7" />
                </span>
                <p className="font-display text-2xl text-ink">ממתינים לחיבור</p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-ink">שולחים להדפסה</p>
                <div className="cam-progress-track" role="progressbar" aria-label="שולחים להדפסה">
                  <span className="cam-progress-bar" />
                </div>
              </>
            )}
            {line ? <p className="max-w-sm text-center text-base text-ink">{line}</p> : null}
            {state !== "sending" ? (
              <button type="button" className="cam-send" onClick={() => runRef.current?.retryNow()}>
                נסו עכשיו
              </button>
            ) : null}
          </div>
        ) : (
          <div className="cam-actions">
            <button type="button" onClick={retake} className="cam-retake">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              <span>צילום חוזר</span>
            </button>
            <button type="button" className="cam-send" onClick={send}>
              שלחו להדפסה
            </button>
          </div>
        )}
        {error ? (
          <p className="max-w-sm text-center text-base text-primary" role="alert">
            {error}
          </p>
        ) : null}
        {error === FRAME_UPDATED ? (
          // The event's frame was replaced while this photo was taken: reload the camera with the new one.
          <button type="button" className="cam-send" onClick={() => window.location.reload()}>
            לצלם שוב
          </button>
        ) : null}
      </div>
    </div>
  );
}
