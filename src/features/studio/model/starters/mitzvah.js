// Bar and bat mitzvah frames.
import { emoji, icon } from '../layoutKit';
import { bandSide, bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'mitzvah-bar',
    label: 'בר מצווה',
    category: 'mitzvah',
    background: '#14213D',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.28 });
      return [
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'בר המצווה של', 'Heebo', '#FFFFFF', 0.4, 300),
          names('יונתן', 'Suez One', '#E0B95B'),
          small('תאריך', '20.03.2026', 'Heebo', '#FFFFFF', 0.34, 300),
        ], { maxMm: 9 }),
        icon('star-of-david', { ...bandSide(size, bandMm, 13, 'left'), side: 7 * s, color: '#E0B95B' }),
        icon('star-of-david', { ...bandSide(size, bandMm, 13, 'right'), side: 7 * s, color: '#E0B95B' }),
      ];
    },
  },
  {
    id: 'mitzvah-bat',
    label: 'בת מצווה נוצצת',
    category: 'mitzvah',
    background: '#F4ECFF',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.28, radius: 3 });
      return [
        photo,
        ...bandText(size, bandMm, [
          small('כותרת', 'בת המצווה של', 'Assistant', '#6B21A8', 0.4),
          names('מאיה', 'Playpen Sans Hebrew', '#7E22CE', 700),
          small('תאריך', '07.05.2026', 'Assistant', '#6B21A8', 0.34),
        ], { maxMm: 9 }),
        emoji('sparkles', { ...bandSide(size, bandMm, 13, 'left'), side: 8 * s }),
        emoji('sparkles', { ...bandSide(size, bandMm, 13, 'right'), side: 8 * s }),
      ];
    },
  },
];
