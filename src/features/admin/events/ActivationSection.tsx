import { useState } from "react";
import { setEventLiveSwitch } from "@/services/api";
import { activationChecklist, type ActivationInput } from "./eventState";

type Props = {
  event: ActivationInput & { id: string; status: "draft" | "live" | "closed" };
  onStatus: (status: "live" | "closed") => void;
};

const button = "inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-lg";

/** One button to open the event to guests, under a list of what is ready and what is missing. */
export function ActivationSection({ event, onStatus }: Props) {
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = activationChecklist(event);
  const ready = items.every((item) => item.ok);

  async function change(live: boolean) {
    setPending(true);
    setError(null);
    try {
      await setEventLiveSwitch(event.id, live);
      onStatus(live ? "live" : "closed");
      setConfirmClose(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לעדכן את האירוע.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="sticker-card mt-6 bg-sticker p-4 text-ink" aria-labelledby="activation-title">
      <h2 id="activation-title" className="font-display text-2xl leading-none">
        {event.status === "live" ? "האירוע חי" : event.status === "closed" ? "האירוע נסגר" : "הפעלה"}
      </h2>
      {event.status === "live" ? (
        <p className="mt-3 text-base">אורחים יכולים לצלם ולשלוח מגנטים.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2" aria-label="מה מוכן">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-base">
              <span aria-hidden="true" className={item.ok ? "text-ink" : "text-primary"}>
                {item.ok ? "✓" : "✗"}
              </span>
              <span>
                {item.label}
                {item.ok ? null : <span className="text-primary"> · {item.missing}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className="mt-3 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        {event.status === "live" ? (
          confirmClose ? (
            <>
              <p className="text-base">לסגור את האירוע? אורחים לא יוכלו לצלם יותר. מגנטים שכבר נשלחו יודפסו.</p>
              <button type="button" className={`${button} bg-pop`} disabled={pending} onClick={() => void change(false)}>
                כן, לסגור
              </button>
              <button type="button" className={button} onClick={() => setConfirmClose(false)}>
                ביטול
              </button>
            </>
          ) : (
            <button type="button" className={button} onClick={() => setConfirmClose(true)}>
              סגירת האירוע
            </button>
          )
        ) : (
          <button type="button" className={`${button} bg-pop`} disabled={!ready || pending} onClick={() => void change(true)}>
            {pending ? "מפעילים…" : event.status === "closed" ? "הפעלה מחדש" : "הפעלת האירוע"}
          </button>
        )}
      </div>
    </section>
  );
}
