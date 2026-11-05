// Converts a Konva node that the user dragged or transformed back into model values (mm).
import { normalizeDeg, round1, roundMm } from '@/features/studio/model/units';
import { U } from './buildFrame';

/** Every element node is positioned at its centre (see buildFrame), so this works for all shapes. */
export function nodeBox(node) {
  const width = (node.width() * node.scaleX()) / U;
  const height = (node.height() * node.scaleY()) / U;
  const cx = node.x() / U;
  const cy = node.y() / U;
  return {
    x: roundMm(cx - width / 2),
    y: roundMm(cy - height / 2),
    width: roundMm(width),
    height: roundMm(height),
    rotation: normalizeDeg(node.rotation()),
  };
}

/**
 * Text keeps its height automatic: side handles change the box width (the text re-wraps),
 * corner handles scale the font size with it.
 */
export function transformPatch(el, node, anchor) {
  const box = nodeBox(node);
  if (el.type !== 'text') return box;
  const { height: _height, ...patch } = box;
  const isCorner = anchor && anchor !== 'rotater' && !anchor.startsWith('middle');
  if (isCorner) patch.sizePt = round1(el.sizePt * node.scaleX());
  return patch;
}
