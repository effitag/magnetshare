const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

/**
 * Base direction from the first strong character, like dir="auto".
 * Canvas has no "auto", and an English line drawn RTL would move its trailing punctuation.
 */
export function detectDirection(text) {
  for (const ch of text ?? '') {
    if (RTL_CHAR.test(ch)) return 'rtl';
    if (LTR_CHAR.test(ch)) return 'ltr';
  }
  return 'rtl';
}

/** First line of a text element, for the layer list. */
export function textPreview(text, fallback) {
  const line = (text ?? '').split('\n').find((l) => l.trim()) ?? '';
  return line.trim() || fallback;
}
