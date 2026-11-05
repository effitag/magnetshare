import type { FormEvent } from "react";
import type { AdminFrameChoice } from "@/services/api";
import { FramePicker } from "./FramePicker";
import type { EventFormState } from "./eventForm";
import { isPastDate } from "./slug";

const fieldClass = "field-scroll sticker-card sticker-flat min-h-11 w-full bg-sticker px-3 text-base text-ink";

type Lead = { name: string; phone: string };

type Props = {
  value: EventFormState;
  frames: AdminFrameChoice[];
  lead: Lead | null;
  hasPrintJobs: boolean;
  error: string | null;
  pending: boolean;
  duplicating: boolean;
  onChange: (next: EventFormState) => void;
  onSlugEdit: (slug: string) => void;
  onDuplicate: (templateId: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  onCloseEvent?: () => void;
};

export function EventForm({
  value,
  frames,
  lead,
  hasPrintJobs,
  error,
  pending,
  duplicating,
  onChange,
  onSlugEdit,
  onDuplicate,
  onSubmit,
  onDelete,
  onCloseEvent,
}: Props) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
      {lead ? (
        <div className="sticker-card sticker-flat bg-sticker px-4 py-3 text-base text-ink">
          <p>מהפנייה</p>
          <p className="mt-1">{lead.name}</p>
          <p className="mt-1" dir="ltr">
            {lead.phone}
          </p>
        </div>
      ) : null}
      <label className="flex flex-col gap-2 text-base text-ink">
        שם האירוע
        <input className={fieldClass} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} />
      </label>
      <label className="flex flex-col gap-2 text-base text-ink">
        תאריך
        <input
          className={fieldClass}
          type="date"
          value={value.eventDate}
          onChange={(event) => onChange({ ...value, eventDate: event.target.value })}
        />
        {isPastDate(value.eventDate) ? <span>התאריך הזה כבר עבר. אפשר לשמור בכל זאת.</span> : null}
      </label>
      <label className="flex flex-col gap-2 text-base text-ink">
        מקום
        <input className={fieldClass} value={value.place} onChange={(event) => onChange({ ...value, place: event.target.value })} />
      </label>
      <FramePicker
        frames={frames}
        value={value.frameId}
        pending={duplicating}
        onChange={(frameId) => onChange({ ...value, frameId })}
        onDuplicate={onDuplicate}
      />
      <label className="flex flex-col gap-2 text-base text-ink">
        מגנטים לאורח
        <input
          className={fieldClass}
          type="number"
          min={1}
          inputMode="numeric"
          value={value.printQuota}
          onChange={(event) => onChange({ ...value, printQuota: Number(event.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-2 text-base text-ink">
        סטטוס
        <select
          className={fieldClass}
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as EventFormState["status"] })}
        >
          <option value="draft">טיוטה</option>
          <option value="live">חי</option>
          <option value="closed">סגור</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-base text-ink">
        כתובת
        <input className={fieldClass} dir="ltr" value={value.slug} onChange={(event) => onSlugEdit(event.target.value)} />
      </label>
      {error ? (
        <p className="text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink bg-pop px-4 text-lg text-ink"
        disabled={pending}
      >
        {pending ? "שומרים…" : "שמירה"}
      </button>
      {hasPrintJobs ? (
        <button type="button" className="min-h-12 text-base text-ink" onClick={onCloseEvent} disabled={pending}>
          סגירת אירוע
        </button>
      ) : onDelete ? (
        <button type="button" className="min-h-12 text-base text-primary" onClick={onDelete} disabled={pending}>
          מחיקה
        </button>
      ) : null}
    </form>
  );
}
