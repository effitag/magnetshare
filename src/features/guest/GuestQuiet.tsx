import { Link } from "react-router-dom";

const copy = {
  missing: {
    title: "האירוע לא זמין",
    line: "הקישור הזה עוד לא פותח אירוע. אם קיבלתם אותו עכשיו, נסו שוב בעוד רגע.",
  },
  closed: {
    title: "האירוע הסתיים",
    line: "תודה שהייתם חלק מהרגע. אי אפשר להוסיף עוד תמונות לאירוע הזה.",
  },
} as const;

export function GuestQuiet({ mode }: { mode: "missing" | "closed" }) {
  const text = copy[mode];
  return (
    <main className="guest-quiet">
      <div className="guest-fallback" aria-hidden="true" />
      <div className="guest-quiet-card">
        <h1 className="guest-name">{text.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-ink">{text.line}</p>
        <Link className="guest-home" to="/">
          לעמוד הבית
        </Link>
      </div>
    </main>
  );
}
