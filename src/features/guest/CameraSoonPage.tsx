import { Link, useParams } from "react-router-dom";

export function CameraSoonPage() {
  const { slug = "" } = useParams();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-paper px-4 text-ink">
      <h1 className="font-display text-4xl leading-none">המצלמה בדרך</h1>
      <Link className="mt-6 inline-flex min-h-12 items-center text-base underline" to={`/e/${slug}`}>
        חזרה לאירוע
      </Link>
    </main>
  );
}
