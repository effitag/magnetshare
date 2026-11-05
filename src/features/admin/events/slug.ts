export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function suggestSlug(title: string, suffix = randomSuffix()): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8);
  const body = stem.length >= 2 ? stem : "event";
  return `${body}${suffix}`.slice(0, 16);
}

export function guestEventUrl(slug: string): string {
  return `https://www.magnetimshare.com/e/${slug}`;
}
