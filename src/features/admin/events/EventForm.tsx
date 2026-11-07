import { useEffect, useState, type FormEvent } from "react";
import { EVENT_TYPES, type EventType } from "@/lib/eventTypes";

const fieldClass =
  "field-scroll sticker-card sticker-flat box-border min-h-11 w-full min-w-0 max-w-full bg-sticker px-3 text-base text-ink";

export type EventFormValue = {
  title: string;
  eventDate: string;
  printQuota: number;
  eventType: EventType | null;
};

type Props = {
  value: EventFormValue;
  coverName: string | null;
  error: string | null;
  pending: boolean;
  onChange: (next: EventFormValue) => void;
  onCover: (file: File | null) => void;
  onSubmit: () => void;
};

export function EventForm({ value, coverName, error, pending, onChange, onCover, onSubmit }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="grid grid-cols-[minmax(0,1fr)] gap-3 overflow-x-clip" onSubmit={submit} noValidate>
      <label className="flex min-w-0 flex-col gap-1 text-base text-ink">
        שם האירוע
        <span className="text-base text-ink">כך יופיע על המגנט</span>
        <input className={fieldClass} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} />
      </label>
      <fieldset className="flex min-w-0 flex-col gap-2 text-base text-ink">
        <legend className="mb-1">סוג האירוע</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => (
            <label
              key={type.id}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-[3px] border-ink px-4 text-base has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                value.eventType === type.id ? "bg-pop" : "bg-sticker"
              }`}
            >
              <input
                type="radio"
                name="event-type"
                className="sr-only"
                value={type.id}
                checked={value.eventType === type.id}
                onChange={() => onChange({ ...value, eventType: type.id })}
              />
              {type.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-w-0 flex-col gap-1 text-base text-ink">
        תאריך
        <span className="block min-w-0 overflow-hidden">
          <input
            className={`${fieldClass} field-date`}
            type="date"
            required
            value={value.eventDate}
            onChange={(event) => onChange({ ...value, eventDate: event.target.value })}
          />
        </span>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-base text-ink">
        תמונת האירוע
        <span className="text-base text-ink">לא חובה</span>
        <input
          className={fieldClass}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (preview) URL.revokeObjectURL(preview);
            setPreview(file ? URL.createObjectURL(file) : null);
            onCover(file);
          }}
        />
        {preview ? <img className="mt-2 h-24 w-24 rounded-2xl border-[3px] border-ink object-cover" src={preview} alt="" /> : null}
        {!preview && coverName ? <span>נשמרה תמונה</span> : null}
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-base text-ink">
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
      {error ? (
        <p className="text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom,0px))] z-10 inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink bg-pop px-4 text-lg text-ink"
        disabled={pending}
      >
        {pending ? "שומרים…" : "שמירה"}
      </button>
    </form>
  );
}
