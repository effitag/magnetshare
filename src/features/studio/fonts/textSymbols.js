// Symbols that can sit inside text ("עדן ♥ אביב"). They are drawn by the bundled "Magnet Symbols"
// font (scripts/studio/build-symbol-font.py), in the text's own colour and size, on every machine.
import symbols from './textSymbols.json';

export const SYMBOL_FONT = 'Magnet Symbols';

/** [{ label, insert, chars }] — `insert` is what the button types; `chars` all draw this symbol. */
export const TEXT_SYMBOLS = symbols.map(({ label, insert, chars }) => ({ label, insert, chars }));

const SYMBOL_CHARS = new Set(symbols.flatMap((s) => s.chars));
const AFTER_SYMBOL_VS16 = new RegExp(`([${[...SYMBOL_CHARS].filter((c) => c.length === 1).join('')}])\\uFE0F`, 'gu');

/**
 * "❤️" from an emoji keyboard carries U+FE0F, which makes browsers draw a colour emoji.
 * Dropping it after our symbols keeps them in the text's colour and font.
 */
export function normalizeSymbols(text) {
  return (text ?? '').replace(AFTER_SYMBOL_VS16, '$1');
}

/** Font list for text: the symbols font first; its unicode-range limits it to the symbols. */
export function withSymbols(family) {
  return `${SYMBOL_FONT}, ${family}`;
}

/**
 * Inserts a symbol at the cursor, adding a space on either side when there isn't one.
 * @returns { text, cursor } with the cursor placed after the symbol (and its trailing space)
 */
export function insertSymbol(text, start, end, symbol) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  // At the end of the text, leave a space to keep typing the second name; elsewhere only if missing.
  const trail = after ? (/^\s/.test(after) ? '' : ' ') : before ? ' ' : '';
  const inserted = `${lead}${symbol}${trail}`;
  return { text: before + inserted + after, cursor: before.length + inserted.length };
}
