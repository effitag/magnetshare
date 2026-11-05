// The photo area: the window the event photo goes into, drawn as a placeholder, the sample
// photo, or (print file) a transparent hole.
import Konva from 'konva';
import { photoPlacement } from '@/features/studio/model/photo';
import { boundToBox, boxAttrs, U } from './nodeBox';

const PLACEHOLDER_FILL = '#D7DBE2';
const PLACEHOLDER_INK = '#7B8190';

/** Outline of the photo window in its own coordinates: rectangle (optionally rounded) or ellipse. */
function photoWindowPath(ctx, el, w, h) {
  if (el.shape === 'ellipse') {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const r = Math.min((el.cornerRadiusMm || 0) * U, w / 2, h / 2);
  if (r > 0) ctx.roundRect(0, 0, w, h, r);
  else ctx.rect(0, 0, w, h);
}

export function buildPhotoArea(el, doc, getImage, mode) {
  const attrs = boxAttrs(el);
  const { width: w, height: h } = attrs;
  if (mode === 'cutout') {
    // Print file: erase everything drawn so far inside the window; layers above it still draw on top.
    return new Konva.Shape({
      ...attrs,
      opacity: 1,
      fill: '#000',
      globalCompositeOperation: 'destination-out',
      sceneFunc: (ctx, shape) => {
        ctx.beginPath();
        photoWindowPath(ctx, el, w, h);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      },
    });
  }
  const group = new Konva.Group({ ...attrs, clipFunc: (ctx) => photoWindowPath(ctx, el, w, h) });
  // Konva sizes a group by its children and ignores the clip, so a zoomed sample photo would make the
  // selection handles far bigger than the window. The area's bounds are the window itself.
  boundToBox(group, w, h);
  const sample = mode === 'sample' && doc.preview?.photo ? getImage(doc.preview.photo) : null;
  if (sample) {
    const placement = photoPlacement(w, h, sample.naturalWidth || sample.width, sample.naturalHeight || sample.height, doc.preview);
    group.add(new Konva.Image({ name: 'samplePhoto', image: sample, ...placement }));
    return group;
  }
  group.add(new Konva.Rect({ width: w, height: h, fill: PLACEHOLDER_FILL }));
  group.add(
    new Konva.Text({
      width: w,
      height: h,
      text: 'התמונה כאן',
      fontFamily: 'Heebo',
      fontSize: Math.min(w, h) * 0.1,
      fill: PLACEHOLDER_INK,
      align: 'center',
      verticalAlign: 'middle',
      direction: 'rtl',
      listening: false,
    }),
  );
  return group;
}
