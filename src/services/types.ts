export type AdminRole = "pending" | "admin";

export type AdminProfile = {
  id: string;
  email: string;
  role: AdminRole;
  created_at: string;
};

export type Frame = {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  overlay_path: string | null;
  window_x: number;
  window_y: number;
  window_w: number;
  window_h: number;
  is_published: boolean;
  created_at: string;
};

export type LeadStatus = "new" | "contacted" | "converted" | "closed";

export type Lead = {
  id: string;
  organizer_name: string;
  phone: string;
  event_name: string;
  event_date: string | null;
  place: string | null;
  guest_count_range: string | null;
  frame_id: string | null;
  status: LeadStatus;
  created_at: string;
};

export type NewLeadInput = {
  organizer_name: string;
  phone: string;
  event_name: string;
  event_date?: string | null;
  place?: string | null;
  guest_count_range?: string | null;
  frame_id?: string | null;
};

export type EventStatus = "draft" | "live" | "closed";

export type Event = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  place: string | null;
  frame_id: string | null;
  print_quota: number;
  status: EventStatus;
  lead_id: string | null;
  cover_path: string | null;
  created_at: string;
};

export type EventCard = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  place: string | null;
  frame_id: string | null;
  frame_portrait_id: string | null;
  print_quota: number;
  status: "live" | "closed";
  cover_path: string | null;
  screen_path: string | null;
  screen_path_portrait: string | null;
};

export type GuestPhoto = {
  id: string;
  event_id: string;
  guest_id: string;
  storage_path: string;
  created_at: string;
};

export type PrintJobStatus = "queued" | "printing" | "ready" | "delivered" | "rejected";

export type PrintJob = {
  id: string;
  event_id: string;
  photo_id: string;
  guest_id: string;
  copies: number;
  status: PrintJobStatus;
  created_at: string;
  frame_id: string | null;
  storage_path: string | null;
};
