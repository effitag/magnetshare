// Shared layout for the ready-made frames: photo window on top, text band below.
import { half, photoArea, textStack } from '../layoutKit';

/** 1 on the regular magnet (75 mm short side); decorations and text grow with larger magnets. */
export const scaleOf = (size) => Math.min(size.widthMm, size.heightMm) / 75;

/** Photo window on top, a band of `band` × height at the bottom for the text. */
export function topWindow(size, { margin, band, radius = 0 }) {
  const { widthMm: W, heightMm: H } = size;
  const s = scaleOf(size);
  const m = half(margin * s);
  const bandMm = half(H * band);
  return { m, bandMm, photo: photoArea({ x: m, y: m, width: W - 2 * m, height: H - m - bandMm, radius: radius * s }) };
}

/** Text lines centred in the bottom band, kept `inset` mm (at least the safe margin) from the edges. */
export function bandText(size, bandMm, lines, { maxMm = 11, inset = 0 } = {}) {
  const { widthMm: W, heightMm: H, safeMm } = size;
  const edge = Math.max(safeMm, inset);
  return textStack({ top: H - bandMm + 0.5, bottom: H - edge, x: edge, width: W - 2 * edge, maxMm: maxMm * scaleOf(size), lines });
}

/** Centre of the band, `fromEdge` mm in from the left or right side. */
export function bandSide(size, bandMm, fromEdge, side) {
  const { widthMm: W, heightMm: H } = size;
  const x = fromEdge * scaleOf(size);
  return { cx: side === 'left' ? x : W - x, cy: H - bandMm / 2 };
}

// Handwriting fonts reach far below the line, so their names get more room above the date.
const HANDWRITING = new Set(['Gveret Levin']);
export const names = (value, font, color, weight = 400) => ({ name: 'שמות', value, font, color, weight, rel: 1, lineHeight: HANDWRITING.has(font) ? 1.4 : 1.15 });
export const small = (name, value, font, color, rel = 0.4, weight = 400) => ({ name, value, font, color, weight, rel });
