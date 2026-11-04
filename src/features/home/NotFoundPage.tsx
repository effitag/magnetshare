import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <h1 className="text-3xl font-semibold">העמוד לא נמצא</h1>
      <p className="mt-2 text-muted">הקישור לא מוביל למסך קיים. חזרו לדף הבית ונסו משם.</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 w-fit items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-ink"
      >
        לדף הבית
      </Link>
    </div>
  );
}
