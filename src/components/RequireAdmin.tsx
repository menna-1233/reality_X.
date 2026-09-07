import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAdminSession, onAdminSessionChange } from "../lib/adminAuth";

/**
 * Gates the admin-only screens (dashboard, findings). Citizens are never
 * routed through this — the report/feed pages are public and unwrapped.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "in" | "out">("checking");

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

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">...جارٍ التحقق</div>;
  }
  if (status === "out") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
