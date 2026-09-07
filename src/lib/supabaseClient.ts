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

// Fallback to the project's real anon/publishable key when no local .env is
// set — safe to ship (see .env.example), and means admin login works out of
// the box without every contributor needing their own Supabase setup.
const FALLBACK_SUPABASE_URL = "https://ccvdyifhquvcdixaqpat.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_wo3XHW100Qtq4bCEIOVLBQ_aEUR64Hd";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
