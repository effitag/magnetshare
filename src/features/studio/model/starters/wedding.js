// Wedding frames.
import { border, icon } from '../layoutKit';
import { bandSide, bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'wedding-classic',
    label: 'קלאסי',
    category: 'wedding',
    background: '#FFFFFF',
    build(size) {
      const { photo, bandMm } = topWindow(size, { margin: 4, band: 0.22 });
      return [
        photo,
        ...bandText(size, bandMm, [
          names('נועה ♥ איתי', 'Frank Ruhl Libre', '#111111', 500),
          small('תאריך', '24.12.2026', 'Frank Ruhl Libre', '#6B6B6B', 0.42),
        ], { maxMm: 9 }),
      ];
    },
  },
  {
    id: 'wedding-rings',
    label: 'טבעות זהב',
    category: 'wedding',
    background: '#FFFFFF',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 6, band: 0.22, radius: 1.5 });
      return [
        border(size, { inset: 2.5 * s, color: '#C9A24A', widthMm: 0.3, dashMm: 1.2, radius: 2.5 * s }),
        photo,
        ...bandText(size, bandMm, [
          names('עדן ⚭ אביב', 'Gveret Levin', '#1F2A44'),
          small('תאריך', '12.06.2026', 'Bellefair', '#9A7B2F', 0.42),
        ], { inset: 4.5 * s, maxMm: 9 }),
      ];
    },
  },
  {
    id: 'wedding-navy',
    label: 'ערב כחול',
    category: 'wedding',
    background: '#1F2A44',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4.5, band: 0.22 });
      return [
        border(size, { inset: 2 * s, color: '#C9A24A', widthMm: 0.3 }),
        photo,
        ...bandText(size, bandMm, [
          names('נועה ✦ איתי', 'Bellefair', '#FFFFFF'),
          small('תאריך', '24.12.2026', 'Heebo', '#C9A24A', 0.4, 300),
        ], { inset: 3.5 * s, maxMm: 9 }),
      ];
    },
  },
  {
    id: 'wedding-blush',
    label: 'ורוד עדין',
    category: 'wedding',
    background: '#F6E1E1',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 4, band: 0.23, radius: 3 });
      return [
        photo,
        ...bandText(size, bandMm, [
          names('מיה ♥ דניאל', 'Gveret Levin', '#8B1A2B'),
          small('תאריך', '03.09.2026', 'Assistant', '#8B1A2B', 0.4),
        ], { maxMm: 9 }),
        icon('heart-line', { ...bandSide(size, bandMm, 11, 'left'), side: 6 * s, color: '#C9566A', rotation: -14 }),
        icon('heart-line', { ...bandSide(size, bandMm, 11, 'right'), side: 6 * s, color: '#C9566A', rotation: 14 }),
      ];
    },
  },
];
