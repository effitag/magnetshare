import { useState } from "react";
import { SHOW_GALLERY, SHOW_TESTIMONIALS } from "@/config/home";

const steps = [
  {
    title: "קוד קטן, דף פתוח",
    body: "האורחים סורקים ומגיעים ישר לצילום.",
    icon: "scan",
  },
  {
    title: "תמונה בתוך המסגרת",
    body: "העיצוב של האירוע כבר מחכה להם.",
    icon: "camera",
  },
  {
    title: "מגנט מודפס",
    body: "כל אחד יוצא עם מגנט משלו.",
    icon: "magnet",
  },
] as const;

const benefits = [
  { title: "מגנט ביד", body: "לא נשאר רק קובץ בטלפון.", pin: "bg-pop" },
  { title: "בלי חשבון לאורחים", body: "נכנסים מהקישור, ומצלמים.", pin: "bg-primary" },
  { title: "עמדה באירוע", body: "ההדפסה קורית במקום.", pin: "bg-paper" },
];

const occasions = ["חתונות", "בר ובת מצווה", "ברית", "אירועי חברה", "ימי הולדת"];

const gallery = [
  { src: "/placeholders/gallery-1.svg", alt: "מגנט לדוגמה 1, להחלפה" },
  { src: "/placeholders/gallery-2.svg", alt: "מגנט לדוגמה 2, להחלפה" },
  { src: "/placeholders/gallery-3.svg", alt: "מגנט לדוגמה 3, להחלפה" },
  { src: "/placeholders/gallery-4.svg", alt: "מגנט לדוגמה 4, להחלפה" },
  { src: "/placeholders/gallery-5.svg", alt: "מגנט לדוגמה 5, להחלפה" },
];

const questions = [
  {
    q: "האורחים צריכים אפליקציה?",
    a: "לא. סורקים קוד ומצלמים בדפדפן, בלי הרשמה.",
  },
  {
    q: "כמה מגנטים כל אורח מקבל?",
    a: "[TO CONFIRM] המספר נקבע לכל אירוע, ולא מופיע כאן.",
  },
  {
    q: "תוך כמה זמן המגנט מוכן?",
    a: "[TO CONFIRM] אין כאן הבטחת זמן.",
  },
  {
    q: "לאילו אירועים זה מתאים?",
    a: "חתונות, בר ובת מצווה, ברית, אירועי חברה וימי הולדת.",
  },
  {
    q: "איך מזמינים?",
    a: "משאירים שם וטלפון למטה, או כותבים בוואטסאפ.",
  },
];

const visibleQuestions = questions.filter(
  (item) => item.q !== "כמה מגנטים כל אורח מקבל?" && item.q !== "תוך כמה זמן המגנט מוכן?",
);

function Wave({ className }: { className: string }) {
  return (
    <svg className={`wave ${className}`} viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 28c180-24 300 20 480 8s300-28 480-8 300 24 480 8v12H0z" fill="currentColor" />
    </svg>
  );
}

function LineIcon({ name }: { name: "scan" | "camera" | "magnet" }) {
  if (name === "scan") {
    return (
      <svg className="step-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M14 8H8v6M34 8h6v6M14 40H8v-6M34 40h6v-6M16 24h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg className="step-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="8" y="14" width="32" height="22" rx="4" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="24" cy="25" r="6" stroke="currentColor" strokeWidth="2.5" />
        <path d="M18 14l2-4h8l2 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="step-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="12" y="8" width="24" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 18h24" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

function FaqList() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mt-6 flex flex-col gap-5">
      {visibleQuestions.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className="sticker-card bg-sticker px-3 py-2">
            <h3>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 text-start text-lg font-medium text-ink"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-pop font-display text-2xl leading-none text-ink">
                  {isOpen ? "–" : "+"}
                </span>
                <span>{item.q}</span>
              </button>
            </h3>
            {isOpen ? <p className="px-2 pb-3 text-base text-ink">{item.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function Testimonials() {
  if (!SHOW_TESTIMONIALS) return null;
  return (
    <section className="band px-4 py-12" aria-label="המלצות">
      <div className="mx-auto max-w-3xl">
        <h2 className="section-title">עוד רגע</h2>
        <ul className="mt-8 grid gap-4" />
      </div>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <section id="steps" className="band-wash" aria-labelledby="steps-title">
        <div className="mx-auto max-w-xl px-4 pt-12 pb-4">
          <h2 id="steps-title" className="section-title">
            איך זה עובד
          </h2>
          <p className="mt-3 text-base text-ink">קוד, צילום, מגנט.</p>
          <ol className="mt-8 flex flex-col gap-2">
            {steps.map((step, index) => (
              <li key={step.title}>
                <div className={`sticker-card flex items-center gap-3 bg-sticker p-3 ${index % 2 === 0 ? "tilt-a" : "tilt-b"}`}>
                  <div className="relative shrink-0">
                    <div className="grid size-[5.5rem] place-items-center rounded-2xl border-[3px] border-ink bg-sticker text-ink">
                      <LineIcon name={step.icon} />
                    </div>
                    <span className="absolute -top-2 -start-2 inline-flex size-11 items-center justify-center rounded-full border-[3px] border-ink bg-pop font-display text-xl text-ink">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-ink">{step.title}</h3>
                    <p className="mt-1 text-base text-ink">{step.body}</p>
                  </div>
                </div>
                {index < steps.length - 1 ? (
                  <div className="flex justify-center py-2 text-ink" aria-hidden="true">
                    <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
                      <path d="M10 2v18M4 14l6 8 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        <Wave className="text-surface" />
      </section>

      <section id="benefits" className="band-white" aria-labelledby="benefits-title">
        <div className="mx-auto max-w-5xl px-4 pt-12 pb-4">
          <h2 id="benefits-title" className="section-title">
            למה מגנטים
          </h2>
          <p className="mt-3 text-base text-ink">קטן, מודפס, ונשאר.</p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {benefits.map((item, index) => (
              <li key={item.title} className={`sticker-card relative bg-sticker p-4 ${index % 2 === 0 ? "tilt-a" : "tilt-b"}`}>
                <span className={`absolute -top-2 end-6 size-4 rounded-full border-2 border-ink ${item.pin}`} />
                <h3 className="text-lg font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-base text-ink">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <Wave className="text-paper" />
      </section>

      <section id="events" className="band px-4 py-12" aria-labelledby="events-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="events-title" className="section-title">
            לאילו אירועים
          </h2>
          <p className="mt-3 text-base text-ink">מהחתונה ועד יום ההולדת.</p>
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {occasions.map((occasion, index) => (
              <li
                key={occasion}
                className={`sticker-card flex min-h-16 items-center justify-center bg-sticker px-3 py-4 text-center text-lg text-ink ${index % 2 === 0 ? "tilt-a" : "tilt-b"}`}
              >
                {occasion}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {SHOW_GALLERY ? (
      <section id="gallery" className="band-white" aria-labelledby="gallery-title">
        <div className="mx-auto max-w-5xl px-4 pt-12 pb-4">
          <h2 id="gallery-title" className="section-title">
            טעימה, עד שיהיו תמונות
          </h2>
          <p className="mt-4 text-base text-ink">התמונות מסומנות להחלפה. הן לא צילומים אמיתיים.</p>
          <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {gallery.map((item, index) => (
              <li key={item.src} className={index % 2 === 0 ? "tilt-a" : "tilt-b"}>
                <figure className="gallery-card">
                  <img src={item.src} alt={item.alt} />
                </figure>
              </li>
            ))}
          </ul>
        </div>
        <Wave className="text-[var(--color-pop-wash)]" />
      </section>
      ) : (
        <Wave className="text-[var(--color-pop-wash)]" />
      )}

      <section id="faq" className="band-wash" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl px-4 pt-12 pb-4">
          <h2 id="faq-title" className="section-title">
            שאלות נפוצות
          </h2>
          <p className="mt-3 text-base text-ink">בקצרה, בלי אותיות קטנות.</p>
          <FaqList />
        </div>
        <Wave className="text-pop" />
      </section>

      <Testimonials />
    </>
  );
}
