import { eventTypeTag, type EventType } from "@/lib/eventTypes";
import { slotForSize, type FrameSlot } from "@/lib/magnets";

export type GalleryTemplate = {
  id: string;
  widthMm: number;
  heightMm: number;
  tags: string[];
};

const GENERAL_TAG = "כללי";

function rank(template: GalleryTemplate, tag: string | null): number {
  if (tag && template.tags.includes(tag)) return 0;
  if (template.tags.includes(GENERAL_TAG)) return 1;
  return 2;
}

/**
 * The templates the gallery shows for one slot of an event: only templates of
 * that orientation, the event's kind first, then "כללי". Without "all", other
 * kinds are left out. An event without a kind sees everything.
 */
export function galleryTemplates<T extends GalleryTemplate>(
  templates: T[],
  { eventType, slot, all }: { eventType: EventType | null; slot: FrameSlot; all: boolean },
): T[] {
  const tag = eventTypeTag(eventType);
  const fitting = templates.filter((template) => slotForSize(template.widthMm, template.heightMm) === slot);
  const shown = all || !tag ? fitting : fitting.filter((template) => rank(template, tag) < 2);
  return shown
    .map((template, index) => ({ template, index, rank: rank(template, tag) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ template }) => template);
}

/** How many templates "כל התבניות" would add. */
export function hiddenCount(templates: GalleryTemplate[], eventType: EventType | null, slot: FrameSlot): number {
  return (
    galleryTemplates(templates, { eventType, slot, all: true }).length -
    galleryTemplates(templates, { eventType, slot, all: false }).length
  );
}
