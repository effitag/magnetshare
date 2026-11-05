// New template: name, standard magnet size, orientation and a design from the gallery: a basic
// layout or a ready-made frame by kind of event, each with a live preview.
import { useMemo, useState } from 'react';
import Button from '@/features/studio/ui/Button';
import Dialog from '@/features/studio/ui/Dialog';
import { FieldLabel, Segmented } from '@/features/studio/ui/fields';
import { DEFAULT_PRESET, DESIGN_CATEGORIES, designsIn, ORIENTATIONS, SIZE_PRESETS } from '@/features/studio/model/presets';
import { useDesignPreviews } from './useDesignPreviews';

const DEFAULT_NAME = 'תבנית חדשה';

function Choice({ selected, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-lg border p-2.5 text-start transition-colors ${
        selected ? 'border-brand bg-primary/15' : 'border-border bg-card hover:border-cool-600'
      }`}
    >
      {children}
    </button>
  );
}

export default function NewTemplateDialog({ onSubmit, onClose }) {
  const [name, setName] = useState(DEFAULT_NAME);
  const [nameEdited, setNameEdited] = useState(false);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [category, setCategory] = useState('basic');
  const [busy, setBusy] = useState(false);
  const designs = useMemo(() => designsIn(category), [category]);
  const previews = useDesignPreviews(designs, preset.sizeId, preset.orientation);
  const square = preset.sizeId === 'square';
  const set = (patch) => setPreset((p) => ({ ...p, ...patch }));

  function pickDesign(design) {
    set({ layoutId: design.id });
    // Until the name is typed, it follows the chosen frame: "חתונה · קלאסי".
    if (!nameEdited) setName(category === 'basic' ? DEFAULT_NAME : `${DESIGN_CATEGORIES.find((c) => c.id === category).label} · ${design.label}`);
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(name.trim(), preset);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="תבנית חדשה" onClose={onClose} wide="xl">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>שם התבנית</FieldLabel>
            <input
              autoFocus
              dir="auto"
              className="h-10 rounded-md bg-card border border-border px-3 text-sm focus:outline-none focus:border-brand"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameEdited(true);
              }}
              onFocus={(e) => e.target.select()}
            />
          </label>
          {!square && (
            <div className="md:w-48">
              <Segmented
                label="כיוון"
                value={preset.orientation}
                onChange={(orientation) => set({ orientation })}
                options={ORIENTATIONS.map((o) => ({ value: o.id, label: o.label }))}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="גודל המגנט">
          <FieldLabel>גודל המגנט (ס״מ)</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_PRESETS.map((s) => (
              <Choice key={s.id} selected={preset.sizeId === s.id} onClick={() => set({ sizeId: s.id })}>
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.note}</span>
              </Choice>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>עיצוב</FieldLabel>
          <div role="tablist" aria-label="סוג האירוע" className="flex flex-wrap gap-1.5">
            {DESIGN_CATEGORIES.map((c) => (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" role="radiogroup" aria-label="עיצוב">
            {designs.map((d) => (
              <Choice key={d.id} selected={preset.layoutId === d.id} onClick={() => pickDesign(d)}>
                <span className="mb-2 flex h-36 items-center justify-center rounded bg-cool-950/60 p-2">
                  {previews[d.id] && <img src={previews[d.id]} alt="" className="max-h-full max-w-full shadow-md" />}
                </span>
                <span className="block text-sm font-semibold">{d.label}</span>
                {d.note && <span className="block text-xs text-muted-foreground leading-snug">{d.note}</span>}
              </Choice>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || busy}>
            {busy ? 'יוצר…' : 'יצירה'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
