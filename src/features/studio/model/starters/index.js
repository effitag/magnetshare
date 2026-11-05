// Ready-made frames by kind of event, designed for this app. Each design is built from ordinary
// layers (photo area, text, icons, shapes), so everything in it can be edited. Positions are worked
// out from the magnet's size, so every design works landscape, portrait and in every size.
import birthday from './birthday';
import brit from './brit';
import general from './general';
import henna from './henna';
import mitzvah from './mitzvah';
import wedding from './wedding';

export const STARTER_CATEGORIES = [
  { id: 'wedding', label: 'חתונה' },
  { id: 'henna', label: 'חינה' },
  { id: 'mitzvah', label: 'בר/בת מצווה' },
  { id: 'brit', label: 'ברית/ה' },
  { id: 'birthday', label: 'יום הולדת' },
  { id: 'general', label: 'כללי' },
];

export const STARTERS = [...wedding, ...henna, ...mitzvah, ...brit, ...birthday, ...general];
