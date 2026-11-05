import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminEvents, setEventLive, type AdminEventRow } from "@/services/api";

const statusLabel = { draft: "טיוטה", live: "חי", closed: "סגור" } as const;

export function EventsPanel() {
  const [events, setEvents] = useState<AdminEventRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listAdminEvents()
      .then(setEvents)
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function goLive(event: AdminEventRow) {
    setMessage(null);
    try {
      await setEventLive(event.id);
      setEvents((current) => current?.map((row) => (row.id === event.id ? { ...row, status: "live" } : row)) ?? current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא הצלחנו להפעיל את האירוע.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none text-ink">אירועים</h1>
        <Link className="inline-flex min-h-12 items-center rounded-full bg-pop px-4 text-base text-ink" to="/admin/events/new">
          אירוע חדש
        </Link>
      </div>
      <p className="mt-3 text-base text-ink">אירוע עולה לאוויר רק אחרי שהמסגרת שלו פורסמה.</p>
      {message && (
        <p role="alert" className="mt-4 rounded-2xl border-[3px] border-ink bg-sticker px-4 py-3 text-base text-ink">
          {message}
        </p>
      )}
      {events?.length === 0 && <p className="mt-6 text-base text-ink">עוד אין אירועים.</p>}
      <ul className="mt-6 grid gap-3">
        {events?.map((event) => (
          <li key={event.id} className="rounded-2xl border-[3px] border-ink bg-sticker p-4">
            <Link className="block min-h-11" to={`/admin/events/${event.id}`}>
              <h2 className="text-lg text-ink">{event.title}</h2>
              <p className="mt-1 text-base text-ink">
                {event.frame_name} · {statusLabel[event.status as keyof typeof statusLabel] ?? event.status}
              </p>
            </Link>
            {event.status !== "live" && (
              <button type="button" className="mt-3 min-h-12 rounded-full bg-pop px-4 text-base text-ink" onClick={() => void goLive(event)}>
                הפעלה
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}