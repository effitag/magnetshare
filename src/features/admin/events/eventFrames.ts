// Choosing a frame for an event: a copy of a template, filled with the event's name and
// date, made ready for guests and put into the event in one step. The template never changes.
import { applyEvent } from "@/features/studio/model/eventBinding";
import { assetPathsOf } from "@/features/studio/model/elements";
import { visibleTags } from "@/features/studio/model/presets";
import { migrateTemplate } from "@/features/studio/model/schema";
import { renderPrintPng, renderScreenWebp, renderThumbnail } from "@/features/studio/render/renderToCanvas";
import { createAssetCache } from "@/features/studio/storage/assetCache";
import { createCloudRepo } from "@/features/studio/storage/cloudRepo";
import type { FrameSlot } from "@/lib/magnets";
import { attachEventFrame, frameGateway, type FrameTemplateRow } from "@/services/api";

// Frame fonts and the symbols font (hearts, rings) for canvas rendering.
import "@/features/studio/fonts/studio-fonts.css";
import "@/features/studio/fonts/symbols.css";

type FrameDoc = { id: string; name: string; tags: string[]; elements: Record<string, unknown>[]; preview?: { photo?: string | null } | null };

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

function filledDoc(template: Template, event: EventValues): FrameDoc {
  return applyEvent(template.doc, { title: event.title, eventDate: event.eventDate }) as FrameDoc;
}

function assetsOf(frameId: string) {
  return createAssetCache((path: string) => repo.readAsset(frameId, path));
}

/** A preview of the template with the event's name and date, as an image. */
export async function renderEventPreview(template: Template, event: EventValues): Promise<Blob> {
  return renderThumbnail(filledDoc(template, event), assetsOf(template.id));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Images stored in the template's folder go into the copy itself, so it never depends on the template. */
async function withOwnImages(doc: FrameDoc, templateId: string): Promise<FrameDoc> {
  const inlined = new Map<string, string>();
  for (const path of assetPathsOf(doc) as string[]) {
    if (path.startsWith("data:")) continue;
    inlined.set(path, await blobToDataUrl(await repo.readAsset(templateId, path)));
  }
  if (!inlined.size) return doc;
  const swap = (value: unknown) => (typeof value === "string" && inlined.has(value) ? inlined.get(value) : value);
  return {
    ...doc,
    elements: doc.elements.map((element) => ({ ...element, src: swap(element.src), image: swap(element.image) })),
    preview: doc.preview ? { ...doc.preview, photo: swap(doc.preview.photo) as string | null } : doc.preview,
  };
}

/**
 * Makes the event's own copy of the template and puts it into the slot, ready for guests.
 * With moveQueued, magnets still waiting to be printed move to the new frame.
 * Returns how many moved.
 */
export async function chooseFrame(
  template: Template,
  event: EventValues,
  slot: FrameSlot,
  { moveQueued = false }: { moveQueued?: boolean } = {},
): Promise<number> {
  const id = crypto.randomUUID();
  const doc = await withOwnImages({ ...filledDoc(template, event), id, name: template.name }, template.id);
  await repo.insert(doc, { isTemplate: false, eventId: event.id, sourceTemplateId: template.id });
  try {
    const assets = assetsOf(id);
    await repo.saveOverlay(id, await renderPrintPng(doc, assets));
    await repo.saveScreen(id, await renderScreenWebp(doc, assets));
    await repo.saveThumbnail(id, await renderThumbnail(doc, assets));
    return await attachEventFrame(event.id, slot, id, { moveQueued });
  } catch (error) {
    // The copy never reached guests. Remove it, so a failed choice leaves nothing behind.
    await repo.remove(id).catch(() => undefined);
    throw error;
  }
}
