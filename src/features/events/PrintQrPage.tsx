import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QrPanel } from "@/features/qr/QrPanel";
import { AppError } from "@/lib/errors";
import { formatEventDate, guestUrl } from "@/lib/format";
import { getMyEvent } from "@/services/api";
import type { EventRow } from "@/services/types";

export default function PrintQrPage() {
  const { eventId = "" } = useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyEvent(eventId)
      .then((row) => {
        if (active) setEvent(row);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof AppError ? caught.message : "לא הצלחנו להכין את הדף להדפסה.");
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-paper px-4 py-8">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to={`/events/${eventId}`} className="inline-flex min-h-11 items-center text-sm font-medium">
          חזרה לאירוע
        </Link>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-ink"
          onClick={() => window.print()}
        >
          הדפסה
        </button>
      </div>
      {error ? (
        <p className="text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {event ? (
        <div className="text-center">
          <p className="text-sm text-muted">MemoriaShare</p>
          <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
          <p className="mt-1 text-muted">{formatEventDate(event.event_date)}</p>
          <div className="mt-6 text-start">
            <QrPanel
              url={guestUrl(event.public_slug)}
              fileName={`memoriashare-${event.public_slug}.png`}
              eventId={event.id}
              printable={false}
            />
          </div>
          <p className="mt-4 text-sm">סרקו כדי לצלם ולראות את האלבום</p>
        </div>
      ) : null}
    </div>
  );
}
