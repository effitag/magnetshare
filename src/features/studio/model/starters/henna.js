// Henna frames.
import { border, icon } from '../layoutKit';
import { bandSide, bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'henna-bordeaux',
    label: 'בורדו וזהב',
    category: 'henna',
    background: '#6E1423',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 5, band: 0.27 });
      return [
        border(size, { inset: 2.2 * s, color: '#D4AF37', widthMm: 0.35, dashMm: 1 }),
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'החינה של', 'Heebo', '#E9CF8F', 0.4, 300),
          names('חן ♥ עומר', 'Suez One', '#E9CF8F'),
          small('תאריך', '15.08.2026', 'Heebo', '#E9CF8F', 0.35, 300),
        ], { inset: 4 * s, maxMm: 8.5 }),
        icon('star-four', { ...bandSide(size, bandMm, 12, 'left'), side: 4.5 * s, color: '#D4AF37' }),
        icon('star-four', { ...bandSide(size, bandMm, 12, 'right'), side: 4.5 * s, color: '#D4AF37' }),
      ];
    },
  },
  {
    id: 'henna-terracotta',
    label: 'טרקוטה',
    category: 'henna',
    background: '#B5532F',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.24, radius: 6 });
      return [
        photo,
        ...bandText(size, bandMm, [
          names('שירן ✧ אלון', 'Karantina', '#FFF1E0', 700),
          small('תאריך', 'חינה · 10.07.2026', 'Heebo', '#FFF1E0', 0.36),
        ], { maxMm: 10 }),
        icon('lotus', { ...bandSide(size, bandMm, 11, 'left'), side: 7 * s, color: '#FFF1E0' }),
        icon('lotus', { ...bandSide(size, bandMm, 11, 'right'), side: 7 * s, color: '#FFF1E0' }),
      ];
    },
  },
];
