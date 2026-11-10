/**
 * One guest send: a fixed id per captured photo and the fixed storage paths
 * that come from it. A retry of the same send reuses the id, so it uploads to
 * the same paths and the database returns the same magnet.
 */

/** A new id for one captured photo. A retake gets a new one. */
export function newSendId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  // Older browsers and plain-http pages have getRandomValues but not randomUUID.
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The print photo and its thumbnail, both in the guest's own folder for this
 * event. The thumbnail shares the photo's name prefix (see thumbPathFromPhoto).
 */
export function guestPhotoPaths(
  eventId: string,
  guestId: string,
  sendId: string,
): { photo: string; thumb: string } {
  const folder = `${eventId}/${guestId}`;
  return { photo: `${folder}/${sendId}_photo.jpg`, thumb: `${folder}/${sendId}_thumb.webp` };
}

/**
 * True when Storage refused an upload because the file is already there. With
 * fixed paths per send, that means an earlier try of this same send stored it.
 */
export function isAlreadyStored(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; statusCode?: unknown; error?: unknown; message?: unknown };
  if (e.status === 409 || e.statusCode === "409" || e.statusCode === 409) return true;
  if (e.error === "Duplicate") return true;
  return typeof e.message === "string" && /already exists/i.test(e.message);
}
