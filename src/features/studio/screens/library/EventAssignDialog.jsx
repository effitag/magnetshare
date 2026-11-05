import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Dialog from '@/features/studio/ui/Dialog';
import { listAdminEvents } from '@/services/api';

export default function EventAssignDialog({ title, onSubmit, onClose }) {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAdminEvents()
      .then((rows) => {
        if (cancelled) return;
        setEvents(rows);
        setEventId(rows[0]?.id ?? '');
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!eventId) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(eventId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא הצלחנו לשייך את המסגרת.');
      setPending(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose}>
      {events?.length === 0 ? (
        <p className="text-base text-ink">
          עדיין אין אירוע.{" "}
          <Link className="underline" to="/admin/events/new" onClick={onClose}>
            יצירת אירוע
          </Link>
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <label className="flex flex-col gap-2 text-base text-ink">
            אירוע
            <select className="min-h-11 rounded-xl border-[3px] border-ink px-3 text-base" value={eventId} onChange={(event) => setEventId(event.target.value)}>
              {(events ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-base text-primary">{error}</p> : null}
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-pop px-4 text-base text-ink" disabled={pending || !eventId}>
            {pending ? "שומרים…" : "שיוך"}
          </button>
        </form>
      )}
    </Dialog>
  );
}
