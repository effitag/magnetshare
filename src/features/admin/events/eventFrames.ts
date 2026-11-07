// An event's frames. Every frame guests see is the event's own copy: of a template when
// the admin chooses one, or of the event's current frame when its name or date changes or
// the admin edits it in the studio. A frame that magnets were sent with never changes, and
// a template never changes when an event uses it.
import { applyEvent, isBound } from "@/features/studio/model/eventBinding";
import { assetPathsOf } from "@/features/studio/model/elements";
import { frameOrientation, visibleTags } from "@/features/studio/model/presets";
import { migrateTemplate } from "@/features/studio/model/schema";
import { renderPrintPng, renderScreenWebp, renderThumbnail } from "@/features/studio/render/renderToCanvas";
import { createAssetCache } from "@/features/studio/storage/assetCache";
import { createCloudRepo } from "@/features/studio/storage/cloudRepo";
import type { FrameSlot } from "@/lib/magnets";
import { attachEventFrame, frameGateway, frameHasJobs, getSlotState, type FrameTemplateRow } from "@/services/api";

// Frame fonts and the symbols font (hearts, rings) for canvas rendering.
import "@/features/studio/fonts/studio-fonts.css";
import "@/features/studio/fonts/symbols.css";

export type FrameDoc = {
  id: string;
  name: string;
  tags: string[];
  size: { widthMm: number; heightMm: number };
  elements: Record<string, unknown>[];
  preview?: { photo?: string | null } | null;
};

export type EventValues = { id: string; title: string; eventDate: string | null };

export type Template = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  tags: string[];
  doc: FrameDoc;
};

const repo = createCloudRepo(frameGateway);

/** Library rows as gallery templates. Rows whose design cannot be read are left out. */
export function toTemplates(rows: FrameTemplateRow[]): Template[] {
  const templates: Template[] = [];
  for (const row of rows) {
    try {
      const doc = migrateTemplate({ ...(row.design as object), id: row.id }) as FrameDoc;
      templates.push({ id: row.id, name: row.name, widthMm: row.widthMm, heightMm: row.heightMm, tags: visibleTags(doc.tags), doc });
    } catch (error) {
      console.warn(`[frames] template ${row.id} skipped:`, error);
    }
  }
  return templates;
}

function filled(doc: FrameDoc, event: EventValues): FrameDoc {
  return applyEvent(doc, { title: event.title, eventDate: event.eventDate }) as FrameDoc;
}

function assetsOf(frameId: string) {
  return createAssetCache((path: string) => repo.readAsset(frameId, path));
}

/** A preview of the template with the event's name and date, as an image. */
export async function renderEventPreview(template: Template, event: EventValues): Promise<Blob> {
  return renderThumbnail(filled(template.doc, event), assetsOf(template.id));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Images stored in another frame's folder go into the copy itself, so it never depends on that frame. */
async function withOwnImages(doc: FrameDoc, readFrom: string): Promise<FrameDoc> {
  const inlined = new Map<string, string>();
  for (const path of assetPathsOf(doc) as string[]) {
    if (path.startsWith("data:")) continue;
    inlined.set(path, await blobToDataUrl(await repo.readAsset(readFrom, path)));
  }
  if (!inlined.size) return doc;
  const swap = (value: unknown) => (typeof value === "string" && inlined.has(value) ? inlined.get(value) : value);
  return {
    ...doc,
    elements: doc.elements.map((element) => ({ ...element, src: swap(element.src), image: swap(element.image) })),
    preview: doc.preview ? { ...doc.preview, photo: swap(doc.preview.photo) as string | null } : doc.preview,
  };
}

export function slotOf(doc: FrameDoc): FrameSlot {
  return frameOrientation(doc.size.widthMm, doc.size.heightMm) as FrameSlot;
}

/** A frame that left its slot is deleted, unless magnets were sent with it (they print with it). */
async function dropIfUnused(frameId: string | null, keep: string): Promise<void> {
  if (!frameId || frameId === keep) return;
  try {
    if (!(await frameHasJobs(frameId))) await repo.remove(frameId);
  } catch (error) {
    console.warn(`[frames] old frame ${frameId} kept:`, error);
  }
}

/**
 * Renders a saved event frame's print file, camera image and thumbnail, and puts it into
 * the event's slot for its orientation. The frame it replaces is deleted unless magnets were
 * sent with it. With moveQueued, magnets still waiting to be printed move to this frame.
 * Returns how many moved.
 */
export async function saveForEvent(frameId: string, doc: FrameDoc, eventId: string, { moveQueued = false } = {}): Promise<number> {
  const slot = slotOf(doc);
  const { frameId: previous } = await getSlotState(eventId, slot);
  const assets = assetsOf(frameId);
  await repo.saveOverlay(frameId, await renderPrintPng(doc, assets));
  await repo.saveScreen(frameId, await renderScreenWebp(doc, assets));
  await repo.saveThumbnail(frameId, await renderThumbnail(doc, assets));
  const moved = await attachEventFrame(eventId, slot, frameId, { moveQueued });
  await dropIfUnused(previous, frameId);
  return moved;
}

/** A new, unattached copy of a frame for the event. Guests do not see it until saveForEvent. */
export async function copyForEvent(
  doc: FrameDoc,
  { eventId, sourceTemplateId, readFrom }: { eventId: string; sourceTemplateId: string | null; readFrom: string },
): Promise<{ id: string; doc: FrameDoc }> {
  const id = crypto.randomUUID();
  const copy = await withOwnImages({ ...structuredClone(doc), id }, readFrom);
  await repo.insert(copy, { isTemplate: false, eventId, sourceTemplateId });
  return { id, doc: copy };
}

async function copyAndSave(
  doc: FrameDoc,
  event: EventValues,
  source: { sourceTemplateId: string | null; readFrom: string },
  moveQueued: boolean,
): Promise<number> {
  const copy = await copyForEvent(doc, { eventId: event.id, ...source });
  try {
    return await saveForEvent(copy.id, copy.doc, event.id, { moveQueued });
  } catch (error) {
    // The copy never reached guests. Remove it, so a failed attempt leaves nothing behind.
    await repo.remove(copy.id).catch(() => undefined);
    throw error;
  }
}

/** The event's own copy of a template, with the event's name and date, put into the slot. */
export async function chooseFrame(template: Template, event: EventValues, { moveQueued = false } = {}): Promise<number> {
  const doc = { ...filled(template.doc, event), name: template.name };
  return copyAndSave(doc, event, { sourceTemplateId: template.id, readFrom: template.id }, moveQueued);
}

/** Loads an event frame for checking or copying. */
export async function loadEventFrame(frameId: string): Promise<FrameDoc> {
  const { doc } = await repo.load(frameId);
  return doc as FrameDoc;
}

/** Whether the frame's linked texts no longer match the event's name and date. */
export function isStale(doc: FrameDoc, event: EventValues): boolean {
  if (!doc.elements.some((element) => isBound(element))) return false;
  return JSON.stringify(filled(doc, event).elements) !== JSON.stringify(doc.elements);
}

/**
 * After the event's name or date changed: a new copy of the event's frame with the new
 * values, keeping any fine-tuning made in the studio.
 */
export async function refreshFrame(
  frameId: string,
  sourceTemplateId: string | null,
  event: EventValues,
  { moveQueued = false } = {},
): Promise<number> {
  const doc = await loadEventFrame(frameId);
  return copyAndSave(filled(doc, event), event, { sourceTemplateId, readFrom: frameId }, moveQueued);
}
