import { format } from "date-fns";
import { he } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";
import type { EventStatus, EventType, Profile } from "@/services/types";

export function displayName(profile: Profile | null, user: User | null): string {
  if (profile?.display_name) return profile.display_name;
  const email = user?.email ?? "";
  const local = email.split("@")[0];
  return local || "מארח";
}

export function formatEventDate(iso: string | null): string {
  if (!iso) return "ללא תאריך";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return format(new Date(year, month - 1, day), "d בMMMM yyyy", { locale: he });
}

export function statusLabel(status: EventStatus): string {
  if (status === "active") return "פתוח";
  if (status === "closed") return "סגור";
  return "טיוטה";
}

export function typeLabel(type: EventType): string {
  return type === "magnet" ? "Magnetim" : "אלבום";
}

export function photosLabel(count: number): string {
  if (count === 0) return "אין תמונות";
  if (count === 1) return "תמונה אחת";
  return `${count} תמונות`;
}

export function guestPath(slug: string): string {
  return `/e/${slug}`;
}

export function guestUrl(slug: string): string {
  if (typeof window === "undefined") return guestPath(slug);
  return `${window.location.origin}${guestPath(slug)}`;
}
