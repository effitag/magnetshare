import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminEvents, type AdminEventRow } from "@/services/api";
import { EventList, type EventListItem } from "@/features/admin/EventList";

function toItem(row: AdminEventRow): EventListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    frameId: row.frame_id,
    framePublished: row.frame_published,
    portraitId: row.frame_portrait_id,
    portraitPublished: row.portrait_published,
  };
}

export function EventsPanel() {
  const [events, setEvents] = useState<EventListItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listAdminEvents()
      .then((rows) => setEvents(rows.map(toItem)))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none text-ink">אירועים</h1>
        <Link className="inline-flex min-h-12 items-center rounded-full bg-pop px-4 text-base text-ink" to="/admin/events/new">
          אירוע חדש
        </Link>
      </div>
      {events ? (
        <EventList events={events} />
      ) : (
        <p className="mt-6 text-base text-ink">{message ?? "טוענים…"}</p>
      )}
    </section>
  );
}
