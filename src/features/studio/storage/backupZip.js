// Backup of all templates as one zip file, and restore from it.
//
// Layout (the same as the original local-folder version, so a backup is readable on its own):
//   <template name>/template.json
//   <template name>/thumbnail.png
//   <template name>/assets/<image files>
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { migrateTemplate } from '@/features/studio/model/schema';
import { sanitizeName, uniqueName } from '@/features/studio/model/names';
import { imageTypeOf, THUMBNAIL_FILE } from './paths';

const TEMPLATE_FILE = 'template.json';
const STORE_ONLY = { level: 0 }; // images are already compressed

/** Zip every template of the user. `onProgress(done, total)` after each template. */
export async function exportAllTemplates(repo, { onProgress = () => {} } = {}) {
  const items = await repo.list();
  const entries = {};
  const folders = [];
  for (const [index, item] of items.entries()) {
    const { doc } = await repo.load(item.id);
    const folder = uniqueName(sanitizeName(doc.name), folders);
    folders.push(folder);
    entries[`${folder}/${TEMPLATE_FILE}`] = [strToU8(`${JSON.stringify(doc, null, 2)}\n`), { level: 6 }];
    for (const path of await repo.listFiles(item.id)) {
      const blob = await repo.readAsset(item.id, path);
      entries[`${folder}/${path}`] = [new Uint8Array(await blob.arrayBuffer()), STORE_ONLY];
    }
    onProgress(index + 1, items.length);
  }
  return { blob: new Blob([zipSync(entries)], { type: 'application/zip' }), count: items.length };
}

/** Replaces every string in the document that equals an old asset path. */
export function remapAssetPaths(value, mapping) {
  if (typeof value === 'string') return mapping.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remapAssetPaths(v, mapping));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapAssetPaths(v, mapping)]));
  }
  return value;
}

/** Groups zip entries by template folder (any folder that holds a template.json). */
export function templateFolders(files) {
  return Object.keys(files)
    .filter((path) => path === TEMPLATE_FILE || path.endsWith(`/${TEMPLATE_FILE}`))
    .filter((path) => !path.split('/').some((part) => part.startsWith('.') || part === '__MACOSX'))
    .map((path) => path.slice(0, -TEMPLATE_FILE.length));
}

/**
 * Adds every template in the zip as a new template (new id, so nothing existing is overwritten).
 * Returns { imported, failed: [{ folder, reason }] }.
 */
export async function importBackup(repo, zipBytes, { onProgress = () => {} } = {}) {
  const files = unzipSync(zipBytes);
  const folders = templateFolders(files);
  const result = { imported: 0, failed: [] };

  for (const [index, folder] of folders.entries()) {
    try {
      await importOne(repo, files, folder);
      result.imported += 1;
    } catch (err) {
      console.error(`[backup] could not import "${folder}":`, err);
      result.failed.push({ folder: folder.replace(/\/$/, '') || '(root)', reason: err.message });
    }
    onProgress(index + 1, folders.length);
  }
  return result;
}

async function importOne(repo, files, folder) {
  const original = migrateTemplate(JSON.parse(strFromU8(files[`${folder}${TEMPLATE_FILE}`])));
  const id = crypto.randomUUID();
  const mapping = new Map();

  // Images first: storage names may change (ASCII only), so the document is rewritten to match.
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith(`${folder}assets/`) || path.endsWith('/')) continue;
    const relative = path.slice(folder.length);
    const name = relative.split('/').pop();
    const type = imageTypeOf(name, '');
    if (!type) continue; // not an image the app can use
    const newPath = await repo.uploadAsset(id, new Blob([bytes], { type }), { name });
    mapping.set(relative, newPath);
  }

  const doc = { ...remapAssetPaths(original, mapping), id };
  await repo.insert(doc);

  const thumbnail = files[`${folder}${THUMBNAIL_FILE}`] ?? files[`${folder}thumbnail.png`];
  if (thumbnail) {
    await repo.saveThumbnail(id, new Blob([thumbnail], { type: 'image/png' })).catch((err) => {
      console.warn('[backup] thumbnail not restored (it is rebuilt when the template is opened):', err.message);
    });
  }
}

/** Starts a download of a blob in the browser. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function backupFileName(date = new Date()) {
  return `magnet-frame-backup-${date.toISOString().slice(0, 10)}.zip`;
}
