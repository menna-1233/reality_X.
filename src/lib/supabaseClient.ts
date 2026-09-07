import { createClient } from "@supabase/supabase-js";

/**
 * Used only for admin authentication (email/password sign-in). Citizens
 * never touch this — reporting and browsing the feed go straight through
 * the backend API (see api.ts) with no login at all.
 *
 * The anon/publishable key is safe to ship to the browser — it has no
 * elevated access; Row Level Security plus the backend's own admin check
 * (see backend/app/auth.py) are what actually gate admin actions.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — admin login is disabled.",
  );
}
