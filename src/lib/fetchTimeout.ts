/**
 * Timeouts for every request the Supabase client makes. Without them a request
 * on a stalled connection never ends, and a send would spin forever.
 *
 * - A guest photo or thumbnail upload: 45 seconds per attempt.
 * - Creating a magnet (create_guest_print): 15 seconds.
 * - Admin frame and cover files (paths under frames/ or events/): no timeout,
 *   they can be large and the admin is not in a hurry.
 * - Everything else (reads, sign-in, signed URLs): 20 seconds.
 *
 * A request that runs out of time fails like a dropped connection (a
 * TypeError), so the Supabase libraries and the send retry treat it as one.
 */

export const UPLOAD_TIMEOUT_MS = 45_000;
export const CREATE_MAGNET_TIMEOUT_MS = 15_000;
export const DEFAULT_TIMEOUT_MS = 20_000;

const STORAGE_OBJECT =
  /\/storage\/v1\/object\/(?:(sign|public|authenticated|info|list|move|copy)\/)?([^/]+)(?:\/(.*))?$/;

/** How long a request may take, or null for no limit. */
export function requestTimeoutMs(url: string, method = "GET"): number | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return DEFAULT_TIMEOUT_MS;
  }
  const storage = STORAGE_OBJECT.exec(path);
  if (storage) {
    const [, action, , key = ""] = storage;
    if (key.startsWith("frames/") || key.startsWith("events/")) return null;
    const upload = !action && (method === "POST" || method === "PUT") && key !== "";
    return upload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  }
  if (path.endsWith("/rest/v1/rpc/create_guest_print")) return CREATE_MAGNET_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

/** A fetch that gives up after the time above. The caller's own abort signal still works. */
export function fetchWithTimeouts(
  baseFetch: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase();
    const limit = requestTimeoutMs(url, method);
    if (limit === null) return baseFetch(input, init);

    const controller = new AbortController();
    const outer = init.signal;
    let timedOut = false;
    const onOuterAbort = () => controller.abort(outer?.reason);
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener("abort", onOuterAbort, { once: true });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limit);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new TypeError(`network timeout after ${limit} ms`);
      throw error;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuterAbort);
    }
  };
}
