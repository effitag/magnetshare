import { Link } from "react-router-dom";
import { whatsAppUrl } from "@/config/contact";

export function SiteFooter() {
  return (
    <footer className="px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 border-t-[3px] border-ink pt-6">
        <p className="font-display text-lg text-primary">MagnetimShare</p>
        <a className="inline-flex min-h-11 items-center text-base text-ink underline" href={whatsAppUrl()} target="_blank" rel="noopener noreferrer">
          וואטסאפ
        </a>
        <Link to="/terms" className="inline-flex min-h-11 items-center text-base text-ink underline">
          תנאים
        </Link>
        <Link to="/privacy" className="inline-flex min-h-11 items-center text-base text-ink underline">
          פרטיות
        </Link>
        <Link to="/accessibility" className="inline-flex min-h-11 items-center text-base text-ink underline">
          הצהרת נגישות
        </Link>
      </div>
    </footer>
  );
}
