import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { counterLine, sentMagnets } from "@/lib/magnetTarget";
import { confirmPrint, listStationEvents, markDelivered, rejectJob, reopenJob } from "@/services/api";
import type { PrintJobStatus, StationEvent, StationJob } from "@/services/types";
import {
  folderSupported,
  pickHotFolder,
  readSettings,
  savedHotFolder,
  saveSettings,
  type StationSettings,
} from "./output";
import { CopiesStepper, JobCard, RejectDialog } from "./StationParts";
import { button, openRun } from "./stationJobs";
import { PrintDialog } from "./StationPrint";
import { useStationData } from "./useStationData";

const page = "min-h-screen bg-paper px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-ink";

function StationSignIn() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  return (
    <main className={page}>
      <p className="font-display text-lg text-primary">MagnetimShare</p>
      <h1 className="mt-8 font-display text-4xl leading-none">עמדת הדפסה</h1>
      <p className="mt-3 text-base">כניסה עם חשבון גוגל של מפעיל או מנהל.</p>
      <button
        type="button"
        className={`${button} mt-8 w-full bg-pop font-display text-xl`}
        onClick={() => signInWithGoogle("/station").catch(() => setError("לא הצלחנו לפתוח את גוגל. נסו שוב."))}
      >
        כניסה עם גוגל
      </button>
      {error ? (
        <p className="mt-4 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function StationNoAccess() {
  const { signOut } = useAuth();
  return (
    <main className={page}>
      <p className="font-display text-lg text-primary">MagnetimShare</p>
      <h1 className="mt-8 font-display text-4xl leading-none">אין גישה</h1>
      <p className="mt-3 text-base">החשבון הזה לא מוגדר כמפעיל עמדת הדפסה.</p>
      <button type="button" className={`${button} mt-8 bg-sticker`} onClick={() => void signOut()}>
        יציאה
      </button>
    </main>
  );
}

/** /station: signed-in admins and operators only. */
export function StationGate() {
  const { loading, user, isAdmin, isOperator, signOut } = useAuth();
  if (!user && loading) return <LoadingScreen />;
  if (!user) return <StationSignIn />;
  if (user.is_anonymous || !(isAdmin || isOperator)) {
    if (!user.is_anonymous && loading) return <LoadingScreen />;
    return <StationNoAccess />;
  }
  return (
    <div className={page}>
      <header className="flex items-center justify-between gap-3">
        <Link to="/station" className="font-display text-lg text-primary">
          עמדת הדפסה
        </Link>
        <button type="button" className="inline-flex min-h-11 items-center text-base" onClick={() => void signOut()}>
          יציאה
        </button>
      </header>
      <Outlet />
    </div>
  );
}

function StationSetup({ settings, onChange }: { settings: StationSettings; onChange: (next: StationSettings) => void }) {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPick = folderSupported();

  useEffect(() => {
    void savedHotFolder().then((folder) => setFolderName(folder?.name ?? null));
  }, []);

  const field = "min-h-11 w-full rounded-2xl border-[3px] border-ink bg-sticker px-3 text-base text-ink";
  return (
    <section className="sticker-card mt-4 bg-sticker p-4" aria-labelledby="setup-title">
      <h2 id="setup-title" className="font-display text-2xl leading-none">
        העמדה הזו
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-base">
          שם העמדה
          <input className={field} maxLength={40} value={settings.name} placeholder="עמדה 1" onChange={(e) => onChange({ ...settings, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          מדפסת (לא חובה)
          <input className={field} maxLength={40} value={settings.printer} placeholder="DS620" onChange={(e) => onChange({ ...settings, printer: e.target.value })} />
        </label>
      </div>
      <fieldset className="mt-3 flex flex-col gap-2 text-base">
        <legend className="mb-1">לאן נשלחים קובצי ההדפסה</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="output" checked={settings.output === "folder"} disabled={!canPick} onChange={() => onChange({ ...settings, output: "folder" })} />
          תיקיית ההדפסה של DNP {canPick ? "" : "(דורש Chrome במחשב)"}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="output" checked={settings.output === "download"} onChange={() => onChange({ ...settings, output: "download" })} />
          הורדות של Chrome
        </label>
      </fieldset>
      {settings.output === "folder" ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-base">
          <span>{folderName ? `תיקייה: ${folderName}` : "עוד לא נבחרה תיקייה"}</span>
          <button
            type="button"
            className={`${button} bg-sticker`}
            disabled={!canPick}
            onClick={async () => {
              setError(null);
              try {
                setFolderName((await pickHotFolder()).name);
              } catch {
                setError("לא נבחרה תיקייה.");
              }
            }}
          >
            {folderName ? "החלפת תיקייה" : "בחירת תיקייה"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** /station: this laptop's settings, then the events to work on. */
export function StationHome() {
  const [settings, setSettings] = useState(readSettings);
  const [events, setEvents] = useState<StationEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStationEvents()
      .then(setEvents)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  function change(next: StationSettings) {
    setSettings(next);
    saveSettings(next);
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <StationSetup settings={settings} onChange={change} />
      <h1 className="mt-6 font-display text-4xl leading-none">אירועים</h1>
      {error ? <p className="mt-3 text-base text-primary">{error}</p> : null}
      {events && !events.length ? <p className="mt-3 text-base">אין אירועים פתוחים לעמדה הזו.</p> : null}
      {!events && !error ? <p className="mt-3 text-base">טוענים…</p> : null}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {(events ?? []).map((event) => (
          <li key={event.id}>
            <Link to={`/station/${event.id}`} className="sticker-card block min-h-11 bg-sticker p-4">
              <span className="block text-lg">{event.title}</span>
              <span className="mt-1 block text-base">{event.status === "live" ? "חי" : "נסגר"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

const TABS: { status: PrintJobStatus; label: string }[] = [
  { status: "queued", label: "בתור" },
  { status: "printing", label: "בהדפסה" },
  { status: "ready", label: "מוכנים לאיסוף" },
  { status: "delivered", label: "נמסרו" },
  { status: "rejected", label: "נדחו" },
];

type PrintRequest = { job: StationJob; kind: "print" | "reprint"; copies: number };

/** /station/:eventId: the queue, printing, pickup, delivered and rejected. */
export function StationEventPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const data = useStationData(eventId);
  const [tab, setTab] = useState<PrintJobStatus>("queued");
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [printing, setPrinting] = useState<PrintRequest | null>(null);
  const [rejecting, setRejecting] = useState<StationJob | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [settings] = useState(readSettings);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const byStatus = useMemo(() => {
    const groups = new Map<PrintJobStatus, StationJob[]>(TABS.map((t) => [t.status, []]));
    for (const job of data.jobs) groups.get(job.status)?.push(job);
    // Newest first for the closed tabs; the queue stays oldest first.
    for (const status of ["delivered", "rejected"] as const) groups.get(status)?.reverse();
    return groups;
  }, [data.jobs]);

  const visible = byStatus.get(tab) ?? [];
  const readyIds = new Set((byStatus.get("ready") ?? []).map((job) => job.id));
  const chosen = [...selected].filter((id) => readyIds.has(id));

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      await run();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "הפעולה לא הצליחה.");
    } finally {
      setBusy(false);
      await data.refresh();
    }
  }

  function askPrint(job: StationJob, kind: "print" | "reprint") {
    if (!job.frameId || !data.frames.get(job.frameId)) {
      setNotice("לא מצאנו את מסגרת המגנט הזה.");
      return;
    }
    setPrinting({ job, kind, copies: kind === "print" ? (copies[job.id] ?? 1) : 1 });
  }

  if (!data.loaded) return <p className="mt-6 text-base">טוענים…</p>;
  if (!data.event) {
    return (
      <main className="mt-6">
        <p className="text-base">{data.error ?? "האירוע לא נמצא, או שאין לכם הרשאה אליו."}</p>
        <button type="button" className={`${button} mt-4 bg-sticker`} onClick={() => navigate("/station")}>
          לאירועים
        </button>
      </main>
    );
  }

  const physical = data.counts ? sentMagnets(data.counts) : null;
  const printFrame = printing?.job.frameId ? data.frames.get(printing.job.frameId) ?? null : null;

  return (
    <main className="mx-auto w-full max-w-6xl">
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none sm:text-4xl">{data.event.title}</h1>
          <p className="mt-1 text-base">
            {physical === null ? "" : counterLine(physical, data.event.magnetTarget)}
            {data.event.status === "closed" ? " · האירוע סגור, ממשיכים להדפיס את מה שנשלח" : ""}
          </p>
        </div>
        <p className="text-base">
          {settings.name ? `עמדה: ${settings.name}` : <Link to="/station" className="text-primary underline">קבעו שם לעמדה</Link>}
          {" · "}
          {settings.output === "folder" ? "תיקיית הדפסה" : "הורדות"}
        </p>
      </div>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="מצב המגנטים">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            className={`${button} shrink-0 ${tab === t.status ? "bg-pop" : "bg-sticker"}`}
            aria-pressed={tab === t.status}
            onClick={() => setTab(t.status)}
          >
            {t.label} ({byStatus.get(t.status)?.length ?? 0})
          </button>
        ))}
      </nav>

      {notice || data.error ? (
        <p className="mt-3 text-base text-primary" role="alert">
          {notice ?? data.error}
        </p>
      ) : null}

      {tab === "ready" && chosen.length ? (
        <button type="button" className={`${button} mt-3 bg-pop`} disabled={busy} onClick={() => void act(async () => {
          await markDelivered(chosen);
          setSelected(new Set());
        })}>
          נמסרו המסומנים ({chosen.length})
        </button>
      ) : null}

      {!visible.length ? <p className="mt-6 text-base">אין כאן מגנטים.</p> : null}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((job) => {
          const frame = job.frameId ? data.frames.get(job.frameId) ?? null : null;
          const run = openRun(data.runs, job.id);
          const open = job.status === "queued" || job.status === "printing" || job.status === "ready";
          return (
            <JobCard
              key={job.id}
              job={job}
              frame={frame}
              runs={data.runs}
              now={now}
              selected={job.status === "ready" ? selected.has(job.id) : undefined}
              onSelect={
                job.status === "ready" && !run
                  ? (on) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (on) next.add(job.id);
                        else next.delete(job.id);
                        return next;
                      })
                  : undefined
              }
              onKey={open && !run ? (key) => (key === "print" && job.status === "queued" ? askPrint(job, "print") : key === "reject" ? setRejecting(job) : undefined) : undefined}
            >
              {run ? (
                <>
                  <button type="button" className={`${button} bg-pop`} disabled={busy} onClick={() => void act(() => confirmPrint(run.id, true))}>
                    הודפס
                  </button>
                  <button type="button" className={`${button} bg-sticker`} disabled={busy} onClick={() => void act(() => confirmPrint(run.id, false))}>
                    נכשל
                  </button>
                </>
              ) : null}
              {job.status === "queued" ? (
                <>
                  <CopiesStepper value={copies[job.id] ?? 1} onChange={(n) => setCopies((c) => ({ ...c, [job.id]: n }))} label="עותקים" />
                  <button type="button" className={`${button} bg-pop`} onClick={() => askPrint(job, "print")}>
                    הדפסה
                  </button>
                </>
              ) : null}
              {job.status === "printing" && !run ? (
                <button type="button" className={`${button} bg-pop`} onClick={() => askPrint(job, "print")}>
                  הדפסה חוזרת
                </button>
              ) : null}
              {job.status === "ready" && !run ? (
                <>
                  <button type="button" className={`${button} bg-pop`} disabled={busy} onClick={() => void act(() => markDelivered([job.id]))}>
                    נמסר
                  </button>
                  <button type="button" className={`${button} bg-sticker`} onClick={() => askPrint(job, "print")}>
                    עוד עותקים
                  </button>
                  <button type="button" className={`${button} bg-sticker`} onClick={() => askPrint(job, "reprint")}>
                    הדפסה מחדש
                  </button>
                </>
              ) : null}
              {open && !run ? (
                <button type="button" className={`${button} bg-sticker`} onClick={() => setRejecting(job)}>
                  דחייה
                </button>
              ) : null}
              {!open && isAdmin ? (
                <button type="button" className={`${button} bg-sticker`} disabled={busy} onClick={() => void act(() => reopenJob(job.id))}>
                  ביטול (מנהל)
                </button>
              ) : null}
            </JobCard>
          );
        })}
      </ul>

      {printing && printFrame ? (
        <PrintDialog
          job={printing.job}
          frame={printFrame}
          eventSlug={data.event.slug}
          kind={printing.kind}
          initialCopies={printing.copies}
          settings={settings}
          onClose={() => setPrinting(null)}
          onDone={() => void data.refresh()}
        />
      ) : null}
      {rejecting ? (
        <RejectDialog
          onClose={() => setRejecting(null)}
          onReject={async (reason) => {
            await rejectJob(rejecting.id, reason);
            await data.refresh();
          }}
        />
      ) : null}
    </main>
  );
}
