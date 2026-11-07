// Texts in a frame can be linked to the event: its name or its date.
//
// A linked text element has `bind: 'names' | 'date'`; a date also has
// `dateFormat` (see DATE_FORMATS). In a template the element's own text is only a
// sample. In an event's frame it is replaced by the event's value (applyEvent).
// `bind: null` means the designer unlinked it on purpose; free text stays as typed.
//
// Templates made before linking existed name these layers "שמות" and "תאריך"
// (every ready-made layout does), so loading links them automatically.

export const BINDINGS = [
  { id: 'names', label: 'שם האירוע' },
  { id: 'date', label: 'תאריך האירוע' },
];

export const DATE_FORMATS = [
  { id: 'dots', label: '11.02.2027' },
  { id: 'long', label: '11 בפברואר 2027' },
  { id: 'hebrew', label: 'תאריך עברי' },
];

export const DEFAULT_DATE_FORMAT = 'dots';

/** The date used for samples in the studio. */
export const SAMPLE_DATE = '2027-02-11';

const LAYER_BINDINGS = { שמות: 'names', תאריך: 'date' };

/** Links an older template's "שמות" and "תאריך" layers. Leaves anything already decided alone. */
export function autoBind(element) {
  if (!element || element.type !== 'text' || 'bind' in element) return element;
  const bind = LAYER_BINDINGS[String(element.name ?? '').trim()];
  if (!bind) return element;
  return bind === 'date' ? { ...element, bind, dateFormat: DEFAULT_DATE_FORMAT } : { ...element, bind };
}

export function isBound(element) {
  return element?.type === 'text' && (element.bind === 'names' || element.bind === 'date');
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** 1–999 in Hebrew letters, with geresh or gershayim: 4 → ד׳, 15 → ט״ו, 787 → תשפ״ז. */
export function hebrewNumeral(value) {
  let n = Math.floor(Number(value)) % 1000;
  if (!(n > 0)) return '';
  let letters = '';
  while (n >= 400) {
    letters += 'ת';
    n -= 400;
  }
  if (n >= 100) {
    letters += HUNDREDS[Math.floor(n / 100)];
    n %= 100;
  }
  // 15 and 16 are written ט״ו and ט״ז, not with the letters of God's name.
  if (n === 15 || n === 16) {
    letters += `ט${ONES[n - 9]}`;
  } else {
    letters += TENS[Math.floor(n / 10)] + ONES[n % 10];
  }
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

function hebrewCalendarDate(date) {
  const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const day = hebrewNumeral(Number(part('day').replace(/\D/g, '')));
  const year = hebrewNumeral(Number(part('year').replace(/\D/g, '')));
  return `${day} ב${part('month')} ${year}`;
}

/** "2027-02-11" in one of DATE_FORMATS. An unreadable date comes back as it was. */
export function formatEventDate(iso, format = DEFAULT_DATE_FORMAT) {
  const date = parseIsoDate(iso);
  if (!date) return String(iso ?? '');
  if (format === 'long') {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }
  if (format === 'hebrew') return hebrewCalendarDate(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** The text a linked element shows for this event. Null when the event has no value for it. */
export function boundText(element, event) {
  if (!isBound(element)) return null;
  if (element.bind === 'names') {
    const name = String(event?.title ?? '').trim();
    return name || null;
  }
  return event?.eventDate ? formatEventDate(event.eventDate, element.dateFormat ?? DEFAULT_DATE_FORMAT) : null;
}

/**
 * A copy of the document with the event's name and date in its linked texts.
 * The given document is never changed. Texts the event has no value for keep their sample.
 */
export function applyEvent(doc, event) {
  const next = structuredClone(doc);
  next.elements = (next.elements ?? []).map((element) => {
    const text = boundText(element, event);
    return text === null ? element : { ...element, text };
  });
  return next;
}

/**
 * Font size that fits one line of `textWidth` (measured at `fontSize`) into
 * `boxWidth`. Never larger than the designed size, never below `minScale` of it.
 */
export function fitFontSize(fontSize, textWidth, boxWidth, minScale = 0.3) {
  if (!(textWidth > boxWidth) || !(boxWidth > 0)) return fontSize;
  return Math.max(fontSize * minScale, (fontSize * boxWidth) / textWidth);
}
