/**
 * Where supabase-js keeps the signed-in session (guest or admin).
 *
 * One session per browser: it lives in localStorage, so every tab, a second
 * scan of the event QR and a browser restart all find the same guest. Before
 * this, it lived in sessionStorage, which belongs to one tab, so every new tab
 * signed in a new anonymous guest with a fresh magnet quota.
 *
 * A session that an older build saved in this tab's sessionStorage moves to
 * localStorage the first time it is read, so a guest keeps their identity
 * across the deploy. When localStorage is blocked, the session falls back to
 * sessionStorage, and then to memory, so the page still works.
 */

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: fn() };
  } catch {
    return { ok: false };
  }
}

/** The browser's storage, or null when the browser blocks it (for example some private modes). */
export function browserStore(name: "localStorage" | "sessionStorage"): KeyValueStore | null {
  const found = attempt(() => globalThis[name]);
  return found.ok && found.value ? found.value : null;
}

export function createSessionStore(
  persistent: KeyValueStore | null,
  legacy: KeyValueStore | null,
): KeyValueStore {
  const memory = new Map<string, string>();

  function read(store: KeyValueStore | null, key: string): string | null {
    if (!store) return null;
    const found = attempt(() => store.getItem(key));
    return found.ok ? found.value : null;
  }

  function write(store: KeyValueStore | null, key: string, value: string): boolean {
    return store ? attempt(() => store.setItem(key, value)).ok : false;
  }

  function remove(store: KeyValueStore | null, key: string): void {
    if (store) attempt(() => store.removeItem(key));
  }

  return {
    getItem(key) {
      const stored = read(persistent, key);
      if (stored !== null) return stored;
      const old = read(legacy, key);
      if (old !== null) {
        if (write(persistent, key, old)) remove(legacy, key);
        return old;
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      if (write(persistent, key, value) || write(legacy, key, value)) {
        memory.delete(key);
        return;
      }
      memory.set(key, value);
    },
    removeItem(key) {
      remove(persistent, key);
      remove(legacy, key);
      memory.delete(key);
    },
  };
}

/** Whether a stored supabase-js session belongs to an anonymous guest. */
function isAnonymousSession(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { user?: { is_anonymous?: unknown } } | null;
    return parsed?.user?.is_anonymous === true;
  } catch {
    return false;
  }
}

/**
 * Guest pages keep their session under their own key, apart from the admin's
 * (see supabase.ts). An anonymous guest that an older build saved under the
 * shared key moves to the guest key once, so a guest keeps their identity,
 * magnets and quota across the deploy. It is moved, not copied: two clients
 * refreshing the same session would invalidate each other's refresh token.
 * Anything else under the shared key (an admin's Google session) stays.
 */
export function moveGuestSession(
  store: KeyValueStore,
  sharedKey: string,
  guestKey: string,
): "moved" | "kept" {
  const shared = store.getItem(sharedKey);
  if (!isAnonymousSession(shared) || store.getItem(guestKey) !== null) return "kept";
  store.setItem(guestKey, shared as string);
  store.removeItem(sharedKey);
  return "moved";
}
