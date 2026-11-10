/**
 * Signing in an anonymous guest at most once per browser.
 *
 * Several tabs (a second QR scan, the link opened twice, a preloaded page) can
 * open the event at the same moment. Without care, each would find no session
 * and sign in its own guest, and each guest gets a fresh magnet quota. Here the
 * sign-in runs under a lock shared by every tab of the site, and checks again
 * for a session once it holds the lock, so the second tab picks up the guest
 * the first one created. Within one tab, concurrent calls share one sign-in.
 */

export type LockFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

export const GUEST_SIGN_IN_LOCK = "magnetimshare-guest-sign-in";

/** A lock shared by every tab of this site (Web Locks). Without Web Locks, the call just runs. */
export const browserLock: LockFn = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== "function") return fn();
  // request() resolves with the callback's result; its type wraps the promise once more.
  return locks.request(name, () => fn()) as unknown as Promise<T>;
};

export type GuestSignInDeps = {
  /** The signed-in user id, read from the shared session storage, or null. */
  currentUserId: () => Promise<string | null>;
  /** Signs in a new anonymous guest and returns its id. */
  signIn: () => Promise<string>;
  lock?: LockFn;
};

export function createGuestSignIn(deps: GuestSignInDeps): () => Promise<string> {
  const lock = deps.lock ?? browserLock;
  let inFlight: Promise<string> | null = null;

  return async function ensureGuest(): Promise<string> {
    const existing = await deps.currentUserId();
    if (existing) return existing;
    if (!inFlight) {
      inFlight = lock(GUEST_SIGN_IN_LOCK, async () => {
        // Another tab may have signed in while this one waited for the lock.
        const again = await deps.currentUserId();
        return again ?? deps.signIn();
      }).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
