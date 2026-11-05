// Keeps the open template saved to the cloud: autosave, connection loss, and edits from elsewhere.
import { useCallback, useEffect, useRef, useState } from 'react';
import { renderThumbnail } from '@/features/studio/render/renderToCanvas';
import { createSaver } from '@/features/studio/storage/saver';
import { useEditor } from '@/features/studio/store/editorStore';

/**
 * @param revision  revision of the version that was loaded (undefined until loaded)
 * @returns { status, flush, reloadLatest, keepMine }
 */
export function useCloudSync({ repo, templateId, revision, assets }) {
  const [status, setStatus] = useState('saved');
  const saverRef = useRef(null);
  const revisionRef = useRef(revision);
  const lastDocRef = useRef(null);
  const ready = revision !== undefined;

  useEffect(() => {
    if (!ready) return undefined;
    revisionRef.current = revision;
    const saver = createSaver({
      save: async (doc) => {
        revisionRef.current = await repo.save(templateId, doc, revisionRef.current);
      },
      saveThumbnail: async (doc) => repo.saveThumbnail(templateId, await renderThumbnail(doc, assets)),
      // Failures show in the banner under the toolbar (SyncBanner), so no extra message here.
      onStatus: setStatus,
    });
    saverRef.current = saver;

    lastDocRef.current = useEditor.getState().history?.present ?? null;
    // Keeps the library thumbnail current (e.g. the first time a template is opened).
    if (lastDocRef.current) saver.scheduleThumbnail(lastDocRef.current);

    const unsubscribe = useEditor.subscribe((state) => {
      const doc = state.history?.present;
      if (doc && doc !== lastDocRef.current) {
        lastDocRef.current = doc;
        saver.schedule(doc);
      }
    });
    const onOnline = () => {
      assets.retryFailed();
      saver.retryNow();
    };
    const onBeforeUnload = (e) => {
      if (!saver.isDirty()) return;
      saver.flush();
      e.preventDefault();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
      saverRef.current = null;
      saver.flush().finally(() => saver.dispose());
    };
    // `revision` only seeds the ref; later revisions come from saves, not from re-running this effect.
  }, [repo, templateId, assets, ready]);

  const flush = useCallback(() => saverRef.current?.flush() ?? Promise.resolve(true), []);

  /** Conflict: replace this tab's version with the one in the cloud. */
  const reloadLatest = useCallback(async () => {
    const latest = await repo.load(templateId);
    revisionRef.current = latest.revision;
    saverRef.current?.discard();
    lastDocRef.current = latest.doc;
    useEditor.getState().open(latest.doc);
  }, [repo, templateId]);

  /** Conflict: overwrite the cloud with this tab's version. */
  const keepMine = useCallback(async () => {
    revisionRef.current = await repo.currentRevision(templateId);
    await saverRef.current?.unblock();
  }, [repo, templateId]);

  return { status, flush, reloadLatest, keepMine };
}
