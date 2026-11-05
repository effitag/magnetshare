import { useRef } from 'react';
import { frameBoxes } from '@/features/studio/model/units';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';
import { useEditorContext } from './EditorContext';
import { useElementSize, useRenderDeps } from './hooks';
import { STAGE_PADDING, useFrameStage } from './useFrameStage';

/** Screen pixels per mm at which the whole bleed box fits the viewport. */
function fitPxPerMm(size, viewport) {
  if (!viewport.width || !viewport.height) return 0;
  const { bleed } = frameBoxes(size);
  const k = Math.min((viewport.width - 2 * STAGE_PADDING) / bleed.width, (viewport.height - 2 * STAGE_PADDING) / bleed.height);
  return Math.max(0.5, k);
}

export default function CanvasView() {
  const doc = useDoc();
  const selectedId = useEditor((s) => s.selectedId);
  const zoom = useEditor((s) => s.zoom);
  const showSample = useEditor((s) => s.showSample);
  const panPhoto = useEditor((s) => s.panPhoto);
  const { assets } = useEditorContext();
  const viewportRef = useRef(null);
  const hostRef = useRef(null);
  const viewport = useElementSize(viewportRef);
  const version = useRenderDeps(doc, assets);
  const pxPerMm = fitPxPerMm(doc.size, viewport) * zoom;

  useFrameStage(hostRef, { doc, pxPerMm, selectedId, getImage: assets.get, version, showSample, panPhoto });

  return (
    // The canvas area is LTR: positions in the file are measured from the left edge.
    <div
      ref={viewportRef}
      dir="ltr"
      className="relative flex-1 min-w-0 overflow-auto bg-cool-950"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || e.target === e.currentTarget.firstChild) useEditor.getState().select(null);
      }}
    >
      <div className="grid min-h-full min-w-full w-max place-items-center">
        <div ref={hostRef} />
      </div>
    </div>
  );
}
