import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { createGuestPrint, uploadGuestPhoto } from "@/services/api";
import { MagnetFrame, type CameraFrame } from "./MagnetFrame";
import { PaperPlane } from "./SendIllustrations";

type Props = {
  photoUrl: string;
  blob: Blob;
  eventId: string;
  guestId: string;
  frame: CameraFrame;
  overlayUrl: string | null;
  onRetake: () => void;
  onSent: () => void;
};

export function MagnetReview({
  photoUrl,
  blob,
  eventId,
  guestId,
  frame,
  overlayUrl,
  onRetake,
  onSent,
}: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      const path = await uploadGuestPhoto(eventId, guestId, file);
      await createGuestPrint(eventId, path, 1);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשלוח את התמונה. נסו שוב.");
      setSending(false);
    }
  }

  return (
    <div className="cam-root bg-paper" dir="rtl" role="dialog" aria-modal="true" aria-label="אישור התמונה">
      <div className="absolute inset-x-0 top-0 flex items-center justify-center px-5 pt-14" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}>
        <MagnetFrame frame={frame} overlayUrl={overlayUrl} width={Math.min(320, typeof window !== "undefined" ? window.innerWidth - 48 : 320)}>
          <img src={photoUrl} alt="התמונה שלכם" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
        </MagnetFrame>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
        {error ? (
          <p className="mb-3 text-center text-base text-primary" role="alert">{error}</p>
        ) : null}
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button type="button" onClick={onRetake} disabled={sending} aria-label="צלמו מחדש" className="cam-glass">
            <Trash2 className="h-5 w-5" />
          </button>
          <button type="button" className="cam-send" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : "שלחו להדפסה"}
          </button>
        </div>
      </div>
      {sending ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-paper/85 px-8">
          <PaperPlane />
          <p className="font-display text-2xl text-ink">שולחים להדפסה</p>
        </div>
      ) : null}
    </div>
  );
}
