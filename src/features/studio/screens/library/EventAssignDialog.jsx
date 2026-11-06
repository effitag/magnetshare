import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { frameOrientation } from '@/features/studio/model/presets';
import Dialog from '@/features/studio/ui/Dialog';
import { listAdminEvents } from '@/services/api';

export default function EventAssignDialog({ title, mode = 'assign', size, onSubmit, onClose }) {
  const natural = frameOrientation(size?.widthMm, size?.heightMm);
  const square = Number(size?.widthMm) > 0 && Number(size?.widthMm) === Number(size?.heightMm);
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState('');
  const [slot, setSlot] = useState(natural);
  const [both, setBoth] = useState(false);
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
    if (mode === 'assign' && slot !== natural) {
      setError(
        square
          ? 'מסגרת ריבוע נשמרת כמסגרת לאורך.'
          : natural === 'landscape'
            ? 'המסגרת רחבה יותר מגובהה, אז היא לרוחב.'
            : 'המסגרת גבוהה יותר מרוחבה, אז היא לאורך.',
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({ eventId, slot: both ? natural : slot, both: mode === 'copy' && both && !square });
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
          <fieldset className="flex flex-col gap-2 text-base text-ink">
            <legend>כיוון</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="slot" checked={slot === 'landscape'} onChange={() => setSlot('landscape')} disabled={both} />
              לרוחב
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="slot" checked={slot === 'portrait'} onChange={() => setSlot('portrait')} disabled={both} />
              לאורך
            </label>
            {mode === 'copy' && !square ? (
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={both} onChange={(event) => setBoth(event.target.checked)} />
                צרו גם את הכיוון השני
              </label>
            ) : null}
            {square ? <p>מסגרת ריבוע נשמרת כמסגרת לאורך.</p> : null}
            {mode === 'copy' && both ? <p>אם לתבנית יש פריסה לשני הכיוונים, שתיהן נוצרות ממנה.</p> : null}
          </fieldset>
          {error ? <p className="text-base text-primary">{error}</p> : null}
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-pop px-4 text-base text-ink" disabled={pending || !eventId}>
            {pending ? "שומרים…" : mode === 'copy' ? "יצירה" : "שיוך"}
          </button>
        </form>
      )}
    </Dialog>
  );
}
