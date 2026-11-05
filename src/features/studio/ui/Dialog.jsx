// Modal dialogs on the native <dialog> element (focus trap, Escape and backdrop for free).
//
// Dialogs are rendered straight into <body> and centred explicitly, so where the component sits in
// the page (e.g. inside the toolbar) can never affect where the window appears. If the browser
// refuses showModal(), the dialog still opens on top of everything, with its own dimmed overlay.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const WIDTHS = { normal: 'w-[min(92vw,420px)]', wide: 'w-[min(94vw,640px)]', xl: 'w-[min(96vw,980px)]' };

/** @param wide  false, true (640px) or 'xl' (980px, for galleries) */
export default function Dialog({ title, onClose, wide = false, children }) {
  const ref = useRef(null);
  const [fallback, setFallback] = useState(false);

  // Unmounting removes the dialog from the top layer, so no explicit close() is needed.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog.open) return;
    try {
      dialog.showModal();
    } catch (err) {
      console.warn('[dialog] showModal failed, opening on top of the page instead:', err);
      dialog.show();
      setFallback(true);
    }
  }, []);

  return createPortal(
    <>
      {fallback && <div className="fixed inset-0 z-40 bg-black/60" onPointerDown={onClose} aria-hidden="true" />}
      <dialog
        ref={ref}
        onClose={onClose}
        onKeyDown={(e) => fallback && e.key === 'Escape' && onClose()}
        className={`fixed inset-0 z-50 m-auto h-fit ${WIDTHS[wide === 'xl' ? 'xl' : wide ? 'wide' : 'normal']} max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl backdrop:bg-black/60`}
      >
        <h2 className="text-base font-semibold mb-4">{title}</h2>
        {children}
      </dialog>
    </>,
    document.body,
  );
}

/** Asks for a name (new template, rename). */
export function NameDialog({ title, initial = '', confirmLabel, onSubmit, onClose }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  async function submit(e) {
    e.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          autoFocus
          dir="auto"
          className="h-10 rounded-md bg-card border border-border px-3 text-sm focus:outline-none focus:border-brand"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button variant="primary" type="submit" disabled={!trimmed || busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="text-sm text-secondary-foreground mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
