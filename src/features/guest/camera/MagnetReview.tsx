import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { blobToThumb } from "@/lib/cropToWindow";
import { createGuestPrint, uploadGuestPhoto } from "@/services/api";
import { MagnetFrame, type CameraFrame } from "./MagnetFrame";

type Props = {
  photoUrl: string;
  blob: Blob;
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
  eventId,
  guestId,
  frameId,
  frame,
  overlayUrl,
  onRetake,
  onSent,
}: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const width = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 48 : 320);

  async function send() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      const thumb = await blobToThumb(blob);
      const path = await uploadGuestPhoto(eventId, guestId, file, thumb);
      await createGuestPrint(eventId, path, 1, frameId);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      await onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשלוח את התמונה. נסו שוב.");
      setSending(false);
    }
  }

  return (
    <div className="cam-root" dir="rtl" role="dialog" aria-modal="true" aria-label="אישור התמונה">
      <div className="cam-sheet">
        <MagnetFrame frame={frame} overlayUrl={overlayUrl} width={width}>
          <img src={photoUrl} alt="התמונה שלכם" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
        </MagnetFrame>
        {sending ? (
          <div className="cam-progress" aria-live="polite">
            <p className="font-display text-2xl text-ink">שולחים להדפסה</p>
            <div className="cam-progress-track" role="progressbar" aria-label="שולחים להדפסה">
              <span className="cam-progress-bar" />
            </div>
          </div>
        ) : (
          <div className="cam-actions">
            <button type="button" onClick={onRetake} className="cam-retake">
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
      </div>
    </div>
  );
}
