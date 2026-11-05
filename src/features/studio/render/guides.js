// Editor-only overlay: shaded bleed strip, dashed cut line, dashed safe area.
// Lives in its own layer and is never part of a saved or exported image.
import Konva from 'konva';
import { frameBoxes } from '@/features/studio/model/units';

const BLEED_SHADE = 'rgba(15,16,19,0.45)';
// Editor-only guide colours (never printed); the properties panel names them too.
export const CUT_LINE = '#ff4d6d';
export const SAFE_LINE = '#3ec1f3';

export function buildGuides(size, pxPerMm) {
  const { trim, bleed, safe } = frameBoxes(size);
  const px = (box) => ({ x: box.x * pxPerMm, y: box.y * pxPerMm, width: box.width * pxPerMm, height: box.height * pxPerMm });
  const b = px(bleed);
  const t = px(trim);
  const group = new Konva.Group({ name: 'guides', listening: false });

  // Four strips between the bleed edge and the cut line.
  const strips = [
    { x: b.x, y: b.y, width: b.width, height: t.y - b.y },
    { x: b.x, y: t.y + t.height, width: b.width, height: b.y + b.height - (t.y + t.height) },
    { x: b.x, y: t.y, width: t.x - b.x, height: t.height },
    { x: t.x + t.width, y: t.y, width: b.x + b.width - (t.x + t.width), height: t.height },
  ];
  strips.forEach((s) => group.add(new Konva.Rect({ ...s, fill: BLEED_SHADE })));

  group.add(new Konva.Rect({ ...t, stroke: CUT_LINE, strokeWidth: 1, dash: [6, 4] }));
  group.add(new Konva.Rect({ ...px(safe), stroke: SAFE_LINE, strokeWidth: 1, dash: [3, 3] }));
  return group;
}
