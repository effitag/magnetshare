const steps = [
  { title: "סורקים את הקוד", body: "האורחים פותחים את הדף מהטלפון, בלי הורדת אפליקציה." },
  { title: "מצלמים בתוך המסגרת", body: "התמונה נכנסת למסגרת שעיצבתם לאירוע." },
  { title: "מקבלים מגנט מודפס", body: "כל אורח מקבל מגנט עם התמונה שלו." },
];

const offers = [
  { title: "מגנטים מודפסים", body: "עם המסגרת של האירוע." },
  { title: "עמדת הדפסה במקום", body: "ההדפסה קורית באירוע עצמו." },
  { title: "מסגרת לאירוע", body: "מסגרת אחת, מעוצבת עבורכם." },
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

export function HomeSections() {
  return (
    <>
      <section className="px-4 py-10" aria-labelledby="steps-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="steps-title" className="font-display text-4xl leading-none text-ink">
            איך זה עובד
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border-[3px] border-ink bg-surface p-4">
                <p className="inline-flex size-11 items-center justify-center rounded-full bg-pop font-display text-2xl text-ink">
                  {index + 1}
                </p>
                <h3 className="mt-2 text-xl font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-base text-ink">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-10" aria-labelledby="offer-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="offer-title" className="font-display text-4xl leading-none text-ink">
            מה מקבלים
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {offers.map((offer) => (
              <li key={offer.title} className="rounded-2xl border-[3px] border-ink bg-pop p-4">
                <h3 className="text-xl font-medium text-ink">{offer.title}</h3>
                <p className="mt-2 text-base text-ink">{offer.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-10" aria-labelledby="events-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="events-title" className="font-display text-4xl leading-none text-ink">
            לאילו אירועים
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {occasions.map((occasion) => (
              <li
                key={occasion}
                className="flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink bg-surface px-3 py-4 text-center text-base text-ink"
              >
                {occasion}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-10" aria-labelledby="gallery-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="gallery-title" className="font-display text-4xl leading-none text-ink">
            מגנטים לדוגמה
          </h2>
          <p className="mt-3 text-base text-ink">התמונות מסומנות להחלפה. הן לא צילומים אמיתיים.</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {gallery.map((item) => (
              <li key={item.src} className="overflow-hidden">
                <figure className="gallery-card">
                  <img src={item.src} alt={item.alt} />
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-10" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="font-display text-4xl leading-none text-ink">
            שאלות
          </h2>
          <dl className="mt-6 flex flex-col gap-4">
            {questions.map((item) => (
              <div key={item.q} className="rounded-2xl border-[3px] border-ink bg-surface p-4">
                <dt className="text-xl font-medium text-ink">{item.q}</dt>
                <dd className="mt-2 text-base text-ink">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
