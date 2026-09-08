import type { TFunction } from "i18next";

/**
 * Was duplicated across ReportCard, ReportDetailPage, DashboardPage, and
 * FindingsPage — centralized here once translation made each copy need a
 * `t` function anyway. Pluralization (1 minute vs N minutes, and Arabic's
 * six-way plural) is handled by the `time.*Ago_*` keys in the locale files.
 */
export function formatRelativeTime(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("time.now");
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("time.daysAgo", { count: days });
}
