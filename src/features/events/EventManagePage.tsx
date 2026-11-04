import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Shell } from "@/features/layout/Shell";
import { QrPanel } from "@/features/qr/QrPanel";
import { AppError } from "@/lib/errors";
import { formatEventDate, guestUrl, photosLabel, statusLabel, typeLabel } from "@/lib/format";
import { getMyEvent, photoCount, signedCoverUrls } from "@/services/api";
import type { EventRow } from "@/services/types";

export default function EventManagePage() {
  const { eventId = "" } = useParams();
  const location = useLocation();
  const coverWarning = (location.state as { coverWarning?: string } | null)?.coverWarning;
  const [event, setEvent] = useState<EventRow | null>(null);
  const [cover, setCover] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyEvent(eventId)
      .then(async (row) => {
        if (!active) return;
        setEvent(row);
        if (row.cover_path) {
          const urls = await signedCoverUrls([row.cover_path]);
          if (active) setCover(urls[row.cover_path] ?? "");
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof AppError ? caught.message : "לא הצלחנו לפתוח את האירוע. חזרו לרשימה ונסו שוב.");
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <Shell>
      <Link to="/dashboard" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink">
        <ChevronRight className="size-4" aria-hidden="true" />
        כל האירועים
      </Link>
      {error ? (
        <p className="mt-6 text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {!event && !error ? <p className="mt-6 text-muted">טוען את האירוע…</p> : null}
      {event ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {cover ? (
              <img src={cover} alt="" className="aspect-video w-full rounded-2xl object-cover shadow-card" />
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-surface px-2 py-1 shadow-card">{typeLabel(event.type)}</span>
              <span className="rounded-full bg-surface px-2 py-1 text-muted shadow-card">{statusLabel(event.status)}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{event.name}</h1>
            <p className="mt-2 text-muted">
              {formatEventDate(event.event_date)} · {photosLabel(photoCount(event))}
            </p>
            {event.description ? <p className="mt-3 max-w-prose">{event.description}</p> : null}
            {coverWarning ? (
              <p className="mt-4 text-sm text-primary" role="status">
                {coverWarning}
              </p>
            ) : null}
            {event.type === "share" ? (
              <p className="mt-6 text-sm text-muted">זה אלבום משותף. אין כאן עיצוב מסגרת ואין תור הדפסה.</p>
            ) : (
              <p className="mt-6 text-sm text-muted">
                זה אירוע Magnetim. עיצוב המסגרת ותור ההדפסה יתווספו בשלב הבא, ורק כאן.
              </p>
            )}
          </div>
          <QrPanel url={guestUrl(event.public_slug)} fileName={`memoriashare-${event.public_slug}.png`} eventId={event.id} />
        </div>
      ) : null}
    </Shell>
  );
}
