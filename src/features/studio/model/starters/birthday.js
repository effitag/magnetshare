// Birthday frames.
import { border, emoji, icon } from '../layoutKit';
import { bandSide, bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'birthday-balloons',
    label: 'בלונים',
    category: 'birthday',
    background: '#FFFFFF',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4, band: 0.26 });
      return [
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'מזל טוב', 'Rubik', '#E0282E', 0.42, 500),
          names('דניאל · 30', 'Rubik', '#111111', 700),
          small('תאריך', '05.05.2026', 'Rubik', '#6B6B6B', 0.32),
        ], { maxMm: 8 }),
        emoji('balloon', { ...bandSide(size, bandMm, 8, 'left'), side: 10 * s, rotation: -10 }),
        emoji('party-popper', { ...bandSide(size, bandMm, 8, 'right'), side: 8 * s }),
      ];
    },
  },
  {
    id: 'birthday-gold',
    label: 'שחור זהב',
    category: 'birthday',
    background: '#111111',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.26 });
      return [
        border(size, { inset: 2 * s, color: '#D4AF37', widthMm: 0.3, dashMm: 0.8 }),
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'יום הולדת שמח', 'Bellefair', '#D4AF37', 0.45),
          names('שירה', 'Bona Nova', '#D4AF37', 700),
          small('תאריך', '18.11.2026', 'Heebo', '#BBBBBB', 0.32, 300),
        ], { inset: 3.5 * s, maxMm: 9 }),
        icon('sparkle-fill', { ...bandSide(size, bandMm, 12, 'left'), side: 5 * s, color: '#D4AF37' }),
        icon('sparkle-fill', { ...bandSide(size, bandMm, 12, 'right'), side: 5 * s, color: '#D4AF37' }),
      ];
    },
  },
];
