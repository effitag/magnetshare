import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { guestEventUrl } from "./slug";

type Props = { eventId: string; slug: string; title: string };

export function EventShare({ eventId, slug, title }: Props) {
  const url = guestEventUrl(slug);
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#1C1416", light: "#FFFFFF" } })
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <section className="sticker-card mt-8 bg-sticker p-4 text-ink">
      <h2 className="font-display text-2xl leading-none">{title || "האירוע"}</h2>
      <p className="mt-3 break-all text-base" dir="ltr">
        {url}
      </p>
      {src ? <img className="mx-auto mt-4 w-48 max-w-full bg-sticker" src={src} alt="" width={192} height={192} /> : null}
      <div className="mt-4 flex flex-col gap-3">
        {src ? (
          <a className="inline-flex min-h-12 items-center justify-center rounded-full bg-pop px-4 text-base text-ink" href={src} download={`magnetimshare-${slug}.png`}>
            הורדת QR
          </a>
        ) : null}
        <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base" onClick={() => void copy()}>
          {copied ? "הקישור הועתק" : "העתקת קישור"}
        </button>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base" to={`/admin/events/${eventId}/card`}>
          כרטיס לשולחן
        </Link>
      </div>
    </section>
  );
}
