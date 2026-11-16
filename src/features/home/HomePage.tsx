import { useEffect, useState } from "react";
import { whatsAppUrl } from "@/config/contact";
import { ContactSection } from "@/features/home/ContactSection";
import { HeroPhones } from "@/features/home/HeroPhones";
import { HomeSections } from "@/features/home/HomeSections";
import { SiteFooter } from "@/features/home/SiteFooter";
import { WhatsAppIcon } from "@/features/home/WhatsAppIcon";

const phrases = [
  "בלי הורדת אפליקציה",
  "בלי הרשמה לאורחים",
  "מגנטים מודפסים, מוכנים לכל אירוע",
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
      <header className="relative z-20 flex items-center justify-between gap-3 bg-paper px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <p className="font-display text-lg text-primary">MagnetimShare</p>
        <a className="btn btn-pop header-cta" href="#contact">
          ספרו לנו על האירוע
        </a>
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

      <section className="px-4 text-center md:grid md:grid-cols-2 md:items-center md:gap-6 md:pt-12 md:text-start">
        <div>
          <h1 className="sticker">
            <span className="block">תמונה בתוך מגנט.</span>
            <span className="sticker-pop block">מודפסת ומוכנה לכם.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-ink md:mx-0">
            האורחים מצלמים בתוך מסגרת מעוצבת, ואנחנו מדפיסים לכל אחד מגנט משלו.
          </p>
        </div>

        <div className="hero-visual mt-8 md:mt-0">
          <HeroPhones />
          <a className="btn btn-pop" href="#contact">
            ספרו לנו על האירוע
          </a>
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
