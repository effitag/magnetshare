import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { EventType } from "@/lib/eventTypes";
import type { FrameSlot } from "@/lib/magnets";
import { countQueuedJobs, getEventFrames, type EventFrames, type EventFrameSlot } from "@/services/api";
import { chooseFrame, isStale, loadEventFrame, refreshFrame, type EventValues, type Template } from "../eventFrames";
import { FrameGallery } from "./FrameGallery";
import { ReplaceDialog } from "./ReplaceDialog";

type Props = {
  event: EventValues & { eventType: EventType | null; status: "draft" | "live" | "closed" };
  /** Called whenever the event's frames change, so the activation checklist can follow. */
  onChanged?: (frames: EventFrames) => void;
};

type Pending =
  | { kind: "replace"; template: Template; queued: number }
  | { kind: "update"; slots: EventFrameSlot[]; queued: number };

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

function slotsOf(frames: EventFrames | null): EventFrameSlot[] {
  return [frames?.landscape, frames?.portrait].filter((frame): frame is EventFrameSlot => Boolean(frame));
}

/** The event's frame: choose one from the gallery, replace it, add an optional portrait frame, and keep it in step with the event's name and date. */
export function FrameSection({ event, onChanged }: Props) {
  const [frames, setFrames] = useState<EventFrames | null>(null);
  const [stale, setStale] = useState<EventFrameSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gallery, setGallery] = useState<FrameSlot | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    try {
      const next = await getEventFrames(event.id);
      setFrames(next);
      onChangedRef.current?.(next);
      const out: EventFrameSlot[] = [];
      for (const frame of slotsOf(next)) {
        if (isStale(await loadEventFrame(frame.id), event)) out.push(frame);
      }
      setStale(out);
      return out;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את המסגרת של האירוע.");
      return [];
    }
  }, [event]);

  async function run(label: string, action: () => Promise<number>) {
    setPending(null);
    setGallery(null);
    setWorking(label);
    setError(null);
    setNotice(null);
    try {
      const moved = await action();
      setNotice(moved > 0 ? `המסגרת מוכנה לאורחים. ${moved === 1 ? "מגנט אחד עודכן" : `${moved} מגנטים עודכנו`} אליה.` : "המסגרת מוכנה לאורחים.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו להכין את המסגרת. נסו שוב.");
    } finally {
      setWorking(null);
      await load();
    }
  }

  const choose = (template: Template, moveQueued: boolean) => run("מכינים את המסגרת…", () => chooseFrame(template, event, { moveQueued }));

  const update = (slots: EventFrameSlot[], moveQueued: boolean) =>
    run("מעדכנים את המסגרת…", async () => {
      let moved = 0;
      for (const frame of slots) moved += await refreshFrame(frame.id, frame.sourceTemplateId, event, { moveQueued });
      return moved;
    });

  async function queuedIn(slots: EventFrameSlot[]): Promise<number> {
    let queued = 0;
    for (const frame of slots) queued += await countQueuedJobs(event.id, frame.id);
    return queued;
  }

  async function pick(template: Template, slot: FrameSlot) {
    const current = slot === "landscape" ? frames?.landscape : frames?.portrait;
    if (!current) return choose(template, false);
    try {
      const queued = await queuedIn([current]);
      if (event.status === "live" || queued > 0) setPending({ kind: "replace", template, queued });
      else await choose(template, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לבדוק את המגנטים בתור.");
    }
  }

  async function askUpdate(slots: EventFrameSlot[]) {
    try {
      const queued = await queuedIn(slots);
      if (event.status === "live" || queued > 0) setPending({ kind: "update", slots, queued });
      else await update(slots, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לבדוק את המגנטים בתור.");
    }
  }

  // On open, and whenever the saved name or date changes: load, and bring the frame up to date.
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const key = `${event.id}|${event.title}|${event.eventDate ?? ""}`;
    const first = seen.current === null;
    if (seen.current === key) return;
    seen.current = key;
    void load().then((out) => {
      if (!first && out.length) void askUpdate(out);
    });
  }, [event.id, event.title, event.eventDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {stale.length && !pending && !working ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border-[3px] border-ink bg-pop-wash p-3">
          <p className="text-base">השם או התאריך של האירוע השתנו, והמסגרת עוד מציגה את הקודמים.</p>
          <button type="button" className={`${button} self-start bg-pop`} onClick={() => void askUpdate(stale)}>
            עדכון המסגרת
          </button>
        </div>
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
          kind={pending.kind}
          live={event.status === "live"}
          queued={pending.queued}
          onReplace={(moveQueued) => void (pending.kind === "replace" ? choose(pending.template, moveQueued) : update(pending.slots, moveQueued))}
          onCancel={() => setPending(null)}
        />
      ) : null}
      {working ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sticker/90 p-4" role="status" aria-live="polite">
          <p className="font-display text-2xl text-ink">{working}</p>
        </div>
      ) : null}
    </section>
  );
}
