// Building blocks for ready-made frames (presets.js, starters.js). Everything is in mm and every
// element is an ordinary layer, so a frame made from these can be edited like any other.
import { EMOJI, SYMBOLS } from '@/features/studio/icons/catalog';
import { SYMBOL_PATHS } from '@/features/studio/icons/symbolPaths';
import { newId } from './schema';
import { MM_PER_PT, roundMm } from './units';

/** Images that ship with the app (Fluent Emoji). They are uploaded into the template when it is created. */
export const BUILTIN_IMAGE_PREFIX = 'emoji:';

const LINE = 1.15; // line height of ready-made text

export const half = (n) => Math.round(n * 2) / 2; // round to 0.5 mm

function base(type, name, { x, y, width, height, rotation = 0, opacity = 1 }) {
  const box = { x: roundMm(x), y: roundMm(y), width: roundMm(width) };
  if (height !== undefined) box.height = roundMm(height);
  return { id: newId(), type, name, visible: true, locked: false, ...box, rotation, opacity };
}

export function photoArea({ x, y, width, height, radius = 0, shape = 'rect' }) {
  return { ...base('photo', 'אזור תמונה', { x, y, width, height }), shape, cornerRadiusMm: roundMm(radius) };
}

export function text({ name, value, x, y, width, sizeMm, font, weight = 400, color, align = 'center', lineHeight = LINE }) {
  return {
    ...base('text', name, { x, y, width }),
    text: value,
    font,
    weight,
    sizePt: Math.round((sizeMm / MM_PER_PT) * 2) / 2,
    lineHeight,
    color,
    align,
  };
}

/**
 * Lines of text (each `rel` times the base size) centred between `top` and `bottom`.
 * The base size grows to fill the room, up to `maxMm`. A line may set a taller `lineHeight`,
 * e.g. for handwriting fonts whose letters reach far below the line.
 */
export function textStack({ top, bottom, x, width, maxMm, lines }) {
  const room = bottom - top;
  const total = lines.reduce((sum, l) => sum + l.rel * (l.lineHeight ?? LINE), 0);
  const unit = Math.min(room / total, maxMm);
  let y = top + (room - total * unit) / 2;
  return lines.map(({ rel, ...line }) => {
    const sizeMm = rel * unit;
    const el = text({ ...line, x, y, width, sizeMm });
    y += sizeMm * el.lineHeight;
    return el;
  });
}

export function rect({ name = 'מלבן', x, y, width, height, fill = null, stroke = null, strokeWidthMm = 0, radius = 0, dashMm = 0, rotation }) {
  return {
    ...base('shape', name, { x, y, width, height, rotation }),
    shape: 'rect',
    fill,
    stroke,
    strokeWidthMm,
    cornerRadiusMm: roundMm(radius),
    dashMm,
  };
}

/** A dashed or solid outline `inset` mm inside the frame's edge. */
export function border(size, { inset, color, widthMm = 0.35, dashMm = 0, radius = 0 }) {
  const { widthMm: W, heightMm: H } = size;
  return rect({ name: 'מסגרת', x: inset, y: inset, width: W - 2 * inset, height: H - 2 * inset, stroke: color, strokeWidthMm: widthMm, dashMm, radius });
}

/** A single-colour icon from the catalogue (src/studio/icons/catalog.js), centred on (cx, cy). */
export function icon(id, { cx, cy, side, color, rotation = 0 }) {
  const art = SYMBOL_PATHS[id];
  if (!art) throw new Error(`Unknown icon "${id}"`);
  const height = (side * art.viewBox[3]) / art.viewBox[2];
  const label = SYMBOLS.find((s) => s.id === id)?.label ?? 'אייקון';
  return {
    ...base('icon', label, { x: cx - side / 2, y: cy - height / 2, width: side, height, rotation }),
    icon: id,
    path: art.path,
    viewBox: art.viewBox,
    color,
  };
}

/** A colourful emoji image from the catalogue, centred on (cx, cy). */
export function emoji(id, { cx, cy, side, rotation = 0 }) {
  const label = EMOJI.find((e) => e.id === id)?.label;
  if (!label) throw new Error(`Unknown emoji "${id}"`);
  return { ...base('image', label, { x: cx - side / 2, y: cy - side / 2, width: side, height: side, rotation }), src: `${BUILTIN_IMAGE_PREFIX}${id}` };
}
