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

export function guestEventUrl(slug: string): string {
  return `https://www.magnetimshare.com/e/${slug}`;
}
