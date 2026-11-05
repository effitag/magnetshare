import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createEvent,
  deleteEvent,
  duplicateFrameForEvent,
  getAdminEvent,
  listAdminFrames,
  updateEvent,
  type AdminFrameChoice,
} from "@/services/api";
import { EventForm } from "./EventForm";
import { EventShare } from "./EventShare";
import { emptyEventForm, type EventFormState } from "./eventForm";
import { isSlug, randomSuffix, suggestSlug } from "./slug";

export function EventEditorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [suffix] = useState(randomSuffix);
  const [form, setForm] = useState<EventFormState>(() => emptyEventForm(suggestSlug("", suffix)));
  const [slugTouched, setSlugTouched] = useState(false);
  const [frames, setFrames] = useState<AdminFrameChoice[]>([]);
  const [lead, setLead] = useState<{ name: string; phone: string } | null>(null);
  const [hasPrintJobs, setHasPrintJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAdminFrames()
      .then((rows) => {
        if (!cancelled) setFrames(rows);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    getAdminEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        setForm({
          title: event.title,
          slug: event.slug,
          eventDate: event.eventDate ?? "",
          place: event.place ?? "",
          frameId: event.frameId,
          printQuota: event.printQuota,
          status: event.status,
        });
        setSlugTouched(true);
        setLead(event.lead);
        setHasPrintJobs(event.hasPrintJobs);
        setReady(true);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function onChange(next: EventFormState) {
    if (!slugTouched && next.title !== form.title) {
      setForm({ ...next, slug: suggestSlug(next.title, suffix) });
      return;
    }
    setForm(next);
  }

  function invalid(next: EventFormState): string | null {
    if (!next.title.trim()) return "הזינו שם לאירוע.";
    if (!isSlug(next.slug)) return "הכתובת יכולה לכלול רק אותיות אנגליות קטנות וספרות.";
    if (!next.frameId) return "בחרו מסגרת לאירוע, או צרו אחת מתבנית.";
    if (!Number.isInteger(next.printQuota) || next.printQuota < 1) return "לכל אורח מגיע לפחות מגנט אחד.";
    return null;
  }

  async function save(next = form) {
    const problem = invalid(next);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const savedId = eventId ? await updateEvent(eventId, next) : await createEvent(next);
      if (!eventId) navigate(`/admin/events/${savedId}`, { replace: true });
      else setForm(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשמור את האירוע.");
    } finally {
      setPending(false);
    }
  }

  async function duplicate(templateId: string) {
    setDuplicating(true);
    setError(null);
    try {
      const id = await duplicateFrameForEvent(templateId);
      const rows = await listAdminFrames();
      setFrames(rows);
      setForm((current) => ({ ...current, frameId: id }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו ליצור מסגרת לאירוע.");
    } finally {
      setDuplicating(false);
    }
  }

  async function remove() {
    if (!eventId) return;
    setPending(true);
    setError(null);
    try {
      await deleteEvent(eventId);
      navigate("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו למחוק את האירוע.");
      setPending(false);
    }
  }

  if (!ready && !error) return <p className="px-4 pt-8 text-base text-ink">טוענים…</p>;

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-8">
      <Link className="inline-flex min-h-11 items-center text-base text-ink" to="/admin">
        חזרה לאירועים
      </Link>
      <h1 className="mt-3 font-display text-4xl leading-none text-ink">{eventId ? "האירוע" : "אירוע חדש"}</h1>
      <EventForm
        value={form}
        frames={frames}
        lead={lead}
        hasPrintJobs={hasPrintJobs}
        error={error}
        pending={pending}
        duplicating={duplicating}
        onChange={onChange}
        onSlugEdit={(slug) => {
          setSlugTouched(true);
          setForm((current) => ({ ...current, slug: slug.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32) }));
        }}
        onDuplicate={(templateId) => void duplicate(templateId)}
        onSubmit={() => void save()}
        onDelete={eventId && !hasPrintJobs ? () => void remove() : undefined}
        onCloseEvent={hasPrintJobs ? () => void save({ ...form, status: "closed" }) : undefined}
      />
      {eventId ? <EventShare eventId={eventId} slug={form.slug} title={form.title} /> : null}
    </section>
  );
}
