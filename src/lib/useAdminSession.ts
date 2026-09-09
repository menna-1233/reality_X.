import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getAdminSession, onAdminSessionChange } from "./adminAuth";

export type AdminSessionStatus = "checking" | "in" | "out";

export interface AdminSessionState {
  status: AdminSessionStatus;
  /** The signed-in admin's email, or null while checking/signed out. */
  email: string | null;
}

/** Shared admin-session state — used by the route guard and the nav/sidebar. */
export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({ status: "checking", email: null });

  useEffect(() => {
    let active = true;
    function apply(session: Session | null) {
      if (active) setState({ status: session ? "in" : "out", email: session?.user.email ?? null });
    }
    getAdminSession().then(apply);
    const unsubscribe = onAdminSessionChange(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
