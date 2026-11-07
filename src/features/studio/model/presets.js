// Standard magnet sizes and ready-made frame layouts for new templates.
//
// Sizes follow what event-magnet companies in Israel offer: 7.5×10 cm is the regular magnet
// (two fit on one 10×15 print), 10×15 the large one, and 10×10 a square "Polaroid" format.
// Most event photos are landscape, so landscape is the default orientation.
// Layout proportions follow common practice: a band of roughly 15–20% of the height for names
// and date, a transparent photo window, and text kept inside the safe area so cutting can't clip it.
import { half, photoArea, rect, text } from './layoutKit';
import { createBackground, createTemplateDoc } from './schema';
import { autoBind } from './eventBinding';
import { STARTER_CATEGORIES, STARTERS } from './starters';

export const SIZE_PRESETS = [
  { id: 'regular', label: 'רגיל · 7.5×10', note: 'הגודל הנפוץ באירועים', long: 100, short: 75 },
  { id: 'large', label: 'גדול · 10×15', note: 'מגנט כפול', long: 150, short: 100 },
  { id: 'square', label: 'ריבוע · 10×10', note: 'בסגנון פולארויד', long: 100, short: 100 },
];

export const ORIENTATIONS = [
  { id: 'landscape', label: 'לרוחב' },
  { id: 'portrait', label: 'לאורך' },
];

export const LAYOUTS = [
  { id: 'polaroid', label: 'פולארויד', note: 'שוליים לבנים, השמות בשוליים התחתונים' },
  { id: 'strip', label: 'פס תחתון', note: 'התמונה עד הקצה, פס צבע עם השמות והתאריך' },
  { id: 'blank', label: 'ריקה', note: 'מתחילים מאפס' },
];

export const DEFAULT_PRESET = { sizeId: 'regular', orientation: 'landscape', layoutId: 'polaroid' };

const BLEED_MM = 3;

export function presetSize(sizeId, orientation = 'landscape') {
  const preset = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[0];
  const landscape = orientation !== 'portrait';
  const widthMm = landscape ? preset.long : preset.short;
  const heightMm = landscape ? preset.short : preset.long;
  // 3 mm keeps the small magnet usable; larger ones get 4 mm.
  const safeMm = Math.min(widthMm, heightMm) <= 75 ? 3 : 4;
  return { widthMm, heightMm, bleedMm: BLEED_MM, safeMm };
}

/**
 * Names (large) above the date (half size), fitted between `top` and the safe line at the bottom.
 */
function namesAndDate(size, top, style) {
  const { widthMm: W, heightMm: H, safeMm } = size;
  const room = H - safeMm - top;
  const namesMm = Math.min(room / (1.15 * 1.5), 12);
  const dateMm = namesMm / 2;
  const block = (namesMm + dateMm) * 1.15;
  const y = top + (room - block) / 2;
  const width = W - 2 * safeMm;
  return [
    text({ name: 'שמות', value: 'שם ♥ שם', x: safeMm, y, width, sizeMm: namesMm, ...style.names }),
    text({ name: 'תאריך', value: 'תאריך האירוע', x: safeMm, y: y + namesMm * 1.15, width, sizeMm: dateMm, ...style.date }),
  ];
}

function polaroid(size) {
  const { widthMm: W, heightMm: H } = size;
  const margin = half(Math.min(W, H) * 0.05);
  const band = half(H * 0.2);
  return [
    photoArea({ x: margin, y: margin, width: W - 2 * margin, height: H - margin - band }),
    ...namesAndDate(size, H - band + 0.5, {
      names: { font: 'Gveret Levin', color: '#1F2A44' },
      date: { font: 'Gveret Levin', color: '#5B6475' },
    }),
  ];
}

function strip(size) {
  const { widthMm: W, heightMm: H, bleedMm: b } = size;
  const band = half(H * 0.18);
  return [
    // The photo runs to the edge: its window extends into the bleed on three sides.
    photoArea({ x: -b, y: -b, width: W + 2 * b, height: H - band + b }),
    rect({ name: 'פס תחתון', x: -b, y: H - band, width: W + 2 * b, height: band + b, fill: '#1F2A44' }),
    ...namesAndDate(size, H - band, {
      names: { font: 'Heebo', weight: 600, color: '#FFFFFF' },
      date: { font: 'Heebo', weight: 400, color: '#D3D8E2' },
    }),
  ];
}

const LAYOUT_BUILDERS = { polaroid, strip, blank: () => [] };

/** The gallery in "תבנית חדשה": the basic layouts, then ready-made frames by kind of event. */
export const DESIGN_CATEGORIES = [{ id: 'basic', label: 'בסיסי' }, ...STARTER_CATEGORIES];

export function designsIn(categoryId) {
  if (categoryId === 'basic') return LAYOUTS;
  return STARTERS.filter((d) => d.category === categoryId);
}

/**
 * A new template document with a standard size and a layout: a basic one or a ready-made frame.
 * A ready-made frame is tagged with its kind of event.
 */
export function createPresetDoc(name, { sizeId, orientation, layoutId } = DEFAULT_PRESET) {
  const doc = createTemplateDoc(name);
  const size = presetSize(sizeId, orientation);
  const starter = STARTERS.find((d) => d.id === layoutId);
  const build = starter?.build ?? LAYOUT_BUILDERS[layoutId] ?? LAYOUT_BUILDERS.blank;
  const background = { ...createBackground(), fill: starter?.background ?? '#FFFFFF' };
  const tags = starter ? [STARTER_CATEGORIES.find((c) => c.id === starter.category).label] : [];
  tags.push(`size:${sizeId}`, `layout:${layoutId}`, `orient:${orientation}`);
  // New templates link their "שמות" and "תאריך" texts to the event from the start.
  return { ...doc, size, tags, elements: [background, ...build(size).map(autoBind)] };
}

export function visibleTags(tags = []) {
  return (tags ?? []).filter((tag) => !/^(size|layout|orient):/.test(String(tag)));
}

function tagValue(tags, prefix) {
  const found = (tags ?? []).find((tag) => String(tag).startsWith(prefix));
  return found ? String(found).slice(prefix.length) : null;
}

export function frameOrientation(widthMm, heightMm) {
  return Number(widthMm) > Number(heightMm) ? 'landscape' : 'portrait';
}

/** Swap the axes when an older template has no saved layout to rebuild from. */
export function transposeDoc(doc) {
  const next = structuredClone(doc);
  const width = Number(next.size?.widthMm) || 1;
  const height = Number(next.size?.heightMm) || 1;
  next.size = { ...next.size, widthMm: height, heightMm: width };
  next.elements = (next.elements ?? []).map((element) => {
    if (element.x == null || element.y == null) return element;
    const moved = { ...element, x: element.y, y: element.x };
    if (element.width != null && element.height != null) {
      moved.width = element.height;
      moved.height = element.width;
    }
    return moved;
  });
  next.tags = [
    ...visibleTags(next.tags),
    ...(tagValue(doc.tags, 'size:') ? [`size:${tagValue(doc.tags, 'size:')}`] : []),
    ...(tagValue(doc.tags, 'layout:') ? [`layout:${tagValue(doc.tags, 'layout:')}`] : []),
    `orient:${frameOrientation(next.size.widthMm, next.size.heightMm)}`,
  ];
  return next;
}

/**
 * A copy aimed at one slot. Tagged templates rebuild from their layout.
 * A square stays square. Anything else without tags is transposed.
 */
export function docForOrientation(doc, orientation) {
  const width = Number(doc.size?.widthMm) || 0;
  const height = Number(doc.size?.heightMm) || 0;
  if (width === height || frameOrientation(width, height) === orientation) return structuredClone(doc);
  const sizeId = tagValue(doc.tags, 'size:');
  const layoutId = tagValue(doc.tags, 'layout:');
  if (sizeId && layoutId) {
    const built = createPresetDoc(doc.name, { sizeId, orientation, layoutId });
    return { ...built, name: doc.name, id: doc.id };
  }
  return transposeDoc(doc);
}
