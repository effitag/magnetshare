// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { closestPreset, findWindow, frameImportDoc } from '@/features/studio/model/frameImport';
import { migrateTemplate } from '@/features/studio/model/schema';

/** RGBA picture, opaque except the rectangles in `holes` ([x, y, w, h] in pixels). */
function picture(width, height, holes = []) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [hx, hy, hw, hh] of holes) {
    for (let y = hy; y < hy + hh; y += 1) for (let x = hx; x < hx + hw; x += 1) data[(y * width + x) * 4 + 3] = 0;
  }
  return { width, height, data };
}

describe('frame import', () => {
  it('matches the picture to the closest standard magnet', () => {
    expect(closestPreset(2500, 1875)).toEqual({ sizeId: 'regular', orientation: 'landscape' });
    expect(closestPreset(1875, 2500)).toEqual({ sizeId: 'regular', orientation: 'portrait' });
    expect(closestPreset(3000, 2000)).toEqual({ sizeId: 'large', orientation: 'landscape' });
    expect(closestPreset(1000, 1000)).toEqual({ sizeId: 'square', orientation: 'landscape' });
  });

  it('finds the transparent window', () => {
    expect(findWindow(picture(100, 75, [[10, 5, 80, 50]]))).toEqual({ x: 0.1, y: 5 / 75, width: 0.8, height: 50 / 75 });
  });

  it('takes the biggest transparent region and ignores small specks', () => {
    const w = findWindow(picture(100, 75, [[0, 0, 3, 3], [10, 5, 80, 50], [95, 70, 5, 5]]));
    expect(w.width).toBe(0.8);
    expect(findWindow(picture(100, 75, [[0, 0, 10, 10]]))).toBeNull(); // too small to be a photo window
    expect(findWindow(picture(100, 75))).toBeNull(); // no transparency (e.g. a JPG)
  });

  it('builds a template: photo area in the window, the picture locked on top', () => {
    const doc = frameImportDoc('מסגרת זהב', { width: 2500, height: 1875 }, 'assets/frame.png', { x: 0.1, y: 0.1, width: 0.8, height: 0.6 });
    expect(doc.size).toMatchObject({ widthMm: 100, heightMm: 75 });
    expect(doc.elements.map((e) => e.type)).toEqual(['background', 'photo', 'image']);
    expect(doc.elements[1]).toMatchObject({ x: 10, y: 7.5, width: 80, height: 45 });
    expect(doc.elements[2]).toMatchObject({ src: 'assets/frame.png', x: 0, y: 0, width: 100, height: 75, locked: true });
    expect(migrateTemplate(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});
