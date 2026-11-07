import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EventType } from "@/lib/eventTypes";
import type { FrameSlot } from "@/lib/magnets";
import { countQueuedJobs, getEventFrames, type EventFrames, type EventFrameSlot } from "@/services/api";
import { chooseFrame, type EventValues, type Template } from "../eventFrames";
import { FrameGallery } from "./FrameGallery";
import { ReplaceDialog } from "./ReplaceDialog";

type Props = {
  event: EventValues & { eventType: EventType | null; status: "draft" | "live" | "closed" };
};

type Pending = { template: Template; slot: FrameSlot; queued: number };

const button = "inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base";

function FrameCard({ frame, title, onReplace }: { frame: EventFrameSlot; title: string; onReplace: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg">{title}</h3>
      <div className="overflow-hidden rounded-xl border-[3px] border-ink bg-paper">
        {frame.previewUrl ? <img className="w-full" src={frame.previewUrl} alt={`המסגרת ${frame.name}`} /> : <p className="p-4 text-base">אין תצוגה</p>}
      </div>
      <p className="text-base">{frame.name}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`${button} bg-pop`} onClick={onReplace}>
          החלפה
        </button>
        <Link className={button} to={`/admin/frames/${frame.id}`}>
          עריכה בסטודיו · במחשב
        </Link>
      </div>
    </div>
  );
}

/** The event's frame: choose one from the gallery, replace it, or add an optional portrait frame. */
export function FrameSection({ event }: Props) {
  const [frames, setFrames] = useState<EventFrames | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gallery, setGallery] = useState<FrameSlot | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    getEventFrames(event.id)
      .then(setFrames)
      .catch((cause: Error) => setError(cause.message));
  }, [event.id]);

  useEffect(load, [load]);

  async function apply(template: Template, slot: FrameSlot, moveQueued: boolean) {
    setPending(null);
    setGallery(null);
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const moved = await chooseFrame(template, event, slot, { moveQueued });
      setNotice(moved > 0 ? `המסגרת מוכנה לאורחים. ${moved === 1 ? "מגנט אחד עודכן" : `${moved} מגנטים עודכנו`} אליה.` : "המסגרת מוכנה לאורחים.");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו להכין את המסגרת. נסו שוב.");
    } finally {
      setWorking(false);
    }
  }

  async function pick(template: Template, slot: FrameSlot) {
    const current = slot === "landscape" ? frames?.landscape : frames?.portrait;
    if (!current) return apply(template, slot, false);
    try {
      const queued = await countQueuedJobs(event.id, current.id);
      if (event.status === "live" || queued > 0) setPending({ template, slot, queued });
      else await apply(template, slot, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לבדוק את המגנטים בתור.");
    }
  }

  const current = gallery === "portrait" ? frames?.portrait : frames?.landscape;

  return (
    <section className="sticker-card mt-6 bg-sticker p-4 text-ink" aria-labelledby="frame-title">
      <h2 id="frame-title" className="font-display text-2xl leading-none">
        מסגרת
      </h2>
      {!frames && !error ? <p className="mt-3 text-base">טוענים…</p> : null}
      {error ? (
        <p className="mt-3 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-base" role="status">
          {notice}
        </p>
      ) : null}

      {frames ? (
        <div className="mt-4 flex flex-col gap-6">
          {frames.landscape ? (
            <FrameCard frame={frames.landscape} title="מסגרת לרוחב" onReplace={() => setGallery("landscape")} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-base">עוד לא נבחרה מסגרת.</p>
              <button type="button" className={`${button} bg-pop text-lg`} onClick={() => setGallery("landscape")}>
                בחירת מסגרת
              </button>
            </div>
          )}
          {frames.portrait ? (
            <FrameCard frame={frames.portrait} title="מסגרת לאורך" onReplace={() => setGallery("portrait")} />
          ) : (
            <button type="button" className="inline-flex min-h-11 items-center self-start text-base underline" onClick={() => setGallery("portrait")}>
              + הוספת מסגרת לאורך (לא חובה)
            </button>
          )}
        </div>
      ) : null}

      {gallery ? (
        <FrameGallery
          event={event}
          slot={gallery}
          currentTemplateId={current?.sourceTemplateId ?? null}
          onPick={(template) => void pick(template, gallery)}
          onClose={() => setGallery(null)}
        />
      ) : null}
      {pending ? (
        <ReplaceDialog
          live={event.status === "live"}
          queued={pending.queued}
          onReplace={(moveQueued) => void apply(pending.template, pending.slot, moveQueued)}
          onCancel={() => setPending(null)}
        />
      ) : null}
      {working ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sticker/90 p-4" role="status" aria-live="polite">
          <p className="font-display text-2xl text-ink">מכינים את המסגרת…</p>
        </div>
      ) : null}
    </section>
  );
}
