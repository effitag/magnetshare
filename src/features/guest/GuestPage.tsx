import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ensureGuestSession, getEventCardBySlug, guestMagnetsLeft, signedMediaUrl } from "@/services/api";
import { inAppBrowser } from "./browser";
import { GuestLanding } from "./GuestLanding";

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(year, month - 1, day));
}

export function GuestPage() {
  const { slug = "" } = useParams();
  const [view, setView] = useState<"loading" | "missing" | "closed" | "live">("loading");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventCardBySlug(slug)
      .then(async (card) => {
        if (cancelled) return;
        if (!card) {
          setView("missing");
          return;
        }
        if (card.status === "closed") {
          setView("closed");
          return;
        }
        await ensureGuestSession();
        const [magnets, cover] = await Promise.all([
          guestMagnetsLeft(card.id, card.print_quota),
          card.cover_path ? signedMediaUrl(card.cover_path) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setTitle(card.title);
        setWhen(dateLabel(card.event_date));
        setCoverUrl(cover);
        setLeft(magnets);
        setView("live");
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <main className="bg-paper px-4 pt-10 text-base text-primary">{error}</main>;
  }
  if (view === "loading") {
    return <main className="bg-paper px-4 pt-10 text-base text-ink">טוענים…</main>;
  }
  return (
    <GuestLanding
      mode={view}
      title={title}
      dateLabel={when}
      coverUrl={coverUrl}
      magnetsLeft={left}
      inApp={inAppBrowser(navigator.userAgent)}
      cameraTo={`/e/${slug}/camera`}
    />
  );
}
