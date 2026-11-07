import { useEffect, useMemo, useRef, useState } from "react";
import { eventTypeLabel, type EventType } from "@/lib/eventTypes";
import type { FrameSlot } from "@/lib/magnets";
import { listFrameTemplates } from "@/services/api";
import { toTemplates, type EventValues, type Template } from "../eventFrames";
import { galleryTemplates, hiddenCount } from "../gallery";
import { usePreview } from "./usePreview";

type Props = {
  event: EventValues & { eventType: EventType | null };
  slot: FrameSlot;
  currentTemplateId: string | null;
  onPick: (template: Template) => void;
  onClose: () => void;
};

function FramePicture({ template, event, eager = false }: { template: Template; event: EventValues; eager?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (visible || !box.current) return;
    const watcher = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setVisible(true), {
      rootMargin: "200px",
    });
    watcher.observe(box.current);
    return () => watcher.disconnect();
  }, [visible]);
  const { url, failed } = usePreview(template, event, visible);
  return (
    <div
      ref={box}
      className="flex w-full items-center justify-center overflow-hidden rounded-xl border-[3px] border-ink bg-paper"
      // Inline style: the template's own proportions (landscape, portrait or square).
      style={{ aspectRatio: `${template.widthMm} / ${template.heightMm}` }}
    >
      {url ? (
        <img className="size-full object-contain" src={url} alt="" />
      ) : (
        <span className="px-2 text-center text-base text-ink">{failed ? "אין תצוגה" : "מכינים תצוגה…"}</span>
      )}
    </div>
  );
}

export function FrameGallery({ event, slot, currentTemplateId, onPick, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Template | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFrameTemplates()
      .then((rows) => !cancelled && setTemplates(toTemplates(rows)))
      .catch((cause: Error) => !cancelled && setError(cause.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // The page behind the gallery does not scroll while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const shown = useMemo(
    () => (templates ? galleryTemplates(templates, { eventType: event.eventType, slot, all }) : []),
    [templates, event.eventType, slot, all],
  );
  const more = templates ? hiddenCount(templates, event.eventType, slot) : 0;
  const kind = eventTypeLabel(event.eventType);
  const title = `${slot === "portrait" ? "מסגרת לאורך" : "בחירת מסגרת"}${kind ? ` · ${kind}` : ""}`;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-sticker text-ink" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink px-4 py-3">
        <h2 className="min-w-0 truncate font-display text-2xl leading-none">{open ? open.name : title}</h2>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border-[3px] border-ink px-4 text-base"
          onClick={() => (open ? setOpen(null) : onClose())}
        >
          {open ? "חזרה" : "סגירה"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
        {open ? (
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            <FramePicture template={open} event={event} eager />
            <p className="text-base">כך המסגרת תיראה באירוע, עם השם והתאריך שלו.</p>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink bg-pop px-4 text-lg"
              onClick={() => onPick(open)}
            >
              {open.id === currentTemplateId ? "בחירה מחדש" : "בחירה"}
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            {error ? <p role="alert">{error}</p> : null}
            {!templates && !error ? <p>טוענים תבניות…</p> : null}
            {templates && !kind ? <p className="mb-3">לאירוע עוד אין סוג, אז מוצגות כל התבניות.</p> : null}
            {templates && shown.length === 0 ? (
              <p className="mb-3">
                {slot === "portrait" ? "אין עדיין תבניות לאורך." : "אין עדיין תבניות מתאימות."} אפשר ליצור תבנית בלשונית מסגרות.
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-3">
              {shown.map((template) => (
                <li key={template.id}>
                  <button type="button" className="flex w-full flex-col gap-1 text-start" onClick={() => setOpen(template)}>
                    <FramePicture template={template} event={event} />
                    <span className="truncate text-base">
                      {template.name}
                      {template.id === currentTemplateId ? " · נבחרה" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {kind && more > 0 ? (
              <button type="button" className="mt-4 inline-flex min-h-11 items-center text-base underline" onClick={() => setAll(!all)}>
                {all ? "רק תבניות מתאימות" : `כל התבניות (${more} נוספות)`}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
