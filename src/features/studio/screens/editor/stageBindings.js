// The editor stage's interaction: selection handles, dragging, resizing, and positioning the
// sample photo inside the photo area. Used by useFrameStage.js.
import { transformPatch, nodeBox } from '@/features/studio/render/nodeGeometry';
import { clampPhotoPosition, focusFromPlacement } from '@/features/studio/model/photo';
import { useEditor } from '@/features/studio/store/editorStore';

const ALL_ANCHORS = ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'];
const TEXT_ANCHORS = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];

export const TRANSFORMER_STYLE = {
  flipEnabled: false,
  ignoreStroke: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 3,
  rotateAnchorOffset: 24,
  anchorSize: 9,
  anchorCornerRadius: 2,
  anchorStroke: '#7c86e1',
  anchorFill: '#ffffff',
  borderStroke: '#7c86e1',
  borderStrokeWidth: 1.5,
  boundBoxFunc: (oldBox, newBox) => (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 1 ? oldBox : newBox),
};

function transformerFor(el) {
  if (el.locked) return { enabledAnchors: [], rotateEnabled: false, borderDash: [4, 3] };
  if (el.type === 'text') return { enabledAnchors: TEXT_ANCHORS, keepRatio: true, rotateEnabled: true, borderDash: null };
  return { enabledAnchors: ALL_ANCHORS, keepRatio: el.type === 'image' || el.type === 'icon', rotateEnabled: true, borderDash: null };
}

const findNode = (s, id) => s.world?.findOne((n) => n.id() === id) ?? null;

/**
 * Selection handles, plus the photo-positioning mode: while it is on, dragging inside the
 * photo area moves the sample photo (clamped so it always covers the window) instead of the area.
 */
export function applySelection(s, doc, selectedId, panPhoto) {
  const el = doc.elements.find((e) => e.id === selectedId);
  const photoEl = doc.elements.find((e) => e.type === 'photo');
  const photoNode = photoEl ? findNode(s, photoEl.id) : null;
  const sample = photoNode?.findOne('.samplePhoto') ?? null;
  const panning = Boolean(panPhoto && sample && photoEl.id === selectedId && !photoEl.locked);

  if (photoNode) photoNode.draggable(!photoEl.locked && !panning);
  if (sample) {
    sample.draggable(panning);
    sample.dragBoundFunc(
      panning
        ? (pos) => {
            const toAbsolute = photoNode.getAbsoluteTransform().copy();
            const local = toAbsolute.copy().invert().point(pos);
            return toAbsolute.point(clampPhotoPosition(photoNode.width(), photoNode.height(), sample.width(), sample.height(), local));
          }
        : null,
    );
  }

  const node = el && el.type !== 'background' && !panning ? findNode(s, selectedId) : null;
  if (!node) {
    s.transformer.nodes([]);
  } else {
    s.transformer.setAttrs(transformerFor(el));
    s.transformer.nodes([node]);
  }
  s.stage.container().style.cursor = panning ? 'grab' : '';
}

export function bindElementEvents(s, doc) {
  const byId = new Map(doc.elements.map((el) => [el.id, el]));
  const container = s.stage.container();
  s.world.find('.element').forEach((node) => {
    const el = byId.get(node.id());
    if (!el) return;
    node.draggable(!el.locked);
    node.on('pointerdown', () => useEditor.getState().select(el.id));
    node.on('mouseenter', () => {
      if (!useEditor.getState().panPhoto) container.style.cursor = 'move';
    });
    node.on('mouseleave', () => {
      if (!useEditor.getState().panPhoto) container.style.cursor = '';
    });
    // Only react to the element itself, not to a child (the sample photo) being dragged inside it.
    node.on('dragend', (e) => {
      if (e.target !== node) return;
      const { x, y } = nodeBox(node);
      useEditor.getState().updateElement(el.id, { x, y });
    });
    node.on('transformend', (e) => {
      if (e.target !== node) return;
      useEditor.getState().updateElement(el.id, transformPatch(el, node, s.activeAnchor));
    });
  });

  // Photo area: double-click to position the sample photo; dragging it stores the new focus point.
  const photoEl = doc.elements.find((e) => e.type === 'photo');
  const photoNode = photoEl ? findNode(s, photoEl.id) : null;
  const sample = photoNode?.findOne('.samplePhoto');
  if (!photoNode || !sample) return;
  photoNode.on('dblclick dbltap', () => {
    if (photoEl.locked) return;
    useEditor.getState().select(photoEl.id);
    useEditor.getState().setPanPhoto(true);
  });
  sample.on('dragstart', () => {
    container.style.cursor = 'grabbing';
  });
  sample.on('dragend', () => {
    container.style.cursor = 'grab';
    const focus = focusFromPlacement(photoNode.width(), photoNode.height(), {
      x: sample.x(),
      y: sample.y(),
      width: sample.width(),
      height: sample.height(),
    });
    useEditor.getState().setPreview(focus, 'preview:pan');
  });
}
