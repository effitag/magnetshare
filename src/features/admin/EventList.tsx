import { Link } from "react-router-dom";
import { eventPhase, phaseLabel } from "@/features/admin/events/eventState";

export type EventListItem = {
  id: string;
  title: string;
  status: string;
  frameId: string | null;
  framePublished: boolean;
  portraitId: string | null;
  portraitPublished: boolean;
};

type Props = {
  events: EventListItem[];
};

/** Every event with its status. Frames and activation live on the event's own page. */
export function EventList({ events }: Props) {
  return (
    <div>
      {events.length === 0 ? <p className="mt-6 text-base text-ink">עוד אין אירועים.</p> : null}
      <ul className="mt-4 grid gap-3">
        {events.map((event) => (
          <li key={event.id}>
            <Link className="block min-h-11 rounded-2xl border-[3px] border-ink bg-sticker p-4" to={`/admin/events/${event.id}`}>
              <h2 className="text-lg text-ink">{event.title}</h2>
              <p className="mt-1 text-base text-ink">{phaseLabel[eventPhase(event)]}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
