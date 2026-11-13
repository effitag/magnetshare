import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeouts } from "@/lib/fetchTimeout";
import { browserStore, createSessionStore, moveGuestSession } from "@/lib/sessionStore";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase publishable configuration");
}

const ref = new URL(url).hostname.split(".")[0];

/** The same key supabase-js uses by default, named here so the stored session is easy to find. */
export const AUTH_STORAGE_KEY = `sb-${ref}-auth-token`;

/** Where the guest pages keep their own anonymous session, apart from the admin's. */
export const GUEST_AUTH_STORAGE_KEY = `sb-${ref}-guest-auth-token`;

// One session per browser (localStorage), shared by every tab. See sessionStore.ts.
const sessions = createSessionStore(browserStore("localStorage"), browserStore("sessionStorage"));

// Before either client reads its session: a guest saved under the shared key
// by an older build moves to the guest key, once.
moveGuestSession(sessions, AUTH_STORAGE_KEY, GUEST_AUTH_STORAGE_KEY);

/** The admin screens and the public site. An admin's Google session lives here. */
export const supabase = createClient(url, key, {
  // Every request gives up after a set time instead of hanging. See fetchTimeout.ts.
  global: { fetch: fetchWithTimeouts() },
  auth: {
    storage: sessions,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

/**
 * The guest pages (/e/:slug and its camera). They only ever use an anonymous
 * guest session of their own, so an admin signed in on the same browser stays
 * signed in as admin, and the guest pages never read with the admin's rights.
 */
export const guestSupabase = createClient(url, key, {
  global: { fetch: fetchWithTimeouts() },
  auth: {
    storage: sessions,
    storageKey: GUEST_AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
