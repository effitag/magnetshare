import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  /** A print-station operator (admin_profiles role 'operator'). Admins are not operators. */
  isOperator: boolean;
  /** Signs in with Google and comes back to the given path (default /admin). */
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function anonymous(user: User | null | undefined): boolean {
  return user?.is_anonymous === true;
}

async function readIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

async function readIsOperator(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_operator");
  if (error) return false;
  return data === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    let active = true;

    function apply(next: Session | null) {
      setSession(next);
      if (!next?.user || anonymous(next.user)) {
        setIsAdmin(false);
        setIsOperator(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      void Promise.all([readIsAdmin(), readIsOperator()]).then(([admin, operator]) => {
        if (!active) return;
        setIsAdmin(admin);
        setIsOperator(operator);
        setLoading(false);
      });
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) apply(data.session);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setIsAdmin(false);
        setIsOperator(false);
        setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) apply(next);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      isAdmin: Boolean(session?.user) && !anonymous(session?.user) && isAdmin,
      isOperator: Boolean(session?.user) && !anonymous(session?.user) && isOperator,
      signInWithGoogle: async (returnTo = "/admin") => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}${returnTo}` },
        });
        if (error) throw error;
      },
      signOut: async () => {
        // Signs out on the server (every device). If that request fails, for
        // example offline, the local sign-out still removes the session stored
        // in this browser, so it does not come back on the next visit.
        const { error } = await supabase.auth.signOut();
        if (error) await supabase.auth.signOut({ scope: "local" });
      },
    }),
    [loading, session, isAdmin, isOperator],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
