// Where a photo sits inside the photo area: it always covers the whole window (object-fit: cover);
// `zoom` enlarges it from there and the focus point (0–1 across the photo) is kept at the
// window centre as far as the photo's edges allow.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * @returns { x, y, width, height } of the photo in the window's coordinates (x, y ≤ 0)
 */
export function photoPlacement(boxW, boxH, imgW, imgH, { zoom = 1, focusX = 0.5, focusY = 0.5 } = {}) {
  const scale = Math.max(boxW / imgW, boxH / imgH) * clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    x: clamp(boxW / 2 - focusX * width, boxW - width, 0),
    y: clamp(boxH / 2 - focusY * height, boxH - height, 0),
    width,
    height,
  };
}

/** Inverse of photoPlacement: the focus point that puts the photo at (x, y). */
export function focusFromPlacement(boxW, boxH, { x, y, width, height }) {
  return {
    focusX: Math.round(clamp((boxW / 2 - x) / width, 0, 1) * 1000) / 1000,
    focusY: Math.round(clamp((boxH / 2 - y) / height, 0, 1) * 1000) / 1000,
  };
}

/** Keeps a dragged photo covering the window: clamps its top-left corner. */
export function clampPhotoPosition(boxW, boxH, width, height, { x, y }) {
  return { x: clamp(x, boxW - width, 0), y: clamp(y, boxH - height, 0) };
}
