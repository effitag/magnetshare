import { Link } from "react-router-dom";

const pages = {
  privacy: {
    title: "פרטיות",
    body: "טקסט זמני. הפרטים שמשאירים בטופס משמשים רק כדי לחזור אליכם. הנוסח הסופי יוחלף.",
  },
  terms: {
    title: "תנאים",
    body: "טקסט זמני. תנאי השימוש יוחלפו בנוסח הסופי לפני פרסום.",
  },
} as const;

export function LegalPage({ kind }: { kind: keyof typeof pages }) {
  const page = pages[kind];
  return (
    <main className="min-h-screen overflow-x-hidden bg-paper px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
      <Link to="/" className="inline-flex min-h-11 items-center font-display text-lg text-primary">
        MagnetimShare
      </Link>
      <h1 className="mt-6 font-display text-4xl leading-none text-ink">{page.title}</h1>
      <p className="mt-4 max-w-lg text-base text-ink">{page.body}</p>
    </main>
  );
}
