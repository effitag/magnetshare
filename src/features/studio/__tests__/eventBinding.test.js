import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  autoBind,
  boundText,
  fitFontSize,
  formatEventDate,
  hebrewNumeral,
  isBound,
} from '@/features/studio/model/eventBinding';
import { createPresetDoc } from '@/features/studio/model/presets';
import { migrateTemplate } from '@/features/studio/model/schema';

const textEl = (name, text, extra = {}) => ({ id: `t_${name}`, type: 'text', name, text, x: 3, y: 60, width: 94, sizePt: 20, ...extra });

describe('linking texts to the event', () => {
  it('links the "שמות" and "תאריך" layers of older templates', () => {
    expect(autoBind(textEl('שמות', 'נועה ♥ איתי')).bind).toBe('names');
    const date = autoBind(textEl('תאריך', '24.12.2026'));
    expect(date.bind).toBe('date');
    expect(date.dateFormat).toBe('dots');
    expect(autoBind(textEl('טקסט', 'שלום'))).not.toHaveProperty('bind');
  });

  it('keeps a text the designer unlinked on purpose', () => {
    const unlinked = textEl('שמות', 'טקסט חופשי', { bind: null });
    expect(autoBind(unlinked).bind).toBeNull();
    expect(isBound(unlinked)).toBe(false);
  });

  it('links every ready-made layout when it is loaded', () => {
    for (const layoutId of ['polaroid', 'strip', 'wedding-classic', 'wedding-rings']) {
      const doc = migrateTemplate(createPresetDoc('בדיקה', { sizeId: 'regular', orientation: 'landscape', layoutId }));
      const binds = doc.elements.filter(isBound).map((el) => el.bind).sort();
      expect(binds, layoutId).toEqual(['date', 'names']);
    }
  });
});

describe('dates', () => {
  it('writes the three formats', () => {
    expect(formatEventDate('2027-02-11', 'dots')).toBe('11.02.2027');
    expect(formatEventDate('2027-02-11', 'long')).toBe('11 בפברואר 2027');
    expect(formatEventDate('2027-02-11', 'hebrew')).toBe('ד׳ באדר א׳ תשפ״ז');
    expect(formatEventDate('2026-12-24', 'hebrew')).toBe('י״ד בטבת תשפ״ז');
  });

  it('uses dots by default and leaves an unreadable date as it was', () => {
    expect(formatEventDate('2027-02-11')).toBe('11.02.2027');
    expect(formatEventDate('2027-02-30', 'dots')).toBe('2027-02-30');
    expect(formatEventDate('', 'dots')).toBe('');
  });

  it('writes Hebrew numerals the traditional way', () => {
    expect(hebrewNumeral(1)).toBe('א׳');
    expect(hebrewNumeral(10)).toBe('י׳');
    expect(hebrewNumeral(15)).toBe('ט״ו');
    expect(hebrewNumeral(16)).toBe('ט״ז');
    expect(hebrewNumeral(30)).toBe('ל׳');
    expect(hebrewNumeral(5787)).toBe('תשפ״ז');
    expect(hebrewNumeral(5800)).toBe('ת״ת');
  });
});

describe('filling in the event', () => {
  const template = {
    elements: [
      { id: 'bg', type: 'background' },
      textEl('שמות', 'נועה ♥ איתי', { bind: 'names' }),
      textEl('תאריך', '24.12.2026', { bind: 'date', dateFormat: 'long' }),
      textEl('טקסט', 'תודה שבאתם', { bind: null }),
    ],
  };
  const event = { title: 'רון ♥ מאיה', eventDate: '2027-02-11' };

  it('puts the event name and date into the linked texts only', () => {
    const filled = applyEvent(template, event);
    expect(filled.elements.map((el) => el.text)).toEqual([undefined, 'רון ♥ מאיה', '11 בפברואר 2027', 'תודה שבאתם']);
  });

  it('never changes the template it was given', () => {
    const before = JSON.stringify(template);
    applyEvent(template, event);
    expect(JSON.stringify(template)).toBe(before);
  });

  it('keeps the sample where the event has no value yet', () => {
    const filled = applyEvent(template, { title: '  ', eventDate: null });
    expect(filled.elements[1].text).toBe('נועה ♥ איתי');
    expect(filled.elements[2].text).toBe('24.12.2026');
    expect(boundText(template.elements[3], event)).toBeNull();
  });
});

describe('fitting a linked text on one line', () => {
  it('keeps the size when the text fits', () => {
    expect(fitFontSize(20, 80, 100)).toBe(20);
  });

  it('shrinks a long text to the width of its box', () => {
    expect(fitFontSize(20, 200, 100)).toBe(10);
  });

  it('never goes below the minimum', () => {
    expect(fitFontSize(20, 1000, 100)).toBe(6);
  });
});
