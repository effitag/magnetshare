// Brit and brita frames.
import { emoji, icon } from '../layoutKit';
import { bandSide, bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'brit-blue',
    label: 'ברית תכלת',
    category: 'brit',
    background: '#DCEBF8',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.27, radius: 3 });
      return [
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'ברוך הבא', 'Fredoka', '#2B5D8C', 0.42, 500),
          names('אריאל', 'Fredoka', '#2B5D8C', 700),
          small('תאריך', '01.02.2026', 'Fredoka', '#2B5D8C', 0.34),
        ], { maxMm: 9 }),
        emoji('teddy-bear', { ...bandSide(size, bandMm, 12, 'left'), side: 10 * s }),
        icon('star-four', { ...bandSide(size, bandMm, 10, 'right'), side: 4 * s, color: '#7FB8E6' }),
        icon('star-four', { cx: size.widthMm - 16 * s, cy: size.heightMm - bandMm / 2 - 3 * s, side: 2.6 * s, color: '#7FB8E6' }),
      ];
    },
  },
  {
    id: 'brit-pink',
    label: 'בריתה ורודה',
    category: 'brit',
    background: '#FCE4EC',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.27, radius: 3 });
      return [
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'ברוכה הבאה', 'Fredoka', '#C2185B', 0.42, 500),
          names('נעמה', 'Fredoka', '#C2185B', 700),
          small('תאריך', '14.04.2026', 'Fredoka', '#C2185B', 0.34),
        ], { maxMm: 9 }),
        emoji('ribbon', { ...bandSide(size, bandMm, 12, 'left'), side: 9 * s }),
        icon('butterfly', { ...bandSide(size, bandMm, 12, 'right'), side: 7 * s, color: '#E07AA0', rotation: 12 }),
      ];
    },
  },
];
