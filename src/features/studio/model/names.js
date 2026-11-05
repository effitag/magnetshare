// Folder and file names on disk. Hebrew is kept; only characters that file systems reject are replaced.

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001F\u007F]/g;
const MAX_LENGTH = 80;

export function sanitizeName(name, fallback = 'ללא שם') {
  const clean = String(name ?? '')
    .normalize('NFC')
    .replace(FORBIDDEN, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // Leading "." or "_" are reserved (hidden files, the app's own folders such as _exports).
    .replace(/^[._\s]+/, '')
    // Windows drops trailing dots and spaces.
    .replace(/[.\s]+$/, '')
    .slice(0, MAX_LENGTH)
    .trim();
  return clean || fallback;
}

/** `base`, or `base (2)`, `base (3)`… Comparison ignores case, as macOS and Windows do. */
export function uniqueName(base, takenNames) {
  const taken = new Set([...takenNames].map((n) => n.normalize('NFC').toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Split "leaf.SVG" → { stem: "leaf", ext: ".svg" }. */
export function splitExtension(fileName) {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return { stem: fileName, ext: '' };
  return { stem: fileName.slice(0, dot), ext: fileName.slice(dot).toLowerCase() };
}
