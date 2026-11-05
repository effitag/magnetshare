// State and actions of the studio library: list, create, rename, delete, backup, restore, frame import.
import { useCallback, useEffect, useState } from 'react';
import { notify } from '@/features/studio/ui/toast';
import { createPresetDoc } from '@/features/studio/model/presets';
import { renderPrintPng, renderScreenWebp } from '@/features/studio/render/renderToCanvas';
import { backupFileName, downloadBlob, exportAllTemplates, importBackup } from '@/features/studio/storage/backupZip';
import { createAssetCache } from '@/features/studio/storage/assetCache';
import { uploadBuiltinImages } from '@/features/studio/storage/builtinImages';
import { isNetworkError } from '@/features/studio/storage/errors';
import { importFrameFile } from './importFrame';

const OFFLINE = 'אין חיבור לאינטרנט. נסה שוב כשהחיבור יחזור.';

export function useLibrary(repo, onOpen) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null); // progress text while backing up, restoring or importing

  const refresh = useCallback(async () => {
    try {
      setItems(await repo.list());
      setLoadError(null);
    } catch (err) {
      console.error('[studio] listing failed:', err);
      setLoadError(isNetworkError(err) ? OFFLINE : 'לא הצלחתי לטעון את התבניות.');
    }
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Run an action; on failure show `message` (or the offline message). Returns whether it worked.
  async function attempt(action, message) {
    try {
      await action();
      return true;
    } catch (err) {
      console.error(`[studio] ${message}`, err);
      notify(isNetworkError(err) ? OFFLINE : message);
      return false;
    }
  }

  async function create(name, preset) {
    let created;
    const make = async () => {
      // Ready-made frames may use the app's colourful icons; they are copied into the new template.
      const doc = await uploadBuiltinImages(repo, createPresetDoc(name, preset));
      created = await repo.insert(doc);
    };
    if (await attempt(make, 'לא הצלחתי ליצור את התבנית.')) onOpen(created.id);
  }

  async function rename(item, name) {
    const ok = await attempt(() => repo.rename(item.id, name), 'שינוי השם נכשל.');
    if (ok) await refresh();
    return ok;
  }

  async function remove(item) {
    const ok = await attempt(() => repo.remove(item.id), 'המחיקה נכשלה.');
    if (ok) await refresh();
    return ok;
  }

  async function importFrame(file) {
    setBusy('מייבא מסגרת…');
    let result;
    const ok = await attempt(async () => (result = await importFrameFile(repo, file)), 'לא הצלחתי לייבא את המסגרת. אפשר PNG, JPG, WEBP או SVG.');
    setBusy(null);
    if (!ok) return;
    notify(result.foundWindow ? 'המסגרת נוספה. החלון השקוף שלה הוא אזור התמונה.' : 'המסגרת נוספה. לא נמצא בה חלון שקוף, אז כדאי להזיז את אזור התמונה למקום.', 'info');
    onOpen(result.id);
  }

  async function exportZip() {
    setBusy('מכין גיבוי…');
    await attempt(async () => {
      const { blob, count } = await exportAllTemplates(repo, { onProgress: (done, total) => setBusy(`מגבה ${done}/${total}…`) });
      downloadBlob(blob, backupFileName());
      notify(`הגיבוי ירד למחשב: ${count} תבניות בקובץ ZIP אחד.`, 'info');
    }, 'הגיבוי נכשל.');
    setBusy(null);
  }

  async function importZip(file) {
    setBusy('קורא את הגיבוי…');
    await attempt(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { imported, failed } = await importBackup(repo, bytes, { onProgress: (done, total) => setBusy(`משחזר ${done}/${total}…`) });
      if (!imported && !failed.length) notify('לא נמצאו תבניות בקובץ הזה.');
      else if (failed.length) notify(`שוחזרו ${imported} תבניות. ${failed.length} לא נקראו: ${failed.map((f) => f.folder).join(', ')}`);
      else notify(`שוחזרו ${imported} תבניות, כעותקים חדשים.`, 'info');
      await refresh();
    }, 'השחזור נכשל. ודא שזה קובץ ZIP של גיבוי מהכלי.');
    setBusy(null);
  }

  async function duplicateForEvent(item) {
    let created;
    const ok = await attempt(async () => {
      created = await repo.duplicateForEvent(item.id);
    }, 'לא הצלחנו ליצור מסגרת לאירוע.');
    if (ok) onOpen(created.id);
  }

  async function publish(item) {
    const ok = await attempt(async () => {
      const { doc } = await repo.load(item.id);
      const assets = createAssetCache((path) => repo.readAsset(item.id, path));
      await repo.publish(item.id, {
        overlay: await renderPrintPng(doc, assets),
        screen: await renderScreenWebp(doc, assets),
      });
    }, 'לא הצלחנו לפרסם את המסגרת. נסו שוב.');
    if (ok) {
      notify('המסגרת פורסמה. עכשיו אפשר להפעיל את האירוע.', 'info');
      await refresh();
    }
    return ok;
  }

  async function unpublish(item) {
    const ok = await attempt(() => repo.unpublish(item.id), 'לא הצלחנו לבטל את הפרסום.');
    if (ok) await refresh();
    return ok;
  }

  return { items, loadError, busy, refresh, create, rename, remove, importFrame, exportZip, importZip, duplicateForEvent, publish, unpublish };
}
