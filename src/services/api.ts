import type { Session } from "@supabase/supabase-js";
import { prepareCover } from "@/lib/prepare-image";
import { isSchemaMissing, toAppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { CreateEventInput, CreatedEvent, EventRow, Profile } from "@/services/types";

export type { CreateEventInput, CreatedEvent, EventRow, EventStatus, EventType, Profile, ProfileRole } from "@/services/types";

const SESSION_FALLBACK = "לא הצלחנו לשחזר את ההתחברות. רעננו את העמוד ונסו שוב.";
const AUTH_FALLBACK = "הפעולה לא הושלמה. בדקו את הפרטים ונסו שוב.";

function slug(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function safeFileName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 40) || "cover.jpg";
}

export function photoCount(event: EventRow): number {
  const photos = event.photos;
  if (Array.isArray(photos) && photos[0] && typeof photos[0].count === "number") {
    return photos[0].count;
  }
  return 0;
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    throw toAppError(error, SESSION_FALLBACK);
  }
}

export function onAuthChange(handler: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signUp(email: string, password: string, displayName: string): Promise<{ needsEmailConfirm: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
    return { needsEmailConfirm: !data.session };
  } catch (error) {
    throw toAppError(error, "ההרשמה לא הושלמה. בדקו את הפרטים ונסו שוב.");
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    throw toAppError(error, AUTH_FALLBACK);
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw toAppError(error, "ההתנתקות לא הושלמה. רעננו את העמוד ונסו שוב.");
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      if (isSchemaMissing(error)) return null;
      throw error;
    }
    return data as Profile | null;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לטעון את הפרופיל. רעננו את העמוד.");
  }
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user) {
    throw toAppError(new Error("auth"), "כדי להמשיך צריך להתחבר. עברו למסך ההתחברות.");
  }
  return session.user.id;
}

export async function listMyEvents(): Promise<EventRow[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("events")
      .select("*, photos(count)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as EventRow[];
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לטעון את האירועים. רעננו את העמוד ונסו שוב.");
  }
}

export async function getMyEvent(eventId: string): Promise<EventRow> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("events")
      .select("*, photos(count)")
      .eq("id", eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw toAppError(new Error("missing"), "האירוע לא נמצא, או שאין לכם הרשאה לראות אותו. חזרו לרשימת האירועים.");
    }
    return data as EventRow;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לפתוח את האירוע. חזרו לרשימה ונסו שוב.");
  }
}

export async function getPublicEventBySlug(slugValue: string): Promise<EventRow | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("public_slug", slugValue)
      .in("status", ["active", "closed"])
      .maybeSingle();
    if (error) {
      if (isSchemaMissing(error)) return null;
      throw error;
    }
    return (data as EventRow | null) ?? null;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לפתוח את האירוע. בדקו את הקישור ונסו שוב.");
  }
}

async function uploadCover(eventId: string, file: File): Promise<string> {
  const blob = await prepareCover(file);
  const path = `${eventId}/covers/${Date.now()}_${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("media").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createEvent(input: CreateEventInput): Promise<CreatedEvent> {
  const userId = await requireUserId();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          owner_id: userId,
          name: input.name.trim(),
          description: input.description.trim(),
          event_date: input.eventDate,
          type: input.type,
          public_slug: slug(),
          status: input.open ? "active" : "closed",
          moderation_required: input.moderationRequired,
        })
        .select("*")
        .single();
      if (error) throw error;
      const event = data as EventRow;
      if (!input.cover) return event;

      try {
        const coverPath = await uploadCover(event.id, input.cover);
        const { data: updated, error: updateError } = await supabase
          .from("events")
          .update({ cover_path: coverPath })
          .eq("id", event.id)
          .eq("owner_id", userId)
          .select("*")
          .single();
        if (updateError) throw updateError;
        return updated as EventRow;
      } catch (coverError) {
        return {
          ...event,
          coverWarning: toAppError(
            coverError,
            "האירוע נוצר, אבל תמונת השער לא עלתה. אפשר להמשיך בלי תמונה.",
          ).message,
        };
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "";
      lastError = error;
      if (code === "23505") continue;
      throw toAppError(error, "לא הצלחנו ליצור את האירוע. בדקו את החיבור ונסו שוב.");
    }
  }

  throw toAppError(lastError, "לא הצלחנו ליצור קישור ייחודי לאירוע. נסו שוב.");
}

export async function signedCoverUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (path) => {
      const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) return [path, ""] as const;
      return [path, data.signedUrl] as const;
    }),
  );
  return Object.fromEntries(pairs);
}
