const SUFFIX_LENGTH = 10;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Ten random letters and digits: about 3.6 × 10^15 links, so nobody can find an
 * event by trying links. A guest finds an event only from its QR or link.
 */
export function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function suggestSlug(title: string, suffix = randomSuffix()): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6);
  const body = stem.length >= 2 ? stem : "event";
  return `${body}${suffix}`.slice(0, 16);
}

const PRODUCTION_SITE = "https://www.magnetimshare.com";

/**
 * The site guests should open, from the address the admin is on. Production always
 * links to www.magnetimshare.com; a preview or a local run links to itself, so its
 * QR opens the event in the same (test) project the event was created in.
 */
export function guestSite(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "magnetimshare.com" || url.hostname.endsWith(".magnetimshare.com")) return PRODUCTION_SITE;
    return url.origin;
  } catch {
    return PRODUCTION_SITE;
  }
}

function currentOrigin(): string {
  return typeof window === "undefined" ? PRODUCTION_SITE : window.location.origin;
}

/** The guest link (and QR) of an event, on the site the admin is using. */
export function guestEventUrl(slug: string, origin: string = currentOrigin()): string {
  return `${guestSite(origin)}/e/${slug}`;
}
