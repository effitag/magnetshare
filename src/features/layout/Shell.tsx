import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/cn";

type ShellProps = {
  children: ReactNode;
  width?: "narrow" | "wide";
};

export function Shell({ children, width = "wide" }: ShellProps) {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to={user ? "/dashboard" : "/"} className="text-lg font-semibold tracking-tight text-ink">
            MemoriaShare
          </Link>
          {user ? (
            <div className="flex items-center gap-1">
              <span className="hidden max-w-40 truncate text-sm text-muted sm:inline">
                {displayName(profile, user)}
              </span>
              <Link to="/dashboard" className="inline-flex min-h-11 items-center px-3 text-sm font-medium">
                האירועים
              </Link>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full text-ink"
                aria-label="התנתקות"
                onClick={() => void signOut()}
              >
                <LogOut className="size-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-ink"
            >
              התחברות
            </Link>
          )}
        </div>
      </header>
      <main className={cn("mx-auto px-4 py-8", width === "narrow" ? "max-w-lg" : "max-w-5xl")}>{children}</main>
    </div>
  );
}
