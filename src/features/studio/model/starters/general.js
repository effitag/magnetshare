// General frames.
import { half, photoArea, rect, textStack } from '../layoutKit';
import { bandText, names, scaleOf, small, topWindow } from './kit';

export default [
  {
    id: 'general-minimal',
    label: 'נקי',
    category: 'general',
    background: '#FFFFFF',
    build(size) {
      const { photo, bandMm } = topWindow(size, { margin: 3, band: 0.13 });
      return [photo, ...bandText(size, bandMm, [names('נועה ♥ איתי · 24.12.26', 'Heebo', '#222222')], { maxMm: 5 })];
    },
  },
  {
    id: 'general-olive',
    label: 'ירוק זית',
    category: 'general',
    background: '#6B7F4E',
    build(size) {
      const s = scaleOf(size);
      const { photo, bandMm } = topWindow(size, { margin: 5.5, band: 0.22 });
      const gap = 1.3 * s;
      return [
        rect({ name: 'קו סביב התמונה', x: photo.x - gap, y: photo.y - gap, width: photo.width + 2 * gap, height: photo.height + 2 * gap, stroke: '#FFFFFF', strokeWidthMm: 0.35 }),
        photo,
        ...bandText(size, bandMm, [
          names('נועה ♥ איתי', 'Gveret Levin', '#FFFFFF'),
          small('תאריך', '24.12.2026', 'Heebo', '#E7ECDD', 0.4, 300),
        ], { maxMm: 9 }),
      ];
    },
  },
  {
    id: 'general-side',
    label: 'שמות בצד',
    category: 'general',
    background: '#FFFFFF',
    build(size) {
      const { widthMm: W, heightMm: H, safeMm } = size;
      const s = scaleOf(size);
      const lines = (heart) => [
        names('נועה', 'Gveret Levin', '#1F2A44'),
        small('לב', heart, 'Gveret Levin', '#1F2A44', 0.6),
        { ...names('איתי', 'Gveret Levin', '#1F2A44'), name: 'שמות 2' },
        small('תאריך', '24.12.26', 'Gveret Levin', '#5B6475', 0.42),
      ];
      if (W <= H) {
        // Portrait: names under the photo instead.
        const { photo, bandMm } = topWindow(size, { margin: 4, band: 0.22 });
        return [
          photo,
          ...bandText(size, bandMm, [names('נועה ♥ איתי', 'Gveret Levin', '#1F2A44'), small('תאריך', '24.12.26', 'Gveret Levin', '#5B6475', 0.42)], { maxMm: 10 }),
        ];
      }
      const m = half(4 * s);
      const photoWidth = half(W * 0.66) - m;
      const panelX = m + photoWidth + 2 * s;
      return [
        photoArea({ x: m, y: m, width: photoWidth, height: H - 2 * m }),
        ...textStack({ top: m, bottom: H - m, x: panelX, width: W - safeMm - panelX, maxMm: 10 * s, lines: lines('♥') }),
      ];
    },
  },
];
