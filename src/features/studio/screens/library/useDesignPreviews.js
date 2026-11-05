// Live previews of designs at the chosen size, drawn by the same renderer as the editor.
import { useEffect, useState } from 'react';
import { createPresetDoc } from '@/features/studio/model/presets';
import { renderFrameToCanvas } from '@/features/studio/render/renderToCanvas';
import { createAssetCache } from '@/features/studio/storage/assetCache';
import { fetchBuiltinImage } from '@/features/studio/storage/builtinImages';

const PREVIEW_PX = 260; // longest side of a preview image

// The app's own images (colourful icons) used by ready-made frames. They never change, so one
// cache serves every dialog.
const builtinAssets = createAssetCache((src) => fetchBuiltinImage(src));
const cache = new Map(); // "design|size|orientation" → data URL

/** @returns { [designId]: dataUrl }, filled in one by one as previews are drawn */
export function useDesignPreviews(designs, sizeId, orientation) {
  const [previews, setPreviews] = useState({});
  useEffect(() => {
    let alive = true;
    const key = (id) => `${id}|${sizeId}|${orientation}`;
    setPreviews(Object.fromEntries(designs.filter((d) => cache.has(key(d.id))).map((d) => [d.id, cache.get(key(d.id))])));
    (async () => {
      for (const design of designs) {
        if (!alive) return;
        if (cache.has(key(design.id))) continue;
        const doc = createPresetDoc('', { sizeId, orientation, layoutId: design.id });
        const pxPerMm = PREVIEW_PX / Math.max(doc.size.widthMm, doc.size.heightMm);
        const canvas = await renderFrameToCanvas(doc, { assets: builtinAssets, pxPerMm, photo: 'placeholder' });
        cache.set(key(design.id), canvas.toDataURL('image/png'));
        if (alive) setPreviews((p) => ({ ...p, [design.id]: cache.get(key(design.id)) }));
      }
    })().catch((err) => console.warn('[new template] previews failed:', err));
    return () => {
      alive = false;
    };
  }, [designs, sizeId, orientation]);
  return previews;
}
