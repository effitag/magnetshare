// In-memory stand-in for supabaseGateway.js, with the same revision rules as the database trigger.
// Used by the unit tests and by the local demo mode (npm run dev, then open /?demo).
// Set `gateway.offline = true` to make every call fail like a dropped connection.

export function createMemoryGateway() {
  const rows = new Map();
  const files = new Map();
  let clock = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();

  const gateway = {
    rows,
    files,
    offline: false,
    calls: [],

    check(name) {
      gateway.calls.push(name);
      if (gateway.offline) throw new TypeError('Failed to fetch');
    },

    async listTemplates() {
      gateway.check('listTemplates');
      return [...rows.values()]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => ({
          id: r.id,
          name: r.name,
          updated_at: r.updated_at,
          revision: r.revision,
          is_template: r.is_template !== false,
          is_published: r.is_published === true,
          size: r.doc.size,
          tags: r.doc.tags,
        }));
    },
    async getTemplate(id) {
      gateway.check('getTemplate');
      const r = rows.get(id);
      return r
        ? structuredClone({ id: r.id, name: r.name, doc: r.doc, revision: r.revision, is_template: r.is_template !== false })
        : null;
    },
    async getRevision(id) {
      gateway.check('getRevision');
      return rows.get(id)?.revision ?? null;
    },
    async insertTemplate(row) {
      gateway.check('insertTemplate');
      if (rows.has(row.id)) throw Object.assign(new Error('duplicate key value'), { code: '23505' });
      rows.set(row.id, { ...structuredClone(row), revision: 1, updated_at: now() });
      return { revision: 1 };
    },
    async updateTemplate(id, patch, expectedRevision) {
      gateway.check('updateTemplate');
      const r = rows.get(id);
      if (!r || r.revision !== expectedRevision) return [];
      Object.assign(r, structuredClone(patch), { revision: r.revision + 1, updated_at: now() });
      return [{ revision: r.revision }];
    },
    async deleteTemplate(id) {
      gateway.check('deleteTemplate');
      rows.delete(id);
    },

    async upload(key, blob, { contentType, upsert = false }) {
      gateway.check('upload');
      if (files.has(key) && !upsert) throw Object.assign(new Error('The resource already exists'), { statusCode: '409' });
      files.set(key, { blob, contentType });
    },
    async download(key) {
      gateway.check('download');
      const f = files.get(key);
      if (!f) throw new Error('Object not found');
      return f.blob;
    },
    async list(prefix) {
      gateway.check('list');
      const children = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(`${prefix}/`)) continue;
        const [name, ...rest] = key.slice(prefix.length + 1).split('/');
        children.set(name, { name, id: rest.length ? null : `file:${key}` });
      }
      return [...children.values()];
    },
    async remove(keys) {
      gateway.check('remove');
      keys.forEach((k) => files.delete(k));
    },
    async signedUrls(keys) {
      gateway.check('signedUrls');
      const urlFor = (k) => (typeof window === 'undefined' ? `memory://${k}` : URL.createObjectURL(files.get(k).blob));
      return keys.map((k) => (files.has(k) ? { path: k, signedUrl: urlFor(k), error: null } : { path: k, signedUrl: null, error: 'Object not found' }));
    },
  };
  return gateway;
}
