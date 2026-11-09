import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createEvent, getAdminEvent, saveEventCover, updateEventDetails, type AdminEventDetail } from "@/services/api";
import { EventForm, type EventFormValue } from "./EventForm";
import { ActivationSection } from "./ActivationSection";
import { FrameSection } from "./frames/FrameSection";
import { EventShare } from "./EventShare";

const empty: EventFormValue = { title: "", eventDate: "", printQuota: 2, eventType: null };

export function EventEditorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<EventFormValue>(empty);
  const [saved, setSaved] = useState<AdminEventDetail | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverName, setCoverName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    getAdminEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        setForm({ title: event.title, eventDate: event.eventDate ?? "", printQuota: event.printQuota, eventType: event.eventType });
        setSaved(event);
        setCoverName(event.coverPath);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function invalid(): string | null {
    if (!form.title.trim()) return "הזינו שם לאירוע.";
    if (!form.eventType) return "בחרו סוג אירוע.";
    if (!form.eventDate) return "בחרו תאריך.";
    if (!Number.isInteger(form.printQuota) || form.printQuota < 1) return "לכל אורח מגיע לפחות מגנט אחד.";
    return null;
  }

  async function save() {
    const problem = invalid();
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = eventId
        ? await updateEventDetails(eventId, form)
        : await createEvent(form);
      if (cover) await saveEventCover(next.id, cover);
      setSaved(next);
      setCover(null);
      if (!eventId) navigate(`/admin/events/${next.id}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשמור את האירוע.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-xl grid-cols-[minmax(0,1fr)] overflow-x-clip px-4 pt-6">
      <Link className="inline-flex min-h-11 items-center text-base text-ink" to="/admin">
        חזרה לאירועים
      </Link>
      <h1 className="mt-2 font-display text-4xl leading-none text-ink">{eventId ? "האירוע" : "אירוע חדש"}</h1>
      <div className="mt-4">
        <EventForm
          value={form}
          coverName={coverName}
          error={error}
          pending={pending}
          onChange={setForm}
          onCover={setCover}
          onSubmit={() => void save()}
        />
      </div>
      {saved ? (
        <FrameSection
          event={{ id: saved.id, title: saved.title, eventDate: saved.eventDate, eventType: saved.eventType, status: saved.status }}
          onChanged={(frames) => setHasFrame(Boolean(frames.landscape || frames.portrait))}
        />
      ) : null}
      {saved ? <EventShare eventId={saved.id} slug={saved.slug} title={saved.title} /> : null}
      {saved ? (
        <ActivationSection
          event={{ ...saved, hasFrame, hasLink: Boolean(saved.slug) }}
          onStatus={(status) => setSaved((current) => (current ? { ...current, status } : current))}
        />
      ) : null}
    </section>
  );
}
