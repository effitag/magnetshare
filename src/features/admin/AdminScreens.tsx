import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { to: "/admin", label: "אירועים", end: true },
  { to: "/admin/queue", label: "תור הדפסה", end: false },
  { to: "/admin/frames", label: "מסגרות", end: false },
  { to: "/admin/leads", label: "פניות", end: false },
];

function GoogleMark() {
  return (
    <svg className="text-ink" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 11v2.8h4.4c-.2 1.2-1.4 3.4-4.4 3.4A5.1 5.1 0 1 1 12 7.1c1.5 0 2.5.6 3.1 1.2l2.1-2.1C15.9 4.8 14.1 4 12 4a8 8 0 1 0 0 16c4.6 0 7.6-3.2 7.6-7.8 0-.5 0-.9-.1-1.2H12Z" />
    </svg>
  );
}

export function AdminEmpty({ title }: { title: string }) {
  return (
    <section className="px-4 pt-8">
      <h1 className="font-display text-4xl leading-none text-ink">{title}</h1>
      <p className="mt-3 text-base text-ink">עוד אין כאן כלום.</p>
    </section>
  );
}

function AdminSignIn() {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGoogle() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("לא הצלחנו לפתוח את גוגל. נסו שוב.");
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <p className="font-display text-lg text-primary">MagnetimShare</p>
      <h1 className="mt-8 font-display text-4xl leading-none text-ink">כניסת מנהלים</h1>
      <p className="mt-3 text-base text-ink">רק עם חשבון גוגל מורשה.</p>
      <button
        type="button"
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[3px] border-ink bg-pop px-4 font-display text-xl text-ink shadow-[4px_4px_0_#1c1416]"
        onClick={onGoogle}
        disabled={pending}
      >
        <GoogleMark />
        {pending ? "פותחים…" : "כניסה עם גוגל"}
      </button>
      {error ? (
        <p className="mt-4 text-base text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function NoAccess() {
  const { signOut } = useAuth();
  return (
    <main className="min-h-screen bg-paper px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <p className="font-display text-lg text-primary">MagnetimShare</p>
      <h1 className="mt-8 font-display text-4xl leading-none text-ink">אין גישה</h1>
      <p className="mt-3 text-base text-ink">החשבון הזה לא יכול להיכנס לניהול.</p>
      <button
        type="button"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border-[3px] border-ink bg-sticker px-5 text-base text-ink"
        onClick={() => void signOut()}
      >
        יציאה
      </button>
    </main>
  );
}

function AdminShell() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const editingFrame = /^\/admin\/frames\/[^/]+/.test(pathname);
  return (
    <div
      className={
        editingFrame
          ? "h-dvh overflow-hidden bg-paper"
          : "min-h-screen bg-paper pt-[env(safe-area-inset-top,0px)] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
      }
    >
      {!editingFrame && (
        <header className="flex items-center justify-between px-4 pt-4">
          <p className="font-display text-lg text-primary">MagnetimShare</p>
          <button type="button" className="inline-flex min-h-11 items-center text-base text-ink" onClick={() => void signOut()}>
            יציאה
          </button>
        </header>
      )}
      <Outlet />
      {!editingFrame && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-ink bg-sticker pb-[env(safe-area-inset-bottom,0px)]" aria-label="ניהול">
          <ul className="flex">
            {tabs.map((tab) => (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center justify-center px-1 text-center text-base leading-tight ${isActive ? "bg-pop text-ink" : "text-ink"}`
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function AdminGate() {
  const { loading, user, isAdmin } = useAuth();
  if (!user && loading) return <LoadingScreen />;
  if (!user) return <AdminSignIn />;
  if (user.is_anonymous || !isAdmin) {
    if (!user.is_anonymous && loading) return <LoadingScreen />;
    return <NoAccess />;
  }
  return <AdminShell />;
}
