import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

async function readIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    function apply(next: Session | null) {
      setSession(next);
      if (!next?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      void readIsAdmin().then((admin) => {
        if (!active) return;
        setIsAdmin(admin);
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
      isAdmin,
    }),
    [loading, session, isAdmin],
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
