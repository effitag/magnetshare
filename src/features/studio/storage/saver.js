// Autosave: saves the template one second after the last change and refreshes the thumbnail later.
//
// - Writes go through one promise chain, so two saves never overlap.
// - If a save fails, the newest unsaved version is kept and retried with growing waits
//   (and right away when the browser reports the connection is back: retryNow()).
// - A ConflictError (saved elsewhere meanwhile) stops autosaving until the user picks a version.
//
// Status: 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict'
import { isNetworkError } from './errors';

export const SAVE_DELAY_MS = 1000;
export const THUMBNAIL_DELAY_MS = 2500;
export const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];

/**
 * @param save           async (doc) => void
 * @param saveThumbnail  async (doc) => void, optional; failures are only logged
 * @param onStatus       (status) => void
 * @param onError        (err) => void, called once per run of failures that aren't a lost connection
 */
export function createSaver({ save, saveThumbnail, onStatus, onError = () => {}, saveDelay = SAVE_DELAY_MS, thumbnailDelay = THUMBNAIL_DELAY_MS }) {
  let pending = null;
  let thumbDoc = null;
  let saveTimer = null;
  let thumbTimer = null;
  let retryTimer = null;
  let attempt = 0;
  let blocked = false;
  let reported = false;
  let status = 'saved';
  let chain = Promise.resolve();

  function setStatus(next) {
    if (next === status) return;
    status = next;
    onStatus(next);
  }

  const enqueue = (task) => (chain = chain.then(task));
  const failing = () => status === 'offline' || status === 'error';

  function clearSaveTimers() {
    clearTimeout(saveTimer);
    clearTimeout(retryTimer);
    saveTimer = null;
    retryTimer = null;
  }

  function runSave() {
    clearSaveTimers();
    if (blocked || !pending) return chain;
    const doc = pending;
    pending = null;
    if (!failing()) setStatus('saving');
    return enqueue(async () => {
      try {
        await save(doc);
        attempt = 0;
        reported = false;
        setStatus(pending ? 'dirty' : 'saved');
        // A change made while saving was waiting for this save; send it now.
        if (pending && !saveTimer) saveTimer = setTimeout(runSave, saveDelay);
        scheduleThumbnail(doc);
      } catch (err) {
        if (!pending) pending = doc; // keep the newest unsaved version
        if (err?.name === 'ConflictError') {
          blocked = true;
          setStatus('conflict');
          return;
        }
        const offline = isNetworkError(err);
        setStatus(offline ? 'offline' : 'error');
        if (!offline && !reported) {
          reported = true;
          console.error('[saver] save failed:', err);
          onError(err);
        }
        const wait = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        attempt += 1;
        retryTimer = setTimeout(runSave, wait);
      }
    });
  }

  function runThumbnail() {
    clearTimeout(thumbTimer);
    thumbTimer = null;
    const doc = thumbDoc;
    thumbDoc = null;
    if (!doc || !saveThumbnail) return chain;
    return enqueue(async () => {
      try {
        await saveThumbnail(doc);
      } catch (err) {
        console.warn('[saver] thumbnail not saved:', err?.message ?? err);
      }
    });
  }

  function scheduleThumbnail(doc) {
    if (!saveThumbnail) return;
    thumbDoc = doc;
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(runThumbnail, thumbnailDelay);
  }

  return {
    schedule(doc) {
      pending = doc;
      // While blocked or failing, the conflict choice or the retry loop picks the change up.
      if (blocked || failing()) return;
      setStatus('dirty');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(runSave, saveDelay);
    },
    scheduleThumbnail,
    /** The connection is back: retry now instead of waiting for the next attempt. */
    retryNow() {
      if (!failing()) return chain;
      attempt = 0;
      return runSave();
    },
    /** After a conflict, keep this tab's version: the caller has refreshed the expected revision. */
    unblock() {
      blocked = false;
      attempt = 0;
      setStatus(pending ? 'dirty' : 'saved');
      return runSave();
    },
    /** After a conflict, drop this tab's unsaved version (the caller loaded the latest one). */
    discard() {
      clearSaveTimers();
      pending = null;
      blocked = false;
      attempt = 0;
      setStatus('saved');
    },
    isDirty: () => pending !== null || blocked,
    getStatus: () => status,
    /** Save now and wait. Resolves true when nothing is left unsaved. */
    async flush() {
      runSave();
      await chain;
      runThumbnail();
      await chain;
      return pending === null && !blocked;
    },
    dispose() {
      clearSaveTimers();
      clearTimeout(thumbTimer);
    },
  };
}
