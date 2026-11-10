import { createClient } from "@supabase/supabase-js";
import { browserStore, createSessionStore } from "@/lib/sessionStore";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase publishable configuration");
}

/** The same key supabase-js uses by default, named here so the stored session is easy to find. */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient(url, key, {
  auth: {
    // One session per browser (localStorage), shared by every tab. See sessionStore.ts.
    storage: createSessionStore(browserStore("localStorage"), browserStore("sessionStorage")),
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
