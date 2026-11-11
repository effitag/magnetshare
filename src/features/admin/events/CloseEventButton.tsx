import { useState } from "react";
import { setEventLiveSwitch } from "@/services/api";

const button = "inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-lg";

type Props = {
  eventId: string;
  onClosed: () => void;
};

/** "סגירת האירוע" with its confirmation. Used on the activation card and next to the target alert. */
export function CloseEventButton({ eventId, onClosed }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setPending(true);
    setError(null);
    try {
      await setEventLiveSwitch(eventId, false);
      setConfirm(false);
      onClosed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לעדכן את האירוע.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {confirm ? (
        <>
          <p className="text-base">לסגור את האירוע? אורחים לא יוכלו לצלם יותר. מגנטים שכבר נשלחו יודפסו.</p>
          <button type="button" className={`${button} bg-pop`} disabled={pending} onClick={() => void close()}>
            כן, לסגור
          </button>
          <button type="button" className={button} onClick={() => setConfirm(false)}>
            ביטול
          </button>
        </>
      ) : (
        <button type="button" className={button} onClick={() => setConfirm(true)}>
          סגירת האירוע
        </button>
      )}
      {error ? (
        <p className="text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
