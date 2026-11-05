import { useEffect, useState } from "react";
import { whatsAppUrl } from "@/config/contact";
import { ContactSection } from "@/features/home/ContactSection";
import { HomeSections } from "@/features/home/HomeSections";
import { SiteFooter } from "@/features/home/SiteFooter";
import { WhatsAppIcon } from "@/features/home/WhatsAppIcon";

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
  const loop = [...phrases, ...phrases];
  const [contactVisible, setContactVisible] = useState(false);

  useEffect(() => {
    const node = document.getElementById("contact");
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setContactVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper">
      <header className="relative z-20 bg-paper px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <p className="font-display text-lg text-primary">MagnetimShare</p>
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
        <p className="mt-4 max-w-md text-base text-ink">
          האורחים מצלמים בתוך מסגרת מעוצבת, ואנחנו מדפיסים לכל אחד מגנט משלו.
        </p>

        <div className="magnet-stage mt-6">
          {shots.map((shot) => (
            <figure key={shot.className} className={shot.className}>
              <img src={shot.src} alt={shot.alt} />
            </figure>
          ))}
        </div>
      </section>

      <HomeSections />
      <ContactSection />
      <SiteFooter />

      {contactVisible ? null : (
        <a className="fab" href={whatsAppUrl()} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon />
          דברו איתנו בוואטסאפ
        </a>
      )}
    </div>
  );
}
