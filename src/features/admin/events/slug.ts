const SLUG = /^[a-z0-9]{1,32}$/;

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function suggestSlug(title: string, suffix = randomSuffix()): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8);
  const body = stem.length >= 2 ? stem : "event";
  return `${body}${suffix}`.slice(0, 16);
}

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

export function guestEventUrl(slug: string): string {
  return `https://www.magnetimshare.com/e/${slug}`;
}

export function isPastDate(value: string): boolean {
  if (!value) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return value < today;
}
