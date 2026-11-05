import { Link } from "react-router-dom";

type Props = {
  mode: "live" | "missing" | "closed";
  title?: string;
  dateLabel?: string | null;
  coverUrl?: string | null;
  magnetsLeft?: number;
  inApp?: boolean;
  cameraTo?: string;
};

export function GuestLanding({ mode, title, dateLabel, coverUrl, magnetsLeft = 0, inApp = false, cameraTo }: Props) {
  if (mode === "missing") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-paper px-4 text-ink">
        <h1 className="font-display text-4xl leading-none">האירוע לא זמין</h1>
      </main>
    );
  }
  if (mode === "closed") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-paper px-4 text-ink">
        <h1 className="font-display text-4xl leading-none">האירוע הסתיים</h1>
      </main>
    );
  }

  const magnets = magnetsLeft === 1 ? "נשאר לכם מגנט אחד" : `נשארו לכם ${magnetsLeft} מגנטים`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-paper px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))] text-ink">
      {coverUrl ? (
        <img className="mx-auto h-52 w-full max-w-sm rounded-[1.25rem] border-[3px] border-ink object-cover shadow-[4px_4px_0_#1c1416]" src={coverUrl} alt="" />
      ) : (
        <div className="mx-auto flex h-52 w-full max-w-sm items-center justify-center rounded-[1.25rem] border-[3px] border-ink bg-pop shadow-[4px_4px_0_#1c1416]" aria-hidden="true">
          <span className="rotate-[-6deg] rounded-2xl border-[3px] border-ink bg-sticker px-6 py-8 font-display text-3xl">מגנט</span>
        </div>
      )}
      <h1 className="mt-6 font-display text-4xl leading-none">{title}</h1>
      {dateLabel ? <p className="mt-3 text-base">{dateLabel}</p> : null}
      <p className="mt-2 text-base">{magnets}</p>
      {inApp ? (
        <p className="mt-4 text-base">כדי לצלם בנוחות, פתחו את הקישור בספארי או בכרום. אפשר גם להמשיך כאן.</p>
      ) : null}
      <Link className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full border-[3px] border-ink bg-pop px-4 text-xl text-ink" to={cameraTo ?? "#"}>
        לצלם
      </Link>
      <p className="mt-6 text-base">
        <Link className="underline" to="/privacy">
          מדיניות הפרטיות
        </Link>
      </p>
    </main>
  );
}
