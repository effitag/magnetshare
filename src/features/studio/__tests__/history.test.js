// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COALESCE_MS, HISTORY_LIMIT, commit, initHistory, redo, undo } from '@/features/studio/store/history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = initHistory('a');
    h = commit(h, 'b', { now: 0 });
    h = commit(h, 'c', { now: 5000 });
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    h = redo(h);
    expect(h.present).toBe('b');
  });

  it('drops the redo stack after a new change', () => {
    let h = commit(initHistory('a'), 'b');
    h = undo(h);
    h = commit(h, 'x');
    expect(h.future).toEqual([]);
  });

  it('merges edits with the same key inside the window into one step', () => {
    let h = initHistory('');
    h = commit(h, 'n', { key: 'text', now: 0 });
    h = commit(h, 'no', { key: 'text', now: 300 });
    h = commit(h, 'noa', { key: 'text', now: 600 });
    expect(h.past).toEqual(['']);
    h = commit(h, 'noa!', { key: 'text', now: 600 + COALESCE_MS + 1 });
    expect(h.past).toEqual(['', 'noa']);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i += 1) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(10);
  });

  it('ignores no-op commits and empty undo/redo', () => {
    const h = initHistory('a');
    expect(commit(h, 'a')).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
