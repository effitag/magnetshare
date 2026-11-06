import { AppError, toAppError } from "@/lib/errors";
import { countMagnetsLeft, slotForSize, type FrameSlot } from "@/lib/magnets";
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

export async function getEventCardBySlug(slug: string): Promise<EventCard | null> {
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

export async function uploadGuestPhoto(eventId: string, guestId: string, file: File, thumb: Blob): Promise<string> {
  const stamp = Date.now();
  const safeName = file.name.replace(/[^\w.-]+/g, "_") || "photo.jpg";
  const path = `${eventId}/${guestId}/${stamp}_${safeName}`;
  const thumbKey = `${eventId}/${guestId}/${stamp}_thumb.webp`;
  if (path.split("/")[0] === "frames" || path.split("/")[0] === "events") {
    throw toAppError(new Error("reserved"), "אי אפשר לשמור קובץ של אורח בתיקייה הזו.");
  }
  const thumbUpload = await supabase.storage.from("media").upload(thumbKey, thumb, {
    contentType: "image/webp",
    upsert: false,
  });
  if (thumbUpload.error) throw toAppError(thumbUpload.error, "לא הצלחנו לשמור את התמונה. נסו שוב.");
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
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
};

export type EventDraft = {
  title: string;
  eventDate: string;
  printQuota: number;
};

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

const LIVE_BLOCK = "כדי להפעיל את האירוע צריך לפחות מסגרת מפורסמת אחת. מסגרת שכבר שויכה חייבת להיות מפורסמת. במסגרות יוצרים מסגרת לאירוע, משייכים אותה, ומפרסמים.";

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

function slotMismatch(widthMm: number, heightMm: number): string {
  if (Number(widthMm) === Number(heightMm)) return "מסגרת ריבוע נשמרת כמסגרת לאורך.";
  return Number(widthMm) > Number(heightMm)
    ? "המסגרת רחבה יותר מגובהה, אז היא לרוחב."
    : "המסגרת גבוהה יותר מרוחבה, אז היא לאורך.";
}

export async function assignFrameToEvent(frameId: string, eventId: string, slot: FrameSlot): Promise<void> {
  const frame = await supabase
    .from("frames")
    .select("is_template, is_published, width_mm, height_mm")
    .eq("id", frameId)
    .maybeSingle();
  if (frame.error) throw toAppError(frame.error, "לא הצלחנו לבדוק את המסגרת.");
  if (!frame.data || frame.data.is_template === true) {
    throw new Error("אי אפשר לשייך תבנית. צרו ממנה מסגרת לאירוע.");
  }
  const width = Number(frame.data.width_mm);
  const height = Number(frame.data.height_mm);
  if (slotForSize(width, height) !== slot) throw new Error(slotMismatch(width, height));
  const target = await supabase.from("events").select("status, frame_id, frame_portrait_id").eq("id", eventId).maybeSingle();
  const legacyTarget = target.error && missingColumn(target.error, "frame_portrait_id");
  const eventRow = legacyTarget
    ? await supabase.from("events").select("status, frame_id").eq("id", eventId).maybeSingle()
    : target;
  if (eventRow.error || !eventRow.data) throw toAppError(eventRow.error, "האירוע לא נמצא.");
  if (legacyTarget && slot === "portrait") {
    throw new Error("כדי לשייך מסגרת לאורך צריך קודם להריץ את עדכון המסד.");
  }
  if (eventRow.data.status === "live" && frame.data.is_published !== true) {
    throw new Error("אי אפשר לשייך מסגרת שלא פורסמה לאירוע חי.");
  }
  const othersQuery = legacyTarget
    ? await supabase.from("events").select("id, status, title, frame_id").eq("frame_id", frameId)
    : await supabase.from("events").select("id, status, title, frame_id, frame_portrait_id").or(`frame_id.eq.${frameId},frame_portrait_id.eq.${frameId}`);
  if (othersQuery.error) throw toAppError(othersQuery.error, "לא הצלחנו לבדוק את השיוך.");
  const others = (othersQuery.data ?? []) as {
    id: string;
    status: string;
    title: string;
    frame_id: string | null;
    frame_portrait_id?: string | null;
  }[];
  const blocking = others.find((row) => row.id !== eventId && row.status === "live");
  if (blocking) throw new Error(`המסגרת כבר משויכת לאירוע חי «${blocking.title}».`);
  for (const row of others) {
    if (row.id === eventId) continue;
    const patch: { frame_id?: null; frame_portrait_id?: null } = {};
    if (row.frame_id === frameId) patch.frame_id = null;
    if (row.frame_portrait_id === frameId) patch.frame_portrait_id = null;
    if (!Object.keys(patch).length) continue;
    const cleared = await supabase.from("events").update(patch).eq("id", row.id);
    if (cleared.error) throw toAppError(cleared.error, "לא הצלחנו לשחרר את המסגרת מהאירוע הקודם.");
  }
  const current = eventRow.data as { frame_id: string | null; frame_portrait_id?: string | null };
  const patch: { frame_id?: string | null; frame_portrait_id?: string | null } =
    slot === "landscape"
      ? { frame_id: frameId, ...(current.frame_portrait_id === frameId ? { frame_portrait_id: null } : {}) }
      : { frame_portrait_id: frameId, ...(current.frame_id === frameId ? { frame_id: null } : {}) };
  const update = await supabase.from("events").update(patch).eq("id", eventId);
  if (update.error) {
    if (update.error.message?.includes("event_frame_is_template")) {
      throw new Error("אי אפשר לשייך תבנית. צרו ממנה מסגרת לאירוע.");
    }
    if (missingColumn(update.error, "frame_portrait_id")) {
      throw new Error("כדי לשייך מסגרת לאורך צריך קודם להריץ את עדכון המסד.");
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

const PRINT_ERRORS: Record<string, string> = {
  print_quota_exceeded: "נגמרו המגנטים שלכם לאירוע הזה.",
  event_not_found: "האירוע לא נמצא.",
  event_not_live: "האירוע לא פתוח לצילום.",
  invalid_copies: "מספר העותקים לא תקין.",
  invalid_storage_path: "לא הצלחנו לשמור את התמונה במקום הנכון.",
  not_authenticated: "החיבור נותק. חזרו לדף האירוע ונסו שוב.",
  frame_not_in_event: "המסגרת לא שייכת לאירוע הזה.",
};

function mapPrintError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : "";
  for (const [code, hebrew] of Object.entries(PRINT_ERRORS)) {
    if (message.includes(code)) return new AppError(hebrew);
  }
  return toAppError(error, "לא הצלחנו לשלוח את התמונה. נסו שוב.");
}

export async function getPublishedFrameWindow(id: string): Promise<PublishedFrameWindow | null> {
  try {
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
  const { data, error } = legacy
    ? await supabase.rpc("create_guest_print", {
        p_event_id: eventId,
        p_storage_path: storagePath,
        p_copies: copies,
      })
    : first;
  if (error) throw mapPrintError(error);
  return data as string;
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

export function subscribeOwnPrintJobs(eventId: string, guestId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`guest-prints-${eventId}-${guestId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "print_jobs", filter: `event_id=eq.${eventId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as { guest_id?: string } | undefined;
        if (row?.guest_id && row.guest_id !== guestId) return;
        onChange();
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
