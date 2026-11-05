import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { AppError } from "@/lib/errors";
import { insertLead } from "@/services/api";

const guestRanges = ["עד 30", "31–80", "81–150", "יותר מ-150"];

type LeadFields = {
  organizerName: string;
  phone: string;
  eventName: string;
  eventDate: string;
  place: string;
  guestCountRange: string;
};

const emptyLead: LeadFields = {
  organizerName: "",
  phone: "",
  eventName: "",
  eventDate: "",
  place: "",
  guestCountRange: "",
};

function isIsraeliPhone(value: string): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return /^05\d{8}$/.test(digits) || /^0[23489]\d{7}$/.test(digits) || /^07\d{8}$/.test(digits);
}

function validate(fields: LeadFields): Partial<Record<keyof LeadFields, string>> {
  const errors: Partial<Record<keyof LeadFields, string>> = {};
  if (!fields.organizerName.trim()) errors.organizerName = "הזינו את שם המארגן.";
  if (!isIsraeliPhone(fields.phone)) errors.phone = "הזינו מספר טלפון ישראלי, למשל 050-0000000.";
  if (!fields.eventName.trim()) errors.eventName = "הזינו שם לאירוע.";
  return errors;
}

export function LeadPage() {
  const [fields, setFields] = useState<LeadFields>(emptyLead);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function setField<Key extends keyof LeadFields>(key: Key, value: LeadFields[Key]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await insertLead({
        organizer_name: fields.organizerName,
        phone: fields.phone,
        event_name: fields.eventName,
        event_date: fields.eventDate || null,
        place: fields.place || null,
        guest_count_range: fields.guestCountRange || null,
      });
      setDone(true);
    } catch (caught) {
      setFormError(caught instanceof AppError ? caught.message : "לא הצלחנו לשמור את הפרטים. נסו שוב.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper px-4 pb-10">
      <header className="pt-4">
        <Link to="/" className="inline-flex min-h-11 items-center font-display text-lg text-primary">
          MagnetimShare
        </Link>
      </header>

      <main className="mx-auto mt-4 w-full max-w-lg">
        <h1 className="font-display text-4xl leading-none text-ink">לפרטים ולהזמנה</h1>
        <p className="mt-3 text-base text-ink">השאירו פרטים, ונחזור אליכם לגבי האירוע.</p>

        {done ? (
          <p className="mt-8 rounded-2xl border-[3px] border-ink bg-pop px-4 py-5 text-lg text-ink" role="status">
            קיבלנו את הפרטים. נחזור אליכם.
          </p>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Field label="שם המארגן" error={errors.organizerName}>
              <input
                className={inputClass}
                name="organizerName"
                autoComplete="name"
                value={fields.organizerName}
                onChange={(event) => setField("organizerName", event.target.value)}
              />
            </Field>
            <Field label="טלפון" error={errors.phone}>
              <input
                className={inputClass}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={fields.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
            </Field>
            <Field label="שם האירוע" error={errors.eventName}>
              <input
                className={inputClass}
                name="eventName"
                value={fields.eventName}
                onChange={(event) => setField("eventName", event.target.value)}
              />
            </Field>
            <Field label="תאריך" hint="אפשר להשאיר ריק.">
              <input
                className={inputClass}
                name="eventDate"
                type="date"
                dir="ltr"
                value={fields.eventDate}
                onChange={(event) => setField("eventDate", event.target.value)}
              />
            </Field>
            <Field label="מקום" hint="אפשר להשאיר ריק.">
              <input
                className={inputClass}
                name="place"
                autoComplete="address-level2"
                value={fields.place}
                onChange={(event) => setField("place", event.target.value)}
              />
            </Field>
            <Field label="טווח אורחים" hint="אפשר להשאיר ריק.">
              <select
                className={inputClass}
                name="guestCountRange"
                value={fields.guestCountRange}
                onChange={(event) => setField("guestCountRange", event.target.value)}
              >
                <option value="">בחרו טווח</option>
                {guestRanges.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </Field>
            {formError ? (
              <p className="text-primary" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" className="w-full border-[3px] border-ink bg-pop font-display text-base text-ink" disabled={pending}>
              {pending ? "שולחים…" : "שליחת הפרטים"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
