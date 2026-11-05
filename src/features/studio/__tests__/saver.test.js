// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaver, RETRY_DELAYS_MS, SAVE_DELAY_MS, THUMBNAIL_DELAY_MS } from '@/features/studio/storage/saver';
import { ConflictError } from '@/features/studio/storage/errors';

const offlineError = () => new TypeError('Failed to fetch');

function setup({ failWith = [] } = {}) {
  const saved = [];
  const thumbnails = [];
  const statuses = [];
  const errors = [];
  const failures = [...failWith];
  const saver = createSaver({
    save: async (doc) => {
      const failure = failures.shift();
      if (failure) throw failure();
      saved.push(doc);
    },
    saveThumbnail: async (doc) => thumbnails.push(doc),
    onStatus: (s) => statuses.push(s),
    onError: (e) => errors.push(e),
  });
  return { saver, saved, thumbnails, statuses, errors, failures };
}

describe('saver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves once, one second after the last change, with the newest version', async () => {
    const { saver, saved, statuses } = setup();
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(500);
    saver.schedule('v2');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['v2']);
    expect(statuses).toEqual(['dirty', 'saving', 'saved']);
  });

  it('refreshes the thumbnail after a save', async () => {
    const { saver, thumbnails } = setup();
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + THUMBNAIL_DELAY_MS);
    expect(thumbnails).toEqual(['v1']);
  });

  it('a change made during a save is saved right after it', async () => {
    let release;
    const saved = [];
    const saver = createSaver({
      save: (doc) => new Promise((resolve) => (release = () => resolve(saved.push(doc)))),
      onStatus: () => {},
    });
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    saver.schedule('v2'); // while v1 is still being written
    release();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual(['v1', 'v2']);
  });

  it('keeps changes while offline and saves the newest one when the connection returns', async () => {
    const { saver, saved, statuses, errors } = setup({ failWith: [offlineError, offlineError] });
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saver.getStatus()).toBe('offline');
    saver.schedule('v2'); // editing goes on
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]); // second attempt also fails
    expect(saver.getStatus()).toBe('offline');
    expect(saver.isDirty()).toBe(true);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    expect(saved).toEqual(['v2']);
    expect(statuses.at(-1)).toBe('saved');
    expect(errors).toEqual([]); // a lost connection is not reported as an error
  });

  it('retries immediately when told the connection is back', async () => {
    const { saver, saved } = setup({ failWith: [offlineError] });
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    await saver.retryNow();
    expect(saved).toEqual(['v1']);
    expect(saver.getStatus()).toBe('saved');
  });

  it('reports a real failure once and keeps retrying', async () => {
    const serverError = () => Object.assign(new Error('internal error'), { code: '500' });
    const { saver, saved, errors } = setup({ failWith: [serverError, serverError] });
    saver.schedule('v1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saver.getStatus()).toBe('error');
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(errors).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    expect(saved).toEqual(['v1']);
  });

  it('stops on a conflict until the user keeps their version', async () => {
    const { saver, saved } = setup({ failWith: [() => new ConflictError(5)] });
    saver.schedule('mine');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saver.getStatus()).toBe('conflict');
    saver.schedule('mine 2');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(saved).toEqual([]); // nothing overwritten while undecided

    await saver.unblock();
    expect(saved).toEqual(['mine 2']);
    expect(saver.getStatus()).toBe('saved');
  });

  it('drops the local version when the user loads the latest one instead', async () => {
    const { saver, saved } = setup({ failWith: [() => new ConflictError(5)] });
    saver.schedule('mine');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    saver.discard();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(saved).toEqual([]);
    expect(saver.isDirty()).toBe(false);
    expect(saver.getStatus()).toBe('saved');
  });

  it('flush saves now and says whether anything is left unsaved', async () => {
    const ok = setup();
    ok.saver.schedule('v1');
    expect(await ok.saver.flush()).toBe(true);
    expect(ok.saved).toEqual(['v1']);
    expect(ok.thumbnails).toEqual(['v1']);

    const offline = setup({ failWith: [offlineError] });
    offline.saver.schedule('v1');
    expect(await offline.saver.flush()).toBe(false);
    offline.saver.dispose();
  });
});
