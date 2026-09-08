import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminSession } from "../lib/useAdminSession";

/**
 * Gates the admin-only screens (dashboard, findings). Citizens are never
 * routed through this — the report/feed pages are public and unwrapped.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const status = useAdminSession();

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        {t("requireAdmin.checking")}
      </div>
    );
  }
  if (status === "out") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
