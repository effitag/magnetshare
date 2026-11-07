import { Link } from "react-router-dom";
import { canGoLive, eventPhase, phaseLabel, slotState, type EventPhase } from "@/features/admin/events/eventState";

export type EventListItem = {
  id: string;
  title: string;
  status: string;
  frameId: string | null;
  framePublished: boolean;
  portraitId: string | null;
  portraitPublished: boolean;
};

const LIVE_BLOCK = "כדי להפעיל את האירוע צריך לבחור לו מסגרת.";

type Props = {
  events: EventListItem[];
  message: string | null;
  pendingId: string | null;
  onToggle: (event: EventListItem, live: boolean) => void;
};

export function EventList({ events, message, pendingId, onToggle }: Props) {
  return (
    <div>
      {message ? (
        <p role="alert" className="mt-4 rounded-2xl border-[3px] border-ink bg-sticker px-4 py-3 text-base text-ink">
          {message}
        </p>
      ) : null}
      {events.length === 0 ? <p className="mt-6 text-base text-ink">עוד אין אירועים.</p> : null}
      <ul className="mt-4 grid gap-3">
        {events.map((event) => {
          const phase: EventPhase = eventPhase(event);
          const live = phase === "live";
          const ready = canGoLive(event);
          return (
            <li key={event.id} className="rounded-2xl border-[3px] border-ink bg-sticker p-4">
              <Link className="block min-h-11" to={`/admin/events/${event.id}`}>
                <h2 className="text-lg text-ink">{event.title}</h2>
                <p className="mt-1 text-base text-ink">{phaseLabel[phase]}</p>
              </Link>
              <p className="mt-2 text-base text-ink">מסגרת לרוחב: {slotState(event.frameId, event.framePublished)}</p>
              <p className="text-base text-ink">מסגרת לאורך: {slotState(event.portraitId, event.portraitPublished)}</p>
              <label className="mt-3 flex min-h-12 items-center justify-between gap-3 text-base text-ink">
                הפעלה
                <input
                  type="checkbox"
                  role="switch"
                  className="size-11 accent-ink"
                  checked={live}
                  disabled={pendingId === event.id || (!live && !ready)}
                  onChange={(change) => onToggle(event, change.target.checked)}
                />
              </label>
              {!live && !ready ? (
                <p className="mt-2 text-base text-ink">
                  {LIVE_BLOCK}{" "}
                  <Link className="underline" to={`/admin/events/${event.id}`}>
                    לבחירת מסגרת
                  </Link>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
