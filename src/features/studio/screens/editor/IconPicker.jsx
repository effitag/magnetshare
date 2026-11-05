// Icon picker: single-colour icons (any colour) and colourful emoji, grouped by kind of celebration.
import { useState } from 'react';
import Dialog from '@/features/studio/ui/Dialog';
import { notify } from '@/features/studio/ui/toast';
import { DEFAULT_ICON_COLOR, emojiUrl, ICON_CATEGORIES, ICON_COLORS, iconsIn } from '@/features/studio/icons/catalog';
import { SYMBOL_PATHS } from '@/features/studio/icons/symbolPaths';
import { createIcon, createImage } from '@/features/studio/model/schema';
import { roundMm } from '@/features/studio/model/units';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';
import { useEditorContext } from './EditorContext';
import { imageUploadMessage, importImage } from './imageImport';

const withArtwork = (s) => (s.path ? s : { ...s, ...SYMBOL_PATHS[s.id] });

// The last colour and category chosen stay picked the next time the picker opens.
let remembered = { color: DEFAULT_ICON_COLOR, category: 'hearts' };
const isLight = (hex) => hex.toUpperCase() === '#FFFFFF';

export function ColorSwatches({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={c.label}
          aria-pressed={value?.toUpperCase() === c.value}
          onClick={() => onChange(c.value)}
          // Inline style: the swatch colour is data.
          style={{ backgroundColor: c.value }}
          className={`size-7 rounded-full border border-cool-600 ${value?.toUpperCase() === c.value ? 'ring-2 ring-brand ring-offset-2 ring-offset-background' : ''}`}
        />
      ))}
    </div>
  );
}

export default function IconPicker({ onClose }) {
  const ctx = useEditorContext();
  const doc = useDoc();
  const [category, setCategoryState] = useState(remembered.category);
  const [color, setColorState] = useState(remembered.color);
  const setCategory = (next) => setCategoryState((remembered = { ...remembered, category: next }).category);
  const setColor = (next) => setColorState((remembered = { ...remembered, color: next }).color);
  const [busy, setBusy] = useState(null);
  const { symbols, emoji } = iconsIn(category);
  const { widthMm: W, heightMm: H } = doc.size;
  const side = Math.round(Math.min(W, H) * 0.16);

  function addSymbol(entry) {
    useEditor.getState().addElement(createIcon(doc.size, withArtwork(entry), color));
    onClose();
  }

  async function addEmoji(entry) {
    setBusy(entry.id);
    try {
      const res = await fetch(emojiUrl(entry.id));
      if (!res.ok) throw new Error(`emoji ${entry.id}: ${res.status}`);
      const file = new File([await res.blob()], `${entry.id}.svg`, { type: 'image/svg+xml' });
      const { path } = await importImage(ctx, file);
      const el = createImage(doc.size, path, 1, 1, entry.label);
      useEditor.getState().addElement({ ...el, width: side, height: side, x: roundMm((W - side) / 2), y: roundMm((H - side) / 2) });
      onClose();
    } catch (err) {
      console.error('[icons] emoji insert failed:', err);
      notify(imageUploadMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog title="אייקונים" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="סוג האירוע" className="flex flex-wrap gap-1.5">
          {ICON_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 h-8 text-sm ${category === c.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {symbols.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs text-brand">בצבע לבחירה</h3>
              <ColorSwatches value={color} onChange={setColor} />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {symbols.map(withArtwork).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  aria-label={s.label}
                  onClick={() => addSymbol(s)}
                  className={`aspect-square rounded-lg grid place-items-center p-2.5 transition-transform hover:scale-105 ${isLight(color) ? 'bg-muted' : 'bg-foreground'}`}
                >
                  <svg viewBox={s.viewBox.join(' ')} className="size-full" aria-hidden="true">
                    <path d={s.path} fill={color} />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {emoji.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-brand">צבעוניים</h3>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {emoji.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  title={e.label}
                  aria-label={e.label}
                  disabled={busy !== null}
                  onClick={() => addEmoji(e)}
                  className="aspect-square rounded-lg grid place-items-center p-2 bg-secondary hover:bg-muted transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <img src={emojiUrl(e.id)} alt="" className="size-full" loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        )}
        <p className="text-xs text-muted-foreground">אייקונים של Memoria, Phosphor ו-MingCute, אימוג׳י מ-Fluent Emoji. אחרי ההוספה אפשר לשנות גודל, צבע ומיקום.</p>
      </div>
    </Dialog>
  );
}
