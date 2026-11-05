// Form fields for the properties panel. Numbers are typed exactly; they commit on Enter or blur.
import { useState } from 'react';
import { formatNumber } from '@/features/studio/model/units';

const INPUT =
  'h-8 w-full min-w-0 rounded-md bg-card border border-border px-2 text-sm text-foreground tabular-nums focus:outline-none focus:border-brand';

export function FieldLabel({ children }) {
  return <span className="block text-xs leading-4 text-muted-foreground">{children}</span>;
}

/**
 * Exact numeric input. ArrowUp/Down step by `step` (Shift ×10). Escape cancels the draft.
 */
export function NumberField({ label, value, onCommit, step = 0.1, min = -Infinity, max = Infinity, suffix, decimals = 2, disabled }) {
  const [draft, setDraft] = useState(null);
  const clamp = (n) => Math.min(max, Math.max(min, n));

  function commit(raw) {
    setDraft(null);
    const n = parseFloat(String(raw).replace(',', '.'));
    if (Number.isFinite(n) && n !== value) onCommit(clamp(n));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') commit(e.currentTarget.value);
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1);
      setDraft(null);
      onCommit(clamp(Number((value + delta).toFixed(decimals))));
    }
  }

  return (
    <label className="flex flex-col gap-1 min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <span className="relative">
        <input
          dir="ltr"
          inputMode="decimal"
          className={`${INPUT} ${suffix ? 'pe-8' : ''}`}
          value={draft ?? formatNumber(value, decimals)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => draft !== null && commit(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {suffix && <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none" dir="ltr">{suffix}</span>}
      </span>
    </label>
  );
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Colour swatch + hex input. `onChange` fires continuously while dragging in the picker. */
export function ColorField({ label, value, onChange, allowNone = false }) {
  const [draft, setDraft] = useState(null);

  function commitHex(raw) {
    setDraft(null);
    const m = HEX.exec(raw.trim());
    if (m) onChange(`#${m[1].toUpperCase()}`);
  }

  return (
    <label className="flex flex-col gap-1 min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-card p-0.5"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          dir="ltr"
          className={`${INPUT} min-w-0 flex-1`}
          placeholder={allowNone ? 'ללא' : ''}
          value={draft ?? value ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => draft !== null && commitHex(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitHex(e.currentTarget.value)}
        />
        {allowNone && value && (
          <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange(null)}>
            ללא
          </button>
        )}
      </span>
    </label>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({ label, value, onChange, rows = 3, inputRef }) {
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        ref={inputRef}
        dir="auto"
        rows={rows}
        className={`${INPUT} h-auto py-1.5 leading-relaxed resize-y`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Row of toggle buttons, e.g. text alignment. */
export function Segmented({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex rounded-md border border-border bg-card p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.label}
            aria-label={o.label}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 h-7 inline-flex items-center justify-center rounded ${
              value === o.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.icon ?? o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
