import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase publishable configuration");
}

const sessionStorageAdapter = {
  getItem: (storageKey: string) => sessionStorage.getItem(storageKey),
  setItem: (storageKey: string, value: string) => sessionStorage.setItem(storageKey, value),
  removeItem: (storageKey: string) => sessionStorage.removeItem(storageKey),
};

export const supabase = createClient(url, key, {
  auth: {
    storage: sessionStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
