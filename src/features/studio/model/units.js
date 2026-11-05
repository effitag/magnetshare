// Templates store geometry in millimetres and font sizes in points.
// Pixels only exist at render time, at whatever scale or DPI is asked for.

export const MM_PER_INCH = 25.4;
export const MM_PER_PT = MM_PER_INCH / 72;

// Arrow-key nudges: 0.1 mm ≈ 1 px and 1 mm ≈ 12 px of a 300 DPI print.
export const NUDGE_MM = 0.1;
export const NUDGE_SHIFT_MM = 1;

export const ptToMm = (pt) => pt * MM_PER_PT;
export const pxPerMmAt = (dpi) => dpi / MM_PER_INCH;

/** Values in the file are kept to 0.01 mm so repeated nudges don't accumulate float noise. */
export const roundMm = (n) => Math.round(n * 100) / 100;
export const round1 = (n) => Math.round(n * 10) / 10;

/** Normalise an angle to (-180, 180], rounded to 0.1°. */
export function normalizeDeg(deg) {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return round1(d) || 0;
}

/** Trim (cut line) box, bleed box and safe box, all in mm relative to the cut line's top-left. */
export function frameBoxes({ widthMm, heightMm, bleedMm, safeMm }) {
  return {
    trim: { x: 0, y: 0, width: widthMm, height: heightMm },
    bleed: { x: -bleedMm, y: -bleedMm, width: widthMm + 2 * bleedMm, height: heightMm + 2 * bleedMm },
    safe: { x: safeMm, y: safeMm, width: widthMm - 2 * safeMm, height: heightMm - 2 * safeMm },
  };
}

/** Pixel size of a box at a DPI, e.g. 106×156 mm at 300 DPI → 1252×1843. */
export function pixelSize(box, dpi) {
  const k = pxPerMmAt(dpi);
  return { width: Math.round(box.width * k), height: Math.round(box.height * k) };
}

/** Source crop that makes an image cover a box (CSS object-fit: cover). */
export function coverCrop(imageWidth, imageHeight, boxWidth, boxHeight) {
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = boxWidth / scale;
  const height = boxHeight / scale;
  return { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height };
}

/** Display a stored number without trailing zeros: 12.30 → "12.3". */
export function formatNumber(n, decimals = 2) {
  return String(Number(Number(n).toFixed(decimals)));
}
