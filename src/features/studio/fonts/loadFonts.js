// Canvas text only renders with a font that is already loaded, so every render path
// (editor, thumbnail, export) awaits the faces it needs first.

import { SYMBOL_FONT } from './textSymbols';

// Hebrew + Latin + digits, so both unicode-range subsets of a family are fetched.
const PROBE_TEXT = 'אבג abc 123';
// The symbols font only covers its own characters, so it needs its own probe.
const SYMBOL_QUERY = `400 40px "${SYMBOL_FONT}"`;
const SYMBOL_PROBE = '♥';

function fontQuery({ family, weight }) {
  return `${weight} 40px "${family}"`;
}

export function fontSpecsOf(doc) {
  const seen = new Map();
  for (const el of doc.elements) {
    if (el.type !== 'text') continue;
    const spec = { family: el.font, weight: el.weight ?? 400 };
    seen.set(fontQuery(spec), spec);
  }
  return [...seen.values()];
}

export function isFontLoaded(spec) {
  return document.fonts.check(fontQuery(spec), PROBE_TEXT) && document.fonts.check(SYMBOL_QUERY, SYMBOL_PROBE);
}

export async function ensureFonts(specs) {
  await Promise.all([document.fonts.load(SYMBOL_QUERY, SYMBOL_PROBE), ...specs.map((spec) => document.fonts.load(fontQuery(spec), PROBE_TEXT))]);
}
