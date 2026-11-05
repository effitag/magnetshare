// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createPresetDoc, DESIGN_CATEGORIES, designsIn, SIZE_PRESETS } from '@/features/studio/model/presets';
import { migrateTemplate } from '@/features/studio/model/schema';
import { STARTER_CATEGORIES, STARTERS } from '@/features/studio/model/starters';
import { ptToMm } from '@/features/studio/model/units';
import { createCloudRepo } from '@/features/studio/storage/cloudRepo';
import { isBuiltinImage, uploadBuiltinImages } from '@/features/studio/storage/builtinImages';
import { createMemoryGateway } from '@/features/studio/storage/memoryGateway';

const combos = SIZE_PRESETS.flatMap((s) =>
  ['landscape', 'portrait'].flatMap((o) => STARTERS.map((d) => ({ sizeId: s.id, orientation: o, layoutId: d.id }))),
);

describe('ready-made frames', () => {
  it('offers at least two designs for every kind of event, with Hebrew names', () => {
    for (const c of STARTER_CATEGORIES) {
      const designs = designsIn(c.id);
      expect(designs.length, c.id).toBeGreaterThanOrEqual(2);
      for (const d of designs) expect(d.label, d.id).toMatch(/[֐-׿]/);
    }
    expect(new Set(STARTERS.map((d) => d.id)).size).toBe(STARTERS.length);
    expect(DESIGN_CATEGORIES[0].id).toBe('basic');
  });

  it.each(combos)('%o is a valid, editable template', (preset) => {
    const doc = createPresetDoc('בדיקה', preset);
    expect(migrateTemplate(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(doc.elements[0].type).toBe('background');
    expect(new Set(doc.elements.map((e) => e.id)).size).toBe(doc.elements.length);
    expect(doc.elements.filter((e) => e.type === 'photo')).toHaveLength(1);
    expect(doc.elements.filter((e) => e.type === 'text').length).toBeGreaterThanOrEqual(1);
  });

  it.each(combos)('%o keeps text inside the safe area and decorations on the magnet', (preset) => {
    const doc = createPresetDoc('בדיקה', preset);
    const { widthMm: W, heightMm: H, safeMm } = doc.size;
    for (const t of doc.elements.filter((e) => e.type === 'text')) {
      expect(t.x, t.name).toBeGreaterThanOrEqual(safeMm);
      expect(t.y, t.name).toBeGreaterThanOrEqual(safeMm);
      expect(t.x + t.width, t.name).toBeLessThanOrEqual(W - safeMm + 0.01);
      expect(t.y + ptToMm(t.sizePt) * t.lineHeight, t.name).toBeLessThanOrEqual(H - safeMm + 0.3);
      expect(t.sizePt, t.name).toBeGreaterThanOrEqual(6);
    }
    for (const e of doc.elements.filter((el) => el.type === 'icon' || el.type === 'image')) {
      expect(e.x, e.name).toBeGreaterThanOrEqual(0);
      expect(e.y, e.name).toBeGreaterThanOrEqual(0);
      expect(e.x + e.width, e.name).toBeLessThanOrEqual(W);
      expect(e.y + e.height, e.name).toBeLessThanOrEqual(H);
    }
  });

  it('tags the template with its kind of event and paints the background', () => {
    const doc = createPresetDoc('x', { sizeId: 'regular', orientation: 'landscape', layoutId: 'henna-bordeaux' });
    expect(doc.tags).toEqual(['חינה']);
    expect(doc.elements[0].fill).toBe('#6E1423');
    expect(createPresetDoc('x').tags).toEqual([]);
  });

  it('puts a heart between the names', () => {
    const doc = createPresetDoc('x', { sizeId: 'regular', orientation: 'landscape', layoutId: 'wedding-classic' });
    expect(doc.elements.find((e) => e.name === 'שמות').text).toContain('♥');
  });
});

describe('built-in images in ready-made frames', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"/>';
  const fakeFetch = async (url) => ({ ok: url.startsWith('/studio/emoji/'), status: 200, blob: async () => new Blob([svg], { type: 'image/svg+xml' }) });

  it('uploads each image into the new template once and points the layers at it', async () => {
    const repo = createCloudRepo(createMemoryGateway());
    const doc = createPresetDoc('בת מצווה', { sizeId: 'regular', orientation: 'landscape', layoutId: 'mitzvah-bat' });
    expect(doc.elements.filter((e) => isBuiltinImage(e.src))).toHaveLength(2);

    const ready = await uploadBuiltinImages(repo, doc, fakeFetch);
    const images = ready.elements.filter((e) => e.type === 'image');
    expect(images[0].src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(images[1].src).toBe(images[0].src);
    await repo.insert(ready);
    expect(await repo.listFiles(doc.id)).toEqual([]);
    expect((await repo.list())[0].tags).toEqual(['בר/בת מצווה']);
  });
});
