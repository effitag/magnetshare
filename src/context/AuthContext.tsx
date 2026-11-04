import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as api from "@/services/api";
import type { Profile } from "@/services/types";

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: typeof api.signUp;
  signIn: typeof api.signIn;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      setProfile(await api.fetchProfile(userId));
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api
      .getSession()
      .then((next) => {
        if (!active) return;
        setSession(next);
        if (next?.user) return loadProfile(next.user.id);
        return undefined;
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = api.onAuthChange((next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
      if (!next?.user) {
        setProfile(null);
        return;
      }
      const userId = next.user.id;
      window.setTimeout(() => {
        if (active) void loadProfile(userId);
      }, 0);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      signUp: api.signUp,
      signIn: api.signIn,
      signOut,
    }),
    [loading, session, profile, signOut],
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
