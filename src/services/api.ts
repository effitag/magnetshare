import { toAppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
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
