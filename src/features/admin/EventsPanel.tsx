import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminEvents, setEventLiveSwitch, type AdminEventRow } from "@/services/api";
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
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    listAdminEvents()
      .then((rows) => setEvents(rows.map(toItem)))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function toggle(event: EventListItem, live: boolean) {
    setMessage(null);
    setPendingId(event.id);
    try {
      await setEventLiveSwitch(event.id, live);
      setEvents((current) => current?.map((row) => (row.id === event.id ? { ...row, status: live ? "live" : "closed" } : row)) ?? current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לעדכן את האירוע.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none text-ink">אירועים</h1>
        <Link className="inline-flex min-h-12 items-center rounded-full bg-pop px-4 text-base text-ink" to="/admin/events/new">
          אירוע חדש
        </Link>
      </div>
      {events ? (
        <EventList events={events} message={message} pendingId={pendingId} onToggle={(event, live) => void toggle(event, live)} />
      ) : (
        <p className="mt-6 text-base text-ink">{message ?? "טוענים…"}</p>
      )}
    </section>
  );
}
