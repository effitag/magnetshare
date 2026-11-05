import { useEffect, useState } from "react";
import type { AdminFrameChoice } from "@/services/api";

const fieldClass = "field-scroll sticker-card sticker-flat min-h-11 w-full bg-sticker px-3 text-base text-ink";

type Props = {
  frames: AdminFrameChoice[];
  value: string;
  pending: boolean;
  onChange: (frameId: string) => void;
  onDuplicate: (templateId: string) => void;
};

export function FramePicker({ frames, value, pending, onChange, onDuplicate }: Props) {
  const eventFrames = frames.filter((frame) => !frame.isTemplate);
  const templates = frames.filter((frame) => frame.isTemplate);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selected = eventFrames.find((frame) => frame.id === value);

  const firstTemplate = templates[0]?.id ?? "";

  useEffect(() => {
    if (!templateId && firstTemplate) setTemplateId(firstTemplate);
  }, [templateId, firstTemplate]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2 text-base text-ink">
        מסגרת
        <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">בחרו מסגרת לאירוע</option>
          {eventFrames.map((frame) => (
            <option key={frame.id} value={frame.id}>
              {frame.name}
              {frame.isPublished ? "" : " · לא פורסמה"}
            </option>
          ))}
        </select>
      </label>
      {selected && !selected.isPublished ? (
        <p className="text-base text-ink">המסגרת עדיין לא פורסמה. אפשר לשמור טיוטה, ואז לפרסם אותה.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-base text-ink">
          מתבנית
          <select
            className={fieldClass}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            disabled={templates.length === 0}
          >
            {templates.length === 0 ? <option value="">אין תבניות</option> : null}
            {templates.map((frame) => (
              <option key={frame.id} value={frame.id}>
                {frame.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink bg-sticker px-4 text-base text-ink"
          disabled={pending || !templateId}
          onClick={() => onDuplicate(templateId)}
        >
          {pending ? "יוצרים…" : "מסגרת לאירוע"}
        </button>
      </div>
    </div>
  );
}
