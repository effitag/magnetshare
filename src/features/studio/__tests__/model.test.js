// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { coverCrop, formatNumber, frameBoxes, normalizeDeg, pixelSize, ptToMm, roundMm } from '@/features/studio/model/units';
import { detectDirection, textPreview } from '@/features/studio/model/text';
import { sanitizeName, splitExtension, uniqueName } from '@/features/studio/model/names';
import { createImage, createTemplateDoc, createText, migrateTemplate, FORMAT } from '@/features/studio/model/schema';
import { assetPathsOf, removeElement, reorderElement } from '@/features/studio/model/elements';

describe('units', () => {
  it('computes the 300 DPI print size of a 10×15 magnet with 3 mm bleed', () => {
    const { bleed, trim } = frameBoxes({ widthMm: 100, heightMm: 150, bleedMm: 3, safeMm: 4 });
    expect(pixelSize(bleed, 300)).toEqual({ width: 1252, height: 1843 });
    expect(pixelSize(trim, 300)).toEqual({ width: 1181, height: 1772 });
  });

  it('converts points to mm', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4);
  });

  it('keeps nudged values free of float noise', () => {
    let x = 0;
    for (let i = 0; i < 3; i += 1) x = roundMm(x + 0.1);
    expect(x).toBe(0.3);
    expect(formatNumber(12.3)).toBe('12.3');
    expect(formatNumber(12)).toBe('12');
  });

  it('normalises angles to (-180, 180]', () => {
    expect(normalizeDeg(270)).toBe(-90);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(360)).toBe(0);
  });

  it('crops an image to cover a box', () => {
    // 2000×1000 landscape into a 100×100 square → centred 1000×1000 crop.
    expect(coverCrop(2000, 1000, 100, 100)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });
});

describe('text', () => {
  it('detects direction from the first strong character', () => {
    expect(detectDirection('נועה ואיתי')).toBe('rtl');
    expect(detectDirection('Noa & Itai')).toBe('ltr');
    expect(detectDirection('24.12 נועה')).toBe('rtl');
    expect(detectDirection('2026')).toBe('rtl');
  });

  it('previews the first non-empty line', () => {
    expect(textPreview('\n  שורה ראשונה\nשנייה', 'x')).toBe('שורה ראשונה');
    expect(textPreview('', 'טקסט')).toBe('טקסט');
  });
});

describe('names', () => {
  it('keeps Hebrew and removes characters file systems reject', () => {
    expect(sanitizeName('חתונה: נועה/איתי?')).toBe('חתונה- נועה-איתי-');
    expect(sanitizeName('  _hidden. ')).toBe('hidden');
    expect(sanitizeName('...')).toBe('ללא שם');
  });

  it('adds a counter when a name is taken, ignoring case', () => {
    expect(uniqueName('Wedding', ['wedding', 'Wedding (2)'])).toBe('Wedding (3)');
    expect(uniqueName('חתונה', [])).toBe('חתונה');
  });

  it('splits extensions', () => {
    expect(splitExtension('leaf.SVG')).toEqual({ stem: 'leaf', ext: '.svg' });
    expect(splitExtension('.env')).toEqual({ stem: '.env', ext: '' });
  });
});

describe('schema', () => {
  it('creates a blank 10×15 template with only a background', () => {
    const doc = createTemplateDoc('חדש');
    expect(doc.format).toBe(FORMAT);
    expect(doc.size).toEqual({ widthMm: 100, heightMm: 150, bleedMm: 3, safeMm: 4 });
    expect(doc.elements.map((e) => e.type)).toEqual(['background']);
  });

  it('creates text without a stored height', () => {
    const text = createText({ widthMm: 100, heightMm: 150 });
    expect(text).not.toHaveProperty('height');
    expect(text.x).toBe(10);
  });

  it('fits a tall image inside 60% of the frame, keeping its ratio', () => {
    const img = createImage({ widthMm: 100, heightMm: 150 }, 'assets/a.png', 1000, 4000);
    expect(img.height).toBe(90);
    expect(img.width).toBe(22.5);
  });

  it('repairs hand-edited files: background first, unknown elements dropped, defaults filled', () => {
    const doc = migrateTemplate({
      format: FORMAT,
      version: 1,
      name: 'x',
      size: { widthMm: 150, heightMm: 100 },
      elements: [{ id: 't', type: 'text' }, { id: 'zz', type: 'hologram' }, { id: 'bg', type: 'background', fill: '#000000' }],
    });
    expect(doc.elements.map((e) => e.id)).toEqual(['bg', 't']);
    expect(doc.elements[0].fill).toBe('#000000');
    expect(doc.size).toEqual({ widthMm: 150, heightMm: 100, bleedMm: 3, safeMm: 4 });
  });

  it('rejects files that are not templates or are from a newer version', () => {
    expect(() => migrateTemplate({ hello: 1 })).toThrow();
    expect(() => migrateTemplate({ format: FORMAT, version: 99 })).toThrow(/newer/);
  });
});

describe('elements', () => {
  const els = ['bg', 'a', 'b', 'c'].map((id) => ({ id, type: id === 'bg' ? 'background' : 'shape' }));
  const ids = (list) => list.map((e) => e.id).join(',');

  it('moves an element before a given index', () => {
    expect(ids(reorderElement(els, 'c', 1))).toBe('bg,c,a,b');
    expect(ids(reorderElement(els, 'a', 4))).toBe('bg,b,c,a');
    expect(ids(reorderElement(els, 'c', 2))).toBe('bg,a,c,b');
  });

  it('never moves anything below the background, or the background itself', () => {
    expect(ids(reorderElement(els, 'b', 0))).toBe('bg,b,a,c');
    expect(reorderElement(els, 'bg', 3)).toBe(els);
  });

  it('never removes the background', () => {
    expect(ids(removeElement(els, 'bg'))).toBe('bg,a,b,c');
    expect(ids(removeElement(els, 'b'))).toBe('bg,a,c');
  });

  it('lists asset paths once', () => {
    const doc = {
      elements: [
        { type: 'background', image: 'assets/bg.jpg' },
        { type: 'image', src: 'assets/leaf.svg' },
        { type: 'image', src: 'assets/leaf.svg' },
      ],
    };
    expect(assetPathsOf(doc)).toEqual(['assets/bg.jpg', 'assets/leaf.svg']);
  });
});

describe('print file size', async () => {
  const { printPixelSize } = await import('@/features/studio/render/renderToCanvas');
  const { presetSize } = await import('@/features/studio/model/presets');

  it('is 2500×1875 for the regular magnet, the size print software expects', () => {
    expect(printPixelSize(presetSize('regular', 'landscape'))).toEqual({ width: 2500, height: 1875 });
    expect(printPixelSize(presetSize('regular', 'portrait'))).toEqual({ width: 1875, height: 2500 });
  });

  it('keeps 25 px per mm for the other sizes', () => {
    expect(printPixelSize(presetSize('large', 'landscape'))).toEqual({ width: 3750, height: 2500 });
    expect(printPixelSize(presetSize('square', 'landscape'))).toEqual({ width: 2500, height: 2500 });
  });
});
