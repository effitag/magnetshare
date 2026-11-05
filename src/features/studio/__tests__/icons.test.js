// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMOJI, ICON_CATEGORIES, ICON_COLORS, iconsIn, SYMBOLS } from '@/features/studio/icons/catalog';
import { SYMBOL_PATHS } from '@/features/studio/icons/symbolPaths';
import { createIcon, createTemplateDoc, migrateTemplate } from '@/features/studio/model/schema';

const categoryIds = new Set(ICON_CATEGORIES.map((c) => c.id));

describe('icon catalogue', () => {
  it('has artwork for every single-colour icon (run `npm run icons` after editing the catalogue)', () => {
    for (const s of SYMBOLS) {
      expect(SYMBOL_PATHS[s.id]?.path, s.id).toMatch(/^[Mm]/); // lowercase m is valid SVG
      expect(SYMBOL_PATHS[s.id].viewBox).toHaveLength(4);
    }
    expect(Object.keys(SYMBOL_PATHS).sort()).toEqual(SYMBOLS.map((s) => s.id).sort());
  });

  it('uses only the modern, permissively licensed sets', () => {
    for (const s of SYMBOLS) expect(s.src, s.id).toMatch(/^(ph|mingcute|custom):[a-z-]+$/);
  });

  it('has rings and a diamond ring among the wedding icons', () => {
    const ids = iconsIn('love').symbols.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['rings', 'diamond-ring', 'heart', 'two-hearts']));
  });

  it('has a file for every emoji', () => {
    for (const e of EMOJI) {
      const file = new URL(`../../../../public/studio/emoji/${e.id}.svg`, import.meta.url);
      expect(existsSync(file), e.id).toBe(true);
      expect(readFileSync(file, 'utf8')).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 \d+ \d+"/);
    }
  });

  it('gives every icon a Hebrew name, known categories and a unique id', () => {
    const all = [...SYMBOLS, ...EMOJI];
    for (const i of all) {
      expect(i.label, i.id).toMatch(/[֐-׿]/);
      expect(i.categories.every((c) => categoryIds.has(c)), i.id).toBe(true);
    }
    expect(new Set(SYMBOLS.map((s) => s.id)).size).toBe(SYMBOLS.length);
    expect(new Set(EMOJI.map((e) => e.id)).size).toBe(EMOJI.length);
  });

  it('fills every category, with plenty of hearts', () => {
    for (const c of ICON_CATEGORIES) {
      const { symbols, emoji } = iconsIn(c.id);
      expect(symbols.length + emoji.length, c.id).toBeGreaterThanOrEqual(6);
    }
    const hearts = iconsIn('hearts');
    expect(hearts.symbols.length).toBeGreaterThanOrEqual(4);
    expect(hearts.emoji.length).toBeGreaterThanOrEqual(10);
  });

  it('offers black, red, soft red and dark red', () => {
    const labels = ICON_COLORS.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['שחור', 'אדום', 'אדום עדין', 'אדום כהה']));
  });
});

describe('icon element', () => {
  const size = { widthMm: 100, heightMm: 75 };
  const heart = { id: 'heart', label: 'לב', ...SYMBOL_PATHS.heart };

  it('is sized to about a sixth of the frame, centred, in the chosen colour', () => {
    const el = createIcon(size, heart, '#8B1A2B');
    expect(el).toMatchObject({ type: 'icon', name: 'לב', width: 12, height: 12, color: '#8B1A2B', icon: 'heart' });
    expect(el.x).toBe(44);
  });

  it('keeps the artwork in the template, so it survives saving and reloading', () => {
    const doc = createTemplateDoc('x');
    doc.elements.push(createIcon(size, heart, '#111111'));
    const reloaded = migrateTemplate(JSON.parse(JSON.stringify(doc)));
    expect(reloaded.elements[1].path).toBe(SYMBOL_PATHS.heart.path);
  });
});
