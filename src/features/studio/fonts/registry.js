// Single source of truth for the frame studio's fonts.
// After changing this list run `node scripts/studio/gen-fonts.mjs` to regenerate
// public/fonts/studio/ and studio-fonts.css.
// All families are open-license (OFL) Google Fonts, self-hosted from their @fontsource
// releases, so every machine renders and exports with the exact same files (no CDN).

export const CATEGORIES = [
  { id: 'sans', label: 'נקי' },
  { id: 'serif', label: 'סריף וחגיגי' },
  { id: 'handwriting', label: 'כתב יד' },
  { id: 'display', label: 'תצוגה' },
  { id: 'latin', label: 'אנגלית' },
];

const HE = ['hebrew', 'latin'];
const EN = ['latin', 'latin-ext'];

// `niqqud: false` marks fonts whose Hebrew set has no vowel points (checked against the font files).
export const FONTS = [
  { family: 'Heebo', pkg: 'heebo', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], subsets: HE, niqqud: true },
  { family: 'Assistant', pkg: 'assistant', category: 'sans', weights: [300, 400, 500, 600, 700, 800], subsets: HE, niqqud: true },
  { family: 'Rubik', pkg: 'rubik', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], subsets: HE, niqqud: true },
  { family: 'Alef', pkg: 'alef', category: 'sans', weights: [400, 700], subsets: HE, niqqud: true },
  { family: 'Miriam Libre', pkg: 'miriam-libre', category: 'sans', weights: [400, 500, 600, 700], subsets: HE, niqqud: true },
  { family: 'Varela Round', pkg: 'varela-round', category: 'sans', weights: [400], subsets: HE, niqqud: true },
  { family: 'Fredoka', pkg: 'fredoka', category: 'sans', weights: [300, 400, 500, 600, 700], subsets: HE, niqqud: true },

  { family: 'Frank Ruhl Libre', pkg: 'frank-ruhl-libre', category: 'serif', weights: [300, 400, 500, 600, 700, 800, 900], subsets: HE, niqqud: true },
  { family: 'David Libre', pkg: 'david-libre', category: 'serif', weights: [400, 500, 700], subsets: HE, niqqud: true },
  { family: 'Bellefair', pkg: 'bellefair', category: 'serif', weights: [400], subsets: HE, niqqud: true },
  { family: 'Bona Nova', pkg: 'bona-nova', category: 'serif', weights: [400, 700], subsets: HE, niqqud: true },
  { family: 'Noto Serif Hebrew', pkg: 'noto-serif-hebrew', category: 'serif', weights: [300, 400, 500, 600, 700, 800, 900], subsets: HE, niqqud: true },
  { family: 'Suez One', pkg: 'suez-one', category: 'serif', weights: [400], subsets: HE, niqqud: true },

  { family: 'Gveret Levin', pkg: 'gveret-levin', category: 'handwriting', weights: [400], subsets: HE, niqqud: true },
  { family: 'Playpen Sans Hebrew', pkg: 'playpen-sans-hebrew', category: 'handwriting', weights: [300, 400, 500, 600, 700, 800], subsets: HE, niqqud: false },
  { family: 'Amatic SC', pkg: 'amatic-sc', category: 'handwriting', weights: [400, 700], subsets: HE, niqqud: true },
  { family: 'Solitreo', pkg: 'solitreo', category: 'handwriting', weights: [400], subsets: HE, niqqud: true },

  { family: 'Secular One', pkg: 'secular-one', category: 'display', weights: [400], subsets: HE, niqqud: true },
  { family: 'Karantina', pkg: 'karantina', category: 'display', weights: [300, 400, 700], subsets: HE, niqqud: true },
  { family: 'Rubik Bubbles', pkg: 'rubik-bubbles', category: 'display', weights: [400], subsets: HE, niqqud: true },
  { family: 'Rubik Doodle Shadow', pkg: 'rubik-doodle-shadow', category: 'display', weights: [400], subsets: HE, niqqud: true },
  { family: 'Rubik Moonrocks', pkg: 'rubik-moonrocks', category: 'display', weights: [400], subsets: HE, niqqud: true },

  { family: 'Playfair Display', pkg: 'playfair-display', category: 'latin', weights: [400, 500, 600, 700, 800, 900], subsets: EN, niqqud: false },
  { family: 'Montserrat', pkg: 'montserrat', category: 'latin', weights: [300, 400, 500, 600, 700, 800, 900], subsets: EN, niqqud: false },
];

export const DEFAULT_FONT = 'Heebo';

export const WEIGHT_LABELS = {
  300: 'דק',
  400: 'רגיל',
  500: 'בינוני',
  600: 'חצי מודגש',
  700: 'מודגש',
  800: 'כבד',
  900: 'שחור',
};

export function getFont(family) {
  return FONTS.find((f) => f.family === family) ?? null;
}

/** Closest weight the family actually ships, so the browser never fakes a bold. */
export function nearestWeight(family, weight) {
  const font = getFont(family);
  if (!font) return weight;
  return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
}

export function sampleText(font) {
  if (font.category === 'latin') return 'Noa ♥ Itai · 24.12.2026';
  return font.niqqud ? 'נֹעָה ♥ אִיתַי · 24.12.2026' : 'נועה ♥ איתי · 24.12.2026';
}
