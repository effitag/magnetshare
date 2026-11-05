// Small editor hooks: viewport size, font/asset readiness, keyboard shortcuts.
import { useEffect, useLayoutEffect, useState } from 'react';
import { assetPathsOf } from '@/features/studio/model/elements';
import { NUDGE_MM, NUDGE_SHIFT_MM, roundMm } from '@/features/studio/model/units';
import { ensureFonts, fontSpecsOf, isFontLoaded } from '@/features/studio/fonts/loadFonts';
import { selectedOf, useEditor } from '@/features/studio/store/editorStore';

export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Returns a counter that bumps whenever fonts or images the document needs finish loading. */
export function useRenderDeps(doc, assets) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const missingAssets = assetPathsOf(doc).filter((p) => !assets.has(p));
    const missingFonts = fontSpecsOf(doc).filter((f) => !isFontLoaded(f));
    if (!missingAssets.length && !missingFonts.length) return;
    Promise.all([
      assets.ensure(missingAssets),
      ensureFonts(missingFonts).catch((err) => console.error('[fonts] load failed:', err)),
    ]).then(() => setVersion((v) => v + 1));
  }, [doc, assets]);
  return version;
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Uses e.code, so the shortcuts also work with the Hebrew keyboard layout. */
export function useEditorKeys({ onSaveNow }) {
  useEffect(() => {
    function onKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === 'KeyS') {
        e.preventDefault();
        onSaveNow();
        return;
      }
      if (isTyping(e.target)) return;
      const state = useEditor.getState();
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && e.code === 'KeyY') {
        e.preventDefault();
        state.redo();
        return;
      }
      if (e.key === 'Escape') {
        // First Escape leaves photo positioning, the next one clears the selection.
        if (state.panPhoto) state.setPanPhoto(false);
        else state.select(null);
        return;
      }
      const el = selectedOf(state);
      if (!el || el.type === 'background' || el.locked) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.removeElement(el.id);
        return;
      }
      const dir = ARROWS[e.key];
      if (dir) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM;
        // Holding an arrow merges into one undo step.
        state.updateElement(el.id, { x: roundMm(el.x + dir[0] * step), y: roundMm(el.y + dir[1] * step) }, `nudge:${el.id}`);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSaveNow]);
}
