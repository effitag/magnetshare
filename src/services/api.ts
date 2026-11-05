import { toAppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { isFrameObjectPath } from "@/features/studio/storage/paths";
import type { EventCard, EventStatus, Frame, NewLeadInput } from "@/services/types";

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
      .select("id, slug, title, event_date, place, frame_id, print_quota, status")
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
  if (path.split("/")[0] === "frames") {
    throw toAppError(new Error("frames"), "אי אפשר לשמור קובץ של אורח בתיקיית המסגרות.");
  }
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
  if (error) throw toAppError(error, "לא הצלחנו לשמור את התמונה. נסו שוב.");
  return path;
}

export type AdminEventRow = {
  id: string;
  title: string;
  status: string;
  frame_id: string;
  frame_name: string;
  frame_published: boolean;
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
      id: row.id,
      title: row.title,
      status: row.status,
      frame_id: row.frame_id,
      frame_name: frame.name ?? "מסגרת",
      frame_published: frame.is_published === true,
    };
  });
}

export async function setEventLive(eventId: string): Promise<void> {
  const event = await getAdminEvent(eventId);
  if (!event.framePublished) {
    throw new Error(`כדי להפעיל את האירוע, פרסמו קודם את המסגרת "${event.frameName}".`);
  }
  const update = await supabase.from("events").update({ status: "live" }).eq("id", eventId);
  if (update.error) throw toAppError(update.error, "לא הצלחנו להפעיל את האירוע.");
}

export type AdminFrameChoice = {
  id: string;
  name: string;
  isTemplate: boolean;
  isPublished: boolean;
};

export async function listAdminFrames(): Promise<AdminFrameChoice[]> {
  const { data, error } = await supabase.from("frames").select("id, name, is_template, is_published").order("name", { ascending: true });
  if (error) throw toAppError(error, "לא הצלחנו לטעון את המסגרות.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "מסגרת",
    isTemplate: row.is_template === true,
    isPublished: row.is_published === true,
  }));
}

export async function duplicateFrameForEvent(templateId: string): Promise<string> {
  try {
    const { createCloudRepo } = await import("@/features/studio/storage/cloudRepo");
    const created = await createCloudRepo(frameGateway).duplicateForEvent(templateId);
    return created.id as string;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו ליצור מסגרת לאירוע.");
  }
}

export type EventDraft = {
  title: string;
  slug: string;
  eventDate: string;
  place: string;
  frameId: string;
  printQuota: number;
  status: EventStatus;
};

export type AdminEventDetail = {
  id: string;
  title: string;
  slug: string;
  eventDate: string | null;
  place: string | null;
  frameId: string;
  frameName: string;
  framePublished: boolean;
  printQuota: number;
  status: EventStatus;
  lead: { name: string; phone: string } | null;
  hasPrintJobs: boolean;
};

function eventRow(draft: EventDraft) {
  return {
    title: draft.title.trim(),
    slug: draft.slug.trim().toLowerCase(),
    event_date: draft.eventDate || null,
    place: draft.place.trim() || null,
    frame_id: draft.frameId,
    print_quota: draft.printQuota,
    status: draft.status,
  };
}

function eventWriteError(error: unknown): never {
  const raw = error as { code?: string; message?: string };
  if (raw.message?.includes("event_frame_is_template")) {
    throw new Error("אי אפשר לבחור תבנית. צרו ממנה מסגרת לאירוע.");
  }
  if (raw.code === "23505") throw new Error("הכתובת הזו תפוסה. בחרו כתובת אחרת.");
  if (raw.code === "23514" && raw.message?.includes("print_quota")) {
    throw new Error("לכל אורח מגיע לפחות מגנט אחד.");
  }
  throw toAppError(error, "לא הצלחנו לשמור את האירוע.");
}

async function assertLiveFrame(frameId: string): Promise<void> {
  const { data, error } = await supabase.from("frames").select("name, is_published, is_template").eq("id", frameId).maybeSingle();
  if (error || !data) throw toAppError(error, "לא הצלחנו לבדוק את המסגרת.");
  if (data.is_template === true) throw new Error("אי אפשר לבחור תבנית. צרו ממנה מסגרת לאירוע.");
  if (data.is_published !== true) {
    throw new Error(`כדי להפעיל את האירוע, פרסמו קודם את המסגרת "${data.name ?? "מסגרת"}".`);
  }
}

export async function createEvent(draft: EventDraft): Promise<string> {
  if (draft.status === "live") await assertLiveFrame(draft.frameId);
  const { data, error } = await supabase.from("events").insert(eventRow(draft)).select("id").single();
  if (error) eventWriteError(error);
  return data.id as string;
}

export async function updateEvent(eventId: string, draft: EventDraft): Promise<string> {
  if (draft.status === "live") await assertLiveFrame(draft.frameId);
  const { error } = await supabase.from("events").update(eventRow(draft)).eq("id", eventId);
  if (error) eventWriteError(error);
  return eventId;
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getAdminEvent(id: string): Promise<AdminEventDetail> {
  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, event_date, place, frame_id, print_quota, status, frame:frames(name, is_published), lead:leads(organizer_name, phone)")
    .eq("id", id)
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לפתוח את האירוע.");
  const jobs = await supabase.from("print_jobs").select("id").eq("event_id", id).limit(1);
  if (jobs.error) throw toAppError(jobs.error, "לא הצלחנו לבדוק את עבודות ההדפסה.");
  const frame = frameJoin(data.frame);
  const lead = one(data.lead as { organizer_name?: string; phone?: string } | { organizer_name?: string; phone?: string }[] | null);
  return {
    id: data.id as string,
    title: data.title as string,
    slug: data.slug as string,
    eventDate: (data.event_date as string | null) ?? null,
    place: (data.place as string | null) ?? null,
    frameId: data.frame_id as string,
    frameName: frame.name ?? "מסגרת",
    framePublished: frame.is_published === true,
    printQuota: data.print_quota as number,
    status: data.status as EventStatus,
    lead: lead?.organizer_name ? { name: lead.organizer_name, phone: lead.phone ?? "" } : null,
    hasPrintJobs: (jobs.data ?? []).length > 0,
  };
}

export async function deleteEvent(id: string): Promise<void> {
  const jobs = await supabase.from("print_jobs").select("id").eq("event_id", id).limit(1);
  if (jobs.error) throw toAppError(jobs.error, "לא הצלחנו לבדוק את עבודות ההדפסה.");
  if ((jobs.data ?? []).length > 0) {
    throw new Error("לאירוע הזה יש מגנטים להדפסה. אפשר לסגור אותו, לא למחוק.");
  }
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw toAppError(error, "לא הצלחנו למחוק את האירוע.");
}
