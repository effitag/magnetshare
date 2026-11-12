import { counterLine, overTargetLine, sentMagnets, targetLevel, targetShare } from "@/lib/magnetTarget";
import type { MagnetCounts } from "@/services/types";
import { CloseEventButton } from "./CloseEventButton";
import { useMagnetCounts } from "./useMagnetCounts";

type Props = {
  eventId: string;
  status: "live" | "closed";
  target: number | null;
  onClosed: () => void;
};

const EMPTY: MagnetCounts = { queued: 0, printing: 0, ready: 0, delivered: 0, rejected: 0 };

/**
 * The top card of a live or closed event: magnets sent (not rejected) against
 * the optional target, with the status breakdown and the 80% and 100% alerts.
 * Nothing is blocked; the admin decides when to close.
 */
export function EventCounter({ eventId, status, target, onClosed }: Props) {
  const { counts, available, error } = useMagnetCounts([eventId], { poll: true });
  if (!available) return null;
  const loaded = counts !== null;
  const mine = counts?.get(eventId) ?? EMPTY;
  const sent = sentMagnets(mine);
  const level = targetLevel(sent, target);
  const over = overTargetLine(sent, target);

  return (
    <section className="sticker-card mt-4 bg-sticker p-4 text-ink" aria-labelledby="counter-title" aria-busy={!loaded}>
      <h2 id="counter-title" className="font-display text-3xl leading-none">
        {loaded ? counterLine(sent, target) : "סופרים מגנטים…"}
      </h2>
      {over ? <p className="mt-1 text-base">{over}</p> : null}
      {target ? (
        <div
          className="mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-paper"
          role="progressbar"
          aria-label="מגנטים מתוך היעד"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(sent, target)}
        >
          <span
            className={`block h-full ${level === "reached" ? "bg-primary" : level === "near" ? "bg-accent" : "bg-pop"}`}
            style={{ width: `${targetShare(sent, target) * 100}%` }}
          />
        </div>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2 text-base" aria-label="לפי מצב">
        <li className="rounded-full border-2 border-ink px-3 py-1">בתור {mine.queued}</li>
        <li className="rounded-full border-2 border-ink px-3 py-1">בהדפסה {mine.printing}</li>
        <li className="rounded-full border-2 border-ink px-3 py-1">מוכנים {mine.ready}</li>
        <li className="rounded-full border-2 border-ink px-3 py-1">נמסרו {mine.delivered}</li>
      </ul>
      {mine.rejected ? <p className="mt-2 text-base">לא אושרו {mine.rejected}, לא נספרים.</p> : null}
      <div aria-live="polite">
        {level === "near" ? (
          <p className="mt-3 rounded-2xl border-[3px] border-ink bg-accent p-3 text-lg">הגעתם ל־80% מהיעד</p>
        ) : null}
        {level === "reached" ? (
          <div className="mt-3 rounded-2xl border-[3px] border-ink bg-primary p-3 text-primary-ink">
            <p className="font-display text-2xl leading-none">הגעתם ליעד</p>
            {status === "live" ? <p className="mt-1 text-base">שום דבר לא נחסם. סוגרים את האירוע כשהוא נגמר.</p> : null}
          </div>
        ) : null}
      </div>
      {level === "reached" && status === "live" ? (
        <div className="mt-3">
          <CloseEventButton eventId={eventId} onClosed={onClosed} />
        </div>
      ) : null}
      {status === "closed" ? <p className="mt-3 text-base">האירוע סגור. מגנטים שכבר נשלחו ממשיכים להדפסה.</p> : null}
      {error ? (
        <p className="mt-2 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
