// The studio's templates in the cloud. Same jobs the local-folder version had:
// list, create, load, save, rename, delete, images and thumbnails.
import { DEFAULT_SIZE, migrateTemplate } from '@/features/studio/model/schema';
import { createPresetDoc, DEFAULT_PRESET, docForOrientation } from '@/features/studio/model/presets';
import { ConflictError, NotFoundError, UnsupportedImageError } from './errors';
import { frameFolder, frameObjectPath, imageTypeOf, OVERLAY_FILE, PREVIEW_FILE, SCREEN_FILE } from './paths';

const THUMBNAIL_URL_SECONDS = 60 * 60;

function frameColumns(doc) {
  const width = Number(doc.size?.widthMm) || 1;
  const height = Number(doc.size?.heightMm) || 1;
  const photo = (doc.elements ?? []).find((element) => element.type === 'photo');
  const ratio = (value, total) => {
    const number = Number(value) / total;
    if (!Number.isFinite(number)) return 0;
    return Math.min(1, Math.max(0, Math.round(number * 10000) / 10000));
  };
  let windowX = photo ? ratio(photo.x, width) : 0;
  let windowY = photo ? ratio(photo.y, height) : 0;
  let windowW = photo ? ratio(photo.width, width) : 1;
  let windowH = photo ? ratio(photo.height, height) : 1;
  if (windowW <= 0) windowW = 0.0001;
  if (windowH <= 0) windowH = 0.0001;
  if (windowX + windowW > 1) windowW = Math.round((1 - windowX) * 10000) / 10000;
  if (windowY + windowH > 1) windowH = Math.round((1 - windowY) * 10000) / 10000;
  return {
    width_mm: Math.max(1, Math.round(width)),
    height_mm: Math.max(1, Math.round(height)),
    bleed_mm: Math.max(0, Math.round(doc.size?.bleedMm ?? 0)),
    safe_mm: Math.max(0, Math.round(doc.size?.safeMm ?? 0)),
    window_x: windowX,
    window_y: windowY,
    window_w: windowW,
    window_h: windowH,
  };
}

/**
 * The studio's template library (shared by all admins; the database lets only admins in).
 * @param gateway  see supabaseGateway.js (or the in-memory one in tests)
 */
export function createCloudRepo(gateway) {
  const prefix = frameFolder;

  async function listKeys(folder) {
    const keys = [];
    for (const entry of await gateway.list(folder)) {
      const key = `${folder}/${entry.name}`;
      if (entry.id === null || entry.id === undefined) keys.push(...(await listKeys(key)));
      else keys.push(key);
    }
    return keys;
  }

  const repo = {
    /** Library rows, newest first: { id, name, updatedAt, revision, size, tags, thumbnailUrl }. */
    async list() {
      const rows = await gateway.listTemplates();
      const keys = rows.map((r) => frameObjectPath(r.id, PREVIEW_FILE));
      const urls = new Map();
      try {
        for (const u of await gateway.signedUrls(keys, THUMBNAIL_URL_SECONDS)) if (!u.error && u.signedUrl) urls.set(u.path, u.signedUrl);
      } catch (err) {
        console.warn('[cloud] thumbnails unavailable:', err.message);
      }
      return rows.map((r, i) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updated_at,
        revision: r.revision,
        size: { ...DEFAULT_SIZE, ...r.size },
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        isTemplate: r.is_template !== false,
        isPublished: r.is_published === true,
        thumbnailUrl: urls.get(keys[i]) ?? null,
      }));
    },

    /** New template with a standard size and layout (see model/presets.js). */
    async create(name, preset = DEFAULT_PRESET) {
      const doc = createPresetDoc(name, preset);
      const created = await repo.insert(doc, { isTemplate: true });
      return { id: created.id, doc, revision: created.revision };
    },

    /** Adds an existing document. Library rows are templates; an event frame is a copy. */
    async insert(doc, { isTemplate = true } = {}) {
      const { revision } = await gateway.insertTemplate({
        id: doc.id,
        name: doc.name,
        doc,
        is_template: isTemplate,
        ...frameColumns(doc),
      });
      return { id: doc.id, revision };
    },

    async duplicateForEvent(id, orientation) {
      const { doc } = await repo.load(id);
      const shaped = orientation ? docForOrientation(doc, orientation) : structuredClone(doc);
      const copy = { ...structuredClone(shaped), id: crypto.randomUUID(), name: doc.name };
      return repo.insert(copy, { isTemplate: false });
    },

    async load(id) {
      const row = await gateway.getTemplate(id);
      if (!row) throw new NotFoundError();
      return { doc: migrateTemplate({ ...row.doc, id: row.id }), revision: row.revision, isTemplate: row.is_template === true };
    },

    /**
     * Saves only if nobody saved since `expectedRevision`; returns the new revision.
     * Throws ConflictError if someone did, NotFoundError if the template was deleted.
     */
    async save(id, doc, expectedRevision) {
      const stamped = { ...doc, id, updatedAt: new Date().toISOString() };
      const rows = await gateway.updateTemplate(id, { name: doc.name, doc: stamped, ...frameColumns(stamped) }, expectedRevision);
      if (rows.length) return rows[0].revision;
      const latest = await gateway.getRevision(id);
      if (latest === null) throw new NotFoundError();
      throw new ConflictError(latest);
    },

    async currentRevision(id) {
      const revision = await gateway.getRevision(id);
      if (revision === null) throw new NotFoundError();
      return revision;
    },

    async rename(id, name) {
      const { doc, revision } = await repo.load(id);
      return repo.save(id, { ...doc, name }, revision);
    },

    /** Deletes the template, then its files (a leftover file is harmless; a leftover row is not). */
    async remove(id) {
      await gateway.deleteTemplate(id);
      try {
        await gateway.remove(await listKeys(prefix(id)));
      } catch (err) {
        console.warn(`[cloud] files of deleted template ${id} not removed:`, err.message);
      }
    },

    async uploadAsset(_id, file, { name = file.name } = {}) {
      const type = imageTypeOf(name, file.type);
      if (!type) throw new UnsupportedImageError(file.type || name);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:${type};base64,${btoa(binary)}`;
    },

    async readAsset(id, path) {
      if (typeof path === 'string' && path.startsWith('data:')) {
        const response = await fetch(path);
        return response.blob();
      }
      return gateway.download(`${prefix(id)}/${path}`);
    },

    async saveThumbnail(id, blob) {
      await gateway.upload(frameObjectPath(id, PREVIEW_FILE), blob, { contentType: 'image/png', upsert: true });
    },

    async saveOverlay(id, blob) {
      await gateway.upload(frameObjectPath(id, OVERLAY_FILE), blob, { contentType: 'image/png', upsert: true });
    },

    async saveScreen(id, blob) {
      await gateway.upload(frameObjectPath(id, SCREEN_FILE), blob, { contentType: 'image/webp', upsert: true });
    },

    async publish(id, { overlay, screen }) {
      const row = await gateway.getTemplate(id);
      if (!row) throw new NotFoundError();
      if (row.is_template === true) {
        throw Object.assign(new Error('template_not_publishable'), { name: 'TemplateError' });
      }
      await repo.saveOverlay(id, overlay);
      await repo.saveScreen(id, screen);
      const rows = await gateway.updateTemplate(
        id,
        {
          is_published: true,
          overlay_path: frameObjectPath(id, OVERLAY_FILE),
          preview_path: frameObjectPath(id, PREVIEW_FILE),
        },
        row.revision,
      );
      if (rows.length) return rows[0].revision;
      const latest = await gateway.getRevision(id);
      if (latest === null) throw new NotFoundError();
      throw new ConflictError(latest);
    },

    async unpublish(id) {
      const row = await gateway.getTemplate(id);
      if (!row) throw new NotFoundError();
      const rows = await gateway.updateTemplate(id, { is_published: false }, row.revision);
      if (rows.length) return rows[0].revision;
      const latest = await gateway.getRevision(id);
      if (latest === null) throw new NotFoundError();
      throw new ConflictError(latest);
    },

    /** Every file of a template, as paths relative to the template folder (for zip export). */
    async listFiles(id) {
      const base = `${prefix(id)}/`;
      return (await listKeys(prefix(id))).map((k) => k.slice(base.length));
    },
  };
  return repo;
}
