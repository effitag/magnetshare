import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { whatsAppUrl } from "@/config/contact";
import { AppError } from "@/lib/errors";
import { insertLead } from "@/services/api";

const eventTypes = ["חתונה", "בר מצווה", "בת מצווה", "ברית", "אירוע חברה", "יום הולדת"];
const HOME_EVENT_NAME = "פנייה מדף הבית";

function isIsraeliPhone(value: string): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return /^05\d{8}$/.test(digits) || /^0[23489]\d{7}$/.test(digits) || /^07\d{8}$/.test(digits);
}

export function ContactSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function keepVisible(target: EventTarget) {
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: { name?: string; phone?: string } = {};
    if (!name.trim()) next.name = "הזינו שם.";
    if (!isIsraeliPhone(phone)) next.phone = "הזינו מספר טלפון ישראלי, למשל 050-0000000.";
    setErrors(next);
    setFormError(null);
    if (next.name || next.phone) return;

    setPending(true);
    try {
      await insertLead({
        organizer_name: name,
        phone,
        event_name: eventType ? `${HOME_EVENT_NAME}: ${eventType}` : HOME_EVENT_NAME,
      });
      setDone(true);
    } catch (caught) {
      setFormError(caught instanceof AppError ? caught.message : "לא הצלחנו לשמור את הפרטים. נסו שוב.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="contact" className="scroll-mt-6 bg-pop px-4 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]" aria-labelledby="contact-title">
      <div className="mx-auto w-full max-w-lg">
        <h2 id="contact-title" className="section-title">
          ספרו לנו על האירוע
        </h2>
        <p className="mt-4 text-base text-ink">שם וטלפון מספיקים. נחזור אליכם.</p>
        {done ? (
          <p className="sticker-card mt-6 bg-sticker px-4 py-5 text-base text-ink" role="status">
            קיבלנו את הפרטים. נחזור אליכם.
          </p>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <label className="flex flex-col gap-2 text-base text-ink">
              שם
              <input
                className="field-scroll sticker-card sticker-flat min-h-11 w-full bg-sticker px-3 text-base text-ink"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onFocus={(event) => keepVisible(event.target)}
              />
              {errors.name ? (
                <span className="text-base text-primary" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-2 text-base text-ink">
              טלפון
              <input
                className="field-scroll sticker-card sticker-flat min-h-11 w-full bg-sticker px-3 text-base text-ink"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onFocus={(event) => keepVisible(event.target)}
              />
              {errors.phone ? (
                <span className="text-base text-primary" role="alert">
                  {errors.phone}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-2 text-base text-ink">
              איזה אירוע
              <span className="text-base text-ink">אפשר לדלג.</span>
              <select
                className="sticker-card sticker-flat min-h-11 w-full bg-sticker px-3 text-base text-ink"
                name="eventType"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="">עוד לא בחרנו</option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            {formError ? (
              <p className="text-base text-primary" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              className="field-scroll sticker-card inline-flex min-h-14 w-full items-center justify-center bg-sticker px-4 font-display text-xl text-ink"
              disabled={pending}
              onFocus={(event) => keepVisible(event.target)}
            >
              {pending ? "שולחים…" : "שלחו, ונחזור"}
            </button>
            <a
              className="sticker-card inline-flex min-h-11 w-full items-center justify-center bg-paper px-4 font-display text-base text-ink"
              href={whatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              וואטסאפ
            </a>
            <Link to="/privacy" className="inline-flex min-h-11 items-center text-base text-ink underline">
              הפרטים משמשים רק כדי לחזור אליכם
            </Link>
          </form>
        )}
      </div>
    </section>
  );
}
