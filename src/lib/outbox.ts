/**
 * Outbox: a photo that has not become a magnet yet stays on the guest's phone,
 * so a reload, a closed tab or a killed browser does not lose it. The next
 * visit to the event finishes the send. Once the magnet exists, the photo is
 * removed from the phone.
 *
 * It lives in IndexedDB. When the browser blocks IndexedDB (some private
 * modes), it falls back to memory, which is how sending worked before.
 */

export type OutboxItem = {
  sendId: string;
  eventId: string;
  guestId: string;
  frameId: string;
  copies: number;
  photo: Blob;
  thumb: Blob;
  savedAt: number;
};

export interface OutboxStore {
  put(item: OutboxItem): Promise<void>;
  delete(sendId: string): Promise<void>;
  list(): Promise<OutboxItem[]>;
}

/** A photo older than this is not sent any more (the event is most likely over). */
export const OUTBOX_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function memoryOutbox(): OutboxStore {
  const items = new Map<string, OutboxItem>();
  return {
    async put(item) {
      items.set(item.sendId, item);
    },
    async delete(sendId) {
      items.delete(sendId);
    },
    async list() {
      return [...items.values()];
    },
  };
}

/** Puts in the first store, and in the fallback when the first one refuses (full, blocked). */
export function withFallback(primary: OutboxStore, fallback: OutboxStore): OutboxStore {
  return {
    async put(item) {
      try {
        await primary.put(item);
      } catch {
        await fallback.put(item);
      }
    },
    async delete(sendId) {
      await Promise.allSettled([primary.delete(sendId), fallback.delete(sendId)]);
    },
    async list() {
      const [first, second] = await Promise.allSettled([primary.list(), fallback.list()]);
      const all = [
        ...(first.status === "fulfilled" ? first.value : []),
        ...(second.status === "fulfilled" ? second.value : []),
      ];
      const bySend = new Map(all.map((item) => [item.sendId, item]));
      return [...bySend.values()];
    },
  };
}

/**
 * The unsent photos of this guest for this event, oldest first. Photos older
 * than a day, or saved by another guest on this phone, are removed.
 */
export async function pendingSends(
  store: OutboxStore,
  eventId: string,
  guestId: string,
  now: number = Date.now(),
  maxAgeMs: number = OUTBOX_MAX_AGE_MS,
): Promise<OutboxItem[]> {
  const items = await store.list();
  const stale = items.filter(
    (item) =>
      now - item.savedAt > maxAgeMs || (item.eventId === eventId && item.guestId !== guestId),
  );
  await Promise.allSettled(stale.map((item) => store.delete(item.sendId)));
  return items
    .filter((item) => !stale.includes(item) && item.eventId === eventId && item.guestId === guestId)
    .sort((a, b) => a.savedAt - b.savedAt);
}

const DB_NAME = "magnetimshare-outbox";
const STORE = "sends";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** The IndexedDB outbox, or null when this browser has no usable IndexedDB. */
export async function openIndexedDbOutbox(): Promise<OutboxStore | null> {
  if (typeof indexedDB === "undefined") return null;
  let db: IDBDatabase;
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE))
        open.result.createObjectStore(STORE, { keyPath: "sendId" });
    };
    db = await request(open);
  } catch {
    return null;
  }
  const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => {
    const tx = db.transaction(STORE, mode);
    const result = request(fn(tx.objectStore(STORE)));
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return Promise.all([result, done]).then(([value]) => value);
  };
  return {
    async put(item) {
      await run("readwrite", (store) => store.put(item));
    },
    async delete(sendId) {
      await run("readwrite", (store) => store.delete(sendId));
    },
    async list() {
      return (await run("readonly", (store) => store.getAll())) as OutboxItem[];
    },
  };
}

let shared: Promise<OutboxStore> | null = null;

/** The outbox of this browser: IndexedDB when it works, memory otherwise. */
export function outbox(): Promise<OutboxStore> {
  shared ??= openIndexedDbOutbox()
    .catch(() => null)
    .then((db) => (db ? withFallback(db, memoryOutbox()) : memoryOutbox()));
  return shared;
}

/** Send ids being sent right now on this page, so a resume does not run the same send twice at once. */
export const activeSends = new Set<string>();
