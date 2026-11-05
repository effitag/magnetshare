// Font picker: a floating list, each name in its own face, above the properties panel.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/features/studio/ui/icons';
import { FieldLabel } from '@/features/studio/ui/fields';
import { CATEGORIES, FONTS, getFont, sampleText } from '@/features/studio/fonts/registry';
import { ensureFonts } from '@/features/studio/fonts/loadFonts';
import { SYMBOL_FONT } from '@/features/studio/fonts/textSymbols';

const cssFamily = (family) => `"${SYMBOL_FONT}", "${family}"`;

export default function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const font = getFont(value);

  useEffect(() => {
    if (!open || !buttonRef.current) return undefined;
    const place = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const openUp = below < 220 && above > below;
      const maxHeight = Math.max(160, Math.min(window.innerHeight * 0.6, openUp ? above : below));
      setBox({
        left: rect.left,
        width: rect.width,
        maxHeight,
        top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      });
    };
    place();
    ensureFonts(FONTS.map((item) => ({ family: item.family, weight: item.weights.includes(400) ? 400 : item.weights[0] }))).catch(() => {});
    const onPointer = (event) => {
      const target = event.target;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div className="relative flex flex-col gap-1">
      <FieldLabel>גופן</FieldLabel>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 items-center gap-2 rounded-md border border-border bg-card px-2 text-start hover:border-cool-600"
      >
        <span className="flex-1 truncate text-base" style={{ fontFamily: cssFamily(value) }}>
          {font ? sampleText(font) : value}
        </span>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {value}
        </span>
        <Icon name="chevronDown" className="size-4 text-muted-foreground" />
      </button>
      {open && box && createPortal(
        <div
          ref={listRef}
          role="listbox"
          aria-label="גופן"
          className="fixed z-[80] overflow-y-auto rounded-lg border border-ink bg-sticker py-1 shadow-[4px_4px_0_#1c1416]"
          style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
        >
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="px-3 pb-1 pt-2 text-xs text-ink">{cat.label}</p>
              {FONTS.filter((item) => item.category === cat.id).map((item) => (
                <button
                  key={item.family}
                  type="button"
                  role="option"
                  aria-selected={item.family === value}
                  onClick={() => {
                    onChange(item.family);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-start hover:bg-pop ${item.family === value ? 'bg-pop' : ''}`}
                >
                  <span className="block truncate text-lg leading-snug" style={{ fontFamily: cssFamily(item.family) }}>
                    {sampleText(item)}
                  </span>
                  <span className="flex gap-2 text-xs text-ink">
                    <span dir="ltr">{item.family}</span>
                    {!item.niqqud && item.category !== 'latin' && <span>· ללא ניקוד</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
