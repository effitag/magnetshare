export default function DesktopOnlyNote({ onBack }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-base leading-relaxed text-ink">עריכת המסגרת זמינה במחשב</p>
      {onBack && (
        <button type="button" className="mt-4 inline-flex min-h-11 items-center text-base text-ink" onClick={onBack}>
          חזרה לרשימה
        </button>
      )}
    </div>
  );
}
