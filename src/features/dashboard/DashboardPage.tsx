import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Shell } from "@/features/layout/Shell";
import { useAuth } from "@/hooks/useAuth";
import { AppError, isSchemaMissing } from "@/lib/errors";
import { displayName, formatEventDate, photosLabel, statusLabel, typeLabel } from "@/lib/format";
import { listMyEvents, photoCount, signedCoverUrls } from "@/services/api";
import type { EventRow } from "@/services/types";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyEvents()
      .then(async (rows) => {
        if (!active) return;
        setEvents(rows);
        const urls = await signedCoverUrls(rows.map((row) => row.cover_path ?? ""));
        if (active) setCovers(urls);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setSchemaMissing(isSchemaMissing(caught));
        setError(caught instanceof AppError ? caught.message : "לא הצלחנו לטעון את האירועים. רעננו את העמוד.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">שלום, {displayName(profile, user)}</p>
          <h1 className="mt-1 text-3xl font-semibold">האירועים שלי</h1>
        </div>
        <Link
          to="/events/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-ink"
        >
          <Plus className="size-4" aria-hidden="true" />
          יצירת אירוע
        </Link>
      </div>

      {loading ? <p className="mt-8 text-muted">טוען אירועים…</p> : null}
      {error ? (
        <p className="mt-8 rounded-2xl bg-surface p-4 text-primary shadow-card" role="alert">
          {schemaMissing
            ? "הטבלאות עדיין לא הוגדרו. הריצו את סקריפט ההקמה ב-Supabase ואז רעננו את העמוד."
            : error}
        </p>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-surface p-6 text-muted shadow-card">
          עדיין אין אירועים. האירוע הראשון לוקח בערך דקה.
        </p>
      ) : null}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {events.map((event) => {
          const cover = event.cover_path ? covers[event.cover_path] : "";
          return (
            <li key={event.id}>
              <Link to={`/events/${event.id}`} className="block overflow-hidden rounded-2xl bg-surface shadow-card">
                {cover ? (
                  <img src={cover} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-paper text-3xl font-semibold text-primary">
                    {event.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-paper px-2 py-1 text-ink">{typeLabel(event.type)}</span>
                    <span className="rounded-full bg-paper px-2 py-1 text-muted">{statusLabel(event.status)}</span>
                  </div>
                  <h2 className="text-lg font-semibold">{event.name}</h2>
                  <p className="text-sm text-muted">
                    {formatEventDate(event.event_date)} · {photosLabel(photoCount(event))}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
