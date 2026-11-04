import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { EventType } from "@/services/types";

type DetailsProps = {
  name: string;
  date: string;
  description: string;
  coverPreview: string | null;
  errors: Record<string, string>;
  onName: (value: string) => void;
  onDate: (value: string) => void;
  onDescription: (value: string) => void;
  onCover: (file: File | null) => void;
};

export function WizardDetails(props: DetailsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="שם האירוע" error={props.errors.name}>
        <input className={inputClass} value={props.name} onChange={(event) => props.onName(event.target.value)} />
      </Field>
      <Field label="תאריך" error={props.errors.date}>
        <input className={inputClass} type="date" value={props.date} onChange={(event) => props.onDate(event.target.value)} />
      </Field>
      <Field label="תיאור קצר" error={props.errors.description} hint="אפשר להשאיר ריק.">
        <textarea
          className={cn(inputClass, "min-h-24 py-3")}
          value={props.description}
          onChange={(event) => props.onDescription(event.target.value)}
        />
      </Field>
      <Field label="תמונת שער">
        <input
          className="block min-h-11 w-full text-sm"
          type="file"
          accept="image/*"
          onChange={(event) => props.onCover(event.target.files?.[0] ?? null)}
        />
      </Field>
      {props.coverPreview ? (
        <img src={props.coverPreview} alt="תצוגה מקדימה של תמונת השער" className="aspect-video w-full rounded-xl object-cover" />
      ) : null}
    </div>
  );
}

type TypeProps = { type: EventType; onType: (type: EventType) => void };

export function WizardType({ type, onType }: TypeProps) {
  const options: { id: EventType; title: string; body: string }[] = [
    { id: "share", title: "אלבום משותף", body: "אורחים מצלמים, ואתם רואים הכל במקום אחד. בלי מסגרת ובלי הדפסה." },
    { id: "magnet", title: "Magnetim", body: "אותו אלבום, עם מקום למסגרת מגנט ולתור הדפסה בהמשך." },
  ];
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const selected = type === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onType(option.id)}
            className={cn(
              "rounded-2xl bg-surface p-4 text-start shadow-card",
              selected && "ring-2 ring-primary",
            )}
          >
            <span className="text-lg font-semibold">{option.title}</span>
            <span className="mt-1 block text-sm text-muted">{option.body}</span>
          </button>
        );
      })}
    </div>
  );
}

type PrivacyProps = {
  moderationRequired: boolean;
  open: boolean;
  onModeration: (value: boolean) => void;
  onOpen: (value: boolean) => void;
};

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3 text-start shadow-card"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={cn("flex h-7 w-12 rounded-full p-1", checked ? "bg-primary" : "bg-line")}>
        <span className={cn("block size-5 rounded-full bg-surface", checked ? "ms-auto" : "")} />
      </span>
    </button>
  );
}

export function WizardPrivacy({ moderationRequired, open, onModeration, onOpen }: PrivacyProps) {
  return (
    <div className="flex flex-col gap-3">
      <SwitchRow
        label="תמונות דורשות אישור לפני שהן גלויות"
        checked={moderationRequired}
        onChange={onModeration}
      />
      <SwitchRow label="האירוע פתוח להעלאות" checked={open} onChange={onOpen} />
      <p className="text-sm text-muted">
        {open ? "אורחים יוכלו לשלוח תמונות ברגע שהאלבום ייפתח." : "האירוע יישמר סגור, בלי העלאות חדשות."}
      </p>
    </div>
  );
}
