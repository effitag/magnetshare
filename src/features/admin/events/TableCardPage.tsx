import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminEvent } from "@/services/api";
import { TableCard } from "./TableCard";

export function TableCardPage() {
  const { eventId = "" } = useParams();
  const [card, setCard] = useState<{ title: string; slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminEvent(eventId)
      .then((event) => {
        if (!cancelled) setCard({ title: event.title, slug: event.slug });
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link className="inline-flex min-h-11 items-center text-base text-ink" to={`/admin/events/${eventId}`}>
          חזרה לאירוע
        </Link>
        <button type="button" className="inline-flex min-h-12 items-center rounded-full bg-pop px-4 text-base text-ink" onClick={() => window.print()}>
          הדפסה
        </button>
      </div>
      {error ? <p className="text-base text-primary">{error}</p> : null}
      {card ? <TableCard title={card.title} slug={card.slug} /> : null}
    </section>
  );
}
