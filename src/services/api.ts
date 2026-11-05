import { toAppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { isFrameObjectPath } from "@/features/studio/storage/paths";
import type { EventCard, Frame, NewLeadInput } from "@/services/types";

export async function insertLead(input: NewLeadInput): Promise<void> {
  try {
    const { error } = await supabase.from("leads").insert({
      organizer_name: input.organizer_name.trim(),
      phone: input.phone.trim(),
      event_name: input.event_name.trim(),
      event_date: input.event_date || null,
      place: input.place?.trim() || null,
      guest_count_range: input.guest_count_range?.trim() || null,
      frame_id: input.frame_id || null,
      status: "new",
    });
    if (error) throw error;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לשמור את הפרטים. בדקו את החיבור ונסו שוב.");
  }
}

export async function getEventCardBySlug(slug: string): Promise<EventCard | null> {
  try {
    const { data, error } = await supabase
      .from("event_cards")
      .select("id, slug, title, event_date, place, frame_id, print_quota, status, cover_path, screen_path")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as EventCard | null) ?? null;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לפתוח את האירוע. בדקו את הקישור ונסו שוב.");
  }
}

export async function listPublishedFrames(): Promise<Frame[]> {
  try {
    const { data, error } = await supabase
      .from("frames")
      .select(
        "id, name, width_mm, height_mm, overlay_path, window_x, window_y, window_w, window_h, is_published, created_at",
      )
      .eq("is_published", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Frame[];
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לטעון את המסגרות. רעננו את העמוד ונסו שוב.");
  }
}

function frameJoin(value: unknown): { name?: string; is_published?: boolean } {
  const row = Array.isArray(value) ? value[0] : value;
  return (row ?? {}) as { name?: string; is_published?: boolean };
}

function frameRow(row: Record<string, unknown>) {
  const design = (row.design ?? null) as { size?: unknown; tags?: unknown } | null;
  return {
    id: row.id,
    name: row.name,
    updated_at: row.updated_at,
    revision: row.revision,
    is_template: row.is_template,
    is_published: row.is_published === true,
    size: design?.size,
    tags: design?.tags,
    doc: design,
  };
}

export const frameGateway = {
  async listTemplates() {
    const { data, error } = await supabase
      .from("frames")
      .select("id, name, updated_at, revision, is_template, is_published, design")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => frameRow(row as Record<string, unknown>));
  },
  async getTemplate(id: string) {
    const { data, error } = await supabase
      .from("frames")
      .select("id, name, revision, is_template, design")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? frameRow(data as Record<string, unknown>) : null;
  },
  async getRevision(id: string) {
    const { data, error } = await supabase.from("frames").select("revision").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.revision ?? null;
  },
  async insertTemplate(row: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("frames")
      .insert({
        id: row.id,
        name: row.name,
        design: row.doc,
        width_mm: row.width_mm,
        height_mm: row.height_mm,
        bleed_mm: row.bleed_mm,
        safe_mm: row.safe_mm,
        window_x: row.window_x,
        window_y: row.window_y,
        window_w: row.window_w,
        window_h: row.window_h,
        is_template: row.is_template !== false,
        is_published: false,
      })
      .select("revision")
      .single();
    if (error) throw error;
    return { revision: data.revision as number };
  },
  async updateTemplate(id: string, patch: Record<string, unknown>, expectedRevision: number) {
    const changes: Record<string, unknown> = {};
    if (patch.name !== undefined) changes.name = patch.name;
    if (patch.doc !== undefined) changes.design = patch.doc;
    for (const key of [
      "width_mm",
      "height_mm",
      "bleed_mm",
      "safe_mm",
      "window_x",
      "window_y",
      "window_w",
      "window_h",
      "is_published",
      "overlay_path",
      "preview_path",
    ]) {
      if (patch[key] !== undefined) changes[key] = patch[key];
    }
    const { data, error } = await supabase
      .from("frames")
      .update(changes)
      .eq("id", id)
      .eq("revision", expectedRevision)
      .select("revision");
    if (error) throw error;
    return data ?? [];
  },
  async deleteTemplate(id: string) {
    const { error } = await supabase.from("frames").delete().eq("id", id);
    if (error) throw error;
  },
  async upload(key: string, blob: Blob, options: { contentType?: string; upsert?: boolean }) {
    if (!isFrameObjectPath(key)) throw new Error("invalid_storage_path");
    const { error } = await supabase.storage.from("media").upload(key, blob, {
      contentType: options.contentType,
      upsert: options.upsert === true,
    });
    if (error) throw error;
  },
  async download(key: string) {
    const { data, error } = await supabase.storage.from("media").download(key);
    if (error) throw error;
    return data;
  },
  async list(prefix: string) {
    const { data, error } = await supabase.storage.from("media").list(prefix, { limit: 100 });
    if (error) throw error;
    return data ?? [];
  },
  async remove(keys: string[]) {
    if (!keys.length) return;
    const { error } = await supabase.storage.from("media").remove(keys);
    if (error) throw error;
  },
  async signedUrls(keys: string[], expiresInSeconds: number) {
    if (!keys.length) return [];
    const { data, error } = await supabase.storage.from("media").createSignedUrls(keys, expiresInSeconds);
    if (error) throw error;
    return data ?? [];
  },
};

export async function uploadGuestPhoto(eventId: string, guestId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${eventId}/${guestId}/${Date.now()}_${safeName}`;
  if (path.split("/")[0] === "frames" || path.split("/")[0] === "events") {
    throw toAppError(new Error("reserved"), "אי אפשר לשמור קובץ של אורח בתיקייה הזו.");
  }
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
  if (error) throw toAppError(error, "לא הצלחנו לשמור את התמונה. נסו שוב.");
  return path;
}

export type AdminEventRow = {
  id: string;
  title: string;
  status: string;
  frame_id: string | null;
  frame_name: string;
  frame_published: boolean;
};

export type AdminEventDetail = {
  id: string;
  slug: string;
  title: string;
  eventDate: string | null;
  printQuota: number;
  coverPath: string | null;
};

export type EventDraft = {
  title: string;
  eventDate: string;
  printQuota: number;
};

export async function listAdminEvents(): Promise<AdminEventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, status, frame_id, frame:frames(name, is_published)")
    .order("created_at", { ascending: false });
  if (error) throw toAppError(error, "לא הצלחנו לטעון את האירועים.");
  return (data ?? []).map((row) => {
    const frame = frameJoin(row.frame);
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      frame_id: (row.frame_id as string | null) ?? null,
      frame_name: frame.name ?? "",
      frame_published: frame.is_published === true,
    };
  });
}

const LIVE_BLOCK = "כדי להפעיל את האירוע צריך מסגרת מפורסמת. במסגרות יוצרים מסגרת לאירוע, משייכים אותה, ומפרסמים.";

export async function setEventLiveSwitch(eventId: string, live: boolean): Promise<void> {
  if (!live) {
    const closed = await supabase.from("events").update({ status: "closed" }).eq("id", eventId);
    if (closed.error) throw toAppError(closed.error, "לא הצלחנו לסגור את האירוע.");
    return;
  }
  const { data, error } = await supabase
    .from("events")
    .select("frame_id, frame:frames(name, is_published)")
    .eq("id", eventId)
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לבדוק את האירוע.");
  const frame = frameJoin(data.frame);
  if (!data.frame_id || frame.is_published !== true) throw new Error(LIVE_BLOCK);
  const update = await supabase.from("events").update({ status: "live" }).eq("id", eventId);
  if (update.error) {
    if (update.error.message?.includes("event_frame_not_published")) throw new Error(LIVE_BLOCK);
    throw toAppError(update.error, "לא הצלחנו להפעיל את האירוע.");
  }
}

export async function getAdminEvent(id: string): Promise<AdminEventDetail> {
  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, event_date, print_quota, cover_path")
    .eq("id", id)
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לפתוח את האירוע.");
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    eventDate: (data.event_date as string | null) ?? null,
    printQuota: data.print_quota as number,
    coverPath: (data.cover_path as string | null) ?? null,
  };
}

async function insertEvent(draft: EventDraft, slug: string): Promise<AdminEventDetail> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: draft.title.trim(),
      event_date: draft.eventDate,
      slug,
      print_quota: draft.printQuota,
      status: "draft",
      frame_id: null,
    })
    .select("id, slug, title")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("retry");
    throw toAppError(error, "לא הצלחנו לשמור את האירוע.");
  }
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    eventDate: draft.eventDate,
    printQuota: draft.printQuota,
    coverPath: null,
  };
}

export async function createEvent(draft: EventDraft): Promise<AdminEventDetail> {
  const { suggestSlug, randomSuffix } = await import("@/features/admin/events/slug");
  try {
    return await insertEvent(draft, suggestSlug(draft.title));
  } catch (error) {
    if (error instanceof Error && error.message === "retry") {
      return insertEvent(draft, suggestSlug(draft.title, randomSuffix()));
    }
    throw error;
  }
}

export async function updateEventDetails(eventId: string, draft: EventDraft): Promise<AdminEventDetail> {
  const { data, error } = await supabase
    .from("events")
    .update({
      title: draft.title.trim(),
      event_date: draft.eventDate,
      print_quota: draft.printQuota,
    })
    .eq("id", eventId)
    .select("id, slug, title, cover_path")
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לשמור את האירוע.");
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    eventDate: draft.eventDate,
    printQuota: draft.printQuota,
    coverPath: (data.cover_path as string | null) ?? null,
  };
}

export async function saveEventCover(eventId: string, file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith(".png") ? "png" : file.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("אפשר להעלות תמונת JPG, PNG או WebP.");
  }
  const path = `events/${eventId}/cover.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw toAppError(error, "לא הצלחנו לשמור את תמונת האירוע.");
  const update = await supabase.from("events").update({ cover_path: path }).eq("id", eventId);
  if (update.error) throw toAppError(update.error, "לא הצלחנו לשמור את תמונת האירוע.");
  return path;
}

export async function assignFrameToEvent(frameId: string, eventId: string): Promise<void> {
  const frame = await supabase.from("frames").select("is_template, is_published").eq("id", frameId).maybeSingle();
  if (frame.error) throw toAppError(frame.error, "לא הצלחנו לבדוק את המסגרת.");
  if (!frame.data || frame.data.is_template === true) {
    throw new Error("אי אפשר לשייך תבנית. צרו ממנה מסגרת לאירוע.");
  }
  const target = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (target.error || !target.data) throw toAppError(target.error, "האירוע לא נמצא.");
  if (target.data.status === "live" && frame.data.is_published !== true) {
    throw new Error("אי אפשר לשייך מסגרת שלא פורסמה לאירוע חי.");
  }
  const others = await supabase.from("events").select("id, status, title").eq("frame_id", frameId).neq("id", eventId);
  if (others.error) throw toAppError(others.error, "לא הצלחנו לבדוק את השיוך.");
  const blocking = (others.data ?? []).find((row) => row.status === "live");
  if (blocking) throw new Error(`המסגרת כבר משויכת לאירוע חי «${blocking.title}».`);
  const otherIds = (others.data ?? []).map((row) => row.id as string);
  if (otherIds.length) {
    const cleared = await supabase.from("events").update({ frame_id: null }).in("id", otherIds);
    if (cleared.error) throw toAppError(cleared.error, "לא הצלחנו לשחרר את המסגרת מהאירוע הקודם.");
  }
  const update = await supabase.from("events").update({ frame_id: frameId }).eq("id", eventId);
  if (update.error) {
    if (update.error.message?.includes("event_frame_is_template")) {
      throw new Error("אי אפשר לשייך תבנית. צרו ממנה מסגרת לאירוע.");
    }
    throw toAppError(update.error, "לא הצלחנו לשייך את המסגרת לאירוע.");
  }
}

export async function ensureGuestSession(): Promise<string> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user) return existing.data.session.user.id;
  const signed = await supabase.auth.signInAnonymously();
  if (signed.error || !signed.data.user) throw toAppError(signed.error, "לא הצלחנו לפתוח את האירוע. נסו שוב.");
  return signed.data.user.id;
}

export async function guestMagnetsLeft(eventId: string, quota: number): Promise<number> {
  const session = await supabase.auth.getSession();
  const uid = session.data.session?.user.id;
  const { data, error } = await supabase.from("print_jobs").select("guest_id, copies, status").eq("event_id", eventId);
  if (error) throw toAppError(error, "לא הצלחנו לבדוק כמה מגנטים נשארו.");
  const used = (data ?? [])
    .filter((row) => row.guest_id === uid && row.status !== "rejected")
    .reduce((sum, row) => sum + Number(row.copies ?? 0), 0);
  return Math.max(0, quota - used);
}

export async function signedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
