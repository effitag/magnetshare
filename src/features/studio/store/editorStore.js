// Editor state: the open template (with undo history), the selection, the zoom and the photo preview.
import { create } from 'zustand';
import { commit, initHistory, redo, undo } from './history';
import { removeElement, reorderElement, updateElement } from '@/features/studio/model/elements';
import { DEFAULT_PREVIEW } from '@/features/studio/model/schema';

const changesSomething = (el, patch) => Object.keys(patch).some((k) => el?.[k] !== patch[k]);

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;

export const useEditor = create((set, get) => ({
  history: null,
  selectedId: null,
  zoom: 1, // 1 = the whole frame fits the canvas area
  showSample: true, // draw the sample photo in the photo area (when there is one)
  panPhoto: false, // dragging inside the photo area moves the photo, not the area

  open: (doc) => set({ history: initHistory(doc), selectedId: null, zoom: 1, panPhoto: false }),
  close: () => set({ history: null, selectedId: null, panPhoto: false }),

  /** Apply `updater(doc) → doc` as one undo step (or merge into the last step with the same key). */
  change: (updater, key = null) =>
    set((s) => ({ history: commit(s.history, updater(s.history.present), { key }) })),

  updateElement: (id, patch, key = null) =>
    get().change((doc) => {
      // A patch that changes nothing (e.g. a click without a drag) is not an undo step.
      if (!changesSomething(doc.elements.find((e) => e.id === id), patch)) return doc;
      return { ...doc, elements: updateElement(doc.elements, id, patch) };
    }, key),

  /** Adds on top, or at `index` (e.g. 1 = just above the background). */
  addElement: (el, index = null) => {
    get().change((doc) => {
      const elements = doc.elements.slice();
      elements.splice(index ?? elements.length, 0, el);
      return { ...doc, elements };
    });
    set({ selectedId: el.id, panPhoto: false });
  },

  /** Sample photo, zoom and focus of the photo area preview. */
  setPreview: (patch, key = null) =>
    get().change((doc) => {
      const preview = { ...DEFAULT_PREVIEW, ...doc.preview };
      if (!changesSomething(preview, patch)) return doc;
      return { ...doc, preview: { ...preview, ...patch } };
    }, key),
  setShowSample: (showSample) => set({ showSample, panPhoto: showSample && get().panPhoto }),
  setPanPhoto: (panPhoto) => set({ panPhoto }),

  removeElement: (id) => {
    get().change((doc) => ({ ...doc, elements: removeElement(doc.elements, id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },

  reorderElement: (id, beforeIndex) =>
    get().change((doc) => {
      const elements = reorderElement(doc.elements, id, beforeIndex);
      return elements === doc.elements ? doc : { ...doc, elements };
    }),

  select: (id) => set((s) => ({ selectedId: id, panPhoto: s.panPhoto && id === s.selectedId })),
  undo: () => set((s) => ({ history: undo(s.history) })),
  redo: () => set((s) => ({ history: redo(s.history) })),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
}));

export const useDoc = () => useEditor((s) => s.history?.present ?? null);

export const useSelected = () =>
  useEditor((s) => s.history?.present.elements.find((el) => el.id === s.selectedId) ?? null);

export const selectedOf = (state) =>
  state.history?.present.elements.find((el) => el.id === state.selectedId) ?? null;
