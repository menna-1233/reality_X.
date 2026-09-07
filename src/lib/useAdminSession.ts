import { useEffect, useState } from "react";
import { getAdminSession, onAdminSessionChange } from "./adminAuth";

export type AdminSessionStatus = "checking" | "in" | "out";

/** Shared admin-session state — used by the route guard and the nav/sidebar. */
export function useAdminSession(): AdminSessionStatus {
  const [status, setStatus] = useState<AdminSessionStatus>("checking");

  useEffect(() => {
    let active = true;
    getAdminSession().then((session) => {
      if (active) setStatus(session ? "in" : "out");
    });
    const unsubscribe = onAdminSessionChange((session) => {
      if (active) setStatus(session ? "in" : "out");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
}
