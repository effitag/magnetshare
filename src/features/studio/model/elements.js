// Pure operations on the elements array. Index 0 is always the background.

export function updateElement(elements, id, patch) {
  return elements.map((el) => (el.id === id ? { ...el, ...patch } : el));
}

export function removeElement(elements, id) {
  return elements.filter((el) => el.id !== id || el.type === 'background');
}

/**
 * Moves an element so it sits just before `beforeIndex` (an index into the array as it is now).
 * `beforeIndex === elements.length` moves it to the top. The background never moves.
 */
export function reorderElement(elements, id, beforeIndex) {
  const from = elements.findIndex((el) => el.id === id);
  if (from <= 0) return elements;
  let to = beforeIndex > from ? beforeIndex - 1 : beforeIndex;
  to = Math.max(1, Math.min(to, elements.length - 1));
  if (to === from) return elements;
  const next = elements.slice();
  const [el] = next.splice(from, 1);
  next.splice(to, 0, el);
  return next;
}

/** Relative paths of every file a template draws. */
export function assetPathsOf(doc) {
  const paths = new Set();
  for (const el of doc.elements) {
    if (el.type === 'image' && el.src) paths.add(el.src);
    if (el.type === 'background' && el.image) paths.add(el.image);
  }
  if (doc.preview?.photo) paths.add(doc.preview.photo);
  return [...paths];
}
