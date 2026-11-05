// Shared geometry for the renderer's Konva nodes (buildFrame.js, photoArea.js).

// Konva world units per mm. Working in 0.1 mm keeps canvas font sizes in a normal pixel range
// (an 18 pt title is 63.5 units, not 6.35), so text measurement and line breaks are stable
// at every zoom level and export resolution.
export const U = 10;

// Model x/y is the top-left of the unrotated box and rotation turns around the box centre,
// so each node is positioned at its centre with an offset of half its size.
export function boxAttrs(el, heightMm = el.height) {
  const w = el.width * U;
  const h = heightMm * U;
  return {
    id: el.id,
    name: 'element',
    x: el.x * U + w / 2,
    y: el.y * U + h / 2,
    width: w,
    height: h,
    offsetX: w / 2,
    offsetY: h / 2,
    rotation: el.rotation || 0,
    opacity: el.opacity ?? 1,
    listening: !el.locked,
  };
}

/** Makes a group report its own box as its bounds (selection handles), whatever its children draw. */
export function boundToBox(group, w, h) {
  group.getClientRect = (config = {}) => {
    const rect = { x: 0, y: 0, width: w, height: h };
    return config.skipTransform ? rect : group._transformedRect(rect, config.relativeTo);
  };
}
