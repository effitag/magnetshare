import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppError } from "@/lib/errors";
import { formatEventDate } from "@/lib/format";
import { getPublicEventBySlug } from "@/services/api";
import type { EventRow } from "@/services/types";

export function GuestSoonPage() {
  const { slug = "" } = useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublicEventBySlug(slug)
      .then((row) => {
        if (!active) return;
        setEvent(row);
        if (!row) setError("האירוע לא זמין. בדקו את הקישור, או בקשו מהמארח קוד חדש.");
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof AppError ? caught.message : "לא הצלחנו לפתוח את האירוע. נסו שוב.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <Link to="/" className="text-lg font-semibold">
        MemoriaShare
      </Link>
      {loading ? <p className="mt-6 text-muted">טוען את האירוע…</p> : null}
      {error ? (
        <p className="mt-6 text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {event ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold">{event.name}</h1>
          <p className="mt-2 text-muted">{formatEventDate(event.event_date)}</p>
          <p className="mt-4 text-muted">הקוד תקין. צילום מהטלפון וצפייה באלבום ייפתחו כאן בשלב הבא.</p>
        </>
      ) : null}
    </div>
  );
}
