import { Link } from "react-router-dom";

const steps = [
  "האורחים מצלמים בתוך הפריים שלכם.",
  "אתם מאשרים את התמונות.",
  "המגנטים מודפסים ונשלחים.",
];

export function MagnetimBlock({ href }: { href: string }) {
  return (
    <section className="mt-16 px-4 md:grid md:grid-cols-2 md:items-center md:gap-10" aria-labelledby="magnetim-title">
      <div>
        <p className="w-fit text-sm font-medium text-ink underline decoration-pop decoration-2 underline-offset-4">Magnetim</p>
        <h2 id="magnetim-title" className="mt-3 font-display text-4xl leading-none text-ink">
          <span className="block">פריים מודפס,</span>
          <span className="block">ביד הביתה</span>
        </h2>
        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-pop font-medium text-ink" aria-hidden="true">
                {index + 1}
              </span>
              <p className="pt-2.5 text-base text-ink">{step}</p>
            </li>
          ))}
        </ol>
        <Link to={href} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-pop px-5 text-base font-medium text-ink">
          לפרטים על Magnetim
        </Link>
      </div>
      <figure className="magnet magnet-solo mx-auto mt-10 md:mt-0">
        <img src="/hero.jpg" alt="תמונת הדגמה על מגנט מודפס" />
      </figure>
    </section>
  );
}
