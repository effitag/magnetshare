// THE renderer: turns a template document into Konva nodes.
// The editor, thumbnails and the print PNG all draw through this one function,
// so what is saved or exported can't drift from what the editor shows.
import Konva from 'konva';
import { coverCrop, frameBoxes, ptToMm } from '@/features/studio/model/units';
import { detectDirection } from '@/features/studio/model/text';
import { normalizeSymbols, withSymbols } from '@/features/studio/fonts/textSymbols';
import { boundToBox, boxAttrs, U } from './nodeBox';
import { buildPhotoArea } from './photoArea';

export { U };

/**
 * @param doc       template document
 * @param getImage  (path) => HTMLImageElement | null
 * @param pxPerMm   output scale
 * @param photo     what fills the photo area: 'placeholder' (grey + label), 'sample' (the sample photo, if any)
 *                  or 'cutout' (a transparent hole, for the print file)
 * @returns Konva.Group whose (0,0) is the top-left of the cut line, clipped to the bleed box
 */
export function buildFrame(doc, { getImage, pxPerMm, photo = 'placeholder' }) {
  const { bleed } = frameBoxes(doc.size);
  const world = new Konva.Group({
    name: 'world',
    scaleX: pxPerMm / U,
    scaleY: pxPerMm / U,
    clipX: bleed.x * U,
    clipY: bleed.y * U,
    clipWidth: bleed.width * U,
    clipHeight: bleed.height * U,
  });
  for (const el of doc.elements) {
    if (el.visible === false) continue;
    const node = el.type === 'photo' ? buildPhotoArea(el, doc, getImage, photo) : buildElement(el, doc, getImage);
    if (node) world.add(node);
  }
  return world;
}

function buildElement(el, doc, getImage) {
  switch (el.type) {
    case 'background':
      return buildBackground(el, doc.size, getImage);
    case 'text':
      return buildText(el);
    case 'image':
      return buildImage(el, getImage);
    case 'shape':
      return buildShape(el);
    case 'icon':
      return buildIcon(el);
    default:
      return null;
  }
}

function buildBackground(el, size, getImage) {
  const { bleed } = frameBoxes(size);
  const box = { x: bleed.x * U, y: bleed.y * U, width: bleed.width * U, height: bleed.height * U };
  const group = new Konva.Group({ id: el.id, name: 'background', listening: false, opacity: el.opacity ?? 1 });
  if (el.fill) group.add(new Konva.Rect({ ...box, fill: el.fill }));
  const img = el.image ? getImage(el.image) : null;
  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const crop = iw && ih ? coverCrop(iw, ih, box.width, box.height) : undefined;
    group.add(new Konva.Image({ ...box, image: img, crop }));
  }
  return group;
}

function buildIcon(el) {
  const attrs = boxAttrs(el);
  const [vx, vy, vw, vh] = el.viewBox ?? [0, 0, 24, 24];
  const sx = attrs.width / vw;
  const sy = attrs.height / vh;
  const group = new Konva.Group(attrs);
  group.add(new Konva.Path({ data: el.path, fill: el.color, x: -vx * sx, y: -vy * sy, scaleX: sx, scaleY: sy }));
  // The path's own bounds are a little smaller than its grid; handles follow the full icon box.
  boundToBox(group, attrs.width, attrs.height);
  return group;
}

function buildText(el) {
  const text = normalizeSymbols(el.text);
  const node = new Konva.Text({
    text,
    // Hearts, rings and sparkles in the text come from the symbols font, in the text's colour.
    fontFamily: withSymbols(el.font),
    fontStyle: String(el.weight ?? 400),
    fontSize: ptToMm(el.sizePt) * U,
    lineHeight: el.lineHeight ?? 1.2,
    fill: el.color,
    align: el.align ?? 'center',
    direction: detectDirection(text),
    width: el.width * U,
    wrap: 'word',
  });
  // Height follows the content: measure, then position around the centre like every other element.
  node.setAttrs(boxAttrs(el, node.height() / U));
  node.height(undefined);
  return node;
}

function buildImage(el, getImage) {
  const img = getImage(el.src);
  if (!img) return new Konva.Rect({ ...boxAttrs(el), fill: 'rgba(128,128,128,0.25)' });
  return new Konva.Image({ ...boxAttrs(el), image: img });
}

function buildShape(el) {
  const paint = {
    fill: el.fill || undefined,
    stroke: el.stroke || undefined,
    strokeWidth: (el.strokeWidthMm || 0) * U,
    // Dashed outline: dashes and gaps of `dashMm`.
    dash: el.dashMm > 0 ? [el.dashMm * U, el.dashMm * U] : undefined,
  };
  if (el.shape === 'ellipse') {
    // Konva ellipses are drawn around their origin, so no offset is needed.
    const { offsetX: _offsetX, offsetY: _offsetY, width, height, ...attrs } = boxAttrs(el);
    return new Konva.Ellipse({ ...attrs, ...paint, radiusX: width / 2, radiusY: height / 2 });
  }
  return new Konva.Rect({ ...boxAttrs(el), ...paint, cornerRadius: (el.cornerRadiusMm || 0) * U });
}
