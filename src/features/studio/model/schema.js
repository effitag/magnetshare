// The template.json format. See README.md for the field-by-field description.
import { DEFAULT_FONT } from '@/features/studio/fonts/registry';

export const FORMAT = 'magnet-frame-studio';
export const VERSION = 1;

export const DEFAULT_SIZE = { widthMm: 100, heightMm: 150, bleedMm: 3, safeMm: 4 };

export const DEFAULT_EVENT = {
  name: '',
  date: '',
  primaryColor: '#1F2A44',
  secondaryColor: '#C9A96E',
  font: DEFAULT_FONT,
  logo: null,
};

const KNOWN_TYPES = new Set(['background', 'photo', 'text', 'image', 'shape', 'icon']);

/** Sample photo shown in the photo area (editor and thumbnails only, never in the print file). */
export const DEFAULT_PREVIEW = { photo: null, zoom: 1, focusX: 0.5, focusY: 0.5 };

export function newId(prefix = 'el') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function createTemplateDoc(name) {
  const now = new Date().toISOString();
  return {
    format: FORMAT,
    version: VERSION,
    id: crypto.randomUUID(),
    name,
    tags: [],
    createdAt: now,
    updatedAt: now,
    size: { ...DEFAULT_SIZE },
    event: { ...DEFAULT_EVENT },
    elements: [createBackground()],
    preview: null,
  };
}

export function createBackground() {
  return { id: 'bg', type: 'background', name: 'רקע', visible: true, locked: true, opacity: 1, fill: '#FFFFFF', image: null };
}

function base(type, name, size, width, height) {
  return {
    id: newId(),
    type,
    name,
    visible: true,
    locked: false,
    x: round2((size.widthMm - width) / 2),
    y: round2((size.heightMm - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
}

/**
 * The window the event photo goes into. In the print file it is transparent; layers above it
 * (text, decorations) draw over the photo. One per template.
 */
export function createPhotoArea(size) {
  const margin = Math.round(Math.min(size.widthMm, size.heightMm) * 0.06);
  const width = size.widthMm - 2 * margin;
  const height = Math.round((size.heightMm - margin) * 0.78);
  return { ...base('photo', 'אזור תמונה', size, width, height), y: margin, shape: 'rect', cornerRadiusMm: 0 };
}

/**
 * A single-colour vector icon. The path is stored in the template, so it doesn't depend on the
 * icon library staying the same. `viewBox` is [minX, minY, width, height] of the path.
 */
export function createIcon(size, { id, label, path, viewBox }, color) {
  const side = Math.round(Math.min(size.widthMm, size.heightMm) * 0.16);
  return { ...base('icon', label, size, side, round2((side * viewBox[3]) / viewBox[2])), icon: id, path, viewBox, color };
}

export function createText(size, font = DEFAULT_FONT) {
  // Text height follows its content, so it isn't stored.
  const { height: _ignored, ...el } = base('text', 'טקסט', size, 80, 0);
  return { ...el, y: round2(size.heightMm * 0.8), text: 'טקסט חדש', font, weight: 400, sizePt: 18, lineHeight: 1.2, color: '#1F2A44', align: 'center' };
}

/** Fits the image inside 60% of the frame, keeping its proportions. */
export function createImage(size, src, naturalWidth, naturalHeight, name = 'תמונה') {
  const ratio = naturalHeight > 0 && naturalWidth > 0 ? naturalHeight / naturalWidth : 1;
  let width = size.widthMm * 0.6;
  let height = width * ratio;
  if (height > size.heightMm * 0.6) {
    height = size.heightMm * 0.6;
    width = height / ratio;
  }
  return { ...base('image', name, size, round2(width), round2(height)), src };
}

export const SHAPE_PRESETS = {
  rect: { name: 'מלבן', shape: 'rect', width: 40, height: 30 },
  ellipse: { name: 'אליפסה', shape: 'ellipse', width: 40, height: 40 },
  line: { name: 'קו', shape: 'rect', width: 60, height: 0.6 },
};

export function createShape(size, preset) {
  const p = SHAPE_PRESETS[preset];
  return { ...base('shape', p.name, size, p.width, p.height), shape: p.shape, fill: '#C9A96E', stroke: null, strokeWidthMm: 0, cornerRadiusMm: 0, dashMm: 0 };
}

/**
 * Reads any template.json (including hand-edited ones) into the current shape.
 * Throws on files that aren't templates or come from a newer app version.
 */
export function migrateTemplate(raw) {
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) {
    throw new Error('Not a Magnet Frame Studio template');
  }
  if (Number(raw.version) > VERSION) {
    throw new Error(`Template version ${raw.version} is newer than this app (${VERSION})`);
  }
  const elements = (Array.isArray(raw.elements) ? raw.elements : []).filter(
    (el) => el && typeof el === 'object' && typeof el.id === 'string' && KNOWN_TYPES.has(el.type),
  );
  const background = elements.find((el) => el.type === 'background');
  const now = new Date().toISOString();
  return {
    format: FORMAT,
    version: VERSION,
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'ללא שם',
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    size: { ...DEFAULT_SIZE, ...raw.size },
    event: { ...DEFAULT_EVENT, ...raw.event },
    // Exactly one background, always the bottom layer.
    elements: [{ ...createBackground(), ...background }, ...elements.filter((el) => el.type !== 'background')],
    preview: raw.preview ? { ...DEFAULT_PREVIEW, ...raw.preview } : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
