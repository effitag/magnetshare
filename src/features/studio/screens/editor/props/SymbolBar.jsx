// Buttons that put a heart, rings or a sparkle into the text at the cursor: "עדן ♥ אביב".
// Colour symbols (the scribble hearts) keep their own colours; the rest take the text colour.
import { FieldLabel } from '@/features/studio/ui/fields';
import { insertSymbol, SYMBOL_FONT, TEXT_SYMBOLS } from '@/features/studio/fonts/textSymbols';

export default function SymbolBar({ textRef, value, onInsert }) {
  function add(symbol) {
    const area = textRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const { text, cursor } = insertSymbol(value, start, end, symbol);
    onInsert(text);
    // Put the cursor back after the symbol once React has written the new text.
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>סמלים בתוך הטקסט</FieldLabel>
      <div className="flex flex-wrap gap-1">
        {TEXT_SYMBOLS.map((s) => (
          <button
            key={s.insert}
            type="button"
            title={s.label}
            aria-label={s.label}
            // Keep the textarea's cursor where it was.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => add(s.insert)}
            // Inline style: draw the button with the same symbols font the canvas uses.
            style={{ fontFamily: `"${SYMBOL_FONT}"` }}
            className="size-8 rounded-md border border-border bg-card text-lg leading-none text-foreground hover:border-brand"
          >
            {s.insert}
          </button>
        ))}
      </div>
    </div>
  );
}
