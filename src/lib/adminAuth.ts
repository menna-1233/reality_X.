import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/**
 * Thin wrapper around Supabase Auth for the admin-only login flow.
 * Regular citizens never call any of this — the report/feed screens work
 * with zero authentication.
 */

export async function signInAdmin(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOutAdmin(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getAdminSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAdminSessionChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** Bearer token to attach to admin-only API calls (see lib/api.ts). */
export async function getAdminAccessToken(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.access_token ?? null;
}
