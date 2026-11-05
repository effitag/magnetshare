// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createPresetDoc, LAYOUTS, presetSize, SIZE_PRESETS } from '@/features/studio/model/presets';
import { migrateTemplate } from '@/features/studio/model/schema';
import { ptToMm } from '@/features/studio/model/units';

const combos = SIZE_PRESETS.flatMap((s) => ['landscape', 'portrait'].flatMap((o) => LAYOUTS.map((l) => ({ sizeId: s.id, orientation: o, layoutId: l.id }))));

describe('standard sizes', () => {
  it('defaults to the regular 7.5×10 magnet, landscape', () => {
    expect(presetSize('regular')).toEqual({ widthMm: 100, heightMm: 75, bleedMm: 3, safeMm: 3 });
    expect(createPresetDoc('x').size).toEqual({ widthMm: 100, heightMm: 75, bleedMm: 3, safeMm: 3 });
  });

  it('turns sizes for portrait and keeps squares square', () => {
    expect(presetSize('large', 'landscape')).toMatchObject({ widthMm: 150, heightMm: 100 });
    expect(presetSize('large', 'portrait')).toMatchObject({ widthMm: 100, heightMm: 150, safeMm: 4 });
    expect(presetSize('square', 'portrait')).toMatchObject({ widthMm: 100, heightMm: 100 });
  });
});

describe('frame layouts', () => {
  it.each(combos)('%o is a valid template with the background at the bottom', (preset) => {
    const doc = createPresetDoc('בדיקה', preset);
    expect(migrateTemplate(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(doc.elements[0].type).toBe('background');
    expect(new Set(doc.elements.map((e) => e.id)).size).toBe(doc.elements.length);
  });

  it.each(combos.filter((c) => c.layoutId !== 'blank'))('%o: one photo area and text inside the safe area', (preset) => {
    const doc = createPresetDoc('בדיקה', preset);
    const { widthMm: W, heightMm: H, safeMm } = doc.size;
    expect(doc.elements.filter((e) => e.type === 'photo')).toHaveLength(1);
    for (const t of doc.elements.filter((e) => e.type === 'text')) {
      const bottom = t.y + ptToMm(t.sizePt) * t.lineHeight;
      expect(t.x).toBeGreaterThanOrEqual(safeMm);
      expect(t.x + t.width).toBeLessThanOrEqual(W - safeMm + 0.01);
      expect(bottom).toBeLessThanOrEqual(H - safeMm + 0.3);
      expect(t.sizePt).toBeGreaterThanOrEqual(8);
    }
  });

  it('polaroid: white margins, a bottom band of about a fifth of the height', () => {
    const doc = createPresetDoc('x', { sizeId: 'regular', orientation: 'landscape', layoutId: 'polaroid' });
    const photo = doc.elements.find((e) => e.type === 'photo');
    expect(photo).toMatchObject({ x: 4, y: 4, width: 92, height: 56 });
    expect(75 - (photo.y + photo.height)).toBe(15);
  });

  it('strip: the photo runs into the bleed and a coloured band holds the text', () => {
    const doc = createPresetDoc('x', { sizeId: 'regular', orientation: 'landscape', layoutId: 'strip' });
    const photo = doc.elements.find((e) => e.type === 'photo');
    const band = doc.elements.find((e) => e.type === 'shape');
    expect(photo).toMatchObject({ x: -3, y: -3, width: 106 });
    expect(band.y).toBe(photo.y + photo.height);
    expect(band.y + band.height).toBe(78); // to the bleed edge
    expect(doc.elements.map((e) => e.type)).toEqual(['background', 'photo', 'shape', 'text', 'text']);
  });

  it('blank: just the background', () => {
    expect(createPresetDoc('x', { sizeId: 'large', orientation: 'portrait', layoutId: 'blank' }).elements.map((e) => e.type)).toEqual(['background']);
  });
});
