// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clampPhotoPosition, focusFromPlacement, photoPlacement } from '@/features/studio/model/photo';

describe('sample photo placement', () => {
  it('covers the window, centred, at zoom 1', () => {
    // 3:2 landscape photo in a 92×56 window: height limits the crop? no — width does.
    const p = photoPlacement(92, 56, 3000, 2000);
    expect(p.width).toBeCloseTo(92);
    expect(p.height).toBeCloseTo(61.33, 1);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo((56 - 61.33) / 2, 1);
  });

  it('never leaves a gap, however far the focus is pushed', () => {
    const p = photoPlacement(92, 56, 3000, 2000, { zoom: 2, focusX: 0, focusY: 1 });
    expect(p.x).toBe(0);
    expect(p.y).toBeCloseTo(56 - p.height);
  });

  it('zoom enlarges from the cover size and is limited to 1–5', () => {
    expect(photoPlacement(100, 100, 1000, 1000, { zoom: 2 }).width).toBe(200);
    expect(photoPlacement(100, 100, 1000, 1000, { zoom: 0.5 }).width).toBe(100);
    expect(photoPlacement(100, 100, 1000, 1000, { zoom: 9 }).width).toBe(500);
  });

  it('focus round-trips through a placement', () => {
    const p = photoPlacement(90, 60, 4000, 3000, { zoom: 1.6, focusX: 0.4, focusY: 0.7 });
    expect(focusFromPlacement(90, 60, p)).toEqual({ focusX: 0.4, focusY: 0.7 });
  });

  it('clamps a dragged photo so it keeps covering the window', () => {
    expect(clampPhotoPosition(90, 60, 120, 80, { x: 10, y: -50 })).toEqual({ x: 0, y: -20 });
  });
});
