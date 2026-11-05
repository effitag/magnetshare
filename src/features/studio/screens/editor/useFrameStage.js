// Owns the editor's Konva stage. React renders the panels; this hook draws the frame
// imperatively by rebuilding it with buildFrame() whenever the document changes.
import { useLayoutEffect, useRef } from 'react';
import Konva from 'konva';
import { buildFrame } from '@/features/studio/render/buildFrame';
import { buildGuides } from '@/features/studio/render/guides';
import { ZOOM_MAX, ZOOM_MIN } from '@/features/studio/model/photo';
import { frameBoxes } from '@/features/studio/model/units';
import { useEditor } from '@/features/studio/store/editorStore';
import { applySelection, bindElementEvents, TRANSFORMER_STYLE } from './stageBindings';

export const STAGE_PADDING = 40;

/**
 * @param hostRef     div the stage mounts into
 * @param pxPerMm     current screen scale (fit × zoom); 0 until the viewport is measured
 * @param getImage    asset lookup for buildFrame
 * @param version     bumps when fonts or images finish loading
 * @param showSample  draw the sample photo in the photo area
 * @param panPhoto    photo-positioning mode
 */
export function useFrameStage(hostRef, { doc, pxPerMm, selectedId, getImage, version, showSample, panPhoto }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const stage = new Konva.Stage({ container: hostRef.current, width: 1, height: 1 });
    const content = new Konva.Layer();
    const overlay = new Konva.Layer();
    const transformer = new Konva.Transformer(TRANSFORMER_STYLE);
    overlay.add(transformer);
    stage.add(content, overlay);
    const s = { stage, content, overlay, transformer, world: null, guides: null, activeAnchor: null };
    transformer.on('transformstart', () => {
      s.activeAnchor = transformer.getActiveAnchor();
    });
    // A press on empty canvas (or the locked background) clears the selection.
    stage.on('pointerdown', (e) => {
      if (e.target === stage || (e.target.getLayer() === content && !e.target.findAncestor('.element', true))) {
        useEditor.getState().select(null);
      }
    });
    // While positioning the photo, the mouse wheel zooms it.
    stage.on('wheel', (e) => {
      const state = useEditor.getState();
      if (!state.panPhoto) return;
      e.evt.preventDefault();
      const zoom = state.history?.present.preview?.zoom ?? 1;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * (e.evt.deltaY < 0 ? 1.08 : 1 / 1.08)));
      state.setPreview({ zoom: Math.round(next * 100) / 100 }, 'preview:zoom');
    });
    ref.current = s;
    return () => {
      stage.destroy();
      ref.current = null;
    };
  }, [hostRef]);

  useLayoutEffect(() => {
    const s = ref.current;
    if (!s || !pxPerMm) return;
    const { bleed } = frameBoxes(doc.size);
    const pad = STAGE_PADDING;
    s.stage.size({ width: Math.ceil(bleed.width * pxPerMm + 2 * pad), height: Math.ceil(bleed.height * pxPerMm + 2 * pad) });
    const origin = { x: pad - bleed.x * pxPerMm, y: pad - bleed.y * pxPerMm };

    s.transformer.nodes([]);
    s.content.destroyChildren();
    s.guides?.destroy();

    // Paper behind the design (editor only): transparent areas print as white.
    s.content.add(
      new Konva.Rect({
        x: pad,
        y: pad,
        width: bleed.width * pxPerMm,
        height: bleed.height * pxPerMm,
        fill: '#ffffff',
        shadowColor: '#000000',
        shadowBlur: 24,
        shadowOpacity: 0.35,
        listening: false,
      }),
    );
    s.world = buildFrame(doc, { getImage, pxPerMm, photo: showSample ? 'sample' : 'placeholder' });
    s.world.position(origin);
    s.content.add(s.world);

    s.guides = buildGuides(doc.size, pxPerMm);
    s.guides.position(origin);
    s.overlay.add(s.guides);
    s.guides.moveToBottom();

    bindElementEvents(s, doc);
    const state = useEditor.getState();
    applySelection(s, doc, state.selectedId, state.panPhoto);
    s.stage.batchDraw();
  }, [doc, pxPerMm, getImage, version, showSample]);

  useLayoutEffect(() => {
    const s = ref.current;
    if (!s?.world) return;
    applySelection(s, doc, selectedId, panPhoto);
    s.stage.batchDraw();
  }, [doc, selectedId, panPhoto]);
}
