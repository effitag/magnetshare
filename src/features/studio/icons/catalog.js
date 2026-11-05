// Icon catalogue: what the icon picker offers, grouped by kind of celebration, with Hebrew names.
//
// - 'symbol' icons are single-colour vectors that take any colour, e.g. a black, red or dark red heart.
//   `src` is "<set>:<name>": Phosphor ("ph", MIT), MingCute ("mingcute", Apache-2.0), or "custom"
//   (src/studio/icons/customPaths.json): Memoria's own hearts and rings, vectorised for print.
// - 'emoji' icons are colourful illustrations: Microsoft Fluent Emoji (MIT), or Memoria's own
//   (source 'custom', src/studio/icons/custom-images/).
// Licences: public/studio/LICENSE.md. After editing these lists run `node scripts/studio/build-icons.mjs` to write the
// artwork into src/studio/icons/symbolPaths.js and public/studio/emoji/.

export const ICON_CATEGORIES = [
  { id: 'hearts', label: 'לבבות' },
  { id: 'love', label: 'חתונה ואהבה' },
  { id: 'party', label: 'חגיגה' },
  { id: 'birthday', label: 'יום הולדת' },
  { id: 'baby', label: 'לידה וברית' },
  { id: 'mitzvah', label: 'בר ובת מצווה' },
  { id: 'nature', label: 'פרחים וטבע' },
  { id: 'fun', label: 'כיף' },
];

/** Quick colours for single-colour icons. */
export const ICON_COLORS = [
  { label: 'שחור', value: '#111111' },
  { label: 'אדום', value: '#E0282E' },
  { label: 'אדום עדין', value: '#F07C82' },
  { label: 'אדום כהה', value: '#8B1A2B' },
  { label: 'ורוד', value: '#F4A6B8' },
  { label: 'זהב', value: '#C9A24A' },
  { label: 'כחול לילה', value: '#1F2A44' },
  { label: 'תכלת', value: '#7FB8E6' },
  { label: 'ירוק זית', value: '#6B7F4E' },
  { label: 'לבן', value: '#FFFFFF' },
];

// Black, like the hearts on most magnets.
export const DEFAULT_ICON_COLOR = '#111111';

const symbol = (id, label, src, categories) => ({ kind: 'symbol', id, label, src, categories });

export const SYMBOLS = [
  // Memoria's own (first in their categories)
  symbol('heart-bold', 'לב קלאסי', 'custom:heart-bold', ['hearts', 'love']),
  symbol('heart-shine', 'לב מבריק', 'custom:heart-shine', ['hearts', 'love']),
  symbol('heart-gloss', 'לב עם ברק', 'custom:heart-gloss', ['hearts']),
  symbol('heart-simple', 'לב מצויר', 'custom:heart-simple', ['hearts']),
  symbol('hearts-burst', 'לבבות קופצים', 'custom:hearts-burst', ['hearts', 'love', 'fun']),
  symbol('rings-hearts', 'טבעות עם לבבות', 'custom:rings-hearts', ['love', 'hearts']),
  symbol('rings-diamonds', 'טבעות יהלום', 'custom:rings-diamonds', ['love']),
  symbol('rings-tangled', 'טבעות שזורות', 'custom:rings-tangled', ['love']),
  // Hearts
  symbol('heart', 'לב', 'ph:heart-fill', ['hearts', 'love']),
  symbol('heart-line', 'לב בקו', 'ph:heart-light', ['hearts', 'love']),
  symbol('heart-thin', 'לב בקו דק', 'ph:heart-thin', ['hearts']),
  symbol('heart-straight', 'לב מחודד', 'ph:heart-straight-fill', ['hearts']),
  symbol('heart-straight-thin', 'לב מחודד בקו דק', 'ph:heart-straight-thin', ['hearts']),
  symbol('two-hearts', 'שני לבבות', 'mingcute:love-fill', ['hearts', 'love']),
  symbol('two-hearts-line', 'שני לבבות בקו', 'mingcute:love-line', ['hearts', 'love']),
  symbol('hand-heart', 'יד עם לב', 'ph:hand-heart-light', ['hearts', 'love']),
  symbol('heartbeat', 'דופק', 'ph:heartbeat-light', ['hearts']),
  symbol('calendar-heart', 'תאריך עם לב', 'ph:calendar-heart-light', ['hearts', 'love']),
  // Wedding and love
  symbol('rings', 'טבעות', 'custom:rings', ['love', 'hearts']),
  symbol('diamond-ring', 'טבעת יהלום', 'custom:diamond-ring', ['love']),
  symbol('champagne', 'שמפניה', 'ph:champagne-light', ['love', 'party']),
  symbol('cheers', 'לחיים', 'ph:cheers-light', ['love', 'party']),
  symbol('wine', 'כוס יין', 'ph:wine-light', ['love', 'mitzvah']),
  symbol('tulip', 'צבעוני', 'ph:flower-tulip-light', ['love', 'nature']),
  symbol('bird', 'ציפור', 'ph:bird-light', ['love', 'baby']),
  symbol('sparkle', 'נצנוץ', 'ph:sparkle-light', ['love', 'party', 'mitzvah']),
  // Party
  symbol('confetti', 'קונפטי', 'ph:confetti-light', ['party', 'birthday']),
  symbol('sparkle-fill', 'נצנוץ מלא', 'ph:sparkle-fill', ['party']),
  symbol('star-four', 'כוכב נוצץ', 'ph:star-four-fill', ['party', 'mitzvah', 'baby']),
  symbol('disco-ball', 'כדור דיסקו', 'ph:disco-ball-light', ['party', 'fun']),
  symbol('music', 'תווים', 'ph:music-notes-light', ['party']),
  symbol('cocktail', 'קוקטייל', 'ph:martini-light', ['party']),
  symbol('microphone', 'מיקרופון', 'ph:microphone-stage-light', ['party', 'fun']),
  symbol('crown', 'כתר', 'ph:crown-simple-fill', ['party', 'birthday', 'mitzvah']),
  // Birthday
  symbol('cake', 'עוגה', 'ph:cake-light', ['birthday']),
  symbol('gift', 'מתנה', 'ph:gift-light', ['birthday']),
  symbol('balloon', 'בלון', 'ph:balloon-light', ['birthday', 'party']),
  symbol('ice-cream', 'גלידה', 'ph:ice-cream-light', ['birthday', 'fun']),
  symbol('star', 'כוכב', 'ph:star-light', ['birthday', 'baby']),
  // Baby
  symbol('baby', 'תינוק', 'ph:baby-light', ['baby']),
  symbol('stroller', 'עגלה', 'ph:baby-carriage-light', ['baby']),
  symbol('moon-stars', 'ירח וכוכבים', 'ph:moon-stars-light', ['baby', 'nature']),
  symbol('cloud', 'ענן', 'ph:cloud-light', ['baby']),
  symbol('rainbow', 'קשת', 'ph:rainbow-light', ['baby', 'fun']),
  symbol('butterfly', 'פרפר', 'ph:butterfly-light', ['baby', 'nature']),
  symbol('feather', 'נוצה', 'ph:feather-light', ['baby']),
  // Bar and bat mitzvah
  symbol('star-of-david', 'מגן דוד', 'ph:star-of-david-light', ['mitzvah']),
  symbol('star-of-david-fill', 'מגן דוד מלא', 'ph:star-of-david-fill', ['mitzvah']),
  symbol('scroll', 'מגילה', 'ph:scroll-light', ['mitzvah']),
  symbol('book', 'ספר', 'ph:book-open-light', ['mitzvah']),
  symbol('crown-line', 'כתר בקו', 'ph:crown-light', ['mitzvah', 'birthday']),
  // Flowers and nature
  symbol('flower', 'פרח', 'ph:flower-light', ['nature', 'love']),
  symbol('lotus', 'לוטוס', 'ph:flower-lotus-light', ['nature']),
  symbol('leaf', 'עלה', 'ph:leaf-light', ['nature']),
  symbol('plant', 'נבט', 'ph:plant-light', ['nature', 'baby']),
  symbol('sun', 'שמש', 'ph:sun-light', ['nature']),
  symbol('sunset', 'שקיעה', 'ph:sun-horizon-light', ['nature', 'love']),
  symbol('palm', 'דקל', 'ph:tree-palm-light', ['nature', 'fun']),
  symbol('waves', 'גלים', 'ph:waves-light', ['nature']),
  symbol('clover', 'תלתן', 'ph:clover-light', ['nature']),
  // Fun
  symbol('smiley', 'סמיילי', 'ph:smiley-light', ['fun']),
  symbol('wink', 'קריצה', 'ph:smiley-wink-light', ['fun']),
  symbol('sunglasses', 'משקפי שמש', 'ph:sunglasses-light', ['fun']),
  symbol('peace', 'שלום', 'ph:hand-peace-light', ['fun']),
  symbol('fire', 'אש', 'ph:fire-light', ['fun']),
  symbol('lightning', 'ברק', 'ph:lightning-light', ['fun']),
  symbol('camera', 'מצלמה', 'ph:camera-light', ['fun', 'party']),
  symbol('popcorn', 'פופקורן', 'ph:popcorn-light', ['fun']),
  symbol('paw', 'כף רגל', 'ph:paw-print-light', ['fun']),
];

const emoji = (id, label, categories, source = 'fluent') => ({ kind: 'emoji', id, label, categories, source });

// `id` is the emoji name in the Iconify "fluent-emoji" set, or a file in custom-images/ (source 'custom').
export const EMOJI = [
  emoji('heart-scribble', 'לב מקושקש', ['hearts', 'love'], 'custom'),
  emoji('heart-scribble-outline', 'לב מקושקש עם קו', ['hearts', 'love'], 'custom'),
  emoji('red-heart', 'לב אדום', ['hearts', 'love']),
  emoji('black-heart', 'לב שחור', ['hearts']),
  emoji('white-heart', 'לב לבן', ['hearts', 'love']),
  emoji('pink-heart', 'לב ורוד', ['hearts', 'baby']),
  emoji('light-blue-heart', 'לב תכלת', ['hearts', 'baby']),
  emoji('purple-heart', 'לב סגול', ['hearts']),
  emoji('two-hearts', 'שני לבבות', ['hearts', 'love']),
  emoji('sparkling-heart', 'לב נוצץ', ['hearts', 'love']),
  emoji('growing-heart', 'לב גדל', ['hearts']),
  emoji('beating-heart', 'לב פועם', ['hearts']),
  emoji('revolving-hearts', 'לבבות', ['hearts', 'love']),
  emoji('heart-with-arrow', 'לב עם חץ', ['hearts', 'love']),
  emoji('heart-with-ribbon', 'לב עם סרט', ['hearts', 'love']),
  emoji('heart-on-fire', 'לב בוער', ['hearts', 'fun']),
  emoji('heart-hands', 'ידיים בצורת לב', ['hearts', 'fun']),
  emoji('love-letter', 'מכתב אהבה', ['hearts', 'love']),
  emoji('kiss-mark', 'נשיקה', ['hearts', 'love', 'fun']),
  emoji('ring', 'טבעת', ['love']),
  emoji('bouquet', 'זר פרחים', ['love', 'nature']),
  emoji('clinking-glasses', 'לחיים', ['love', 'party']),
  emoji('bottle-with-popping-cork', 'שמפניה', ['love', 'party']),
  emoji('dove', 'יונה', ['love']),
  emoji('rose', 'ורד', ['love', 'nature']),
  emoji('wedding', 'חתונה', ['love']),
  emoji('gem-stone', 'יהלום', ['love']),
  emoji('wine-glass', 'כוס יין', ['love', 'mitzvah']),
  emoji('party-popper', 'קונפטי', ['party', 'birthday']),
  emoji('confetti-ball', 'כדור קונפטי', ['party']),
  emoji('sparkles', 'נצנצים', ['party', 'mitzvah', 'love']),
  emoji('glowing-star', 'כוכב זוהר', ['party', 'mitzvah']),
  emoji('shooting-star', 'כוכב נופל', ['party', 'baby']),
  emoji('star', 'כוכב', ['party']),
  emoji('mirror-ball', 'כדור דיסקו', ['party', 'fun']),
  emoji('musical-notes', 'תווים', ['party']),
  emoji('balloon', 'בלון', ['party', 'birthday']),
  emoji('cocktail-glass', 'קוקטייל', ['party']),
  emoji('tropical-drink', 'משקה', ['party', 'fun']),
  emoji('birthday-cake', 'עוגת יום הולדת', ['birthday']),
  emoji('cupcake', 'קאפקייק', ['birthday']),
  emoji('shortcake', 'פרוסת עוגה', ['birthday']),
  emoji('candle', 'נר', ['birthday', 'mitzvah']),
  emoji('wrapped-gift', 'מתנה', ['birthday', 'party']),
  emoji('partying-face', 'פרצוף חוגג', ['birthday', 'fun']),
  emoji('unicorn', 'חד קרן', ['birthday', 'fun']),
  emoji('lollipop', 'סוכרייה', ['birthday', 'baby']),
  emoji('baby', 'תינוק', ['baby']),
  emoji('baby-bottle', 'בקבוק', ['baby']),
  emoji('teddy-bear', 'דובי', ['baby']),
  emoji('ribbon', 'פפיון', ['baby', 'birthday']),
  emoji('hatching-chick', 'אפרוח', ['baby']),
  emoji('crown', 'כתר', ['mitzvah', 'party']),
  emoji('hamsa', 'חמסה', ['mitzvah', 'baby']),
  emoji('scroll', 'מגילה', ['mitzvah']),
  emoji('cherry-blossom', 'פריחה', ['nature', 'love']),
  emoji('tulip', 'צבעוני', ['nature']),
  emoji('blossom', 'פרח', ['nature']),
  emoji('sunflower', 'חמנייה', ['nature']),
  emoji('hibiscus', 'היביסקוס', ['nature']),
  emoji('lotus', 'לוטוס', ['nature']),
  emoji('herb', 'עלים', ['nature']),
  emoji('leaf-fluttering-in-wind', 'עלה ברוח', ['nature']),
  emoji('four-leaf-clover', 'תלתן', ['nature', 'mitzvah']),
  emoji('butterfly', 'פרפר', ['nature', 'baby']),
  emoji('rainbow', 'קשת', ['nature', 'fun']),
  emoji('sun', 'שמש', ['nature']),
  emoji('crescent-moon', 'ירח', ['nature']),
  emoji('smiling-face-with-heart-eyes', 'עיני לב', ['fun', 'hearts']),
  emoji('smiling-face-with-hearts', 'מאוהבים', ['fun', 'love']),
  emoji('face-blowing-a-kiss', 'נשיקה באוויר', ['fun', 'love']),
  emoji('star-struck', 'עיני כוכבים', ['fun']),
  emoji('smiling-face-with-sunglasses', 'משקפי שמש', ['fun']),
  emoji('fire', 'אש', ['fun']),
  emoji('camera-with-flash', 'מצלמה', ['fun']),
];

export function iconsIn(categoryId) {
  const inCategory = (i) => i.categories.includes(categoryId);
  return { symbols: SYMBOLS.filter(inCategory), emoji: EMOJI.filter(inCategory) };
}

export const emojiUrl = (id) => `/studio/emoji/${id}.svg`;
