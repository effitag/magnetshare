type Props = {
  /** replace: another frame. update: the same frame with the event's new name or date. */
  kind?: "replace" | "update";
  live: boolean;
  queued: number;
  onReplace: (moveQueued: boolean) => void;
  onCancel: () => void;
};

const button = "inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink px-4 text-base";

/**
 * Asked before a frame is replaced in a live event, or in any event with magnets still in the queue.
 * Printed and delivered magnets never change; queued ones move only if the admin says so.
 */
export function ReplaceDialog({ kind = "replace", live, queued, onReplace, onCancel }: Props) {
  const update = kind === "update";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="replace-title">
      <div className="sticker-card w-full max-w-md bg-sticker p-4 text-ink">
        <h2 id="replace-title" className="font-display text-2xl leading-none">
          {update ? "עדכון המסגרת לשם ולתאריך החדשים" : live ? "החלפת מסגרת באירוע חי" : "החלפת מסגרת"}
        </h2>
        {live ? (
          <p className="mt-3 text-base">
            אורחים חדשים יצלמו במסגרת {update ? "המעודכנת" : "החדשה"}. מגנטים שכבר הודפסו נשארים עם המסגרת שאיתה צולמו. אורח שבאמצע צילום יתבקש לצלם שוב.
          </p>
        ) : null}
        {queued > 0 ? (
          <p className="mt-3 text-base">
            {queued === 1 ? "מגנט אחד עוד לא הודפס." : `${queued} מגנטים עוד לא הודפסו.`} לעדכן גם {queued === 1 ? "אותו" : "אותם"} למסגרת החדשה?
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          {queued > 0 ? (
            <>
              <button type="button" className={`${button} bg-pop`} onClick={() => onReplace(true)}>
                {`${update ? "עדכון" : "החלפה"}, ${queued === 1 ? "כולל המגנט שבתור" : `כולל ${queued} המגנטים שבתור`}`}
              </button>
              <button type="button" className={button} onClick={() => onReplace(false)}>
                {update ? "עדכון" : "החלפה"} רק למגנטים חדשים
              </button>
            </>
          ) : (
            <button type="button" className={`${button} bg-pop`} onClick={() => onReplace(false)}>
              {update ? "עדכון" : "החלפה"}
            </button>
          )}
          <button type="button" className={button} onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
