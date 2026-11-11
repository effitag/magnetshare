import { AppError, errorInfo, toAppError } from "@/lib/errors";
import { isEventType, type EventType } from "@/lib/eventTypes";
import { isAlreadyStored } from "@/lib/guestSend";
import { createGuestSignIn } from "@/lib/guestSession";
import { retryTransient } from "@/lib/sendRetry";
import { countMagnetsLeft, type FrameSlot } from "@/lib/magnets";
import { supabase } from "@/lib/supabase";
import { isFrameObjectPath } from "@/features/studio/storage/paths";
import type { EventCard, Frame, NewLeadInput, PrintJob, PrintJobStatus } from "@/services/types";

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

const EVENT_CARD_COLUMNS =
  "id, slug, title, event_date, place, frame_id, frame_portrait_id, print_quota, status, cover_path, screen_path, screen_path_portrait";
const EVENT_CARD_LEGACY =
  "id, slug, title, event_date, place, frame_id, print_quota, status, cover_path, screen_path";

function missingColumn(error: { message?: string } | null, name: string): boolean {
  const message = error?.message ?? "";
  return message.includes(name);
}

/** True while the database does not have the function yet (only between a deploy and its migration). */
export function missingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202";
}

export async function getEventCardBySlug(slug: string): Promise<EventCard | null> {
  try {
    const card = await supabase.rpc("get_event_card", { p_slug: slug }).maybeSingle();
    if (!card.error) return (card.data as EventCard | null) ?? null;
    if (!missingFunction(card.error)) throw card.error;
    return await getEventCardFromView(slug);
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לפתוח את האירוע. בדקו את הקישור ונסו שוב.");
  }
}

async function getEventCardFromView(slug: string): Promise<EventCard | null> {
  try {
    const first = await supabase.from("event_cards").select(EVENT_CARD_COLUMNS).eq("slug", slug).maybeSingle();
    if (first.error && (missingColumn(first.error, "frame_portrait_id") || missingColumn(first.error, "screen_path_portrait"))) {
      const second = await supabase.from("event_cards").select(EVENT_CARD_LEGACY).eq("slug", slug).maybeSingle();
      if (second.error) throw second.error;
      if (!second.data) return null;
      return { ...(second.data as EventCard), frame_portrait_id: null, screen_path_portrait: null };
    }
    if (first.error) throw first.error;
    return (first.data as EventCard | null) ?? null;
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
        // An event frame records its event and the template it was copied from.
        ...(row.event_id ? { event_id: row.event_id } : {}),
        ...(row.source_template_id ? { source_template_id: row.source_template_id } : {}),
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

/**
 * Uploads one file of a send (photo or thumbnail) to its fixed path. A retry of
 * the same send finds the file already there, which counts as stored.
 */
export async function uploadGuestFile(path: string, file: Blob): Promise<void> {
  const top = path.split("/")[0];
  if (top === "frames" || top === "events") {
    throw toAppError(new Error("reserved"), "אי אפשר לשמור קובץ של אורח בתיקייה הזו.");
  }
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error && !isAlreadyStored(error)) throw toAppError(error, "לא הצלחנו לשמור את התמונה. נסו שוב.");
}

export type AdminEventRow = {
  id: string;
  title: string;
  status: string;
  frame_id: string | null;
  frame_name: string;
  frame_published: boolean;
  frame_portrait_id: string | null;
  portrait_name: string;
  portrait_published: boolean;
};

export type AdminEventDetail = {
  id: string;
  slug: string;
  title: string;
  eventDate: string | null;
  printQuota: number;
  coverPath: string | null;
  eventType: EventType | null;
  status: "draft" | "live" | "closed";
};

export type EventDraft = {
  title: string;
  eventDate: string;
  printQuota: number;
  /** Left out: the kind of event is not changed. */
  eventType?: EventType | null;
};

function eventTypeColumn(draft: EventDraft): { event_type?: EventType | null } {
  return draft.eventType === undefined ? {} : { event_type: draft.eventType };
}

export async function listAdminEvents(): Promise<AdminEventRow[]> {
  const columns = "id, title, status, frame_id, frame_portrait_id";
  const first = await supabase.from("events").select(columns).order("created_at", { ascending: false });
  const legacy = first.error && missingColumn(first.error, "frame_portrait_id");
  const { data, error } = legacy
    ? await supabase.from("events").select("id, title, status, frame_id").order("created_at", { ascending: false })
    : first;
  if (error) throw toAppError(error, "לא הצלחנו לטעון את האירועים.");
  const rows = (data ?? []) as {
    id: string;
    title: string;
    status: string;
    frame_id: string | null;
    frame_portrait_id?: string | null;
  }[];
  const ids = [...new Set(rows.flatMap((row) => [row.frame_id, row.frame_portrait_id].filter((id): id is string => Boolean(id))))];
  const frames = new Map<string, { name: string; is_published: boolean }>();
  if (ids.length) {
    const listed = await supabase.from("frames").select("id, name, is_published").in("id", ids);
    if (listed.error) throw toAppError(listed.error, "לא הצלחנו לטעון את האירועים.");
    for (const frame of listed.data ?? []) {
      frames.set(frame.id as string, { name: (frame.name as string) ?? "", is_published: frame.is_published === true });
    }
  }
  return rows.map((row) => {
    const landscape = row.frame_id ? frames.get(row.frame_id) : undefined;
    const portrait = row.frame_portrait_id ? frames.get(row.frame_portrait_id) : undefined;
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      frame_id: row.frame_id ?? null,
      frame_name: landscape?.name ?? "",
      frame_published: landscape?.is_published === true,
      frame_portrait_id: row.frame_portrait_id ?? null,
      portrait_name: portrait?.name ?? "",
      portrait_published: portrait?.is_published === true,
    };
  });
}

const LIVE_BLOCK = "כדי להפעיל את האירוע צריך לבחור לו מסגרת. בוחרים אותה במסך האירוע.";

export async function setEventLiveSwitch(eventId: string, live: boolean): Promise<void> {
  if (!live) {
    const closed = await supabase.from("events").update({ status: "closed" }).eq("id", eventId);
    if (closed.error) throw toAppError(closed.error, "לא הצלחנו לסגור את האירוע.");
    return;
  }
  const first = await supabase.from("events").select("frame_id, frame_portrait_id").eq("id", eventId).single();
  const legacy = first.error && missingColumn(first.error, "frame_portrait_id");
  const loaded = legacy
    ? await supabase.from("events").select("frame_id").eq("id", eventId).single()
    : first;
  if (loaded.error) throw toAppError(loaded.error, "לא הצלחנו לבדוק את האירוע.");
  const frameId = (loaded.data.frame_id as string | null) ?? null;
  const portraitId = legacy ? null : ((loaded.data as { frame_portrait_id?: string | null }).frame_portrait_id ?? null);
  const ids = [frameId, portraitId].filter((id): id is string => Boolean(id));
  const published = new Map<string, boolean>();
  if (ids.length) {
    const frames = await supabase.from("frames").select("id, is_published").in("id", ids);
    if (frames.error) throw toAppError(frames.error, "לא הצלחנו לבדוק את האירוע.");
    for (const frame of frames.data ?? []) published.set(frame.id as string, frame.is_published === true);
  }
  const landReady = Boolean(frameId) && published.get(frameId as string) === true;
  const portReady = Boolean(portraitId) && published.get(portraitId as string) === true;
  if ((frameId && !landReady) || (portraitId && !portReady) || (!landReady && !portReady)) {
    throw new Error(LIVE_BLOCK);
  }
  const update = await supabase.from("events").update({ status: "live" }).eq("id", eventId);
  if (update.error) {
    if (update.error.message?.includes("event_frame_not_published")) throw new Error(LIVE_BLOCK);
    throw toAppError(update.error, "לא הצלחנו להפעיל את האירוע.");
  }
}

function readEventType(row: { event_type?: unknown }): EventType | null {
  return isEventType(row.event_type) ? row.event_type : null;
}

export async function getAdminEvent(id: string): Promise<AdminEventDetail> {
  const columns = "id, slug, title, event_date, print_quota, cover_path, status";
  const first = await supabase.from("events").select(`${columns}, event_type`).eq("id", id).single();
  // Until the event_type migration runs, read the event without it.
  const { data, error } = first.error && missingColumn(first.error, "event_type")
    ? await supabase.from("events").select(columns).eq("id", id).single()
    : first;
  if (error) throw toAppError(error, "לא הצלחנו לפתוח את האירוע.");
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    eventDate: (data.event_date as string | null) ?? null,
    printQuota: data.print_quota as number,
    coverPath: (data.cover_path as string | null) ?? null,
    eventType: readEventType(data as { event_type?: unknown }),
    status: data.status as AdminEventDetail["status"],
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
      ...eventTypeColumn(draft),
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
    eventType: draft.eventType ?? null,
    status: "draft",
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
      ...eventTypeColumn(draft),
    })
    .eq("id", eventId)
    .select("id, slug, title, cover_path, status")
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לשמור את האירוע.");
  const saved = {
    status: data.status as AdminEventDetail["status"],
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    eventDate: draft.eventDate,
    printQuota: draft.printQuota,
    coverPath: (data.cover_path as string | null) ?? null,
  };
  if (draft.eventType !== undefined) return { ...saved, eventType: draft.eventType };
  return { ...saved, eventType: (await getAdminEvent(eventId)).eventType };
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

export type FrameTemplateRow = {
  id: string;
  name: string;
  design: unknown;
  widthMm: number;
  heightMm: number;
};

/** The template library, newest first, with each template's design. */
export async function listFrameTemplates(): Promise<FrameTemplateRow[]> {
  const { data, error } = await supabase
    .from("frames")
    .select("id, name, design, width_mm, height_mm")
    .eq("is_template", true)
    .order("updated_at", { ascending: false });
  if (error) throw toAppError(error, "לא הצלחנו לטעון את התבניות.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    design: row.design,
    widthMm: Number(row.width_mm),
    heightMm: Number(row.height_mm),
  }));
}

export type EventFrameSlot = {
  id: string;
  name: string;
  sourceTemplateId: string | null;
  previewUrl: string | null;
};

export type EventFrames = {
  landscape: EventFrameSlot | null;
  portrait: EventFrameSlot | null;
};

/** The frames the event shows its guests now, with a preview image of each. */
export async function getEventFrames(eventId: string): Promise<EventFrames> {
  const event = await supabase.from("events").select("frame_id, frame_portrait_id").eq("id", eventId).single();
  if (event.error) throw toAppError(event.error, "לא הצלחנו לטעון את המסגרת של האירוע.");
  const ids = [event.data.frame_id, event.data.frame_portrait_id].filter((id): id is string => Boolean(id));
  const frames = new Map<string, EventFrameSlot>();
  if (ids.length) {
    const listed = await supabase.from("frames").select("id, name, preview_path, source_template_id").in("id", ids);
    if (listed.error) throw toAppError(listed.error, "לא הצלחנו לטעון את המסגרת של האירוע.");
    for (const row of listed.data ?? []) {
      const id = row.id as string;
      const preview = (row.preview_path as string | null) ?? `frames/${id}/screen.webp`;
      frames.set(id, {
        id,
        name: (row.name as string) ?? "",
        sourceTemplateId: (row.source_template_id as string | null) ?? null,
        previewUrl: await signedMediaUrl(preview).catch(() => null),
      });
    }
  }
  return {
    landscape: event.data.frame_id ? frames.get(event.data.frame_id as string) ?? null : null,
    portrait: event.data.frame_portrait_id ? frames.get(event.data.frame_portrait_id as string) ?? null : null,
  };
}

const ATTACH_ERRORS: Record<string, string> = {
  not_admin: "רק מנהלים יכולים לבחור מסגרת לאירוע.",
  invalid_slot: "בחרו מסגרת לרוחב או לאורך.",
  frame_not_found: "המסגרת לא נמצאה. נסו לבחור שוב.",
  event_frame_is_template: "זו תבנית. בחרו אותה מהגלריה של האירוע.",
  frame_of_other_event: "המסגרת הזו שייכת לאירוע אחר.",
  frame_wrong_orientation: "כיוון המסגרת לא מתאים למקום שנבחר.",
  frame_files_missing: "המסגרת עוד לא מוכנה לאורחים. נסו שוב.",
  event_not_found: "האירוע לא נמצא.",
  frame_in_use: "עם המסגרת הזו כבר נשלחו מגנטים, אז היא לא משתנה. כל שינוי יוצר עותק חדש.",
};

/**
 * Puts a ready event frame (its overlay and screen files already uploaded) into
 * the event's landscape or portrait slot. It is ready for guests at once.
 * With moveQueued, the event's magnets that are still waiting to be printed
 * move from the old frame to this one. Returns how many moved.
 */
export async function attachEventFrame(
  eventId: string,
  slot: FrameSlot,
  frameId: string,
  { moveQueued = false }: { moveQueued?: boolean } = {},
): Promise<number> {
  const { data, error } = await supabase.rpc("attach_event_frame", {
    p_event_id: eventId,
    p_slot: slot,
    p_frame_id: frameId,
    p_move_queued: moveQueued,
  });
  if (error) {
    const message = error.message ?? "";
    for (const [code, hebrew] of Object.entries(ATTACH_ERRORS)) {
      if (message.includes(code)) throw new AppError(hebrew);
    }
    throw toAppError(error, "לא הצלחנו לחבר את המסגרת לאירוע. נסו שוב.");
  }
  return Number(data ?? 0);
}

/** Whether any magnet was sent with this frame. Such a frame never changes. */
export async function frameHasJobs(frameId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("frame_id", frameId);
  if (error) throw toAppError(error, "לא הצלחנו לבדוק את המסגרת.");
  return (count ?? 0) > 0;
}

export type EventFrameContext = {
  eventId: string | null;
  eventStatus: "draft" | "live" | "closed" | null;
  isTemplate: boolean;
  used: boolean;
  /** Guests see this frame now: it is in one of the event's slots. */
  attached: boolean;
  sourceTemplateId: string | null;
};

/** What the studio needs to know about a frame before editing it. */
export async function getFrameContext(frameId: string): Promise<EventFrameContext> {
  const { data, error } = await supabase
    .from("frames")
    .select("is_template, event_id, source_template_id")
    .eq("id", frameId)
    .single();
  if (error) throw toAppError(error, "לא הצלחנו לפתוח את המסגרת.");
  const eventId = (data.event_id as string | null) ?? null;
  let eventStatus: EventFrameContext["eventStatus"] = null;
  let attached = false;
  if (eventId) {
    const event = await supabase.from("events").select("status, frame_id, frame_portrait_id").eq("id", eventId).single();
    if (event.error) throw toAppError(event.error, "לא הצלחנו לפתוח את המסגרת.");
    eventStatus = event.data.status as EventFrameContext["eventStatus"];
    attached = event.data.frame_id === frameId || event.data.frame_portrait_id === frameId;
  }
  return {
    eventId,
    eventStatus,
    isTemplate: data.is_template === true,
    used: data.is_template === true ? false : await frameHasJobs(frameId),
    attached,
    sourceTemplateId: (data.source_template_id as string | null) ?? null,
  };
}

/** The frame an event shows now in one slot, the event's status, and that frame's queued magnets. */
export async function getSlotState(
  eventId: string,
  slot: FrameSlot,
): Promise<{ frameId: string | null; status: "draft" | "live" | "closed"; queued: number }> {
  const { data, error } = await supabase.from("events").select("status, frame_id, frame_portrait_id").eq("id", eventId).single();
  if (error) throw toAppError(error, "לא הצלחנו לבדוק את האירוע.");
  const frameId = ((slot === "landscape" ? data.frame_id : data.frame_portrait_id) as string | null) ?? null;
  return {
    frameId,
    status: data.status as "draft" | "live" | "closed",
    queued: frameId ? await countQueuedJobs(eventId, frameId) : 0,
  };
}

/** Magnets of this event, sent with this frame, that are still waiting to be printed. */
export async function countQueuedJobs(eventId: string, frameId: string): Promise<number> {
  const { count, error } = await supabase
    .from("print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("frame_id", frameId)
    .eq("status", "queued");
  if (error) throw toAppError(error, "לא הצלחנו לבדוק את המגנטים בתור.");
  return count ?? 0;
}

/** Waits before retrying a guest sign-in: about 2, 5 and 10 seconds. */
const SIGN_IN_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const signInWaiters = new Set<() => void>();

/** The guest of this browser: the stored session if there is one, otherwise one new anonymous guest for all tabs. */
const ensureGuest = createGuestSignIn({
  currentUserId: async () => {
    const existing = await supabase.auth.getSession();
    return existing.data.session?.user?.id ?? null;
  },
  // At a venue every guest on the Wi-Fi shares one sign-in limit, so a busy
  // moment (429) or a dropped connection is retried before giving up.
  signIn: () =>
    retryTransient(
      async () => {
        const signed = await supabase.auth.signInAnonymously();
        if (signed.error || !signed.data.user) throw toAppError(signed.error, "לא הצלחנו לפתוח את האירוע. נסו שוב.");
        return signed.data.user.id;
      },
      { delays: SIGN_IN_RETRY_DELAYS_MS, onWait: () => signInWaiters.forEach((wait) => wait()) },
    ),
});

/** Shown while a guest sign-in waits to retry. */
export const SIGN_IN_WAIT = "הרבה אורחים נכנסים עכשיו, עוד רגע…";

export async function ensureGuestSession(options: { onWait?: () => void } = {}): Promise<string> {
  const onWait = options.onWait;
  if (onWait) signInWaiters.add(onWait);
  try {
    return await ensureGuest();
  } finally {
    if (onWait) signInWaiters.delete(onWait);
  }
}

/** Renews the guest's sign-in after the server said it expired. */
export async function refreshGuestSession(): Promise<void> {
  await supabase.auth.refreshSession();
}

export async function guestMagnetsLeft(eventId: string, quota: number): Promise<number> {
  const jobs = await listOwnPrintJobs(eventId);
  return countMagnetsLeft(quota, jobs);
}

export async function signedMediaUrl(
  path: string,
  size?: { width: number; resize?: "cover" | "contain" },
): Promise<string | null> {
  if (size) {
    const sized = await supabase.storage.from("media").createSignedUrl(path, 60 * 30, {
      transform: { width: size.width, resize: size.resize ?? "cover", quality: 70 },
    });
    if (!sized.error && sized.data?.signedUrl) return sized.data.signedUrl;
  }
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export type PublishedFrameWindow = {
  id: string;
  width_mm: number;
  height_mm: number;
  window_x: number;
  window_y: number;
  window_w: number;
  window_h: number;
};

/** Shown to a guest whose photo was taken in a frame the event has since replaced. */
export const FRAME_UPDATED = "המסגרת של האירוע עודכנה בינתיים. צלמו שוב במסגרת החדשה.";

const PRINT_ERRORS: Record<string, string> = {
  print_quota_exceeded: "נגמרו המגנטים שלכם לאירוע הזה.",
  event_not_found: "האירוע לא נמצא.",
  event_not_live: "האירוע לא פתוח לצילום.",
  invalid_copies: "מספר העותקים לא תקין.",
  invalid_storage_path: "לא הצלחנו לשמור את התמונה במקום הנכון.",
  storage_path_not_yours: "אפשר לשלוח רק תמונה שצילמתם כאן. חזרו לדף האירוע וצלמו שוב.",
  not_authenticated: "החיבור נותק. חזרו לדף האירוע ונסו שוב.",
  frame_not_in_event: FRAME_UPDATED,
  photo_not_uploaded: "התמונה לא הגיעה לשרת. נסו שוב.",
};

function mapPrintError(error: unknown, status?: number): AppError {
  const message = typeof error === "object" && error !== null ? String((error as { message?: unknown }).message ?? "") : "";
  const info = errorInfo(error, status);
  for (const [code, hebrew] of Object.entries(PRINT_ERRORS)) {
    if (message.includes(code)) return new AppError(hebrew, { ...info, code });
  }
  return new AppError(toAppError(error, "לא הצלחנו לשלוח את התמונה. נסו שוב.").message, info);
}

export async function getPublishedFrameWindow(id: string): Promise<PublishedFrameWindow | null> {
  try {
    const frame = await supabase.rpc("get_frame_window", { p_id: id }).maybeSingle();
    if (!frame.error) return (frame.data as PublishedFrameWindow | null) ?? null;
    if (!missingFunction(frame.error)) throw frame.error;
    const { data, error } = await supabase
      .from("frames")
      .select("id, width_mm, height_mm, window_x, window_y, window_w, window_h")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    return (data as PublishedFrameWindow | null) ?? null;
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לטעון את המסגרת. נסו שוב.");
  }
}

export async function createGuestPrint(
  eventId: string,
  storagePath: string,
  copies: number,
  frameId: string,
): Promise<string> {
  const args = {
    p_event_id: eventId,
    p_storage_path: storagePath,
    p_copies: copies,
    p_frame_id: frameId,
  };
  const first = await supabase.rpc("create_guest_print", args);
  const legacy =
    first.error &&
    /create_guest_print/.test(first.error.message) &&
    /schema cache|Could not find the function|PGRST202/.test(first.error.message);
  const result = legacy
    ? await supabase.rpc("create_guest_print", {
        p_event_id: eventId,
        p_storage_path: storagePath,
        p_copies: copies,
      })
    : first;
  if (result.error) throw mapPrintError(result.error, result.status);
  return result.data as string;
}

const JOB_COLUMNS =
  "id, event_id, photo_id, guest_id, copies, status, created_at, frame_id, photo:guest_photos(storage_path)";
const JOB_LEGACY = "id, event_id, photo_id, guest_id, copies, status, created_at, photo:guest_photos(storage_path)";

function asJob(row: Record<string, unknown>): PrintJob {
  const photo = row.photo as { storage_path?: string } | { storage_path?: string }[] | null;
  const nested = Array.isArray(photo) ? photo[0] : photo;
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    photo_id: String(row.photo_id),
    guest_id: String(row.guest_id),
    copies: Number(row.copies ?? 0),
    status: row.status as PrintJobStatus,
    created_at: String(row.created_at),
    frame_id: (row.frame_id as string | null) ?? null,
    storage_path: nested?.storage_path ?? null,
  };
}

export async function listOwnPrintJobs(eventId: string): Promise<PrintJob[]> {
  try {
    const first = await supabase.from("print_jobs").select(JOB_COLUMNS).eq("event_id", eventId).order("created_at", { ascending: false });
    const legacy = first.error && missingColumn(first.error, "frame_id");
    const { data, error } = legacy
      ? await supabase.from("print_jobs").select(JOB_LEGACY).eq("event_id", eventId).order("created_at", { ascending: false })
      : first;
    if (error) throw error;
    return (data ?? []).map((row) => asJob(row as Record<string, unknown>));
  } catch (error) {
    throw toAppError(error, "לא הצלחנו לטעון את המגנטים שלכם.");
  }
}

