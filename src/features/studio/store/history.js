// Snapshot undo/redo over the immutable template document.

export const HISTORY_LIMIT = 50;
// Edits with the same key within this window merge into one undo step
// (a burst of typing, a held arrow key, dragging through the colour picker).
export const COALESCE_MS = 1000;

export function initHistory(present) {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit(history, next, { key = null, now = Date.now() } = {}) {
  if (next === history.present) return history;
  const merge = key !== null && key === history.lastKey && now - history.lastAt < COALESCE_MS;
  const past = merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo(history) {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo(history) {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}
