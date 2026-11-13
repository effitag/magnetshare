import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  assignOperator,
  inviteOperator,
  listAdminEvents,
  listStaff,
  removeOperator,
  unassignOperator,
  type AdminEventRow,
} from "@/services/api";
import type { StaffMember } from "@/services/types";

const fieldClass = "sticker-card sticker-flat box-border min-h-11 w-full min-w-0 bg-sticker px-3 text-base text-ink";
const button = "inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base text-ink disabled:opacity-50";

const STATUS_LABEL: Record<string, string> = { draft: "טיוטה", live: "חי", closed: "נסגר" };

/**
 * /admin/team: print-station operators. An admin adds an operator's Google
 * email; the operator signs in at /station, and the admin assigns them to
 * events. Operators can print and change statuses for their events only.
 */
export function TeamPanel() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // Assignments shown at once on a click, until the list is read again.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [people, rows] = await Promise.all([listStaff(), listAdminEvents()]);
      setStaff(people);
      setEvents(rows);
      setToggled({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את הצוות.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(run: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await run();
      if (done) setNotice(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הפעולה לא הצליחה.");
    } finally {
      setBusy(false);
      await load();
    }
  }

  function invite(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    void act(async () => {
      const saved = await inviteOperator(email);
      setEmail("");
      return saved;
    }, "המפעיל נוסף. הוא נכנס עם חשבון הגוגל הזה בכתובת ‎/station‎.");
  }

  const admins = (staff ?? []).filter((person) => person.role === "admin");
  const operators = (staff ?? []).filter((person) => person.role === "operator");

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6 text-ink">
      <h1 className="font-display text-4xl leading-none">צוות</h1>
      <p className="mt-2 text-base">
        מפעילים מדפיסים בעמדת ההדפסה, רק באירועים שמשויכים אליהם. הם לא יכולים לערוך אירועים, מסגרות או את הצוות.
      </p>

      <form className="sticker-card mt-4 flex flex-col gap-3 bg-sticker p-4" onSubmit={invite} noValidate>
        <label className="flex flex-col gap-1 text-base">
          חשבון הגוגל של המפעיל
          <input
            className={fieldClass}
            type="email"
            inputMode="email"
            autoComplete="off"
            dir="ltr"
            placeholder="name@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button type="submit" className={`${button} bg-pop`} disabled={busy || !email.trim()}>
          הוספת מפעיל
        </button>
      </form>

      {error ? (
        <p className="mt-3 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-base" role="status">
          {notice}
        </p>
      ) : null}
      {!staff && !error ? <p className="mt-4 text-base">טוענים…</p> : null}

      {staff ? (
        <>
          <h2 className="mt-6 font-display text-2xl leading-none">מפעילים</h2>
          {!operators.length ? <p className="mt-2 text-base">עוד אין מפעילים.</p> : null}
          <ul className="mt-3 grid gap-3">
            {operators.map((person) => (
              <li key={person.email} className="sticker-card bg-sticker p-4">
                <p className="break-all text-lg" dir="ltr">
                  {person.email}
                </p>
                <p className="mt-1 text-base">
                  {person.signedIn ? "נכנס/ה לעמדה" : "עוד לא נכנס/ה. אפשר לשייך לאירועים אחרי הכניסה הראשונה ל־‎/station‎."}
                </p>
                {person.signedIn && person.userId ? (
                  <fieldset className="mt-3 flex flex-col gap-1">
                    <legend className="mb-1 text-base">אירועים</legend>
                    {!events.length ? <p className="text-base">אין אירועים.</p> : null}
                    {events.map((event) => {
                      const key = `${person.userId}:${event.id}`;
                      const checked = toggled[key] ?? person.eventIds.includes(event.id);
                      return (
                        <label key={event.id} className="flex min-h-11 items-center gap-3 text-base">
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={checked}
                            disabled={busy}
                            onChange={() => {
                              setToggled((current) => ({ ...current, [key]: !checked }));
                              void act(() =>
                                checked
                                  ? unassignOperator(event.id, person.userId as string)
                                  : assignOperator(event.id, person.userId as string),
                              );
                            }}
                          />
                          <span>
                            {event.title} · {STATUS_LABEL[event.status] ?? event.status}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {confirmRemove === person.email ? (
                    <>
                      <p className="w-full text-base">להסיר? המפעיל לא יוכל להיכנס יותר, והשיוכים לאירועים יימחקו.</p>
                      <button
                        type="button"
                        className={`${button} bg-primary text-primary-ink`}
                        disabled={busy}
                        onClick={() => void act(() => removeOperator(person.email), "המפעיל הוסר.").then(() => setConfirmRemove(null))}
                      >
                        כן, להסיר
                      </button>
                      <button type="button" className={`${button} bg-sticker`} onClick={() => setConfirmRemove(null)}>
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button type="button" className={`${button} bg-sticker`} onClick={() => setConfirmRemove(person.email)}>
                      הסרה
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 font-display text-2xl leading-none">מנהלים</h2>
          <ul className="mt-2 grid gap-1">
            {admins.map((person) => (
              <li key={person.email} className="break-all text-base" dir="ltr">
                {person.email}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
