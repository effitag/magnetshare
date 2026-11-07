// The kinds of event. The ids match the database check on events.event_type.
// `tag` is the label the frame studio puts on a template of that kind
// (see STARTER_CATEGORIES), so the gallery can filter templates by it.

export const EVENT_TYPES = [
  { id: "wedding", label: "חתונה", tag: "חתונה" },
  { id: "henna", label: "חינה", tag: "חינה" },
  { id: "mitzvah", label: "בר/בת מצווה", tag: "בר/בת מצווה" },
  { id: "brit", label: "ברית/ה", tag: "ברית/ה" },
  { id: "birthday", label: "יום הולדת", tag: "יום הולדת" },
  { id: "company", label: "אירוע חברה", tag: "אירוע חברה" },
  { id: "general", label: "אחר", tag: "כללי" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["id"];

export function isEventType(value: unknown): value is EventType {
  return EVENT_TYPES.some((type) => type.id === value);
}

export function eventTypeLabel(value: EventType | null | undefined): string | null {
  return EVENT_TYPES.find((type) => type.id === value)?.label ?? null;
}

/** The studio tag of a kind of event, e.g. "חתונה" for weddings. */
export function eventTypeTag(value: EventType | null | undefined): string | null {
  return EVENT_TYPES.find((type) => type.id === value)?.tag ?? null;
}
