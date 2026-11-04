import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const phrases = [
  "בלי הורדת אפליקציה",
  "בלי הרשמה לאורחים",
  "מגנטים מודפסים, מוכנים לכל אירוע",
];

const shots = [
  { src: "/placeholders/snap-b.svg", alt: "תמונת הדגמה קטנה", className: "magnet magnet-small" },
  { src: "/hero.jpg", alt: "תמונת הדגמה על מגנט", className: "magnet magnet-main" },
];

export function HomePage() {
  const { user } = useAuth();
  const cta = "/magnet/lead";
  const loop = [...phrases, ...phrases];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper pb-32">
      <header className="flex items-center justify-between px-4 pt-4">
        <p className="font-display text-lg text-primary">MagnetimShare</p>
        <Link to={user ? "/dashboard" : "/login"} className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
          {user ? "האירועים" : "התחברות"}
        </Link>
      </header>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {loop.map((phrase, index) => (
            <span key={`${phrase}-${index}`} className="inline-flex items-center gap-3">
              <span className="marquee-item">{phrase}</span>
              <span className="marquee-dot" />
            </span>
          ))}
        </div>
      </div>

      <section className="px-4 md:grid md:grid-cols-2 md:items-center md:gap-6">
        <h1 className="sticker">
          <span className="block">תמונה בתוך מגנט.</span>
          <span className="sticker-pop block">מודפסת ומוכנה לכם.</span>
        </h1>
        <p className="mt-4 max-w-md text-base text-ink">האורחים מצלמים בתוך מסגרת שעיצבתם, ואנחנו מדפיסים לכל אחד מגנט משלו.</p>

        <div className="magnet-stage mt-6">
          {shots.map((shot) => (
            <figure key={shot.className} className={shot.className}>
              <img src={shot.src} alt={shot.alt} />
            </figure>
          ))}
        </div>
      </section>

      <Link to={cta} className="fab">
        לפרטים ולהזמנה
      </Link>
    </div>
  );
}
