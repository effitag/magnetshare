import { format } from "date-fns";
import { he } from "date-fns/locale";

export function formatEventDate(iso: string | null): string {
  if (!iso) return "ללא תאריך";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return format(new Date(year, month - 1, day), "d בMMMM yyyy", { locale: he });
}

export function guestPath(slug: string): string {
  return `/e/${slug}`;
}

export function guestUrl(slug: string): string {
  if (typeof window === "undefined") return guestPath(slug);
  return `${window.location.origin}${guestPath(slug)}`;
}
