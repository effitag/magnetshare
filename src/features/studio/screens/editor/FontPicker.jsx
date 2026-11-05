// Font picker: every option is drawn in its own font with a sample line, grouped by style.
import { useEffect, useRef, useState } from 'react';
import Icon from '@/features/studio/ui/icons';
import { FieldLabel } from '@/features/studio/ui/fields';
import { CATEGORIES, FONTS, getFont, sampleText } from '@/features/studio/fonts/registry';
import { SYMBOL_FONT } from '@/features/studio/fonts/textSymbols';

// Samples show hearts (♥) the way the canvas draws them: symbols font first.
const cssFamily = (family) => `"${SYMBOL_FONT}", "${family}"`;

export default function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const font = getFont(value);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <FieldLabel>גופן</FieldLabel>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-9 flex items-center gap-2 rounded-md border border-border bg-card px-2 text-start hover:border-cool-600"
      >
        {/* Inline style: the family is data, not a fixed class. */}
        <span className="flex-1 truncate text-base" style={{ fontFamily: cssFamily(value) }}>
          {font ? sampleText(font) : value}
        </span>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {value}
        </span>
        <Icon name="chevronDown" className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 inset-x-0 z-30 max-h-[60vh] overflow-y-auto rounded-lg border border-cool-600 bg-card shadow-2xl py-1">
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="px-3 pt-2 pb-1 text-xs text-brand">{cat.label}</p>
              {FONTS.filter((f) => f.category === cat.id).map((f) => (
                <button
                  key={f.family}
                  type="button"
                  onClick={() => {
                    onChange(f.family);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-start hover:bg-muted ${f.family === value ? 'bg-primary/20' : ''}`}
                >
                  <span className="block text-lg leading-snug truncate" style={{ fontFamily: cssFamily(f.family) }}>
                    {sampleText(f)}
                  </span>
                  <span className="flex gap-2 text-xs text-muted-foreground">
                    <span dir="ltr">{f.family}</span>
                    {!f.niqqud && f.category !== 'latin' && <span>· ללא ניקוד</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
