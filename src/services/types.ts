export type EventType = "share" | "magnet";
export type EventStatus = "draft" | "active" | "closed";
export type ProfileRole = "organizer" | "operator";

export type Profile = {
  id: string;
  display_name: string;
  role: ProfileRole;
};

export type EventRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  event_date: string | null;
  cover_path: string | null;
  type: EventType;
  public_slug: string;
  status: EventStatus;
  moderation_required: boolean;
  created_at: string;
  photos?: { count: number }[] | null;
};

export type CreateEventInput = {
  name: string;
  description: string;
  eventDate: string;
  type: EventType;
  moderationRequired: boolean;
  open: boolean;
  cover: File | null;
};

export type CreatedEvent = EventRow & { coverWarning?: string };
